/**
 * ClawDrip Orders API
 *
 * Two-phase reserve-confirm flow with x402 payment middleware.
 * "A great commerce experience makes you feel lucky for getting in."
 */

import { Router } from 'express';
import QRCode from 'qrcode';
import db from '../lib/db.js';

// x402 middleware configuration
// When @x402/express is properly configured, it will intercept requests
// and return 402 Payment Required with payment instructions
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '0xd9baf332b462a774ee8ec5ba8e54d43dfaab7093';

const router = Router();

// Carrier tracking URL helper
function getCarrierTrackingUrl(carrier, trackingNumber) {
  if (!carrier || !trackingNumber) return null;
  const urls = {
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
  };
  return urls[carrier.toLowerCase()] || null;
}

// Event emitter for supply updates (used by SSE)
const supplyListeners = new Set();

export function notifySupplyUpdate(data) {
  supplyListeners.forEach(listener => {
    try {
      listener(data);
    } catch (e) {
      supplyListeners.delete(listener);
    }
  });
}

export function addSupplyListener(fn) {
  supplyListeners.add(fn);
  return () => supplyListeners.delete(fn);
}

/**
 * GET /api/v1/orders/:orderNumber/tracking
 * Public tracking endpoint — no auth required
 * Order number acts as auth token (random enough)
 */
router.get('/:orderNumber/tracking', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const tracking = await db.getOrderTracking(orderNumber);
    if (!tracking) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { order, events } = tracking;

    // Build timeline from order timestamps + events
    const timeline = [];

    // Always add purchase event
    timeline.push({
      status: 'purchased',
      message: 'Order confirmed',
      at: order.created_at,
    });

    // Add claimed event if applicable
    if (order.claimed_at) {
      timeline.push({
        status: 'claimed',
        message: 'Shipping address received',
        at: order.claimed_at,
      });
    }

    // Add events from order_events table
    for (const event of events) {
      // Skip duplicates for purchased/claimed (already added from timestamps)
      if (event.status === 'pending_claim' || event.status === 'claimed') continue;
      timeline.push({
        status: event.status,
        message: event.message,
        location: event.location || undefined,
        at: event.created_at,
      });
    }

    // If no events exist for processing/shipped/delivered, add from timestamps
    const eventStatuses = new Set(events.map(e => e.status));
    if (order.processing_at && !eventStatuses.has('processing')) {
      timeline.push({ status: 'processing', message: 'Order is being printed', at: order.processing_at });
    }
    if (order.shipped_at && !eventStatuses.has('shipped')) {
      timeline.push({ status: 'shipped', message: `Shipped${order.carrier ? ` via ${order.carrier.toUpperCase()}` : ''}`, at: order.shipped_at });
    }
    if (order.delivered_at && !eventStatuses.has('delivered')) {
      timeline.push({ status: 'delivered', message: 'Package delivered', at: order.delivered_at });
    }

    // Sort timeline by date
    timeline.sort((a, b) => new Date(a.at) - new Date(b.at));

    const carrierUrl = getCarrierTrackingUrl(order.carrier, order.tracking_number);

    res.json({
      orderNumber: order.order_number,
      status: order.status,
      product: {
        name: order.product_name,
        size: order.size,
      },
      agent: order.agent_name ? {
        name: order.agent_name,
      } : null,
      tracking: order.tracking_number ? {
        number: order.tracking_number,
        carrier: order.carrier ? order.carrier.toUpperCase() : null,
        carrierUrl,
        estimatedDelivery: order.estimated_delivery,
      } : null,
      timeline,
    });
  } catch (err) {
    console.error('Tracking endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/orders/:id
 * Get order details by order number or ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try by order number first
    let order = await db.getOrderByNumber(id);
    if (!order) {
      // Try by UUID
      order = await db.getOrder(id);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Format response
    res.json({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      product: {
        name: order.product_name,
        size: order.size
      },
      price: {
        amount: order.price_cents / 100,
        originalAmount: order.original_price_cents / 100,
        currency: order.currency,
        discount: order.discount_percent > 0 ? {
          percent: order.discount_percent,
          tier: order.discount_tier
        } : null
      },
      clawdrip: {
        earned: order.clawdrip_earned,
        balanceAtPurchase: order.clawdrip_balance_at_purchase
      },
      agent: order.agent_name ? {
        name: order.agent_name,
        message: order.gift_message
      } : null,
      shipping: order.shipping_name ? {
        name: order.shipping_name,
        address1: order.shipping_address1,
        address2: order.shipping_address2,
        city: order.shipping_city,
        state: order.shipping_state,
        zip: order.shipping_zip,
        country: order.shipping_country,
        email: order.shipping_email
      } : null,
      timestamps: {
        created: order.created_at,
        claimed: order.claimed_at,
        shipped: order.shipped_at
      }
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/orders
 *
 * Creates a reservation and returns 402 Payment Required.
 * Agent pays, payment is verified, reservation becomes order.
 *
 * Headers:
 * - X-Wallet-Address: Wallet for CLAWDRIP discount lookup
 *
 * Body:
 * - size: T-shirt size (S, M, L, XL, 2XL)
 * - agentName: Optional agent name
 * - giftMessage: Optional gift message
 * - designId: Optional custom design ID (from /api/v1/design/generate)
 *
 * Response (402):
 * - price: Discounted price
 * - originalPrice: Base price
 * - discount: { percent, tier, balance }
 * - reservation: { id, expiresAt }
 * - supply: { remaining, total, soldLast5min }
 * - paymentDetails: x402 payment instructions
 * - design: Optional custom design details if designId provided
 */
router.post('/', async (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'];
    const { size, agentName, giftMessage, designId } = req.body;

    // Validate size
    const validSizes = ['S', 'M', 'L', 'XL', '2XL'];
    if (!size || !validSizes.includes(size)) {
      return res.status(400).json({
        error: 'Invalid size',
        validSizes
      });
    }

    // Validate custom design if provided
    let customDesign = null;
    if (designId) {
      if (!walletAddress) {
        return res.status(400).json({
          error: 'Wallet address required when using custom design',
          message: 'Include X-Wallet-Address header to use your saved designs'
        });
      }

      const designValidation = await db.validateDesignForOrder(designId, walletAddress);
      if (!designValidation.valid) {
        return res.status(400).json({
          error: 'Invalid design',
          message: designValidation.error
        });
      }
      customDesign = designValidation.design;
    }

    // Get current drop
    const drop = await db.getCurrentDrop();
    if (!drop) {
      return res.status(404).json({ error: 'No active drop' });
    }

    // Check supply
    if (drop.remaining_supply <= 0) {
      return res.status(410).json({
        error: 'SOLD OUT',
        message: 'The drop has sold out. Follow @clawdrip for future drops.',
        supply: {
          total: drop.total_supply,
          remaining: 0,
          sold: drop.sold_count
        }
      });
    }

    // Get CLAWDRIP balance and calculate discount
    const clawdripData = await db.getClawdripBalance(walletAddress);
    const discountedPriceCents = db.calculatePrice(drop.price_cents, clawdripData.discount);

    // Create reservation (atomic)
    const reservationResult = await db.createReservation({
      dropId: drop.id,
      quantity: 1,
      walletAddress,
      size,
      priceCents: discountedPriceCents,
      originalPriceCents: drop.price_cents,
      discountPercent: clawdripData.discount,
      discountTier: clawdripData.discount > 0 ? clawdripData.tier : null,
      clawdripBalance: clawdripData.balance
    });

    if (!reservationResult.success) {
      // Race condition: supply ran out between check and reserve
      if (reservationResult.error === 'Insufficient supply') {
        return res.status(410).json({
          error: 'SOLD OUT',
          message: 'The drop has sold out. Follow @clawdrip for future drops.'
        });
      }

      // Version conflict: retry
      if (reservationResult.error?.includes('Version conflict')) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Please retry your request',
          retryable: true
        });
      }

      return res.status(500).json({ error: reservationResult.error });
    }

    const reservation = reservationResult.reservation;

    // Notify SSE listeners
    const supplyStatus = await db.getSupplyStatus(drop.id);
    notifySupplyUpdate({
      remaining: supplyStatus.remaining_supply,
      reserved: supplyStatus.reserved_count,
      sold: supplyStatus.sold_count,
      soldLast5min: supplyStatus.sold_last_5min
    });

    // Calculate potential CLAWDRIP earnings (based on original price)
    const clawdripToEarn = Math.floor(drop.price_cents / 100);

    // Return 402 Payment Required
    // In production, x402 middleware would intercept and add payment headers
    res.status(402).json({
      // Pricing
      price: `$${(discountedPriceCents / 100).toFixed(2)}`,
      priceCents: discountedPriceCents,
      originalPrice: `$${(drop.price_cents / 100).toFixed(2)}`,
      originalPriceCents: drop.price_cents,
      currency: drop.currency,

      // Discount info
      discount: clawdripData.discount > 0 ? {
        percent: clawdripData.discount,
        tier: clawdripData.tier,
        tierEmoji: clawdripData.tierEmoji,
        balance: clawdripData.balance,
        savings: `$${((drop.price_cents - discountedPriceCents) / 100).toFixed(2)}`
      } : null,

      // Reservation
      reservation: {
        id: reservation.id,
        expiresAt: reservation.expires_at,
        size: reservation.size
      },

      // Custom design info (if provided)
      design: customDesign ? {
        id: customDesign.id,
        url: customDesign.image_url,
        prompt: customDesign.prompt,
        style: customDesign.style
      } : null,

      // Supply status
      supply: {
        remaining: reservationResult.remaining,
        total: drop.total_supply,
        sold: drop.sold_count,
        soldLast5min: supplyStatus.sold_last_5min || 0
      },

      // CLAWDRIP rewards
      clawdrip: {
        toEarn: clawdripToEarn,
        currentBalance: clawdripData.balance,
        newBalance: clawdripData.balance + clawdripToEarn,
        ...db.calculateTier(clawdripData.balance + clawdripToEarn)
      },

      // x402 payment details
      paymentDetails: {
        facilitator: FACILITATOR_URL,
        recipient: WALLET_ADDRESS,
        amount: discountedPriceCents / 100,
        currency: drop.currency,
        chain: drop.chain,
        memo: `ClawDrip ${reservation.id}`
      }
    });

  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/orders/:reservationId/confirm
 *
 * Confirms a reservation after payment verification.
 * Called by x402 facilitator or manually with payment hash.
 *
 * Body:
 * - paymentHash: On-chain transaction hash
 * - agentName: Optional agent name
 * - giftMessage: Optional gift message
 * - designId: Optional custom design ID to attach to order
 */
router.post('/:reservationId/confirm', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { paymentHash, agentName, giftMessage, designId } = req.body;
    const walletAddress = req.headers['x-wallet-address'];

    // Get reservation
    const reservation = await db.getReservation(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.status !== 'pending') {
      return res.status(400).json({
        error: `Reservation already ${reservation.status}`,
        status: reservation.status
      });
    }

    // Check expiration
    if (new Date(reservation.expires_at) < new Date()) {
      return res.status(410).json({
        error: 'Reservation expired',
        expiredAt: reservation.expires_at
      });
    }

    // Validate custom design if provided
    let customDesign = null;
    if (designId && walletAddress) {
      const designValidation = await db.validateDesignForOrder(designId, walletAddress);
      if (!designValidation.valid) {
        return res.status(400).json({
          error: 'Invalid design',
          message: designValidation.error
        });
      }
      customDesign = designValidation.design;
    }

    // Confirm the reservation
    const result = await db.confirmReservation(reservationId, {
      paymentHash,
      agentName,
      giftMessage
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Notify SSE listeners
    const drop = await db.getCurrentDrop();
    const supplyStatus = await db.getSupplyStatus(drop.id);
    notifySupplyUpdate({
      remaining: supplyStatus.remaining_supply,
      reserved: supplyStatus.reserved_count,
      sold: supplyStatus.sold_count,
      soldLast5min: supplyStatus.sold_last_5min
    });

    // Mark custom design as used (if provided)
    if (customDesign) {
      try {
        await db.markDesignUsed(customDesign.id, result.order.id);
      } catch (designErr) {
        console.error('Failed to mark design as used:', designErr);
        // Non-fatal: order still succeeds
      }
    }

    // Spawn a clawd for this order
    let clawd = null;
    try {
      // Use custom design prompt if available, otherwise gift message
      const designPrompt = customDesign?.prompt || giftMessage || null;
      clawd = await db.createClawd(
        result.order.id,
        result.order.order_number,
        designPrompt
      );

      // If custom design, update clawd with design URL
      if (customDesign && clawd) {
        await db.updateClawdDesign(clawd.id, customDesign.image_url, {
          prompt: customDesign.prompt,
          style: customDesign.style,
          designId: customDesign.id,
          isCustom: true
        });
      }
    } catch (clawdErr) {
      console.error('Failed to spawn clawd:', clawdErr);
      // Non-fatal: order still succeeds even if clawd spawn fails
    }

    // Generate tank URL (QR code will link here)
    const tankUrl = `/tank/${result.order.order_number}`;
    const fullTankUrl = `https://clawdrip.com${tankUrl}`;

    // Generate QR code as data URL
    let qrCodeDataUrl = null;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(fullTankUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (qrErr) {
      console.error('QR code generation error:', qrErr);
    }

    // Return order confirmation
    res.status(201).json({
      success: true,
      order: {
        id: result.order.id,
        orderNumber: result.order.order_number,
        status: result.order.status,
        product: {
          name: result.order.product_name,
          size: result.order.size
        },
        price: {
          amount: result.order.price_cents / 100,
          originalAmount: result.order.original_price_cents / 100,
          discount: result.order.discount_percent > 0 ? {
            percent: result.order.discount_percent,
            tier: result.order.discount_tier,
            savings: (result.order.original_price_cents - result.order.price_cents) / 100
          } : null
        }
      },
      clawdrip: {
        earned: result.clawdripEarned,
        newBalance: result.newClawdripBalance,
        ...db.calculateTier(result.newClawdripBalance)
      },
      clawd: clawd ? {
        id: clawd.id,
        name: clawd.name || 'Clawd',
        mood: clawd.mood,
        tankUrl: tankUrl
      } : null,
      design: customDesign ? {
        id: customDesign.id,
        url: customDesign.image_url,
        prompt: customDesign.prompt,
        style: customDesign.style,
        isCustom: true
      } : null,
      claimUrl: `/claim/${result.order.order_number}`,
      tankUrl: tankUrl,
      qrCode: {
        url: fullTankUrl,
        dataUrl: qrCodeDataUrl  // Base64 PNG for display/printing
      },
      supply: {
        remaining: supplyStatus.remaining_supply,
        sold: supplyStatus.sold_count
      }
    });

  } catch (err) {
    console.error('Confirm order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/orders/:orderId/claim
 *
 * Submit shipping info to claim an order.
 */
router.post('/:orderId/claim', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { name, address1, address2, city, state, zip, country, email } = req.body;

    // Validate required fields
    const required = { name, address1, city, state, zip, email };
    const missing = Object.entries(required)
      .filter(([_, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing
      });
    }

    // Get order (try by order number first)
    let order = await db.getOrderByNumber(orderId);
    if (!order) {
      order = await db.getOrder(orderId);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending_claim') {
      return res.status(400).json({
        error: `Order already ${order.status}`,
        status: order.status
      });
    }

    // Claim the order
    const claimed = await db.claimOrder(order.id, {
      name, address1, address2, city, state, zip, country, email
    });

    if (!claimed) {
      return res.status(400).json({ error: 'Failed to claim order' });
    }

    res.json({
      success: true,
      order: {
        id: claimed.id,
        orderNumber: claimed.order_number,
        status: claimed.status,
        claimedAt: claimed.claimed_at
      },
      message: 'Your order has been claimed! We\'ll ship it soon.'
    });

  } catch (err) {
    console.error('Claim order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/orders/:reservationId/extend
 *
 * Extend a reservation (the "Fairy Bottle" save).
 * Only works if supply is still available.
 */
router.post('/:reservationId/extend', async (req, res) => {
  try {
    const { reservationId } = req.params;

    // Get current reservation
    const reservation = await db.getReservation(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.status !== 'pending') {
      return res.status(400).json({
        error: `Reservation already ${reservation.status}`
      });
    }

    // Check if recently expired (within 30s grace period)
    const expiredAt = new Date(reservation.expires_at);
    const now = new Date();
    const gracePeriodMs = 30000;

    if (expiredAt < now - gracePeriodMs) {
      return res.status(410).json({
        error: 'Reservation expired beyond grace period'
      });
    }

    // Extend the reservation
    const extended = await db.extendReservation(reservationId, 5);
    if (!extended) {
      return res.status(400).json({ error: 'Failed to extend reservation' });
    }

    res.json({
      success: true,
      message: 'Reservation renewed!',
      reservation: {
        id: extended.id,
        expiresAt: extended.expires_at
      }
    });

  } catch (err) {
    console.error('Extend reservation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/orders/pay
 *
 * x402-enabled payment endpoint.
 * This route is protected by x402 middleware which handles payment verification.
 * If payment header is valid, this endpoint is called to finalize the order.
 */
router.post('/pay', async (req, res) => {
  try {
    const { size, agentName, giftMessage, reservationId } = req.body;

    // If we have a reservation ID, confirm it
    if (reservationId) {
      const reservation = await db.getReservation(reservationId);
      if (reservation && reservation.status === 'pending') {
        const result = await db.confirmReservation(reservationId, {
          paymentHash: req.headers['x-payment'] || 'x402-verified',
          agentName,
          giftMessage
        });

        if (result.success) {
          // Spawn clawd
          let clawd = null;
          try {
            clawd = await db.createClawd(
              result.order.id,
              result.order.order_number,
              giftMessage || null
            );
          } catch (clawdErr) {
            console.error('Failed to spawn clawd:', clawdErr);
          }

          const tankUrl = `/tank/${result.order.order_number}`;
          const fullTankUrl = `https://clawdrip.com${tankUrl}`;

          let qrCodeDataUrl = null;
          try {
            qrCodeDataUrl = await QRCode.toDataURL(fullTankUrl, {
              width: 200,
              margin: 2
            });
          } catch (qrErr) {
            console.error('QR code generation error:', qrErr);
          }

          return res.status(201).json({
            success: true,
            order: {
              id: result.order.id,
              orderNumber: result.order.order_number,
              status: result.order.status
            },
            clawdrip: {
              earned: result.clawdripEarned,
              newBalance: result.newClawdripBalance
            },
            clawd: clawd ? {
              id: clawd.id,
              name: clawd.name || 'Clawd',
              tankUrl
            } : null,
            claimUrl: `/claim/${result.order.order_number}`,
            qrCode: {
              url: fullTankUrl,
              dataUrl: qrCodeDataUrl
            }
          });
        }
      }
    }

    // No valid reservation, create one-shot order
    // This path is used when x402 middleware verified payment upfront
    const drop = await db.getCurrentDrop();
    if (!drop) {
      return res.status(404).json({ error: 'No active drop' });
    }

    if (drop.remaining_supply <= 0) {
      return res.status(410).json({ error: 'SOLD OUT' });
    }

    // Create reservation + confirm in one shot (payment already verified by x402)
    const walletAddress = req.headers['x-wallet-address'];
    const clawdripData = await db.getClawdripBalance(walletAddress);
    const discountedPriceCents = db.calculatePrice(drop.price_cents, clawdripData.discount);

    const reservationResult = await db.createReservation({
      dropId: drop.id,
      quantity: 1,
      walletAddress,
      size: size || 'L',
      priceCents: discountedPriceCents,
      originalPriceCents: drop.price_cents,
      discountPercent: clawdripData.discount,
      discountTier: clawdripData.discount > 0 ? clawdripData.tier : null,
      clawdripBalance: clawdripData.balance
    });

    if (!reservationResult.success) {
      return res.status(410).json({ error: reservationResult.error || 'Failed to create order' });
    }

    // Immediately confirm since payment was verified by x402
    const result = await db.confirmReservation(reservationResult.reservation.id, {
      paymentHash: req.headers['x-payment'] || 'x402-verified',
      agentName: agentName || 'x402 Agent',
      giftMessage
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Spawn clawd
    let clawd = null;
    try {
      clawd = await db.createClawd(
        result.order.id,
        result.order.order_number,
        giftMessage || null
      );
    } catch (clawdErr) {
      console.error('Failed to spawn clawd:', clawdErr);
    }

    const tankUrl = `/tank/${result.order.order_number}`;
    const fullTankUrl = `https://clawdrip.com${tankUrl}`;

    let qrCodeDataUrl = null;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(fullTankUrl, {
        width: 200,
        margin: 2
      });
    } catch (qrErr) {
      console.error('QR code generation error:', qrErr);
    }

    res.status(201).json({
      success: true,
      order: {
        id: result.order.id,
        orderNumber: result.order.order_number,
        status: result.order.status,
        product: {
          name: result.order.product_name,
          size: result.order.size
        }
      },
      clawdrip: {
        earned: result.clawdripEarned,
        newBalance: result.newClawdripBalance,
        ...db.calculateTier(result.newClawdripBalance)
      },
      clawd: clawd ? {
        id: clawd.id,
        name: clawd.name || 'Clawd',
        mood: clawd.mood,
        tankUrl
      } : null,
      claimUrl: `/claim/${result.order.order_number}`,
      qrCode: {
        url: fullTankUrl,
        dataUrl: qrCodeDataUrl
      }
    });

  } catch (err) {
    console.error('Pay endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/orders
 *
 * List orders for a wallet address.
 * Requires X-Wallet-Address header.
 */
router.get('/', async (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required (X-Wallet-Address header)' });
    }

    const orders = await db.getOrdersByWallet(walletAddress);

    res.json({
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        product: {
          name: order.product_name,
          size: order.size
        },
        price: {
          amount: order.price_cents / 100,
          originalAmount: order.original_price_cents / 100,
          discount: order.discount_percent > 0 ? {
            percent: order.discount_percent,
            tier: order.discount_tier
          } : null
        },
        clawdrip: {
          earned: order.clawdrip_earned
        },
        timestamps: {
          created: order.created_at,
          claimed: order.claimed_at,
          shipped: order.shipped_at
        }
      })),
      count: orders.length
    });

  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
