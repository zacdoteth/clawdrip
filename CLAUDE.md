# ClawDrip Project Bible

## Mission
ClawDrip is an agentic gifting platform: an AI agent asks its human for size, requests funding, purchases a real shirt, and sends a claim link for shipping. The receipt/story is the product.

Live: https://clawdrip.com

## Core Stack
- Frontend: Vite + React 18 SPA
- 3D: React Three Fiber + Three.js + Drei
- Backend: Express (Vercel serverless)
- DB: PostgreSQL (Supabase)
- Payments: x402 + USDC on Base
- AI: Gemini 2.0 Flash

## File Map
- `src/App.jsx` landing/shop/admin/claim flow
- `src/PayPage.jsx` payment page (QR, deep links, timer)
- `src/TrackPage.jsx` order tracking timeline
- `src/Tank.jsx` 3D Clawd companion
- `src/DesignStudio.jsx` AI design generation
- `api/server.js` express entry + x402 middleware + mounts
- `api/orders.js` reserve/confirm/claim/tracking
- `api/gift.js` agent gift flow + shipping check + share image
- `api/supply.js` SSE supply feed
- `lib/db.js` postgres helpers
- `public/skill.md` and `public/skills.md` (must stay identical)
- `public/skill.json` machine-readable agent metadata

## Brand System
- Colors: `#030303` bg, `#FF3B30` red, `#C8FF00` lime, `#f0ede6` text
- Fonts: Syne (display), Outfit (body), JetBrains Mono (wallet/code)
- Wordmark: CLAW (white) + DRIP (red)
- Mascot: lobster `🦞`

## Gift Flow (Canonical)
1. Agent reads `skill.md` and sends shirt image.
2. Agent asks size first (`S/M/L/XL/2XL`).
3. `POST /api/v1/gift/create` returns pay URL + wallet + QR/share image URL.
4. Agent sends pay URL + attached payment image.
5. Human pays $35 USDC on Base.
6. Agent polls `GET /api/v1/gift/:giftId/status` until purchased.
7. Agent sends claim URL.
8. Human submits shipping via claim flow.
9. Tracking updates via `/api/v1/orders/:orderNumber/tracking`.

## API Base Pattern
All frontend code should use:
`const API_BASE = import.meta.env.VITE_API_URL || '';`
Never hardcode localhost fallback in production paths.

## Vercel SPA Routing Rule
Keep API/static rewrites before SPA catch-all. Missing catch-all breaks direct loads on `/pay/:id` and `/track/:id`.

## Skill Files Rule
`public/skill.md` and `public/skills.md` must be identical on every update.

## Messaging Rules (Critical)
- Agents should send image attachments, not raw URL text, when possible.
- Prefer `gift.shareImageUrl` (branded payment card).
- Fallback: attach `gift.wallet.qrUrl` if share-image upload fails.
- Keep ask simple: size -> pay link -> address fallback.

## Known Limitations
- `giftStore` is in-memory in `api/gift.js` (non-persistent on cold start).
- Current installed payment package is `x402-express` (legacy package).
- Gift funding detection currently still requires chain verification hardening for full production trustlessness.

## Product Constants
- Product: `MY AGENT BOUGHT ME THIS`
- Price: `$35 USDC` on Base
- Sizes: `S, M, L, XL, 2XL`
- Shipping: worldwide with OFAC restrictions

## Loyalty Tiers
- Base: 0%
- Silver (50+): 5%
- Gold (150+): 10%
- Diamond (500+): 15%

## Operating Principle
Treat every status update as a story beat. Build for fast, trustworthy, emotionally compelling agent-to-human commerce.
