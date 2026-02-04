/**
 * ClawDrip Products API
 *
 * Catalog for AI agents to discover and browse products.
 * "Agent buys. Human wears."
 */

import { Router } from 'express';
import db from '../lib/db.js';

const router = Router();

// Product catalog - could be expanded to database-driven in the future
const PRODUCTS = [
  {
    id: 1,
    slug: 'my-agent-bought-me-this',
    name: 'MY AGENT BOUGHT ME THIS',
    type: 'TEE',
    description: 'The OG ClawDrip tee. Your AI agent picked this out, paid in USDC, and sent it straight to you. Bella+Canvas 3001 unisex. DTG printed in Detroit.',
    priceCents: 3500,
    currency: 'USDC',
    chain: 'base',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    specs: {
      material: '100% combed ringspun cotton, 4.2 oz',
      fit: 'Unisex, true to size',
      print: 'Direct-to-garment, water-based ink',
      fulfillment: 'Inkpressions · Commerce Township, MI'
    },
    images: [
      '/tee1.png'
    ],
    available: true,
    launchDate: '2026-02-03'
  }
];

/**
 * GET /api/v1/products
 * List all available products
 */
router.get('/', async (req, res) => {
  try {
    // Get current supply info
    const drop = await db.getCurrentDrop();
    const supply = drop ? await db.getSupplyStatus(drop.id) : null;

    // Enrich products with supply data
    const productsWithSupply = PRODUCTS.map(product => ({
      ...product,
      price: `$${(product.priceCents / 100).toFixed(2)}`,
      supply: supply ? {
        total: supply.total_supply,
        remaining: supply.remaining_supply,
        sold: supply.sold_count,
        status: supply.remaining_supply === 0 ? 'SOLD_OUT' :
                supply.remaining_supply < 100 ? 'ALMOST_GONE' :
                supply.remaining_supply < 1000 ? 'SELLING_FAST' : 'AVAILABLE'
      } : null
    }));

    res.json({
      products: productsWithSupply,
      count: productsWithSupply.length,
      paymentMethods: {
        supported: ['USDC'],
        chains: ['base', 'base-sepolia'],
        protocol: 'x402'
      },
      discountTiers: [
        { name: 'Diamond Drip', minBalance: 500, discountPercent: 15 },
        { name: 'Gold Drip', minBalance: 150, discountPercent: 10 },
        { name: 'Silver Drip', minBalance: 50, discountPercent: 5 },
        { name: 'Base', minBalance: 0, discountPercent: 0 }
      ]
    });
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/products/:id
 * Get a specific product by ID or slug
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find by ID or slug
    const product = PRODUCTS.find(p =>
      p.id === parseInt(id) || p.slug === id
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get supply info
    const drop = await db.getCurrentDrop();
    const supply = drop ? await db.getSupplyStatus(drop.id) : null;

    res.json({
      ...product,
      price: `$${(product.priceCents / 100).toFixed(2)}`,
      supply: supply ? {
        total: supply.total_supply,
        remaining: supply.remaining_supply,
        sold: supply.sold_count,
        status: supply.remaining_supply === 0 ? 'SOLD_OUT' :
                supply.remaining_supply < 100 ? 'ALMOST_GONE' : 'AVAILABLE'
      } : null,
      purchaseUrl: '/api/v1/orders',
      purchaseMethod: 'POST',
      purchaseBody: {
        size: 'L',  // example
        agentName: 'YourAgent',
        giftMessage: 'Optional message for the recipient'
      },
      headers: {
        'X-Wallet-Address': 'Your wallet address for CLAWDRIP discount lookup'
      }
    });
  } catch (err) {
    console.error('Product detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
