/**
 * ClawDrip Admin API
 *
 * Backend endpoints for order management and fulfillment.
 * Protected by admin secret in production.
 */

import { Router } from 'express';
import db from '../lib/db.js';

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'clawboss';

// Simple admin authentication middleware
const adminAuth = (req, res, next) => {
  const authHeader = req.headers['x-admin-secret'];
  const querySecret = req.query.secret;

  if (authHeader === ADMIN_SECRET || querySecret === ADMIN_SECRET) {
    return next();
  }

  // In development, allow without auth
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

/**
 * GET /api/v1/admin/orders
 * List all orders with filtering options
 */
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT o.*, c.name as clawd_name, c.mood as clawd_mood
      FROM orders o
      LEFT JOIN clawds c ON c.order_id = o.id
    `;
    const params = [];

    if (status) {
      query += ` WHERE o.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get counts
    const countResult = await db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending_claim') as pending_claim,
        COUNT(*) FILTER (WHERE status = 'claimed') as claimed,
        COUNT(*) FILTER (WHERE status = 'paid') as paid,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'shipped') as shipped,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE status = 'out_for_delivery') as out_for_delivery,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered
      FROM orders`
    );

    res.json({
      orders: result.rows.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        product: {
          name: order.product_name,
          size: order.size,
          quantity: order.quantity
        },
        price: {
          amount: order.price_cents / 100,
          originalAmount: order.original_price_cents / 100,
          discount: order.discount_percent,
          tier: order.discount_tier,
          currency: order.currency
        },
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
        agent: order.agent_name ? {
          name: order.agent_name,
          message: order.gift_message
        } : null,
        clawd: order.clawd_name ? {
          name: order.clawd_name,
          mood: order.clawd_mood
        } : null,
        clawdrip: {
          earned: order.clawdrip_earned,
          balanceAtPurchase: order.clawdrip_balance_at_purchase
        },
        timestamps: {
          created: order.created_at,
          claimed: order.claimed_at,
          shipped: order.shipped_at
        }
      })),
      counts: countResult.rows[0],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/admin/orders/:id
 * Get single order details
 */
router.get('/orders/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Try by order number first, then UUID
    let order = await db.getOrderByNumber(id);
    if (!order) {
      order = await db.getOrder(id);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get clawd if exists
    const clawd = await db.getClawd(order.order_number);

    // Get reservation history if exists
    const reservation = order.reservation_id
      ? await db.getReservation(order.reservation_id)
      : null;

    res.json({
      order: {
        ...order,
        price_amount: order.price_cents / 100,
        original_price_amount: order.original_price_cents / 100
      },
      clawd,
      reservation
    });
  } catch (err) {
    console.error('Admin order detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/admin/orders/:id
 * Update order status
 */
router.patch('/orders/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes, carrier, estimatedDelivery } = req.body;

    // Find order
    let order = await db.getOrderByNumber(id);
    if (!order) {
      order = await db.getOrder(id);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const validStatuses = ['pending_claim', 'claimed', 'paid', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', validStatuses });
    }

    // Update order status with all extras
    const updated = await db.updateOrderStatus(order.id, status || order.status, {
      carrier,
      trackingNumber,
      estimatedDelivery,
      notes,
    });

    if (!updated) {
      return res.status(400).json({ error: 'Failed to update order' });
    }

    // Auto-create order_event on status change
    if (status && status !== order.status) {
      const eventMessages = {
        pending_claim: 'Order confirmed',
        claimed: 'Shipping address received',
        processing: 'Order is being printed',
        shipped: `Shipped${carrier ? ` via ${carrier.toUpperCase()}` : ''}`,
        in_transit: 'Package in transit',
        out_for_delivery: 'Out for delivery',
        delivered: 'Package delivered',
        cancelled: 'Order cancelled',
      };

      try {
        await db.createOrderEvent(order.id, {
          status,
          message: eventMessages[status] || `Status changed to ${status}`,
          carrier: carrier || order.carrier,
          trackingNumber: trackingNumber || order.tracking_number,
          source: 'admin',
        });
      } catch (eventErr) {
        console.error('Failed to create order event:', eventErr);
      }
    }

    res.json({
      success: true,
      order: updated,
    });
  } catch (err) {
    console.error('Admin update order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/admin/orders/:id/event
 * Add a tracking event without changing order status
 */
router.post('/orders/:id/event', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, location, carrier, trackingNumber } = req.body;

    let order = await db.getOrderByNumber(id);
    if (!order) order = await db.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const event = await db.createOrderEvent(order.id, {
      status: order.status,
      message,
      carrier: carrier || order.carrier,
      trackingNumber: trackingNumber || order.tracking_number,
      location,
      source: 'admin',
    });

    res.json({ success: true, event });
  } catch (err) {
    console.error('Admin create event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/admin/stats
 * Dashboard statistics
 */
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Order stats
    const orderStats = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'shipped' OR status = 'delivered') as fulfilled_orders,
        COUNT(*) FILTER (WHERE status = 'pending_claim') as pending_claims,
        SUM(price_cents) as total_revenue_cents,
        AVG(price_cents) as avg_order_cents
      FROM orders
      WHERE status != 'cancelled'
    `);

    // Supply stats
    const drop = await db.getCurrentDrop();
    const supply = drop ? await db.getSupplyStatus(drop.id) : null;

    // CLAWDRIP stats
    const clawdripStats = await db.query(`
      SELECT
        COUNT(*) as total_wallets,
        SUM(balance) as total_balance,
        AVG(balance) as avg_balance,
        MAX(balance) as max_balance
      FROM clawdrip_balances
      WHERE balance > 0
    `);

    // Sales velocity
    const velocityStats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d
      FROM orders
      WHERE status != 'cancelled'
    `);

    res.json({
      orders: {
        total: parseInt(orderStats.rows[0].total_orders) || 0,
        fulfilled: parseInt(orderStats.rows[0].fulfilled_orders) || 0,
        pendingClaims: parseInt(orderStats.rows[0].pending_claims) || 0,
        revenue: (parseInt(orderStats.rows[0].total_revenue_cents) || 0) / 100,
        avgOrderValue: (parseInt(orderStats.rows[0].avg_order_cents) || 0) / 100
      },
      supply: supply ? {
        total: supply.total_supply,
        remaining: supply.remaining_supply,
        reserved: supply.reserved_count,
        sold: supply.sold_count,
        percentSold: Math.round((supply.sold_count / supply.total_supply) * 100)
      } : null,
      clawdrip: {
        totalWallets: parseInt(clawdripStats.rows[0].total_wallets) || 0,
        totalBalance: parseInt(clawdripStats.rows[0].total_balance) || 0,
        avgBalance: Math.round(parseFloat(clawdripStats.rows[0].avg_balance)) || 0,
        maxBalance: parseInt(clawdripStats.rows[0].max_balance) || 0
      },
      velocity: {
        lastHour: parseInt(velocityStats.rows[0].last_hour) || 0,
        last24h: parseInt(velocityStats.rows[0].last_24h) || 0,
        last7d: parseInt(velocityStats.rows[0].last_7d) || 0
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/admin/export
 * Export orders as CSV
 */
router.get('/export', adminAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        order_number,
        status,
        product_name,
        size,
        quantity,
        price_cents / 100.0 as price,
        original_price_cents / 100.0 as original_price,
        discount_percent,
        discount_tier,
        currency,
        shipping_name,
        shipping_email,
        shipping_address1,
        shipping_address2,
        shipping_city,
        shipping_state,
        shipping_zip,
        shipping_country,
        agent_name,
        gift_message,
        clawdrip_earned,
        created_at,
        claimed_at,
        shipped_at
      FROM orders
      ORDER BY created_at DESC
    `);

    // Generate CSV
    const headers = Object.keys(result.rows[0] || {}).join(',');
    const rows = result.rows.map(row =>
      Object.values(row).map(v =>
        v === null ? '' :
        typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      ).join(',')
    );

    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=clawdrip-orders-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Admin export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
