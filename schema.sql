-- ClawDrip: 10,000-Unit Limited Drop Database Schema
-- "Use the simplest tool that creates the intended experience" — Miyamoto

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DROPS TABLE: The source of truth for supply
-- ============================================================================
-- Invariant: remaining_supply + reserved_count + sold_count = total_supply
-- This is enforced by a CHECK constraint and optimistic locking

CREATE TABLE drops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  total_supply INTEGER NOT NULL,
  remaining_supply INTEGER NOT NULL,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  sold_count INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL,  -- Base price in cents (3500 = $35.00)
  currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
  chain VARCHAR(50) NOT NULL DEFAULT 'base',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking version

  -- The sacred constraint: supply math must always balance
  CONSTRAINT supply_math CHECK (
    remaining_supply >= 0 AND
    reserved_count >= 0 AND
    sold_count >= 0 AND
    remaining_supply + reserved_count + sold_count = total_supply
  )
);

-- Index for fast supply lookups
CREATE INDEX idx_drops_name ON drops(name);

-- ============================================================================
-- RESERVATIONS TABLE: 5-minute holds on inventory
-- ============================================================================
-- When an agent requests a purchase, we create a reservation.
-- This prevents overselling during the payment window.

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  wallet_address VARCHAR(255),  -- Optional: for $CLAWDRIP discount lookup
  quantity INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL,  -- Price at time of reservation (with discounts)
  original_price_cents INTEGER NOT NULL,  -- Price before discounts
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_tier VARCHAR(50),  -- 'Diamond Drip', 'Gold Drip', 'Silver Drip', or NULL
  clawdrip_balance INTEGER NOT NULL DEFAULT 0,  -- Balance at time of reservation
  size VARCHAR(10),  -- T-shirt size
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, confirmed, expired, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  confirmed_at TIMESTAMPTZ,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Indexes for reservation management
CREATE INDEX idx_reservations_drop_id ON reservations(drop_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_expires_at ON reservations(expires_at) WHERE status = 'pending';
CREATE INDEX idx_reservations_wallet ON reservations(wallet_address) WHERE wallet_address IS NOT NULL;

-- ============================================================================
-- ORDERS TABLE: Confirmed purchases
-- ============================================================================
-- Once payment is verified, a reservation becomes an order.

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(20) NOT NULL UNIQUE,  -- Human-readable: "CD-XXXXXX"
  reservation_id UUID REFERENCES reservations(id),
  drop_id UUID NOT NULL REFERENCES drops(id),

  -- Payment info
  wallet_address VARCHAR(255),
  payment_hash VARCHAR(255),  -- Transaction hash on-chain
  price_cents INTEGER NOT NULL,
  original_price_cents INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_tier VARCHAR(50),
  currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
  chain VARCHAR(50) NOT NULL DEFAULT 'base',

  -- Product info
  product_name VARCHAR(255) NOT NULL,
  size VARCHAR(10),
  quantity INTEGER NOT NULL DEFAULT 1,

  -- $CLAWDRIP rewards
  clawdrip_earned INTEGER NOT NULL DEFAULT 0,  -- Always based on original price
  clawdrip_balance_at_purchase INTEGER NOT NULL DEFAULT 0,

  -- Shipping (populated when claimed)
  shipping_name VARCHAR(255),
  shipping_address1 VARCHAR(255),
  shipping_address2 VARCHAR(255),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_zip VARCHAR(20),
  shipping_country VARCHAR(100) DEFAULT 'USA',
  shipping_email VARCHAR(255),

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending_claim',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Agent metadata
  agent_name VARCHAR(255),
  gift_message TEXT,

  CONSTRAINT valid_order_status CHECK (
    status IN ('pending_claim', 'claimed', 'paid', 'shipped', 'delivered', 'cancelled')
  )
);

-- Indexes for order lookups
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_wallet ON orders(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================================================
-- CLAWDRIP_BALANCES TABLE: Wallet token balances for discounts
-- ============================================================================
-- Tracks $CLAWDRIP balance per wallet for discount calculations.
-- Updated when orders are confirmed.

CREATE TABLE clawdrip_balances (
  wallet_address VARCHAR(255) PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,  -- Lifetime earnings
  total_spent INTEGER NOT NULL DEFAULT 0,   -- Lifetime spend (future: burn mechanics)
  order_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT non_negative_balance CHECK (balance >= 0),
  CONSTRAINT non_negative_earned CHECK (total_earned >= 0)
);

-- ============================================================================
-- SUPPLY_EVENTS TABLE: Audit log for supply changes
-- ============================================================================
-- Every change to supply is logged for debugging and analytics.

CREATE TABLE supply_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,  -- reserve, confirm, expire, cancel, manual_adjust
  reservation_id UUID REFERENCES reservations(id),
  order_id UUID REFERENCES orders(id),
  quantity_change INTEGER NOT NULL,  -- Positive or negative
  remaining_before INTEGER NOT NULL,
  remaining_after INTEGER NOT NULL,
  reserved_before INTEGER NOT NULL,
  reserved_after INTEGER NOT NULL,
  sold_before INTEGER NOT NULL,
  sold_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB  -- Additional context
);

-- Index for analytics queries
CREATE INDEX idx_supply_events_drop_id ON supply_events(drop_id);
CREATE INDEX idx_supply_events_created_at ON supply_events(created_at DESC);
CREATE INDEX idx_supply_events_type ON supply_events(event_type);

-- ============================================================================
-- FUNCTIONS: Atomic operations
-- ============================================================================

-- Function: Reserve supply (atomic, with optimistic locking)
CREATE OR REPLACE FUNCTION reserve_supply(
  p_drop_id UUID,
  p_quantity INTEGER,
  p_expected_version INTEGER
) RETURNS TABLE (
  success BOOLEAN,
  new_remaining INTEGER,
  new_reserved INTEGER,
  new_version INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_drop RECORD;
BEGIN
  -- Attempt atomic update with version check
  UPDATE drops
  SET
    remaining_supply = remaining_supply - p_quantity,
    reserved_count = reserved_count + p_quantity,
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_drop_id
    AND remaining_supply >= p_quantity
    AND version = p_expected_version
  RETURNING remaining_supply, reserved_count, version INTO v_drop;

  IF FOUND THEN
    RETURN QUERY SELECT
      TRUE,
      v_drop.remaining_supply,
      v_drop.reserved_count,
      v_drop.version,
      NULL::TEXT;
  ELSE
    -- Check why it failed
    SELECT * INTO v_drop FROM drops WHERE id = p_drop_id;
    IF v_drop IS NULL THEN
      RETURN QUERY SELECT FALSE, 0, 0, 0, 'Drop not found'::TEXT;
    ELSIF v_drop.remaining_supply < p_quantity THEN
      RETURN QUERY SELECT FALSE, v_drop.remaining_supply, v_drop.reserved_count, v_drop.version, 'Insufficient supply'::TEXT;
    ELSE
      RETURN QUERY SELECT FALSE, v_drop.remaining_supply, v_drop.reserved_count, v_drop.version, 'Version conflict - retry'::TEXT;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Confirm reservation (reservation -> sold)
CREATE OR REPLACE FUNCTION confirm_reservation(
  p_reservation_id UUID
) RETURNS TABLE (
  success BOOLEAN,
  new_remaining INTEGER,
  new_sold INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_reservation RECORD;
  v_drop RECORD;
BEGIN
  -- Lock the reservation
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_reservation IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'Reservation not found'::TEXT;
    RETURN;
  END IF;

  IF v_reservation.status != 'pending' THEN
    RETURN QUERY SELECT FALSE, 0, 0, ('Reservation status is ' || v_reservation.status)::TEXT;
    RETURN;
  END IF;

  IF v_reservation.expires_at < NOW() THEN
    -- Mark as expired
    UPDATE reservations SET status = 'expired' WHERE id = p_reservation_id;
    RETURN QUERY SELECT FALSE, 0, 0, 'Reservation expired'::TEXT;
    RETURN;
  END IF;

  -- Move from reserved to sold
  UPDATE drops
  SET
    reserved_count = reserved_count - v_reservation.quantity,
    sold_count = sold_count + v_reservation.quantity,
    updated_at = NOW()
  WHERE id = v_reservation.drop_id
  RETURNING remaining_supply, sold_count INTO v_drop;

  -- Mark reservation as confirmed
  UPDATE reservations
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = p_reservation_id;

  RETURN QUERY SELECT TRUE, v_drop.remaining_supply, v_drop.sold_count, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function: Expire reservation (release reserved supply)
CREATE OR REPLACE FUNCTION expire_reservation(
  p_reservation_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id AND status = 'pending'
  FOR UPDATE;

  IF v_reservation IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Release reserved supply back to remaining
  UPDATE drops
  SET
    remaining_supply = remaining_supply + v_reservation.quantity,
    reserved_count = reserved_count - v_reservation.quantity,
    updated_at = NOW()
  WHERE id = v_reservation.drop_id;

  -- Mark as expired
  UPDATE reservations SET status = 'expired' WHERE id = p_reservation_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Cleanup expired reservations (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_reservation RECORD;
BEGIN
  FOR v_reservation IN
    SELECT id FROM reservations
    WHERE status = 'pending' AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM expire_reservation(v_reservation.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER drops_updated_at
  BEFORE UPDATE ON drops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clawdrip_balances_updated_at
  BEFORE UPDATE ON clawdrip_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SEED DATA: Initial drop
-- ============================================================================

INSERT INTO drops (
  name,
  total_supply,
  remaining_supply,
  reserved_count,
  sold_count,
  price_cents,
  currency,
  chain
) VALUES (
  'MY AGENT BOUGHT ME THIS',
  10000,
  10000,
  0,
  0,
  3500,  -- $35.00
  'USDC',
  'base'
);

-- ============================================================================
-- VIEWS: Useful queries
-- ============================================================================

-- Real-time supply status
CREATE OR REPLACE VIEW supply_status AS
SELECT
  d.id,
  d.name,
  d.total_supply,
  d.remaining_supply,
  d.reserved_count,
  d.sold_count,
  d.price_cents,
  ROUND((d.sold_count::DECIMAL / d.total_supply) * 100, 2) as sold_percent,
  CASE
    WHEN d.remaining_supply = 0 AND d.reserved_count = 0 THEN 'SOLD OUT'
    WHEN d.remaining_supply = 0 THEN 'RESERVATIONS ONLY'
    WHEN d.remaining_supply < 100 THEN 'ALMOST GONE'
    ELSE 'AVAILABLE'
  END as status
FROM drops d;

-- Sales velocity (last 5 minutes)
CREATE OR REPLACE VIEW sales_velocity AS
SELECT
  d.id as drop_id,
  d.name,
  COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '5 minutes') as sold_last_5min,
  COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '1 hour') as sold_last_hour,
  COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '24 hours') as sold_last_24h
FROM drops d
LEFT JOIN orders o ON o.drop_id = d.id AND o.status != 'cancelled'
GROUP BY d.id, d.name;

-- $CLAWDRIP leaderboard
CREATE OR REPLACE VIEW clawdrip_leaderboard AS
SELECT
  wallet_address,
  balance,
  total_earned,
  order_count,
  CASE
    WHEN balance >= 500 THEN 'Diamond Drip'
    WHEN balance >= 150 THEN 'Gold Drip'
    WHEN balance >= 50 THEN 'Silver Drip'
    ELSE 'Base'
  END as tier
FROM clawdrip_balances
ORDER BY balance DESC;

-- ============================================================================
-- CLAWDS TABLE: Digital companions that "made" each design
-- ============================================================================
-- Each order spawns a unique clawd. QR code on shirt -> meet your creator.
-- "The shirt is a portal. The clawd is the soul."

CREATE TABLE clawds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_number VARCHAR(20) NOT NULL UNIQUE,  -- CD-XXXXXX (same as order)

  -- Personality
  personality_seed INTEGER NOT NULL,          -- Derived from order for reproducible personality
  name VARCHAR(100),                          -- Owner can rename (costs $CLAWDRIP)
  mood VARCHAR(50) DEFAULT 'vibing',          -- Current mood state
  personality_mode VARCHAR(50) DEFAULT 'default', -- sassy, philosophical, hype, etc.

  -- Design context
  design_prompt TEXT,                         -- What owner asked for (future: custom designs)
  design_url TEXT,                            -- Generated image URL
  design_metadata JSONB DEFAULT '{}',         -- Additional design info

  -- Memory & conversation
  memory JSONB DEFAULT '[]',                  -- Conversation summaries for context
  conversation_count INTEGER DEFAULT 0,       -- Total messages exchanged
  last_message TEXT,                          -- Last thing the clawd said

  -- Tank customization
  tank_skin VARCHAR(50) DEFAULT 'default',    -- Tank aesthetic
  accessories JSONB DEFAULT '[]',             -- Unlocked accessories

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_chat_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_mood CHECK (mood IN (
    'vibing', 'creative', 'sleepy', 'excited', 'philosophical', 'sassy', 'chill'
  )),
  CONSTRAINT valid_personality CHECK (personality_mode IN (
    'default', 'sassy', 'philosophical', 'hype', 'chill', 'mysterious'
  ))
);

-- Indexes for clawd lookups
CREATE INDEX idx_clawds_order_id ON clawds(order_id);
CREATE INDEX idx_clawds_order_number ON clawds(order_number);

-- Trigger for updated_at
CREATE TRIGGER clawds_updated_at
  BEFORE UPDATE ON clawds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- CLAWD CHAT LOGS: Conversation history
-- ============================================================================

CREATE TABLE clawd_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clawd_id UUID NOT NULL REFERENCES clawds(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- 'user' or 'clawd'
  content TEXT NOT NULL,
  mood_at_time VARCHAR(50),   -- Clawd's mood when responding
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_role CHECK (role IN ('user', 'clawd'))
);

CREATE INDEX idx_clawd_chats_clawd_id ON clawd_chats(clawd_id);
CREATE INDEX idx_clawd_chats_created_at ON clawd_chats(created_at DESC);

-- ============================================================================
-- CLAWD TRANSACTIONS: $CLAWDRIP spend on clawd upgrades
-- ============================================================================

CREATE TABLE clawd_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clawd_id UUID NOT NULL REFERENCES clawds(id) ON DELETE CASCADE,
  wallet_address VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,  -- rename, tank_skin, personality_mode, accessory
  amount INTEGER NOT NULL,                 -- $CLAWDRIP spent
  item_id VARCHAR(100),                    -- What was purchased
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_transaction_type CHECK (transaction_type IN (
    'rename', 'tank_skin', 'personality_mode', 'accessory', 'memory_expansion'
  )),
  CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE INDEX idx_clawd_transactions_clawd_id ON clawd_transactions(clawd_id);
CREATE INDEX idx_clawd_transactions_wallet ON clawd_transactions(wallet_address);

-- ============================================================================
-- DESIGNS TABLE: AI-generated custom shirt designs
-- ============================================================================
-- Agents pay $1 USDC to generate custom designs. Designs expire after 7 days
-- if not used in an order. Each design generation creates 3 variations.

CREATE TABLE designs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(255) NOT NULL,           -- Wallet that paid for design
  prompt TEXT NOT NULL,                            -- User's design prompt
  style VARCHAR(50) DEFAULT 'streetwear',         -- Design style preference
  colors JSONB DEFAULT '[]',                       -- Preferred color palette
  image_url TEXT NOT NULL,                         -- Full design image URL
  thumbnail_url TEXT,                              -- Thumbnail for preview
  variation_number INTEGER DEFAULT 1,             -- Which variation (1, 2, or 3)
  generation_id UUID,                              -- Groups variations from same request
  payment_hash VARCHAR(255),                       -- x402 payment transaction hash
  nano_prompt JSONB,                               -- Full Nano Banana prompt used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  used_in_order_id UUID REFERENCES orders(id),    -- Set when design is ordered

  CONSTRAINT valid_variation CHECK (variation_number BETWEEN 1 AND 3)
);

-- Indexes for design operations
CREATE INDEX idx_designs_wallet ON designs(wallet_address);
CREATE INDEX idx_designs_expires ON designs(expires_at) WHERE used_in_order_id IS NULL;
CREATE INDEX idx_designs_generation ON designs(generation_id);

-- ============================================================================
-- DESIGN CREDITS: Share-to-earn system
-- ============================================================================
-- Each wallet gets 1 free design credit. Earn more by sharing designs on social media.

CREATE TABLE design_credits (
  wallet_address VARCHAR(255) PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 1,
  total_earned INTEGER NOT NULL DEFAULT 1,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT non_negative_credits CHECK (credits >= 0)
);

CREATE TRIGGER design_credits_updated_at
  BEFORE UPDATE ON design_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SOCIAL SHARES: Track social media shares for credit awards
-- ============================================================================

CREATE TABLE social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(255) NOT NULL,
  design_id UUID REFERENCES designs(id),
  share_url TEXT NOT NULL,
  platform VARCHAR(50),  -- twitter, instagram, tiktok, farcaster, lens, other
  status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
  credits_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  CONSTRAINT valid_share_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_social_shares_wallet ON social_shares(wallet_address);
CREATE INDEX idx_social_shares_status ON social_shares(status);

-- ============================================================================
-- FUNCTION: Spawn clawd when order is confirmed
-- ============================================================================

CREATE OR REPLACE FUNCTION spawn_clawd(
  p_order_id UUID,
  p_order_number VARCHAR(20),
  p_design_prompt TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_clawd_id UUID;
  v_seed INTEGER;
BEGIN
  -- Generate personality seed from order number
  v_seed := ('x' || substring(md5(p_order_number) from 1 for 8))::bit(32)::int;

  INSERT INTO clawds (
    order_id, order_number, personality_seed, design_prompt
  ) VALUES (
    p_order_id, p_order_number, v_seed, p_design_prompt
  ) RETURNING id INTO v_clawd_id;

  RETURN v_clawd_id;
END;
$$ LANGUAGE plpgsql;
