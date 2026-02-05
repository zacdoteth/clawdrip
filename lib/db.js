/**
 * ClawDrip Database Library
 *
 * PostgreSQL connection pool and query helpers for atomic operations.
 * "Shopify-fast" — all lookups < 50ms, all writes atomic.
 */

import pg from 'pg';
const { Pool } = pg;

// Connection pool (reused across requests)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
});

// Log connection errors
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

/**
 * Execute a query with automatic connection handling
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (duration > 100) {
    console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
  }

  return result;
}

/**
 * Get a client for transactions
 */
export async function getClient() {
  return pool.connect();
}

// ============================================================================
// DROP OPERATIONS
// ============================================================================

/**
 * Get drop by ID with current supply status
 */
export async function getDrop(dropId) {
  const result = await query(
    `SELECT * FROM drops WHERE id = $1`,
    [dropId]
  );
  return result.rows[0] || null;
}

/**
 * Get the current/active drop (assumes single drop for now)
 */
export async function getCurrentDrop() {
  const result = await query(
    `SELECT * FROM drops ORDER BY created_at DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Get supply status with velocity metrics
 */
export async function getSupplyStatus(dropId) {
  const result = await query(
    `SELECT
      d.*,
      COALESCE(v.sold_last_5min, 0) as sold_last_5min,
      COALESCE(v.sold_last_hour, 0) as sold_last_hour
    FROM drops d
    LEFT JOIN sales_velocity v ON v.drop_id = d.id
    WHERE d.id = $1`,
    [dropId]
  );
  return result.rows[0] || null;
}

// ============================================================================
// RESERVATION OPERATIONS
// ============================================================================

/**
 * Create a reservation (atomic supply decrement)
 *
 * @param {Object} options
 * @param {string} options.dropId - Drop to reserve from
 * @param {number} options.quantity - Number to reserve (default 1)
 * @param {string} options.walletAddress - Wallet for $CLAW lookup
 * @param {string} options.size - T-shirt size
 * @param {number} options.priceCents - Final price after discounts
 * @param {number} options.originalPriceCents - Price before discounts
 * @param {number} options.discountPercent - Discount percentage applied
 * @param {string} options.discountTier - Tier name if discount applied
 * @param {number} options.clawdripBalance - CLAWDRIP balance at reservation time
 *
 * @returns {Object} { success, reservation, error }
 */
export async function createReservation({
  dropId,
  quantity = 1,
  walletAddress,
  size,
  priceCents,
  originalPriceCents,
  discountPercent = 0,
  discountTier = null,
  clawdripBalance = 0
}) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get current drop with lock
    const dropResult = await client.query(
      `SELECT * FROM drops WHERE id = $1 FOR UPDATE`,
      [dropId]
    );

    const drop = dropResult.rows[0];
    if (!drop) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Drop not found' };
    }

    // Attempt atomic reservation
    const reserveResult = await client.query(
      `SELECT * FROM reserve_supply($1, $2, $3)`,
      [dropId, quantity, drop.version]
    );

    const result = reserveResult.rows[0];
    if (!result.success) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: result.error_message,
        remaining: result.new_remaining
      };
    }

    // Create reservation record
    const reservationResult = await client.query(
      `INSERT INTO reservations (
        drop_id, wallet_address, quantity, price_cents, original_price_cents,
        discount_percent, discount_tier, clawdrip_balance, size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dropId, walletAddress, quantity, priceCents, originalPriceCents,
        discountPercent, discountTier, clawdripBalance, size
      ]
    );

    // Log the event
    await client.query(
      `INSERT INTO supply_events (
        drop_id, event_type, reservation_id, quantity_change,
        remaining_before, remaining_after, reserved_before, reserved_after,
        sold_before, sold_after
      ) VALUES ($1, 'reserve', $2, $3, $4, $5, $6, $7, $8, $8)`,
      [
        dropId,
        reservationResult.rows[0].id,
        -quantity,
        drop.remaining_supply,
        result.new_remaining,
        drop.reserved_count,
        result.new_reserved,
        drop.sold_count
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      reservation: reservationResult.rows[0],
      remaining: result.new_remaining
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get a reservation by ID
 */
export async function getReservation(reservationId) {
  const result = await query(
    `SELECT * FROM reservations WHERE id = $1`,
    [reservationId]
  );
  return result.rows[0] || null;
}

/**
 * Confirm a reservation (move from reserved to sold)
 * Called after successful payment
 *
 * @returns {Object} { success, order, error }
 */
export async function confirmReservation(reservationId, paymentData = {}) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get and lock the reservation
    const resResult = await client.query(
      `SELECT r.*, d.name as product_name
       FROM reservations r
       JOIN drops d ON d.id = r.drop_id
       WHERE r.id = $1
       FOR UPDATE`,
      [reservationId]
    );

    const reservation = resResult.rows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Reservation not found' };
    }

    if (reservation.status !== 'pending') {
      await client.query('ROLLBACK');
      return { success: false, error: `Reservation status is ${reservation.status}` };
    }

    if (new Date(reservation.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Reservation expired' };
    }

    // Confirm the reservation (atomic)
    const confirmResult = await client.query(
      `SELECT * FROM confirm_reservation($1)`,
      [reservationId]
    );

    if (!confirmResult.rows[0].success) {
      await client.query('ROLLBACK');
      return { success: false, error: confirmResult.rows[0].error_message };
    }

    // Generate order number
    const orderNumber = `CD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Calculate CLAWDRIP earned (always based on original price)
    const clawdripEarned = Math.floor(reservation.original_price_cents / 100);

    // Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, reservation_id, drop_id, wallet_address,
        payment_hash, price_cents, original_price_cents,
        discount_percent, discount_tier, currency, chain,
        product_name, size, quantity, clawdrip_earned, clawdrip_balance_at_purchase,
        agent_name, gift_message, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        orderNumber,
        reservationId,
        reservation.drop_id,
        reservation.wallet_address,
        paymentData.paymentHash || null,
        reservation.price_cents,
        reservation.original_price_cents,
        reservation.discount_percent,
        reservation.discount_tier,
        'USDC',
        'base',
        reservation.product_name,
        reservation.size,
        reservation.quantity,
        clawdripEarned,
        reservation.clawdrip_balance,
        paymentData.agentName || null,
        paymentData.giftMessage || null,
        'pending_claim'
      ]
    );

    // Update CLAWDRIP balance
    if (reservation.wallet_address) {
      await client.query(
        `INSERT INTO clawdrip_balances (wallet_address, balance, total_earned, order_count)
         VALUES ($1, $2, $2, 1)
         ON CONFLICT (wallet_address) DO UPDATE
         SET balance = clawdrip_balances.balance + $2,
             total_earned = clawdrip_balances.total_earned + $2,
             order_count = clawdrip_balances.order_count + 1,
             updated_at = NOW()`,
        [reservation.wallet_address.toLowerCase(), clawdripEarned]
      );
    }

    // Log the event
    const dropResult = await client.query(
      `SELECT * FROM drops WHERE id = $1`,
      [reservation.drop_id]
    );
    const drop = dropResult.rows[0];

    await client.query(
      `INSERT INTO supply_events (
        drop_id, event_type, reservation_id, order_id, quantity_change,
        remaining_before, remaining_after, reserved_before, reserved_after,
        sold_before, sold_after
      ) VALUES ($1, 'confirm', $2, $3, $4, $5, $5, $6, $7, $8, $9)`,
      [
        reservation.drop_id,
        reservationId,
        orderResult.rows[0].id,
        0,
        drop.remaining_supply,
        drop.reserved_count + reservation.quantity,
        drop.reserved_count,
        drop.sold_count - reservation.quantity,
        drop.sold_count
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      order: orderResult.rows[0],
      clawdripEarned,
      newClawdripBalance: reservation.clawdrip_balance + clawdripEarned
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Expire a reservation (release supply back)
 */
export async function expireReservation(reservationId) {
  const result = await query(
    `SELECT expire_reservation($1) as success`,
    [reservationId]
  );
  return result.rows[0]?.success || false;
}

/**
 * Extend a reservation (the "Fairy Bottle" save)
 */
export async function extendReservation(reservationId, minutes = 5) {
  const result = await query(
    `UPDATE reservations
     SET expires_at = NOW() + INTERVAL '${minutes} minutes'
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [reservationId]
  );
  return result.rows[0] || null;
}

/**
 * Cleanup expired reservations (run periodically)
 */
export async function cleanupExpiredReservations() {
  const result = await query(
    `SELECT cleanup_expired_reservations() as count`
  );
  return result.rows[0]?.count || 0;
}

// ============================================================================
// $CLAW OPERATIONS
// ============================================================================

/**
 * Get CLAWDRIP balance and tier for a wallet
 * Shopify-fast: single indexed query < 5ms
 */
export async function getClawdripBalance(walletAddress) {
  if (!walletAddress) {
    return { balance: 0, tier: 'Base', discount: 0 };
  }

  const result = await query(
    `SELECT balance, total_earned, order_count FROM clawdrip_balances WHERE wallet_address = $1`,
    [walletAddress.toLowerCase()]
  );

  const balance = result.rows[0]?.balance || 0;
  return {
    balance,
    totalEarned: result.rows[0]?.total_earned || 0,
    orderCount: result.rows[0]?.order_count || 0,
    ...calculateTier(balance)
  };
}

/**
 * Calculate tier and discount from CLAWDRIP balance
 */
export function calculateTier(balance) {
  if (balance >= 500) {
    return { tier: 'Diamond Drip', tierEmoji: '💎', discount: 15, nextTier: null, toNextTier: 0 };
  }
  if (balance >= 150) {
    return { tier: 'Gold Drip', tierEmoji: '🥇', discount: 10, nextTier: 'Diamond Drip', toNextTier: 500 - balance };
  }
  if (balance >= 50) {
    return { tier: 'Silver Drip', tierEmoji: '🥈', discount: 5, nextTier: 'Gold Drip', toNextTier: 150 - balance };
  }
  return { tier: 'Base', tierEmoji: null, discount: 0, nextTier: 'Silver Drip', toNextTier: 50 - balance };
}

/**
 * Calculate discounted price
 */
export function calculatePrice(basePriceCents, discountPercent) {
  return Math.round(basePriceCents * (1 - discountPercent / 100));
}

// ============================================================================
// ORDER OPERATIONS
// ============================================================================

/**
 * Get order by order number
 */
export async function getOrderByNumber(orderNumber) {
  const result = await query(
    `SELECT * FROM orders WHERE order_number = $1`,
    [orderNumber]
  );
  return result.rows[0] || null;
}

/**
 * Get order by ID
 */
export async function getOrder(orderId) {
  const result = await query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

/**
 * Update order with shipping info (claim)
 */
export async function claimOrder(orderId, shippingInfo) {
  const result = await query(
    `UPDATE orders SET
      shipping_name = $2,
      shipping_address1 = $3,
      shipping_address2 = $4,
      shipping_city = $5,
      shipping_state = $6,
      shipping_zip = $7,
      shipping_country = $8,
      shipping_email = $9,
      status = 'claimed',
      claimed_at = NOW()
     WHERE id = $1 AND status = 'pending_claim'
     RETURNING *`,
    [
      orderId,
      shippingInfo.name,
      shippingInfo.address1,
      shippingInfo.address2 || null,
      shippingInfo.city,
      shippingInfo.state,
      shippingInfo.zip,
      shippingInfo.country || 'USA',
      shippingInfo.email
    ]
  );
  return result.rows[0] || null;
}

/**
 * Get orders for a wallet
 */
export async function getOrdersByWallet(walletAddress) {
  const result = await query(
    `SELECT * FROM orders WHERE wallet_address = $1 ORDER BY created_at DESC`,
    [walletAddress.toLowerCase()]
  );
  return result.rows;
}

// ============================================================================
// CLAWD OPERATIONS
// ============================================================================

/**
 * Spawn a new clawd when an order is confirmed
 */
export async function createClawd(orderId, orderNumber, designPrompt = null) {
  const result = await query(
    `SELECT spawn_clawd($1, $2, $3) as clawd_id`,
    [orderId, orderNumber, designPrompt]
  );

  if (result.rows[0]?.clawd_id) {
    return getClawd(orderNumber);
  }
  return null;
}

/**
 * Get clawd by order number
 */
export async function getClawd(orderNumber) {
  const result = await query(
    `SELECT c.*, o.wallet_address, o.product_name, o.agent_name, o.gift_message, o.created_at as order_created_at
     FROM clawds c
     JOIN orders o ON o.id = c.order_id
     WHERE c.order_number = $1`,
    [orderNumber]
  );
  return result.rows[0] || null;
}

/**
 * Get clawd by ID
 */
export async function getClawdById(clawdId) {
  const result = await query(
    `SELECT c.*, o.wallet_address, o.product_name, o.agent_name, o.gift_message, o.created_at as order_created_at
     FROM clawds c
     JOIN orders o ON o.id = c.order_id
     WHERE c.id = $1`,
    [clawdId]
  );
  return result.rows[0] || null;
}

/**
 * Update clawd's mood
 */
export async function updateClawdMood(clawdId, mood) {
  const result = await query(
    `UPDATE clawds SET mood = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [clawdId, mood]
  );
  return result.rows[0] || null;
}

/**
 * Update clawd's name (costs CLAWDRIP)
 */
export async function renameClawd(clawdId, walletAddress, newName) {
  const client = await getClient();
  const RENAME_COST = 5;

  try {
    await client.query('BEGIN');

    // Check balance
    const balanceResult = await client.query(
      `SELECT balance FROM clawdrip_balances WHERE wallet_address = $1`,
      [walletAddress.toLowerCase()]
    );

    const balance = balanceResult.rows[0]?.balance || 0;
    if (balance < RENAME_COST) {
      await client.query('ROLLBACK');
      return { success: false, error: `Need ${RENAME_COST} CLAWDRIP (have ${balance})` };
    }

    // Deduct balance
    await client.query(
      `UPDATE clawdrip_balances
       SET balance = balance - $2, total_spent = total_spent + $2, updated_at = NOW()
       WHERE wallet_address = $1`,
      [walletAddress.toLowerCase(), RENAME_COST]
    );

    // Update name
    const clawdResult = await client.query(
      `UPDATE clawds SET name = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [clawdId, newName]
    );

    // Log transaction
    await client.query(
      `INSERT INTO clawd_transactions (clawd_id, wallet_address, transaction_type, amount, item_id)
       VALUES ($1, $2, 'rename', $3, $4)`,
      [clawdId, walletAddress.toLowerCase(), RENAME_COST, newName]
    );

    await client.query('COMMIT');
    return { success: true, clawd: clawdResult.rows[0] };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update clawd's memory with conversation summary
 */
export async function updateClawdMemory(clawdId, memorySummary) {
  const result = await query(
    `UPDATE clawds
     SET memory = memory || $2::jsonb,
         conversation_count = conversation_count + 1,
         updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [clawdId, JSON.stringify([{ timestamp: new Date().toISOString(), summary: memorySummary }])]
  );
  return result.rows[0] || null;
}

/**
 * Save a chat message
 */
export async function saveClawdChat(clawdId, role, content, mood = null) {
  const result = await query(
    `INSERT INTO clawd_chats (clawd_id, role, content, mood_at_time)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [clawdId, role, content, mood]
  );

  // Update last_chat_at and last_message if clawd
  if (role === 'clawd') {
    await query(
      `UPDATE clawds SET last_chat_at = NOW(), last_message = $2 WHERE id = $1`,
      [clawdId, content.substring(0, 500)]
    );
  }

  return result.rows[0];
}

/**
 * Get recent chat history for context
 */
export async function getClawdChatHistory(clawdId, limit = 20) {
  const result = await query(
    `SELECT * FROM clawd_chats
     WHERE clawd_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [clawdId, limit]
  );
  return result.rows.reverse(); // Chronological order
}

/**
 * Update tank skin (costs CLAWDRIP)
 */
export async function updateTankSkin(clawdId, walletAddress, skinId) {
  const SKIN_COSTS = {
    coral_reef: 10,
    deep_sea: 15,
    neon_city: 20,
    void: 25,
    rainbow: 30,
    gold: 50
  };

  const cost = SKIN_COSTS[skinId];
  if (!cost) {
    return { success: false, error: 'Invalid skin' };
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check balance
    const balanceResult = await client.query(
      `SELECT balance FROM clawdrip_balances WHERE wallet_address = $1`,
      [walletAddress.toLowerCase()]
    );

    const balance = balanceResult.rows[0]?.balance || 0;
    if (balance < cost) {
      await client.query('ROLLBACK');
      return { success: false, error: `Need ${cost} CLAWDRIP (have ${balance})` };
    }

    // Deduct balance
    await client.query(
      `UPDATE clawdrip_balances
       SET balance = balance - $2, total_spent = total_spent + $2, updated_at = NOW()
       WHERE wallet_address = $1`,
      [walletAddress.toLowerCase(), cost]
    );

    // Update tank skin
    const clawdResult = await client.query(
      `UPDATE clawds SET tank_skin = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [clawdId, skinId]
    );

    // Log transaction
    await client.query(
      `INSERT INTO clawd_transactions (clawd_id, wallet_address, transaction_type, amount, item_id)
       VALUES ($1, $2, 'tank_skin', $3, $4)`,
      [clawdId, walletAddress.toLowerCase(), cost, skinId]
    );

    await client.query('COMMIT');
    return { success: true, clawd: clawdResult.rows[0] };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update personality mode (costs CLAWDRIP)
 */
export async function updatePersonalityMode(clawdId, walletAddress, mode) {
  const MODE_COST = 15;
  const VALID_MODES = ['default', 'sassy', 'philosophical', 'hype', 'chill', 'mysterious'];

  if (!VALID_MODES.includes(mode)) {
    return { success: false, error: 'Invalid personality mode' };
  }

  if (mode === 'default') {
    // Free to reset to default
    const result = await query(
      `UPDATE clawds SET personality_mode = 'default', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [clawdId]
    );
    return { success: true, clawd: result.rows[0] };
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const balanceResult = await client.query(
      `SELECT balance FROM clawdrip_balances WHERE wallet_address = $1`,
      [walletAddress.toLowerCase()]
    );

    const balance = balanceResult.rows[0]?.balance || 0;
    if (balance < MODE_COST) {
      await client.query('ROLLBACK');
      return { success: false, error: `Need ${MODE_COST} CLAWDRIP (have ${balance})` };
    }

    await client.query(
      `UPDATE clawdrip_balances
       SET balance = balance - $2, total_spent = total_spent + $2, updated_at = NOW()
       WHERE wallet_address = $1`,
      [walletAddress.toLowerCase(), MODE_COST]
    );

    const clawdResult = await client.query(
      `UPDATE clawds SET personality_mode = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [clawdId, mode]
    );

    await client.query(
      `INSERT INTO clawd_transactions (clawd_id, wallet_address, transaction_type, amount, item_id)
       VALUES ($1, $2, 'personality_mode', $3, $4)`,
      [clawdId, walletAddress.toLowerCase(), MODE_COST, mode]
    );

    await client.query('COMMIT');
    return { success: true, clawd: clawdResult.rows[0] };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update clawd design URL (after AI generation)
 */
export async function updateClawdDesign(clawdId, designUrl, metadata = {}) {
  const result = await query(
    `UPDATE clawds
     SET design_url = $2, design_metadata = $3, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [clawdId, designUrl, JSON.stringify(metadata)]
  );
  return result.rows[0] || null;
}

// ============================================================================
// DESIGN OPERATIONS
// ============================================================================

/**
 * Save generated designs (typically 3 variations from one generation)
 *
 * @param {string} walletAddress - Wallet that paid for the designs
 * @param {Object[]} designs - Array of design objects from BlockRun/image generator
 * @param {string} prompt - Original user prompt
 * @param {Object} options - Additional options (style, colors, paymentHash)
 * @returns {Object[]} - Saved design records
 */
export async function saveDesigns(walletAddress, designs, prompt, options = {}) {
  const { style = 'streetwear', colors = [], paymentHash = null, nanoPrompt = null } = options;
  const generationId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const savedDesigns = [];

  for (let i = 0; i < designs.length; i++) {
    const design = designs[i];
    const result = await query(
      `INSERT INTO designs (
        wallet_address, prompt, style, colors, image_url, thumbnail_url,
        variation_number, generation_id, payment_hash, nano_prompt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        walletAddress.toLowerCase(),
        prompt,
        style,
        JSON.stringify(colors),
        design.url || design.image_url,
        design.thumbnail || design.thumbnail_url || null,
        i + 1,
        generationId,
        paymentHash,
        nanoPrompt ? JSON.stringify(nanoPrompt) : null
      ]
    );
    savedDesigns.push(result.rows[0]);
  }

  return savedDesigns;
}

/**
 * Get designs for a wallet (only unexpired, unused designs)
 */
export async function getDesignsByWallet(walletAddress, includeUsed = false) {
  let queryText = `
    SELECT * FROM designs
    WHERE wallet_address = $1
      AND expires_at > NOW()
  `;

  if (!includeUsed) {
    queryText += ` AND used_in_order_id IS NULL`;
  }

  queryText += ` ORDER BY created_at DESC`;

  const result = await query(queryText, [walletAddress.toLowerCase()]);
  return result.rows;
}

/**
 * Get a specific design by ID
 */
export async function getDesignById(designId) {
  const result = await query(
    `SELECT * FROM designs WHERE id = $1`,
    [designId]
  );
  return result.rows[0] || null;
}

/**
 * Mark a design as used in an order
 */
export async function markDesignUsed(designId, orderId) {
  const result = await query(
    `UPDATE designs
     SET used_in_order_id = $2
     WHERE id = $1
       AND used_in_order_id IS NULL
       AND expires_at > NOW()
     RETURNING *`,
    [designId, orderId]
  );
  return result.rows[0] || null;
}

/**
 * Validate a design can be used by a wallet
 * Checks: exists, belongs to wallet, not expired, not already used
 */
export async function validateDesignForOrder(designId, walletAddress) {
  const result = await query(
    `SELECT * FROM designs
     WHERE id = $1
       AND wallet_address = $2
       AND used_in_order_id IS NULL
       AND expires_at > NOW()`,
    [designId, walletAddress.toLowerCase()]
  );

  if (!result.rows[0]) {
    // Check why validation failed
    const design = await getDesignById(designId);
    if (!design) {
      return { valid: false, error: 'Design not found' };
    }
    if (design.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
      return { valid: false, error: 'Design belongs to a different wallet' };
    }
    if (design.used_in_order_id) {
      return { valid: false, error: 'Design already used in an order' };
    }
    if (new Date(design.expires_at) < new Date()) {
      return { valid: false, error: 'Design has expired' };
    }
    return { valid: false, error: 'Unknown validation error' };
  }

  return { valid: true, design: result.rows[0] };
}

/**
 * Get all designs from a single generation (3 variations)
 */
export async function getDesignsByGeneration(generationId) {
  const result = await query(
    `SELECT * FROM designs
     WHERE generation_id = $1
     ORDER BY variation_number`,
    [generationId]
  );
  return result.rows;
}

/**
 * Cleanup expired designs (run periodically)
 */
export async function cleanupExpiredDesigns() {
  const result = await query(
    `DELETE FROM designs
     WHERE expires_at < NOW()
       AND used_in_order_id IS NULL
     RETURNING id`
  );
  return result.rowCount;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Close the connection pool
 */
export async function close() {
  await pool.end();
}

export default {
  query,
  getClient,
  getDrop,
  getCurrentDrop,
  getSupplyStatus,
  createReservation,
  getReservation,
  confirmReservation,
  expireReservation,
  extendReservation,
  cleanupExpiredReservations,
  getClawdripBalance,
  calculateTier,
  calculatePrice,
  getOrderByNumber,
  getOrder,
  claimOrder,
  getOrdersByWallet,
  // Clawd operations
  createClawd,
  getClawd,
  getClawdById,
  updateClawdMood,
  renameClawd,
  updateClawdMemory,
  saveClawdChat,
  getClawdChatHistory,
  updateTankSkin,
  updatePersonalityMode,
  updateClawdDesign,
  // Design operations
  saveDesigns,
  getDesignsByWallet,
  getDesignById,
  markDesignUsed,
  validateDesignForOrder,
  getDesignsByGeneration,
  cleanupExpiredDesigns,
  close
};
