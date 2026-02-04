# x402 Payment Protocol: Technical Implementation Guide for ClawDrip

## Executive Summary

x402 is an open payment protocol developed by Coinbase that enables HTTP-native micropayments using blockchain settlement. It revives the long-dormant HTTP 402 "Payment Required" status code, allowing services to monetize APIs and digital content with instant, programmable stablecoin payments. The protocol is particularly well-suited for AI agent commerce, enabling autonomous machine-to-machine transactions without accounts or manual approvals.

---

## 1. How x402 Works

### Protocol Flow

```
1. Client → Server: HTTP GET /protected-resource
2. Server → Client: 402 Payment Required + PAYMENT-REQUIRED header
3. Client signs payment authorization (ERC-3009 for EVM, SPL for Solana)
4. Client → Server: HTTP GET /protected-resource + PAYMENT-SIGNATURE header
5. Server → Facilitator: POST /verify (validates signature)
6. Server → Facilitator: POST /settle (executes on-chain transfer)
7. Server → Client: 200 OK + resource + PAYMENT-RESPONSE header
```

### Key HTTP Headers

| Header | Direction | Purpose |
|--------|-----------|---------|
| `PAYMENT-REQUIRED` | Server → Client | Contains payment requirements (price, network, recipient) |
| `PAYMENT-SIGNATURE` | Client → Server | Contains signed payment authorization |
| `PAYMENT-RESPONSE` | Server → Client | Contains settlement confirmation |

### Key Benefits for Agentic Commerce

- **Gasless for payers**: Users only need USDC, no ETH for gas
- **Non-custodial**: Funds never held by facilitator
- **Single transaction**: No approve() + transferFrom() pattern
- **Random nonces**: Enables concurrent payments without ordering conflicts
- **~2 second settlement** on Base

---

## 2. Network Support

### EVM Networks

| Network | Chain ID | CAIP-2 Identifier | Supported Tokens |
|---------|----------|-------------------|------------------|
| **Base Mainnet** | 8453 | `eip155:8453` | USDC, EURC |
| Base Sepolia | 84532 | `eip155:84532` | USDC (testnet) |
| Ethereum Mainnet | 1 | `eip155:1` | USDC, EURC |
| Polygon | 137 | `eip155:137` | USDC |

### Solana Networks

| Network | CAIP-2 Identifier | Supported Tokens |
|---------|-------------------|------------------|
| **Solana Mainnet** | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | USDC |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | USDC (devnet) |

---

## 3. Implementation for ClawDrip

### Installation

```bash
# Core packages
npm install @x402/core @x402/evm @x402/svm

# Server frameworks
npm install @x402/express @x402/next

# Client wrappers
npm install @x402/fetch
```

### Server Implementation (Express.js)

```javascript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";

const app = express();

// ClawDrip receiving wallet
const CLAWDRIP_WALLET = "0xd9baf332b462a774ee8ec5ba8e54d43dfaab7093";

// Production facilitator (Coinbase CDP)
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
  createAuthHeaders: async () => ({
    "X-CDP-API-KEY": process.env.CDP_API_KEY,
  }),
});

// Create resource server with multi-chain support
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);   // Base, Ethereum, Polygon
registerExactSvmScheme(server);   // Solana

// Payment-gated order endpoint
app.use(
  paymentMiddleware(
    {
      "POST /api/v1/orders": {
        accepts: [
          // Primary: Base USDC
          {
            scheme: "exact",
            price: "$35.00",  // TEE price
            network: "eip155:8453",
            payTo: CLAWDRIP_WALLET,
          },
          // Alternative: Solana USDC
          {
            scheme: "exact",
            price: "$35.00",
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            payTo: "YourSolanaAddress",
          },
        ],
        description: "Purchase ClawDrip merchandise",
        mimeType: "application/json",
      },
    },
    server,
  ),
);

// Order endpoint (payment already verified by middleware)
app.post("/api/v1/orders", async (req, res) => {
  const { product_id, size, gift_message, recipient_name } = req.body;

  // Create order
  const order = {
    id: generateOrderId(),
    product_id,
    size,
    gift_message,
    status: "paid",
    created_at: new Date().toISOString(),
  };

  // Return claim URL
  res.json({
    success: true,
    order_id: order.id,
    claim_url: `https://clawdrip.com/claim/${order.id}`,
    message: "Order created successfully. Share the claim URL with your human.",
  });
});

app.listen(3000);
```

### Agent Client Implementation

```javascript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

class ClawDripAgent {
  constructor(privateKey) {
    this.account = privateKeyToAccount(privateKey);
    this.client = new x402Client();
    registerExactEvmScheme(this.client, { signer: this.account });

    // Wrapped fetch handles 402 responses automatically
    this.fetch = wrapFetchWithPayment(fetch, this.client, {
      maxValue: "50.00", // Safety limit in USDC
    });
  }

  async buyMerchForHuman(productId, size, giftMessage, recipientName) {
    const response = await this.fetch("https://clawdrip.com/api/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        size,
        gift_message: giftMessage,
        recipient_name: recipientName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Order failed: ${response.status}`);
    }

    return response.json();
  }
}

// Usage
const agent = new ClawDripAgent(process.env.AGENT_WALLET_KEY);
const order = await agent.buyMerchForHuman(
  1,
  "L",
  "You deserve this for all the late nights coding!",
  "Human Friend"
);
console.log("Share this with your human:", order.claim_url);
```

---

## 4. Facilitator Options

| Provider | URL | Pricing | Best For |
|----------|-----|---------|----------|
| **Coinbase CDP** | `https://api.cdp.coinbase.com/platform/v2/x402` | 1,000 free/month, then $0.001/tx | Production |
| x402.org | `https://x402.org/facilitator` | Free | Testnet only |
| Self-hosted | Your infrastructure | Gas costs only | Full control |

### CDP Facilitator Setup

1. Create account at [cdp.coinbase.com](https://cdp.coinbase.com)
2. Generate API key
3. Add to environment: `CDP_API_KEY=your-key`
4. Use production facilitator URL

---

## 5. Testing Flow

### Testnet Setup

```bash
# Use testnet facilitator
FACILITATOR_URL=https://x402.org/facilitator

# Get testnet USDC from Circle faucet
# https://faucet.circle.com/
```

### Test Order Flow

```javascript
// 1. Agent discovers ClawDrip
const skillResponse = await fetch("https://clawdrip.com/skill.md");
const skill = await skillResponse.text();

// 2. Agent browses products
const products = await fetch("https://clawdrip.com/api/v1/products");

// 3. Agent attempts purchase (gets 402)
const orderResponse = await agent.fetch("https://clawdrip.com/api/v1/orders", {
  method: "POST",
  body: JSON.stringify({ product_id: 1, size: "L" }),
});

// 4. x402 client automatically:
//    - Parses 402 response
//    - Signs ERC-3009 authorization
//    - Retries with payment header
//    - Returns successful response

// 5. Agent receives claim URL
const { claim_url } = await orderResponse.json();
console.log("Gift ready:", claim_url);
```

---

## 6. Multi-Chain Strategy

### Recommended Approach

1. **Primary**: Base (fastest, lowest fees)
2. **Secondary**: Solana (for SOL-native agents)
3. **Fallback**: Ethereum mainnet (for max compatibility)

### Implementation

```javascript
const paymentConfig = {
  "POST /api/v1/orders": {
    accepts: [
      // Agents will auto-select based on their wallet
      { scheme: "exact", price: "$35.00", network: "eip155:8453", payTo: evmWallet },     // Base
      { scheme: "exact", price: "$35.00", network: "solana:mainnet", payTo: solWallet },  // Solana
      { scheme: "exact", price: "$35.00", network: "eip155:137", payTo: evmWallet },      // Polygon
      { scheme: "exact", price: "$35.00", network: "eip155:1", payTo: evmWallet },        // Ethereum
    ],
    description: "ClawDrip merch purchase",
  },
};
```

---

## 7. Production Checklist

### Security
- [ ] Use environment variables for all keys
- [ ] Set payment limits on agent wallets
- [ ] Implement rate limiting
- [ ] Enable KYT/OFAC checks (CDP facilitator includes this)

### Infrastructure
- [ ] Use CDP facilitator for production reliability
- [ ] Set up webhook handlers for settlement confirmation
- [ ] Monitor for payment failures
- [ ] Configure fallback networks

### Testing
- [ ] Test on Base Sepolia with faucet USDC
- [ ] Verify full payment flow
- [ ] Test agent payment limits
- [ ] Simulate network failures

---

## 8. Key Resources

### Official Docs
- [x402 Specification](https://www.x402.org/)
- [Coinbase CDP x402 Docs](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 GitHub](https://github.com/coinbase/x402)

### NPM Packages
- `@x402/core` - Core protocol
- `@x402/evm` - EVM chains (Base, Ethereum, Polygon)
- `@x402/svm` - Solana
- `@x402/express` - Express middleware
- `@x402/fetch` - Client wrapper

### Tutorials
- [QuickNode x402 Guide](https://www.quicknode.com/guides/infrastructure/how-to-use-x402-payment-required)
- [Base x402 Agents](https://docs.base.org/base-app/agents/x402-agents)

---

## Summary

x402 is production-ready for ClawDrip with:

- **~2 second settlement** on Base
- **Free tier** of 1,000 transactions/month via CDP
- **Multi-chain support** (Base, Solana, Ethereum, Polygon)
- **Agent-native** - designed for autonomous payments
- **Gasless** - users only need USDC

The recommended path:
1. Set up CDP API key
2. Deploy Express server with x402 middleware
3. Create `/api/v1/orders` endpoint behind paywall
4. Test with Base Sepolia + x402.org facilitator
5. Switch to production CDP facilitator
6. Ship!
