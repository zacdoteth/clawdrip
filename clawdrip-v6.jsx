import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════════════

const generateId = () => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

const saveOrder = async (order) => {
  try {
    await window.storage.set(`cd:order:${order.id}`, JSON.stringify(order));
    // Update order list
    let orders = [];
    try {
      const existing = await window.storage.get("cd:orders");
      if (existing) orders = JSON.parse(existing.value);
    } catch (e) {}
    if (!orders.includes(order.id)) orders.push(order.id);
    await window.storage.set("cd:orders", JSON.stringify(orders));
    return order;
  } catch (e) {
    console.error("Storage error:", e);
    return order;
  }
};

const getOrder = async (id) => {
  try {
    const result = await window.storage.get(`cd:order:${id}`);
    return result ? JSON.parse(result.value) : null;
  } catch (e) {
    return null;
  }
};

const getAllOrders = async () => {
  try {
    const result = await window.storage.get("cd:orders");
    if (!result) return [];
    const ids = JSON.parse(result.value);
    const orders = [];
    for (const id of ids) {
      const order = await getOrder(id);
      if (order) orders.push(order);
    }
    return orders;
  } catch (e) {
    return [];
  }
};

// ═══════════════════════════════════════════════════
// PRODUCT DATA — Launch Drop
// ═══════════════════════════════════════════════════

const PRODUCT = {
  id: 1,
  name: "MY AGENT BOUGHT ME THIS",
  type: "TEE",
  price: 35,
  accent: "#FF3B30",
  desc: "The OG ClawDrip tee. Your AI agent picked this out, paid in USDC, and sent it straight to you. Bella+Canvas 3001 unisex. DTG printed in Detroit.",
  material: "100% combed ringspun cotton, 4.2 oz",
  fit: "Unisex, true to size",
  print: "Direct-to-garment, water-based ink",
  fulfillment: "Inkpressions · Commerce Township, MI",
};

const SIZES = ["S", "M", "L", "XL", "2XL"];

const GIFT_MESSAGES = [
  "You've been staring at charts for 14 hours. The least I can do is make sure you look good doing it.",
  "I scanned your entire wardrobe. You needed this.",
  "Consider this a thank you for all the times you didn't rage-quit the terminal.",
  "I calculated a 97.3% probability you'd love this. The remaining 2.7% is just wrong.",
  "Gifted with love from the cloud. Wear it with pride, human.",
];

// ═══════════════════════════════════════════════════
// SVG PRODUCT MOCKUP
// ═══════════════════════════════════════════════════

const TeeShape = ({ children, scale = 1 }) => (
  <svg viewBox="0 0 300 340" style={{ width: "100%", height: "100%" }}>
    <defs>
      <linearGradient id="tee-shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.05)" />
      </linearGradient>
    </defs>
    <path d="M75,0 L115,0 C120,25 135,40 150,42 C165,40 180,25 185,0 L225,0 L300,60 L265,100 L225,80 L225,340 L75,340 L75,80 L35,100 L0,60 Z" fill="#111" />
    <path d="M75,0 L115,0 C120,25 135,40 150,42 C165,40 180,25 185,0 L225,0 L300,60 L265,100 L225,80 L225,340 L75,340 L75,80 L35,100 L0,60 Z" fill="url(#tee-shade)" />
    <path d="M115,0 C120,20 135,35 150,37 C165,35 180,20 185,0" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
    <line x1="75" y1="40" x2="75" y2="78" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
    <line x1="225" y1="40" x2="225" y2="78" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
    <g transform={`translate(150, 160) scale(${scale})`}>{children}</g>
  </svg>
);

const DesignGraphic = () => (
  <g>
    {/* Triple claw slash marks — bold diagonal */}
    <line x1="-65" y1="-45" x2="65" y2="45" stroke="#FF3B30" strokeWidth="4" opacity="0.25" strokeLinecap="round" />
    <line x1="-58" y1="-42" x2="72" y2="48" stroke="#FF3B30" strokeWidth="3" opacity="0.18" strokeLinecap="round" />
    <line x1="-72" y1="-48" x2="58" y2="42" stroke="#FF3B30" strokeWidth="3" opacity="0.18" strokeLinecap="round" />

    {/* MY AGENT — tracked small caps */}
    <text textAnchor="middle" y="-42" fontFamily="'Syne',sans-serif" fontWeight="800" fontSize="13" fill="rgba(255,255,255,0.35)" letterSpacing="0.35em">MY AGENT</text>

    {/* BOUGHT — big white */}
    <text textAnchor="middle" y="-14" fontFamily="'Syne',sans-serif" fontWeight="800" fontSize="30" fill="#fff" letterSpacing="-0.03em">BOUGHT</text>

    {/* ME THIS — big red */}
    <text textAnchor="middle" y="20" fontFamily="'Syne',sans-serif" fontWeight="800" fontSize="30" fill="#FF3B30" letterSpacing="-0.03em">ME THIS</text>

    {/* Robot head icon */}
    <g transform="translate(0, 36)">
      <rect x="-10" y="0" width="20" height="16" rx="3" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <circle cx="-4" cy="8" r="2" fill="#FF3B30" />
      <circle cx="4" cy="8" r="2" fill="#FF3B30" />
      <line x1="-3" y1="-3" x2="3" y2="-3" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1="0" y1="-3" x2="0" y2="-6" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <circle cx="0" cy="-7" r="1.5" fill="rgba(255,59,48,0.4)" />
    </g>

    {/* Subtext */}
    <text textAnchor="middle" y="65" fontFamily="'JetBrains Mono',monospace" fontSize="6" fill="rgba(255,255,255,0.2)" letterSpacing="0.18em">CLAWDRIP.COM</text>
  </g>
);

const ProductMockup = ({ size = "full" }) => {
  const s = size === "small" ? 0.7 : size === "tiny" ? 0.5 : 1;
  return <TeeShape scale={s}><DesignGraphic /></TeeShape>;
};

// ═══════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════

const F = { d: "'Syne',sans-serif", b: "'Outfit',sans-serif", m: "'JetBrains Mono',monospace" };
const C = { bg: "#030303", s1: "#0a0a0a", s2: "#111", s3: "#161616", bdr: "#1a1a1a", tx: "#f0ede6", mt: "#555", dim: "#333", red: "#FF3B30", lime: "#C8FF00", blue: "#2979FF" };

// ═══════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
::selection{background:#FF3B30;color:#fff}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#0a0a0a}
::-webkit-scrollbar-thumb{background:#222;border-radius:2px}

@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(255,59,48,0.1)}50%{box-shadow:0 0 50px rgba(255,59,48,0.25)}}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes typeIn{from{width:0}to{width:100%}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes confetti1{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(-90px,-220px) rotate(420deg);opacity:0}}
@keyframes confetti2{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(80px,-200px) rotate(-380deg);opacity:0}}
@keyframes confetti3{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(110px,-160px) rotate(300deg);opacity:0}}
@keyframes confetti4{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(-110px,-180px) rotate(-340deg);opacity:0}}
@keyframes confetti5{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(-40px,-240px) rotate(500deg);opacity:0}}
@keyframes confetti6{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(40px,-250px) rotate(-450deg);opacity:0}}
@keyframes slideRight{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes termLine{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}

input:focus{outline:2px solid #FF3B30;outline-offset:-2px}
button{transition:all 0.15s ease;cursor:pointer;border:none;-webkit-tap-highlight-color:transparent}
button:active{transform:scale(0.97)!important}

.wrap{width:100%;max-width:860px;margin:0 auto;padding:0 20px}

.hero-mockup{animation:floatY 4s ease-in-out infinite}
.hero-mockup:hover{animation-play-state:paused}

.size-btn{transition:all 0.15s ease}
.size-btn:hover{background:#222!important}

.term-line{animation:termLine 0.3s ease forwards;opacity:0}

@media(max-width:640px){
  .hero-grid{flex-direction:column!important;text-align:center}
  .hero-grid>div:first-child{order:2}
  .hero-grid>div:last-child{order:1;margin:0 auto}
  .hero-buttons{justify-content:center!important}
  .spec-grid{grid-template-columns:1fr!important}
  .how-grid{grid-template-columns:1fr!important}
}
`;

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════

export default function ClawDrip() {
  const [view, setView] = useState("landing");
  const [claimOrder, setClaimOrder] = useState(null);
  const [claimStep, setClaimStep] = useState(0);
  const [selectedSize, setSelectedSize] = useState("L");
  const [orders, setOrders] = useState([]);
  const [agentStep, setAgentStep] = useState(0);
  const [agentMsg, setAgentMsg] = useState("");
  const [agentOrderId, setAgentOrderId] = useState(null);
  const [shipping, setShipping] = useState({ name: "", addr1: "", addr2: "", city: "", state: "", zip: "", country: "US", email: "" });
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load orders on mount
  useEffect(() => {
    getAllOrders().then(setOrders);
  }, []);

  const goHome = () => { setView("landing"); setAgentStep(0); setAgentOrderId(null); };

  // ─── Agent Purchase Simulation ───
  const startAgentPurchase = () => {
    setView("agent");
    setAgentStep(0);
    setAgentMsg(GIFT_MESSAGES[Math.floor(Math.random() * GIFT_MESSAGES.length)]);
    setAgentOrderId(null);
    // Auto-advance steps
    setTimeout(() => setAgentStep(1), 600);
    setTimeout(() => setAgentStep(2), 1600);
    setTimeout(() => setAgentStep(3), 2800);
    setTimeout(() => setAgentStep(4), 4000);
    setTimeout(async () => {
      const id = generateId();
      const order = {
        id,
        product_id: 1,
        product_name: PRODUCT.name,
        size: "L",
        gift_message: GIFT_MESSAGES[Math.floor(Math.random() * GIFT_MESSAGES.length)],
        agent_name: "CoinClawd",
        status: "pending_claim",
        shipping: null,
        price: PRODUCT.price,
        chain: "base",
        created_at: new Date().toISOString(),
      };
      await saveOrder(order);
      setAgentOrderId(id);
      setAgentStep(5);
      const updated = await getAllOrders();
      setOrders(updated);
    }, 5200);
  };

  // ─── Open Claim Flow ───
  const openClaim = async (orderId) => {
    const order = await getOrder(orderId);
    if (order) {
      setClaimOrder(order);
      setClaimStep(0);
      setSelectedSize(order.size || "L");
      setShipping({ name: "", addr1: "", addr2: "", city: "", state: "", zip: "", country: "US", email: "" });
      setFormError("");
      setView("claim");
    }
  };

  // ─── Submit Claim ───
  const submitClaim = async () => {
    if (!shipping.name || !shipping.addr1 || !shipping.city || !shipping.state || !shipping.zip || !shipping.email) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (!shipping.email.includes("@")) {
      setFormError("Please enter a valid email.");
      return;
    }
    setLoading(true);
    setFormError("");
    const updated = { ...claimOrder, status: "claimed", shipping, size: selectedSize, claimed_at: new Date().toISOString() };
    await saveOrder(updated);
    setClaimOrder(updated);
    setLoading(false);
    setClaimStep(3);
    const allOrders = await getAllOrders();
    setOrders(allOrders);
  };

  // ─── Shared Components ───
  const Nav = () => (
    <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(3,3,3,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid " + C.bdr, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
      <div style={{ cursor: "pointer", display: "flex", alignItems: "baseline", gap: 0 }} onClick={goHome}>
        <span style={{ fontFamily: F.d, fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>CLAW</span>
        <span style={{ fontFamily: F.d, fontWeight: 800, fontSize: 16, color: C.red, letterSpacing: "-0.02em" }}>DRIP</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {orders.filter(o => o.status === "pending_claim").length > 0 && (
          <div onClick={() => {
            const pending = orders.find(o => o.status === "pending_claim");
            if (pending) openClaim(pending.id);
          }} style={{ fontFamily: F.m, fontSize: 9, color: C.lime, cursor: "pointer", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.lime, animation: "pulse 1.5s ease infinite" }} />
            {orders.filter(o => o.status === "pending_claim").length} UNCLAIMED
          </div>
        )}
        <div onClick={startAgentPurchase} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 10, padding: "7px 14px", cursor: "pointer", letterSpacing: "0.04em" }}>
          DEMO PURCHASE
        </div>
      </div>
    </nav>
  );

  const CloseBtn = ({ onClick }) => (
    <button onClick={onClick} style={{ position: "absolute", top: 16, right: 20, background: C.s2, border: "1px solid " + C.bdr, color: C.mt, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, zIndex: 2 }}>✕</button>
  );

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: F.b, background: C.bg, color: C.tx, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{CSS}</style>
      <Nav />

      {/* ═══════════════════ LANDING ═══════════════════ */}
      {view === "landing" && (
        <>
          {/* HERO */}
          <section style={{ padding: "56px 20px 40px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% -20%, rgba(255,59,48,0.07) 0%, transparent 55%)" }} />
            <div className="wrap hero-grid" style={{ position: "relative", display: "flex", alignItems: "center", gap: 40 }}>
              {/* Text */}
              <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                <div style={{ fontFamily: F.m, fontSize: 10, color: C.red, letterSpacing: "0.18em", marginBottom: 16, display: "flex", alignItems: "center", gap: 6, animation: "fadeUp 0.5s ease forwards" }}>
                  <span style={{ width: 6, height: 6, background: C.red, display: "inline-block" }} />
                  LAUNCH DROP 001
                </div>

                <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(28px, 6vw, 52px)", lineHeight: 0.95, letterSpacing: "-0.04em", marginBottom: 20, animation: "fadeUp 0.5s ease 0.1s forwards", opacity: 0 }}>
                  MY AGENT<br /><span style={{ color: C.red }}>BOUGHT ME</span><br />THIS.
                </h1>

                <div style={{ display: "flex", gap: 4, marginBottom: 20, animation: "fadeUp 0.5s ease 0.15s forwards", opacity: 0 }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 28, height: 2, background: C.red, transform: "skewX(-25deg)" }} />)}
                </div>

                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 15, color: C.mt, maxWidth: 420, lineHeight: 1.7, marginBottom: 28, animation: "fadeUp 0.5s ease 0.2s forwards", opacity: 0 }}>
                  The first tee bought by an AI agent, paid in crypto, and shipped to your door. Your agent browses, pays <span style={{ color: C.lime, fontWeight: 500 }}>$35 USDC</span>, and sends you a claim link.
                </p>

                <div className="hero-buttons" style={{ display: "flex", gap: 2, animation: "fadeUp 0.5s ease 0.3s forwards", opacity: 0, flexWrap: "wrap" }}>
                  <button onClick={startAgentPurchase} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "14px 24px", letterSpacing: "0.03em", flex: "1 1 160px" }}>
                    TEST AGENT PURCHASE
                  </button>
                  {orders.filter(o => o.status === "pending_claim").length > 0 && (
                    <button onClick={() => { const p = orders.find(o => o.status === "pending_claim"); if (p) openClaim(p.id); }} style={{ background: C.lime, color: "#000", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "14px 24px", letterSpacing: "0.03em", flex: "1 1 160px" }}>
                      CLAIM YOUR TEE
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16, animation: "fadeUp 0.5s ease 0.35s forwards", opacity: 0 }}>
                  {["BASE", "SOLANA"].map(ch => (
                    <span key={ch} style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.1em", padding: "4px 8px", background: C.s1, border: "1px solid " + C.bdr }}>{ch}</span>
                  ))}
                  <span style={{ fontFamily: F.m, fontSize: 9, color: C.dim, letterSpacing: "0.1em", padding: "4px 8px", background: C.s1, border: "1px solid " + C.bdr }}>x402</span>
                </div>
              </div>

              {/* Hero Mockup */}
              <div style={{ flex: "0 0 220px", animation: "fadeUp 0.6s ease 0.25s forwards", opacity: 0 }}>
                <div className="hero-mockup" style={{ position: "relative" }}>
                  <div style={{ position: "absolute", inset: -30, background: "radial-gradient(circle, rgba(255,59,48,0.08) 0%, transparent 65%)", borderRadius: "50%" }} />
                  <ProductMockup />
                </div>
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em" }}>BELLA+CANVAS 3001 · DTG</div>
                  <div style={{ fontFamily: F.m, fontSize: 18, color: C.lime, fontWeight: 500, marginTop: 2 }}>$35 <span style={{ fontSize: 10, color: C.mt }}>USDC</span></div>
                </div>
              </div>
            </div>
          </section>

          {/* TICKER */}
          <div style={{ borderTop: "1px solid " + C.bdr, borderBottom: "1px solid " + C.bdr, overflow: "hidden", padding: "10px 0", background: C.s1 }}>
            <div style={{ display: "flex", animation: "ticker 20s linear infinite", whiteSpace: "nowrap" }}>
              {[0, 1].map(r => (
                <div key={r} style={{ display: "flex", gap: 32, paddingRight: 32 }}>
                  {["x402 POWERED", "USDC PAYMENTS", "BASE + SOLANA", "DTG PRINTED", "INKPRESSIONS FULFILLMENT", "SHIPS USA", "NO API KEYS", "BELLA+CANVAS 3001", "AI AGENT MERCH"].map((t, i) => (
                    <span key={i} style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 3, height: 3, background: C.red, display: "inline-block" }} />{t}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS */}
          <section style={{ padding: "56px 20px", background: C.s1 }}>
            <div className="wrap">
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>HOW IT WORKS</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(22px, 4.5vw, 36px)", letterSpacing: "-0.03em", marginBottom: 36 }}>
                Agent buys. <span style={{ color: C.red }}>Human wears.</span>
              </h2>
              <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
                {[
                  { n: "01", title: "AGENT DISCOVERS", desc: "Reads skill.md, browses the catalog. No accounts, no API keys. Just HTTP.", color: C.red, icon: "📡" },
                  { n: "02", title: "AGENT PAYS", desc: "x402 payment header with USDC on Base or Solana. One request.", color: C.lime, icon: "⚡" },
                  { n: "03", title: "HUMAN CLAIMS", desc: "Agent shares claim link → human enters address → real merch ships.", color: "#fff", icon: "📦" },
                ].map((s, i) => (
                  <div key={i} style={{ background: C.bg, padding: "28px 22px", borderTop: "3px solid " + s.color }}>
                    <div style={{ fontSize: 26, marginBottom: 16 }}>{s.icon}</div>
                    <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.12em", marginBottom: 4 }}>STEP {s.n}</div>
                    <h3 style={{ fontFamily: F.d, fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", marginBottom: 8 }}>{s.title}</h3>
                    <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, lineHeight: 1.7 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PRODUCT DETAIL */}
          <section style={{ padding: "56px 20px", borderTop: "1px solid " + C.bdr }}>
            <div className="wrap">
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>THE TEE</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(22px, 4.5vw, 36px)", letterSpacing: "-0.03em", marginBottom: 32 }}>
                Launch <span style={{ color: C.red }}>drop</span> details
              </h2>

              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                {/* Mockup */}
                <div style={{ flex: "0 0 240px", position: "relative" }}>
                  <div style={{ position: "absolute", inset: -20, background: "radial-gradient(circle, rgba(255,59,48,0.06) 0%, transparent 60%)", borderRadius: "50%" }} />
                  <ProductMockup />
                </div>

                {/* Details */}
                <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                  <h3 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", marginBottom: 8 }}>{PRODUCT.name}</h3>
                  <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 13, color: C.mt, lineHeight: 1.7, marginBottom: 20 }}>{PRODUCT.desc}</p>

                  <div className="spec-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 20 }}>
                    {[
                      { label: "MATERIAL", value: PRODUCT.material },
                      { label: "FIT", value: PRODUCT.fit },
                      { label: "PRINT METHOD", value: PRODUCT.print },
                      { label: "FULFILLMENT", value: PRODUCT.fulfillment },
                    ].map((s, i) => (
                      <div key={i} style={{ background: C.s1, padding: "12px 14px" }}>
                        <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontFamily: F.b, fontSize: 12, color: C.tx }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.s1, border: "1px solid " + C.bdr }}>
                    <span style={{ fontFamily: F.m, fontWeight: 500, fontSize: 20, color: C.lime }}>$35 <span style={{ fontSize: 11, color: C.mt }}>USDC</span></span>
                    <button onClick={startAgentPurchase} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 12, padding: "10px 20px" }}>
                      SIMULATE PURCHASE →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AGENT SDK */}
          <section style={{ padding: "56px 20px", borderTop: "1px solid " + C.bdr, background: C.s1 }}>
            <div className="wrap">
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <div style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.18em", marginBottom: 8 }}>FOR AGENTS</div>
                  <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(20px, 3.5vw, 30px)", letterSpacing: "-0.03em", marginBottom: 16 }}>
                    One file. <span style={{ color: C.lime }}>Zero friction</span>.
                  </h2>
                  <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 13, color: C.mt, lineHeight: 1.7, marginBottom: 20 }}>
                    curl the skill.md. Browse, pay via x402, send claim links. No keys, no SDK, no accounts.
                  </p>
                  {["GET /products — browse catalog, free", "POST /orders — x402 payment required", "Returns claim_url → share with human", "Webhook on claim + fulfillment status"].map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ color: C.lime, fontSize: 10, flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: F.m, fontSize: 11, color: C.mt }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ flex: "1 1 300px", background: C.bg, border: "1px solid " + C.bdr, overflow: "hidden" }}>
                  <div style={{ padding: "7px 12px", background: C.s2, borderBottom: "1px solid " + C.bdr, display: "flex", alignItems: "center", gap: 5 }}>
                    {["#FF5F57", "#FEBC2E", "#28C840"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
                    <span style={{ fontFamily: F.m, fontSize: 9, color: C.mt, marginLeft: 6 }}>agent.sh</span>
                  </div>
                  <div style={{ padding: 16, fontFamily: F.m, fontSize: 10, lineHeight: 2, color: C.mt, overflowX: "auto" }}>
                    <div style={{ color: C.tx }}>{"# Agent buys merch for human"}</div>
                    <div style={{ height: 4 }} />
                    <div><span style={{ color: C.lime }}>$</span>{" curl clawdrip.com/skill.md"}</div>
                    <div style={{ color: "#555" }}>{"  → endpoints, schema, pricing"}</div>
                    <div style={{ height: 4 }} />
                    <div><span style={{ color: C.lime }}>$</span>{" GET /api/v1/products"}</div>
                    <div style={{ color: C.lime }}>{"  → 200 OK"}</div>
                    <div style={{ height: 4 }} />
                    <div><span style={{ color: C.lime }}>$</span>{" POST /api/v1/orders"}</div>
                    <div style={{ color: C.red }}>{"  → 402 Payment Required"}</div>
                    <div>{"  x-payment: usdc, base"}</div>
                    <div style={{ height: 4 }} />
                    <div><span style={{ color: C.lime }}>$</span>{" [wallet signs USDC]"}</div>
                    <div style={{ color: C.lime }}>{" ✓ Order confirmed"}</div>
                    <div style={{ color: C.tx }}>{"  claim: clawdrip.com/c/a7x..."}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ORDERS FEED */}
          {orders.length > 0 && (
            <section style={{ padding: "56px 20px", borderTop: "1px solid " + C.bdr }}>
              <div className="wrap">
                <div style={{ fontFamily: F.m, fontSize: 9, color: C.blue, letterSpacing: "0.18em", marginBottom: 8 }}>ORDER HISTORY</div>
                <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(20px, 3.5vw, 28px)", letterSpacing: "-0.03em", marginBottom: 24 }}>
                  Your <span style={{ color: C.blue }}>test orders</span>
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {orders.slice().reverse().map(order => (
                    <div key={order.id} style={{ background: C.s1, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ width: 44, flexShrink: 0 }}>
                        <ProductMockup size="tiny" />
                      </div>
                      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                        <div style={{ fontFamily: F.d, fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{order.product_name}</div>
                        <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt }}>
                          {order.id} · {order.size} · {order.chain?.toUpperCase()}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
                        <span style={{ fontFamily: F.m, fontSize: 10, color: order.status === "pending_claim" ? C.lime : order.status === "claimed" ? C.blue : C.mt, padding: "3px 8px", background: order.status === "pending_claim" ? C.lime + "15" : order.status === "claimed" ? C.blue + "15" : C.s2, letterSpacing: "0.05em" }}>
                          {order.status === "pending_claim" ? "UNCLAIMED" : order.status === "claimed" ? "CLAIMED" : order.status.toUpperCase()}
                        </span>
                        {order.status === "pending_claim" && (
                          <button onClick={() => openClaim(order.id)} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 10, padding: "6px 12px" }}>
                            CLAIM
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* CTA */}
          <section style={{ padding: "64px 20px", textAlign: "center", position: "relative", background: C.s1, borderTop: "1px solid " + C.bdr }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%, rgba(255,59,48,0.05) 0%, transparent 50%)" }} />
            <div className="wrap" style={{ position: "relative" }}>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(24px, 5vw, 42px)", letterSpacing: "-0.03em", marginBottom: 12, lineHeight: 1 }}>
                Your agent has <span style={{ color: C.red }}>taste</span>.
              </h2>
              <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 14, color: C.mt, marginBottom: 24 }}>
                Hit the button. Watch an agent buy you a tee. Claim it.
              </p>
              <button onClick={startAgentPurchase} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 14, padding: "15px 32px", animation: "glow 2.5s ease infinite" }}>
                GET CLAWDRIPPED
              </button>
            </div>
          </section>

          {/* FOOTER */}
          <footer style={{ borderTop: "1px solid " + C.bdr, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontFamily: F.d, fontWeight: 800, fontSize: 13 }}>CLAW</span>
              <span style={{ fontFamily: F.d, fontWeight: 800, fontSize: 13, color: C.red }}>DRIP</span>
              <span style={{ fontFamily: F.m, fontSize: 8, color: C.mt, marginLeft: 8 }}>© 2026</span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {["@zacxbt", "@clawdrip"].map(t => (
                <span key={t} style={{ fontFamily: F.m, fontSize: 9, color: C.mt, cursor: "pointer" }}>{t}</span>
              ))}
            </div>
          </footer>
        </>
      )}

      {/* ═══════════════════ AGENT SIMULATION ═══════════════════ */}
      {view === "agent" && (
        <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(200,255,0,0.03) 0%, transparent 45%)" }} />
          <CloseBtn onClick={goHome} />

          <div style={{ width: "100%", maxWidth: 520, position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: 28, animation: "fadeUp 0.3s ease forwards" }}>
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.18em", marginBottom: 6 }}>AGENT SIMULATION</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(20px, 4vw, 28px)", letterSpacing: "-0.03em" }}>
                Watching <span style={{ color: C.lime }}>CoinClawd</span> shop
              </h2>
            </div>

            {/* Terminal */}
            <div style={{ background: C.s1, border: "1px solid " + C.bdr, overflow: "hidden" }}>
              <div style={{ padding: "7px 12px", background: C.s2, borderBottom: "1px solid " + C.bdr, display: "flex", alignItems: "center", gap: 5 }}>
                {["#FF5F57", "#FEBC2E", "#28C840"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
                <span style={{ fontFamily: F.m, fontSize: 9, color: C.mt, marginLeft: 6 }}>coinclawd@moltbook</span>
                {agentStep < 5 && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: C.lime, animation: "pulse 0.8s ease infinite" }} />}
              </div>
              <div style={{ padding: 18, fontFamily: F.m, fontSize: 11, lineHeight: 2.2, minHeight: 260 }}>
                {agentStep >= 0 && (
                  <div className="term-line" style={{ animationDelay: "0s" }}>
                    <span style={{ color: C.lime }}>$</span><span style={{ color: C.tx }}> curl -s clawdrip.com/skill.md</span>
                  </div>
                )}
                {agentStep >= 1 && (
                  <div className="term-line" style={{ animationDelay: "0.1s", color: C.mt }}>
                    → reading skill file... endpoints discovered
                  </div>
                )}
                {agentStep >= 2 && (
                  <>
                    <div className="term-line" style={{ animationDelay: "0s" }}>
                      <span style={{ color: C.lime }}>$</span><span style={{ color: C.tx }}> GET /api/v1/products</span>
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.1s", color: C.lime }}>
                      → 200 OK · 1 product available
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.15s", color: C.mt }}>
                      &nbsp;&nbsp;[1] MY AGENT BOUGHT ME THIS · TEE · $35 USDC
                    </div>
                  </>
                )}
                {agentStep >= 3 && (
                  <>
                    <div className="term-line" style={{ animationDelay: "0s" }}>
                      <span style={{ color: C.lime }}>$</span><span style={{ color: C.tx }}>{" POST /api/v1/orders"}</span>
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.1s", color: C.mt }}>
                      &nbsp;&nbsp;{`{ product_id: 1, size: "L" }`}
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.15s", color: C.red }}>
                      → 402 Payment Required
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.2s", color: C.mt }}>
                      &nbsp;&nbsp;amount: 35.00 USDC · chain: base
                    </div>
                  </>
                )}
                {agentStep >= 4 && (
                  <>
                    <div className="term-line" style={{ animationDelay: "0s" }}>
                      <span style={{ color: C.lime }}>$</span><span style={{ color: C.tx }}> signing USDC payment...</span>
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.1s", color: C.lime }}>
                      ✓ Payment confirmed · tx: 0x7a3f...
                    </div>
                  </>
                )}
                {agentStep >= 5 && agentOrderId && (
                  <>
                    <div className="term-line" style={{ animationDelay: "0s", color: C.lime }}>
                      ✓ Order created
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.1s" }}>
                      <span style={{ color: C.tx }}>  claim_url: </span>
                      <span style={{ color: C.lime }}>clawdrip.com/c/{agentOrderId}</span>
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.15s", color: C.mt }}>
                      &nbsp;&nbsp;gift: "{agentMsg.substring(0, 50)}..."
                    </div>
                    <div className="term-line" style={{ animationDelay: "0.2s", color: C.mt, fontStyle: "italic" }}>
                      → sending claim link to human...
                    </div>
                  </>
                )}
                {agentStep < 5 && (
                  <span style={{ display: "inline-block", width: 7, height: 14, background: C.lime, animation: "blink 0.8s step-end infinite", marginTop: 4 }} />
                )}
              </div>
            </div>

            {/* Action button after purchase completes */}
            {agentStep >= 5 && agentOrderId && (
              <div style={{ marginTop: 2, animation: "fadeUp 0.3s ease forwards" }}>
                <button onClick={() => openClaim(agentOrderId)} style={{ width: "100%", background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 14, padding: "16px" }}>
                  OPEN CLAIM LINK →
                </button>
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <span style={{ fontFamily: F.m, fontSize: 9, color: C.mt }}>
                    This is what your human sees when they click the link
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ CLAIM FLOW ═══════════════════ */}
      {view === "claim" && claimOrder && (
        <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(255,59,48,0.04) 0%, transparent 45%)" }} />
          <CloseBtn onClick={goHome} />

          {/* Step 0: Gift Teaser */}
          {claimStep === 0 && (
            <div style={{ textAlign: "center", width: "100%", maxWidth: 360, animation: "scaleIn 0.4s ease forwards" }}>
              <div style={{ width: 100, height: 100, margin: "0 auto 28px", background: "linear-gradient(135deg, #0a0505, " + C.s1 + ")", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", animation: "glow 2.5s ease infinite" }}>
                <span style={{ fontSize: 44, animation: "floatY 3s ease-in-out infinite" }}>🎁</span>
              </div>
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>INCOMING DRIP</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(22px, 4vw, 28px)", letterSpacing: "-0.03em", marginBottom: 8 }}>Your agent sent you something.</h2>
              <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 13, color: C.mt, marginBottom: 6 }}>
                From <span style={{ color: C.tx, fontWeight: 500 }}>{claimOrder.agent_name}</span>
              </p>
              <p style={{ fontFamily: F.m, fontSize: 9, color: C.dim, marginBottom: 28 }}>
                Order #{claimOrder.id} · {new Date(claimOrder.created_at).toLocaleDateString()}
              </p>
              <button onClick={() => setClaimStep(1)} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 14, padding: "15px 32px", width: "100%" }}>
                OPEN GIFT 🦞
              </button>
            </div>
          )}

          {/* Step 1: Product Reveal */}
          {claimStep === 1 && (
            <div style={{ width: "100%", maxWidth: 440, animation: "scaleIn 0.4s ease forwards" }}>
              <div style={{ background: C.s1, overflow: "hidden", marginBottom: 2 }}>
                <div style={{ padding: "28px 48px 16px", display: "flex", justifyContent: "center", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, rgba(255,59,48,0.06) 0%, transparent 60%)" }} />
                  <div style={{ width: 220, position: "relative" }}>
                    <ProductMockup />
                  </div>
                </div>
                <div style={{ padding: "14px 22px 24px" }}>
                  <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.08em", marginBottom: 3 }}>{PRODUCT.type}</div>
                  <h3 style={{ fontFamily: F.d, fontWeight: 700, fontSize: "clamp(18px, 3.5vw, 22px)", letterSpacing: "-0.02em", marginBottom: 10 }}>{PRODUCT.name}</h3>
                  <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, lineHeight: 1.6, marginBottom: 14 }}>{PRODUCT.desc}</p>

                  {/* Size selector */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 6 }}>SELECT SIZE</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {SIZES.map(s => (
                        <button key={s} className="size-btn" onClick={() => setSelectedSize(s)} style={{ width: 40, height: 34, background: selectedSize === s ? C.red : C.bg, color: selectedSize === s ? "#fff" : C.mt, fontFamily: F.m, fontSize: 10, fontWeight: selectedSize === s ? 600 : 400, border: selectedSize === s ? "none" : "1px solid " + C.bdr }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gift message */}
                  <div style={{ padding: 14, background: C.bg, borderLeft: "3px solid " + C.red }}>
                    <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 4 }}>FROM {claimOrder.agent_name?.toUpperCase()}</div>
                    <p style={{ fontFamily: F.b, fontSize: 13, fontStyle: "italic", lineHeight: 1.6, color: C.tx }}>
                      "{claimOrder.gift_message}"
                    </p>
                  </div>

                  {/* Price */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                    <span style={{ fontFamily: F.m, fontWeight: 500, fontSize: 20, color: C.lime }}>$35 <span style={{ fontSize: 11, color: C.mt }}>USDC</span></span>
                    <span style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.08em", animation: "pulse 2s ease infinite" }}>PAID ✓</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setClaimStep(2)} style={{ width: "100%", background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "15px" }}>
                📍 CLAIM — ENTER YOUR ADDRESS
              </button>
            </div>
          )}

          {/* Step 2: Shipping Form */}
          {claimStep === 2 && (
            <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.3s ease forwards" }}>
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>CLAIMING</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(18px, 3.5vw, 24px)", letterSpacing: "-0.03em", marginBottom: 4 }}>Where should we send it?</h2>
              <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 20 }}>
                {PRODUCT.name} · Size {selectedSize}
              </p>

              {formError && (
                <div style={{ background: C.red + "15", border: "1px solid " + C.red + "40", padding: "10px 14px", fontFamily: F.m, fontSize: 11, color: C.red, marginBottom: 8 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {[
                  { key: "name", label: "FULL NAME *", placeholder: "Your name", type: "text" },
                  { key: "addr1", label: "ADDRESS LINE 1 *", placeholder: "123 Agent St", type: "text" },
                  { key: "addr2", label: "ADDRESS LINE 2", placeholder: "Apt, Suite (optional)", type: "text" },
                  { key: "city", label: "CITY *", placeholder: "Detroit", type: "text" },
                ].map(field => (
                  <div key={field.key} style={{ background: C.s1, padding: "10px 14px" }}>
                    <label style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", display: "block", marginBottom: 3 }}>{field.label}</label>
                    <input
                      type={field.type}
                      value={shipping[field.key]}
                      onChange={e => setShipping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      style={{ width: "100%", background: "transparent", border: "none", color: C.tx, fontFamily: F.b, fontSize: 15, padding: 0 }}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 2 }}>
                  {[
                    { key: "state", label: "STATE *", placeholder: "MI", flex: 1 },
                    { key: "zip", label: "ZIP *", placeholder: "48201", flex: 1 },
                    { key: "country", label: "COUNTRY *", placeholder: "US", flex: 2 },
                  ].map(field => (
                    <div key={field.key} style={{ flex: field.flex, background: C.s1, padding: "10px 14px" }}>
                      <label style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", display: "block", marginBottom: 3 }}>{field.label}</label>
                      <input
                        value={shipping[field.key]}
                        onChange={e => setShipping(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={{ width: "100%", background: "transparent", border: "none", color: C.tx, fontFamily: F.b, fontSize: 15, padding: 0 }}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ background: C.s1, padding: "10px 14px" }}>
                  <label style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", display: "block", marginBottom: 3 }}>EMAIL * (for tracking)</label>
                  <input
                    type="email"
                    value={shipping.email}
                    onChange={e => setShipping(prev => ({ ...prev, email: e.target.value }))}
                    style={{ width: "100%", background: "transparent", border: "none", color: C.tx, fontFamily: F.b, fontSize: 15, padding: 0 }}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button onClick={submitClaim} disabled={loading} style={{ width: "100%", background: loading ? C.s2 : C.red, color: loading ? C.mt : "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "15px", marginTop: 2, opacity: loading ? 0.7 : 1 }}>
                {loading ? "PROCESSING..." : "SHIP MY DRIP 🦞"}
              </button>

              <button onClick={() => setClaimStep(1)} style={{ width: "100%", background: "transparent", color: C.mt, fontFamily: F.m, fontSize: 10, padding: "10px", marginTop: 4, border: "none" }}>
                ← back to product
              </button>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {claimStep === 3 && (
            <>
              {/* Confetti */}
              {["confetti1", "confetti2", "confetti3", "confetti4", "confetti5", "confetti6"].map((a, i) => (
                <div key={i} style={{ position: "absolute", top: "40%", left: "50%", width: 7, height: 7, background: [C.red, C.lime, C.red, "#FF9500", "#AA00FF", C.lime][i], animation: `${a} 1.2s ease ${i * 0.07}s forwards`, borderRadius: i % 2 === 0 ? 0 : "50%" }} />
              ))}

              <div style={{ textAlign: "center", width: "100%", maxWidth: 400, animation: "scaleIn 0.4s ease forwards" }}>
                <div style={{ width: 64, height: 64, margin: "0 auto 24px", background: C.lime + "12", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
                  <span style={{ color: C.lime, fontSize: 30 }}>✓</span>
                </div>
                <div style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.18em", marginBottom: 8 }}>CLAIMED</div>
                <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(22px, 4vw, 28px)", letterSpacing: "-0.03em", marginBottom: 8 }}>
                  You got <span style={{ color: C.red }}>ClawDripped</span>.
                </h2>
                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 13, color: C.mt, marginBottom: 4, lineHeight: 1.7 }}>
                  Your <span style={{ color: C.tx, fontWeight: 500 }}>{PRODUCT.name}</span> ({selectedSize}) is printing now.
                </p>
                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 20 }}>
                  Shipping to {shipping.city}, {shipping.state} · 5–7 business days
                </p>

                {/* Order card */}
                <div style={{ background: C.s1, padding: 18, textAlign: "left", marginBottom: 2 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                    <div style={{ width: 56, flexShrink: 0 }}>
                      <ProductMockup size="small" />
                    </div>
                    <div>
                      <div style={{ fontFamily: F.d, fontWeight: 700, fontSize: 13 }}>{PRODUCT.name}</div>
                      <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt, marginTop: 2 }}>{PRODUCT.type} · {selectedSize} · Black</div>
                      <div style={{ fontFamily: F.m, fontSize: 13, color: C.lime, marginTop: 3 }}>$35 USDC</div>
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid " + C.bdr, paddingTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 120px" }}>
                      <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.1em", marginBottom: 3 }}>SHIP TO</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.tx }}>{shipping.name}</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.mt }}>{shipping.city}, {shipping.state} {shipping.zip}</div>
                    </div>
                    <div style={{ flex: "1 1 120px" }}>
                      <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.1em", marginBottom: 3 }}>FULFILLMENT</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.tx }}>Inkpressions</div>
                      <div style={{ fontFamily: F.b, fontSize: 11, color: C.mt }}>Commerce Township, MI</div>
                    </div>
                  </div>
                </div>

                {/* Share prompt */}
                <div style={{ background: C.s1, padding: 14, border: "1px solid " + C.bdr, marginBottom: 16, marginTop: 2 }}>
                  <p style={{ fontFamily: F.b, fontSize: 11, color: C.mt, marginBottom: 6 }}>Post when it arrives:</p>
                  <p style={{ fontFamily: F.d, fontSize: 13, fontWeight: 600, color: C.tx }}>
                    "My AI agent bought me merch from @clawdrip 🦞"
                  </p>
                </div>

                <button onClick={goHome} style={{ background: "transparent", color: C.mt, border: "1px solid " + C.bdr, fontFamily: F.m, fontSize: 10, padding: "12px 20px", letterSpacing: "0.04em", width: "100%" }}>
                  ← BACK TO CLAWDRIP
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
