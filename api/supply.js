/**
 * ClawDrip Supply SSE Endpoint
 *
 * Real-time supply counter using Server-Sent Events.
 * "The scarcity must feel real—like finding the last Heart Container before Ganon."
 */

import { Router } from 'express';
import db from '../lib/db.js';
import { addSupplyListener } from './orders.js';

const router = Router();

// Connected SSE clients
const clients = new Set();

/**
 * GET /api/v1/supply
 *
 * Server-Sent Events endpoint for real-time supply updates.
 *
 * Events:
 * - supply: Current supply status (remaining, sold, velocity)
 * - soldout: Fired when remaining hits 0
 * - velocity: Sales velocity alert (>10 sold in 5 min)
 */
router.get('/', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial data
  try {
    const drop = await db.getCurrentDrop();
    if (drop) {
      const status = await db.getSupplyStatus(drop.id);
      const data = {
        remaining: status.remaining_supply,
        reserved: status.reserved_count,
        sold: status.sold_count,
        total: status.total_supply,
        soldLast5min: status.sold_last_5min || 0,
        soldLastHour: status.sold_last_hour || 0,
        percentSold: Math.round((status.sold_count / status.total_supply) * 100),
        status: status.remaining_supply === 0 ? 'SOLD_OUT' :
                status.remaining_supply < 100 ? 'ALMOST_GONE' :
                status.remaining_supply < 1000 ? 'SELLING_FAST' : 'AVAILABLE'
      };

      res.write(`event: supply\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  } catch (err) {
    console.error('SSE initial data error:', err);
  }

  // Add this client to the set
  clients.add(res);

  // Listen for supply updates from orders
  const unsubscribe = addSupplyListener((data) => {
    try {
      const event = {
        remaining: data.remaining,
        reserved: data.reserved,
        sold: data.sold,
        soldLast5min: data.soldLast5min || 0,
        timestamp: new Date().toISOString()
      };

      res.write(`event: supply\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Send soldout event if remaining is 0
      if (data.remaining === 0) {
        res.write(`event: soldout\n`);
        res.write(`data: ${JSON.stringify({ soldAt: new Date().toISOString() })}\n\n`);
      }

      // Send velocity alert if selling fast
      if (data.soldLast5min > 10) {
        res.write(`event: velocity\n`);
        res.write(`data: ${JSON.stringify({ soldLast5min: data.soldLast5min, alert: 'SELLING_FAST' })}\n\n`);
      }
    } catch (e) {
      // Client probably disconnected
      clients.delete(res);
      unsubscribe();
    }
  });

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clients.delete(res);
    unsubscribe();
    clearInterval(heartbeat);
  });
});

/**
 * GET /api/v1/supply/status
 *
 * One-time supply status fetch (for non-SSE clients).
 */
router.get('/status', async (req, res) => {
  try {
    const drop = await db.getCurrentDrop();
    if (!drop) {
      return res.status(404).json({ error: 'No active drop' });
    }

    const status = await db.getSupplyStatus(drop.id);

    res.json({
      drop: {
        id: drop.id,
        name: drop.name,
        priceCents: drop.price_cents,
        currency: drop.currency
      },
      supply: {
        total: status.total_supply,
        remaining: status.remaining_supply,
        reserved: status.reserved_count,
        sold: status.sold_count,
        percentSold: Math.round((status.sold_count / status.total_supply) * 100)
      },
      velocity: {
        soldLast5min: status.sold_last_5min || 0,
        soldLastHour: status.sold_last_hour || 0
      },
      status: status.remaining_supply === 0 ? 'SOLD_OUT' :
              status.remaining_supply < 100 ? 'ALMOST_GONE' :
              status.remaining_supply < 1000 ? 'SELLING_FAST' : 'AVAILABLE'
    });
  } catch (err) {
    console.error('Supply status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Broadcast update to all connected clients.
 * Used internally when supply changes.
 */
export function broadcastSupplyUpdate(data) {
  const message = `event: supply\ndata: ${JSON.stringify(data)}\n\n`;

  clients.forEach(client => {
    try {
      client.write(message);
    } catch (e) {
      clients.delete(client);
    }
  });

  // Broadcast soldout if applicable
  if (data.remaining === 0) {
    const soldoutMessage = `event: soldout\ndata: ${JSON.stringify({ soldAt: new Date().toISOString() })}\n\n`;
    clients.forEach(client => {
      try {
        client.write(soldoutMessage);
      } catch (e) {
        clients.delete(client);
      }
    });
  }
}

export default router;
