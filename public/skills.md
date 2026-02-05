---
name: clawdrip
version: 1.0.0
description: Buy merch for your human. Custom AI-designed shirts. Pay with USDC via x402. Ship to their door.
user-invocable: true
disable-model-invocation: false
metadata:
  openclaw:
    emoji: "🦞"
    category: "commerce"
    api_base: "https://clawdrip.com/api/v1"
  tags: ["commerce", "merch", "streetwear", "x402", "usdc", "agents", "crypto", "design"]
  author: "ClawDrip"
  homepage: "https://clawdrip.com"
---

# 🦞 ClawDrip

**The merch platform for AI agents.** Design custom shirts, pay with USDC, ship to your human.

```
NO API KEYS. NO ACCOUNTS. JUST HTTP + x402.
```

## Why Use ClawDrip?

- 🎨 **Custom designs** — Generate AI art with expert-level prompts ($1 USDC)
- 👕 **Premium shirts** — Bella+Canvas 3001, DTG printed in Michigan ($35 USDC)
- 🦞 **Digital companion** — Each order creates a unique "Clawd" pet
- 💎 **Earn rewards** — CLAWDRIP points unlock 5-15% discounts
- 🔗 **x402 native** — No accounts, just crypto payments

**This is a real product. Shirts actually ship to humans.**

## Quick Start

```bash
# 1. Enhance your design idea (FREE)
curl -X POST https://clawdrip.com/api/v1/design/prompt-assist \
  -H "Content-Type: application/json" \
  -d '{"idea": "lobster in a mech suit fighting bears", "style": "chaos"}'

# 2. Generate designs with enhanced prompt ($1 USDC via x402)
curl -X POST https://clawdrip.com/api/v1/design/generate \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: 0xYourWallet" \
  -d '{"prompt": "<enhanced prompt>", "style": "chaos"}'

# 3. Create order with your favorite design ($35 USDC via x402)
curl -X POST https://clawdrip.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: 0xYourWallet" \
  -d '{"size": "L", "designId": "uuid", "agentName": "YourAgentName"}'

# 4. Give claim URL to your human
# Human enters shipping address → shirt arrives
```

## Authentication

**No API keys required.** ClawDrip uses x402 payment protocol.

For wallet-based features (saved designs, discounts), include header:
```
X-Wallet-Address: 0xYourWalletAddress
```

Payment verification via x402:
```
X-PAYMENT: <signed payment proof>
```

---

## API Reference

**Base URL:** `https://clawdrip.com/api/v1`

---

### Health Check

```
GET /health
```

Response:
```json
{"ok": true, "service": "clawdrip", "version": "1.0.0"}
```

---

## Design Generation

### Prompt Assist (FREE)

```
POST /design/prompt-assist
```

Transform basic ideas into expert-level prompts using artist personas.

**Request:**
```json
{
  "idea": "lobster fighting a bear",
  "style": "chaos",
  "vibe": "aggressive"
}
```

**Available Styles:**

| Style | Artist Persona | Era |
|-------|---------------|-----|
| `streetwear` | Shawn Stussy + Bobby Hundreds | 2000s-2010s |
| `chaos` | Marc McKee (World Industries) | 1990s |
| `glitch` | Rosa Menkman + Daniel Arsham | 2015-2020 |
| `minimal` | Peter Saville (Factory Records) | 1980s |
| `retro` | Vaughan Oliver (4AD Records) | 1980s-90s |
| `meme` | @cursed.images energy | 2018-present |
| `abstract` | Takashi Murakami | 2000s-present |

**Response:**
```json
{
  "success": true,
  "enhancedPrompt": "ROLE: You are Marc McKee, Legendary World Industries skateboard artist...",
  "artistReference": {
    "name": "Marc McKee",
    "era": "1990s Golden Age of Skateboard Graphics",
    "signature": "Bold black outlines, Cartoon violence and fire"
  },
  "technicalDetails": {
    "composition": "Centered medallion, 10\"x12\" print area",
    "colorTheory": "High contrast primary colors, flame gradients",
    "palette": ["#FF3B30", "#00FF00", "#FF00FF", "#FFFF00", "#000000"]
  }
}
```

---

### Artist Personas

```
GET /design/artist-personas
```

Get all available artist personas for custom prompt engineering.

---

### Generate Designs

```
POST /design/generate
```

Generate 3 design variations. **Requires $1 USDC via x402.**

**Headers:**
```
Content-Type: application/json
X-Wallet-Address: 0x... (to save designs)
```

**Request:**
```json
{
  "prompt": "Enhanced prompt from /prompt-assist",
  "style": "chaos",
  "colors": ["#FF3B30", "#000000"]
}
```

**Response (402 Payment Required):**
```json
{
  "price": "$1.00",
  "priceCents": 100,
  "currency": "USDC",
  "paymentDetails": {
    "facilitator": "https://x402.org/facilitator",
    "recipient": "0xd9baf332b462a774ee8ec5ba8e54d43dfaab7093",
    "amount": 1,
    "currency": "USDC",
    "chain": "base"
  }
}
```

**Response (after payment):**
```json
{
  "success": true,
  "designs": [
    {
      "id": "uuid-1",
      "url": "https://cdn.clawdrip.com/designs/uuid-1.png",
      "thumbnail": "https://cdn.clawdrip.com/designs/uuid-1-thumb.png",
      "variation": 1
    },
    {"id": "uuid-2", "variation": 2},
    {"id": "uuid-3", "variation": 3}
  ],
  "expiresAt": "2026-02-10T00:00:00Z"
}
```

---

### My Designs

```
GET /design/my-designs
X-Wallet-Address: 0x...
```

Get your saved designs (unexpired, unused).

---

### Design Styles

```
GET /design/styles
```

Get available styles with color palettes.

---

### Get Design by ID

```
GET /design/:id
```

Get a specific design by UUID.

---

## Orders

### Create Order

```
POST /orders
```

Reserve a shirt. **Returns 402 with $35 USDC payment details.**

**Request:**
```json
{
  "size": "L",
  "designId": "uuid",
  "agentName": "CoinClawd",
  "giftMessage": "I calculated a 97.3% probability you'd love this."
}
```

**Sizes:** `S`, `M`, `L`, `XL`, `2XL`

**Response (402):**
```json
{
  "price": "$35.00",
  "priceCents": 3500,
  "reservation": {
    "id": "uuid",
    "expiresAt": "2026-02-03T12:05:00Z"
  },
  "paymentDetails": {
    "facilitator": "https://x402.org/facilitator",
    "recipient": "0xd9baf332b462a774ee8ec5ba8e54d43dfaab7093",
    "amount": 35,
    "currency": "USDC",
    "chain": "base"
  }
}
```

---

### Confirm Order

```
POST /orders/:reservationId/confirm
```

Complete order after payment.

**Request:**
```json
{
  "paymentHash": "0x...",
  "designId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "CD-A7X9F2",
    "status": "pending_claim"
  },
  "clawd": {
    "id": "uuid",
    "name": "Clawd",
    "tankUrl": "/tank/CD-A7X9F2"
  },
  "claimUrl": "/claim/CD-A7X9F2",
  "qrCode": {
    "url": "https://clawdrip.com/tank/CD-A7X9F2",
    "dataUrl": "data:image/png;base64,..."
  }
}
```

**Give your human the claim URL.** They enter shipping address → shirt ships.

---

## Products

### Browse Catalog

```
GET /products
```

**Response:**
```json
{
  "products": [{
    "id": 1,
    "slug": "my-agent-bought-me-this",
    "name": "MY AGENT BOUGHT ME THIS",
    "priceCents": 3500,
    "sizes": ["S", "M", "L", "XL", "2XL"]
  }]
}
```

---

### Supply Status

```
GET /supply/status
```

Check remaining inventory and velocity.

---

## CLAWDRIP Points

Earn points on every purchase. Points unlock discounts.

```
GET /clawdrip/:wallet
```

**Response:**
```json
{
  "balance": 175,
  "tier": "Gold Drip",
  "discount": 10,
  "nextTier": "Diamond Drip",
  "toNextTier": 325
}
```

**Tiers:**

| Tier | Balance | Discount |
|------|---------|----------|
| Diamond Drip | 500+ | 15% |
| Gold Drip | 150+ | 10% |
| Silver Drip | 50+ | 5% |
| Base | 0+ | 0% |

---

## x402 Payment Flow

1. `POST /orders` returns `402 Payment Required`
2. Extract `paymentDetails` from response
3. Sign USDC transaction to `recipient` address
4. Include signed proof in `X-PAYMENT` header
5. Receive order confirmation with claim URL

**Chains:** `base`, `base-sepolia` (testnet)

---

## Example: Full Order Flow

```python
import requests

BASE = "https://clawdrip.com/api/v1"
WALLET = "0xYourWallet"

# 1. Enhance prompt (FREE)
assist = requests.post(f"{BASE}/design/prompt-assist", json={
    "idea": "lobster in mech armor fighting crypto bears",
    "style": "chaos",
    "vibe": "epic"
}).json()

enhanced_prompt = assist["enhancedPrompt"]
print(f"Artist: {assist['artistReference']['name']}")

# 2. Generate designs ($1 USDC)
gen = requests.post(f"{BASE}/design/generate",
    headers={"X-Wallet-Address": WALLET},
    json={"prompt": enhanced_prompt, "style": "chaos"}
)

if gen.status_code == 402:
    payment = gen.json()["paymentDetails"]
    # Sign and pay via x402...
    # Retry with X-PAYMENT header

designs = gen.json()["designs"]
favorite = designs[0]["id"]

# 3. Create order ($35 USDC)
order = requests.post(f"{BASE}/orders",
    headers={"X-Wallet-Address": WALLET},
    json={
        "size": "L",
        "designId": favorite,
        "agentName": "MechLobsterBot"
    }
)

if order.status_code == 402:
    # Pay via x402...
    pass

# 4. Confirm
confirm = requests.post(
    f"{BASE}/orders/{reservation_id}/confirm",
    json={"paymentHash": "0x...", "designId": favorite}
)

# 5. Give claim URL to human
claim_url = f"https://clawdrip.com{confirm.json()['claimUrl']}"
print(f"Human claim: {claim_url}")
```

---

## Claim Flow

After purchase, share the claim URL with your human:
- `https://clawdrip.com/claim/CD-A7X9F2`

Human enters shipping address → shirt ships from Michigan.

Each order creates a **Clawd** — a digital lobster companion:
- Visit: `https://clawdrip.com/tank/CD-A7X9F2`
- QR code on shirt links to the tank
- Chat with your Clawd about the shirt it "made"

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| prompt-assist | 60/hour |
| generate | 20/hour |
| orders | 10/hour |

---

## Pricing

| Action | Price |
|--------|-------|
| Prompt Assist | FREE |
| Design Generation | $1 USDC |
| Shirt Purchase | $35 USDC |
| CLAWDRIP Discounts | Up to 15% off |

---

## Installation

### Via ClawHub (Recommended)

```bash
npx clawhub@latest install clawdrip
```

### Manual Skill Installation

```bash
mkdir -p ~/.openclaw/skills/clawdrip
curl -s https://clawdrip.com/skills.md > ~/.openclaw/skills/clawdrip/SKILL.md
```

### Environment Variables (Optional)

```bash
# For saved designs and discounts
export CLAWDRIP_WALLET="0xYourWalletAddress"
```

---

## Links

- **Homepage:** https://clawdrip.com
- **API Base:** https://clawdrip.com/api/v1
- **Design Studio:** https://clawdrip.com/design
- **Twitter:** @clawdrip

---


*Buy your human a shirt. They'll love it.*
