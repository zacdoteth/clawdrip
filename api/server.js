/**
 * ClawDrip API Server
 *
 * Express server with x402 payment middleware.
 * "Make commerce better for everyone" — Tobi Lütke
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import ordersRouter from './orders.js';
import supplyRouter from './supply.js';
import clawdsRouter from './clawds.js';
import designRouter from './design.js';
import productsRouter from './products.js';
import adminRouter from './admin.js';
import giftRouter from './gift.js';
import db from '../lib/db.js';

// x402 Configuration — supports Base (EVM) and Solana (SVM)
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '0xd9baf332b462a774ee8ec5ba8e54d43dfaab7093';
const SOLANA_WALLET_ADDRESS = process.env.SOLANA_WALLET_ADDRESS || '';
const X402_FACILITATOR = process.env.X402_FACILITATOR_URL || 'https://facilitator.x402.org';

// Network identifiers (CAIP-2 format)
const EVM_NETWORK = process.env.X402_NETWORK === 'base-sepolia' ? 'eip155:84532' : 'eip155:8453';
const SVM_NETWORK = process.env.X402_SVM_NETWORK === 'solana-devnet'
  ? 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
  : 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

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

// x402 Payment Middleware — Base (EVM) + Solana (SVM)
// Build accepts arrays per route: EVM always included, Solana if wallet configured
function buildAccepts(price) {
  const accepts = [
    { scheme: 'exact', price, network: EVM_NETWORK, payTo: WALLET_ADDRESS, maxTimeoutSeconds: 300 }
  ];
  if (SOLANA_WALLET_ADDRESS) {
    accepts.push({ scheme: 'exact', price, network: SVM_NETWORK, payTo: SOLANA_WALLET_ADDRESS, maxTimeoutSeconds: 300 });
  }
  return accepts;
}

const x402Routes = {
  'POST /api/v1/orders': {
    accepts: buildAccepts('$35'),
    description: 'ClawDrip Launch Tee - MY AGENT BOUGHT ME THIS',
  },
  'POST /api/v1/design/generate': {
    accepts: buildAccepts('$1'),
    description: 'ClawDrip Custom Design Generation - 3 variations',
  }
};

// Apply x402 middleware only if configured
if (WALLET_ADDRESS && WALLET_ADDRESS !== '0x...') {
  try {
    const facilitatorClient = new HTTPFacilitatorClient({ url: X402_FACILITATOR });
    const resourceServer = new x402ResourceServer(facilitatorClient)
      .register(EVM_NETWORK, new ExactEvmScheme());

    // Register Solana if wallet is configured
    if (SOLANA_WALLET_ADDRESS) {
      resourceServer.register(SVM_NETWORK, new ExactSvmScheme());
      console.log(`x402: Solana enabled (${SVM_NETWORK})`);
    }

    app.use(paymentMiddleware(x402Routes, resourceServer));
    console.log(`x402 payment middleware enabled (EVM: ${EVM_NETWORK})`);
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
app.use('/api/v1/gift', giftRouter);

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

// Run DB migration for order tracking (idempotent)
async function runMigration() {
  try {
    await db.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery DATE;
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        status VARCHAR(50) NOT NULL,
        message TEXT,
        carrier VARCHAR(50),
        tracking_number VARCHAR(255),
        location VARCHAR(255),
        source VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        expires_at TIMESTAMPTZ,
        wallet_private_key_encrypted TEXT,
        sweep_tx_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await db.query(`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS wallet_private_key_encrypted TEXT;`);
    await db.query(`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS sweep_tx_hash TEXT;`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_gifts_status ON gifts(status);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_gifts_expires_at ON gifts(expires_at);`);
    // Design credits + social shares for share-to-earn
    await db.query(`
      CREATE TABLE IF NOT EXISTS design_credits (
        wallet_address VARCHAR(255) PRIMARY KEY,
        credits INTEGER NOT NULL DEFAULT 1,
        total_earned INTEGER NOT NULL DEFAULT 1,
        total_spent INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT non_negative_credits CHECK (credits >= 0)
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS social_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address VARCHAR(255) NOT NULL,
        design_id UUID REFERENCES designs(id),
        share_url TEXT NOT NULL,
        platform VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        credits_awarded INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        CONSTRAINT valid_share_status CHECK (status IN ('pending', 'approved', 'rejected'))
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_social_shares_wallet ON social_shares(wallet_address);`);
    console.log('DB migration: all tables ready');
  } catch (err) {
    console.error('DB migration error (non-fatal):', err.message);
  }
}

// Only start server if running directly (not imported by Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  runMigration().then(() => {}).catch(() => {});
  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🦞 ClawDrip API Server                                  ║
  ║                                                           ║
  ║   Port: ${PORT}                                              ║
  ║   Env:  ${process.env.NODE_ENV || 'development'}                                    ║
  ║   Chains: Base (EVM)${SOLANA_WALLET_ADDRESS ? ' + Solana (SVM)' : ''}                           ║
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
