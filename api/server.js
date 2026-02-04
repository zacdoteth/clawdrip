/**
 * ClawDrip API Server
 *
 * Express server with x402 payment middleware.
 * "Make commerce better for everyone" — Tobi Lütke
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { paymentMiddleware } from 'x402-express';
import ordersRouter from './orders.js';
import supplyRouter from './supply.js';
import clawdsRouter from './clawds.js';
import designRouter from './design.js';
import productsRouter from './products.js';
import adminRouter from './admin.js';
import db from '../lib/db.js';

// x402 Configuration
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '0xd9baf332b462a774ee8ec5ba8e54d43dfaab7093';
const X402_FACILITATOR = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const NETWORK = process.env.X402_NETWORK || 'base-sepolia'; // Use base-sepolia for testnet, 'base' for mainnet

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://clawdrip.com', 'https://www.clawdrip.com']
    : (process.env.CORS_ORIGIN || 'http://localhost:9000'),
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve skill.md for agent discovery
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper to find skill files (handles both local and Vercel paths)
function getSkillFilePath(filename) {
  // Try different possible paths
  const paths = [
    join(__dirname, '..', 'public', filename),  // Local dev
    join(process.cwd(), 'public', filename),     // Vercel
    join(__dirname, 'public', filename)          // Alternative
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return paths[0]; // Default to first path
}

// Serve skill files for agent discovery (OpenClaw ecosystem)
app.get('/skill.md', (req, res) => {
  try {
    const skillPath = getSkillFilePath('skill.md');
    const content = readFileSync(skillPath, 'utf-8');
    res.setHeader('Content-Type', 'text/markdown');
    res.send(content);
  } catch (err) {
    res.status(404).send('# Skill file not found');
  }
});

app.get('/skills.md', (req, res) => {
  try {
    const skillPath = getSkillFilePath('skills.md');
    const content = readFileSync(skillPath, 'utf-8');
    res.setHeader('Content-Type', 'text/markdown');
    res.send(content);
  } catch (err) {
    res.status(404).send('# Skills file not found');
  }
});

app.get('/skill.json', (req, res) => {
  try {
    const skillPath = getSkillFilePath('skill.json');
    const content = readFileSync(skillPath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
  } catch (err) {
    res.status(404).json({ error: 'Skill metadata not found' });
  }
});

// x402 Payment Middleware for orders that require payment
// This intercepts requests and verifies payment headers
const x402Routes = {
  'POST /api/v1/orders/pay': {
    price: '$35',  // Base price in USD
    network: NETWORK,
    config: {
      description: 'ClawDrip Launch Tee - MY AGENT BOUGHT ME THIS',
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,  // 5 minute payment window
    }
  },
  'POST /api/v1/design/generate': {
    price: '$1',  // $1 USDC for design generation
    network: NETWORK,
    config: {
      description: 'ClawDrip Custom Design Generation - 3 variations',
      mimeType: 'application/json',
      maxTimeoutSeconds: 120,  // 2 minute payment window
    }
  }
};

// Apply x402 middleware only if configured
if (WALLET_ADDRESS && WALLET_ADDRESS !== '0x...') {
  try {
    app.use(paymentMiddleware(WALLET_ADDRESS, x402Routes, X402_FACILITATOR));
    console.log('x402 payment middleware enabled');
  } catch (err) {
    console.warn('x402 middleware setup skipped:', err.message);
  }
}

// API Routes
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/supply', supplyRouter);
app.use('/api/v1/clawds', clawdsRouter);
app.use('/api/v1/design', designRouter);
app.use('/api/v1/admin', adminRouter);

// $CLAWDRIP balance lookup
app.get('/api/v1/clawdrip/:wallet', async (req, res) => {
  try {
    const result = await db.getClawdripBalance(req.params.wallet);
    res.json(result);
  } catch (err) {
    console.error('CLAWDRIP lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Cleanup expired reservations every minute
const cleanupInterval = setInterval(async () => {
  try {
    const count = await db.cleanupExpiredReservations();
    if (count > 0) {
      console.log(`Cleaned up ${count} expired reservations`);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}, 60000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  clearInterval(cleanupInterval);
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  clearInterval(cleanupInterval);
  await db.close();
  process.exit(0);
});

// Only start server if running directly (not imported by Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🦞 ClawDrip API Server                                  ║
  ║                                                           ║
  ║   Port: ${PORT}                                              ║
  ║   Env:  ${process.env.NODE_ENV || 'development'}                                    ║
  ║                                                           ║
  ║   Agent Discovery:                                        ║
  ║   - GET  /skills.md              OpenClaw skill manifest   ║
  ║   - GET  /skill.json             Structured metadata       ║
  ║   - GET  /skill.md               API documentation         ║
  ║                                                           ║
  ║   Endpoints:                                              ║
  ║   - POST /design/prompt-assist   Enhance prompts (FREE)   ║
  ║   - POST /design/generate        Custom design (x402 $1)  ║
  ║   - POST /orders                 Create order (x402 $35)  ║
  ║   - GET  /products               Browse catalog           ║
  ║   - GET  /clawdrip/:addr         Get $CLAWDRIP balance    ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Export for Vercel serverless
export default app;
