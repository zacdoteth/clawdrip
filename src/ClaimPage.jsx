import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || '';

const F = { d: "'Syne',sans-serif", b: "'Outfit',sans-serif", m: "'JetBrains Mono',monospace" };
const C = { bg: "#030303", s1: "#0a0a0a", s2: "#111", s3: "#161616", bdr: "#1a1a1a", tx: "#f0ede6", mt: "#555", dim: "#333", red: "#FF3B30", lime: "#C8FF00", blue: "#2979FF" };

const SIZES = ["S", "M", "L", "XL", "2XL"];

const ProductMockup = () => (
  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <img src="/tee1.png" alt="MY AGENT BOUGHT ME THIS - ClawDrip Tee" style={{ width: "100%", height: "auto", objectFit: "contain" }} />
  </div>
);

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
::selection{background:#FF3B30;color:#fff}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(255,59,48,0.1)}50%{box-shadow:0 0 50px rgba(255,59,48,0.25)}}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes confetti1{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(-90px,-220px) rotate(420deg);opacity:0}}
@keyframes confetti2{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(80px,-200px) rotate(-380deg);opacity:0}}
@keyframes confetti3{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(110px,-160px) rotate(300deg);opacity:0}}
@keyframes confetti4{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(-110px,-180px) rotate(-340deg);opacity:0}}
@keyframes confetti5{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(-40px,-240px) rotate(500deg);opacity:0}}
@keyframes confetti6{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(40px,-250px) rotate(-450deg);opacity:0}}
input:focus{outline:2px solid #FF3B30;outline-offset:-2px}
button{transition:all 0.15s ease;cursor:pointer;border:none;-webkit-tap-highlight-color:transparent}
button:active{transform:scale(0.97)!important}
.size-btn{transition:all 0.15s ease}
.size-btn:hover{background:#222!important}
`;

export default function ClaimPage() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [claimStep, setClaimStep] = useState(0);
  const [selectedSize, setSelectedSize] = useState("L");
  const [shipping, setShipping] = useState({ name: "", addr1: "", addr2: "", city: "", state: "", zip: "", country: "US", email: "" });
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch order from API
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/orders/${orderNumber}`);
        if (!res.ok) {
          if (res.status === 404) {
            setLoadError("Order not found. Please check your claim link.");
          } else {
            setLoadError("Something went wrong. Please try again.");
          }
          setLoading(false);
          return;
        }
        const data = await res.json();
        setOrder(data);
        setSelectedSize(data.product?.size || "L");
        setLoading(false);
      } catch (err) {
        setLoadError("Could not connect to server. Please try again.");
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderNumber]);

  // Submit claim to backend API
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

    try {
      const res = await fetch(`${API_BASE}/api/v1/orders/${orderNumber}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shipping.name,
          address1: shipping.addr1,
          address2: shipping.addr2,
          city: shipping.city,
          state: shipping.state,
          zip: shipping.zip,
          country: shipping.country,
          email: shipping.email,
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setClaimStep(3);
      } else {
        setFormError(data.error || "Failed to claim order. Please try again.");
      }
    } catch (err) {
      setFormError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Already claimed — show a message
  const isAlreadyClaimed = order && order.status !== 'pending_claim';

  return (
    <div style={{ background: C.bg, color: C.tx, minHeight: "100vh", fontFamily: F.b }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid " + C.bdr }}>
        <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.04em", cursor: "pointer" }} onClick={() => navigate("/")}>
          <span style={{ color: C.tx }}>CLAW</span><span style={{ color: C.red }}>DRIP</span>
        </div>
        <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.12em" }}>CLAIM</div>
      </div>

      <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(255,59,48,0.04) 0%, transparent 45%)" }} />

        {/* Loading */}
        {loading && !order && !loadError && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 48, height: 48, margin: "0 auto 20px", border: "2px solid " + C.bdr, borderTop: "2px solid " + C.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ fontFamily: F.m, fontSize: 11, color: C.mt }}>Loading order...</p>
          </div>
        )}

        {/* Error */}
        {loadError && (
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🦞</div>
            <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Oops</h2>
            <p style={{ fontFamily: F.b, fontSize: 14, color: C.mt, marginBottom: 20 }}>{loadError}</p>
            <button onClick={() => navigate("/")} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "12px 28px" }}>
              GO HOME
            </button>
          </div>
        )}

        {/* Already claimed */}
        {order && isAlreadyClaimed && claimStep !== 3 && (
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 20px", background: C.lime + "12", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
              <span style={{ color: C.lime, fontSize: 30 }}>✓</span>
            </div>
            <div style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.18em", marginBottom: 8 }}>ALREADY CLAIMED</div>
            <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>This order is on its way.</h2>
            <p style={{ fontFamily: F.b, fontSize: 13, color: C.mt, marginBottom: 20, lineHeight: 1.6 }}>
              Order #{order.orderNumber} has already been claimed. Check your email for tracking info.
            </p>
            <button onClick={() => navigate(`/track/${order.orderNumber}`)} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "12px 28px" }}>
              TRACK ORDER
            </button>
          </div>
        )}

        {/* Step 0: Gift Teaser */}
        {order && !isAlreadyClaimed && claimStep === 0 && (
          <div style={{ textAlign: "center", width: "100%", maxWidth: 360, animation: "scaleIn 0.4s ease forwards" }}>
            <div style={{ width: 100, height: 100, margin: "0 auto 28px", background: "linear-gradient(135deg, #0a0505, " + C.s1 + ")", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", animation: "glow 2.5s ease infinite" }}>
              <span style={{ fontSize: 44, animation: "floatY 3s ease-in-out infinite" }}>🎁</span>
            </div>
            <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>INCOMING DRIP</div>
            <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(22px, 4vw, 28px)", letterSpacing: "-0.03em", marginBottom: 8 }}>Your agent sent you something.</h2>
            {order.agent && (
              <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 13, color: C.mt, marginBottom: 6 }}>
                From <span style={{ color: C.tx, fontWeight: 500 }}>{order.agent.name}</span>
              </p>
            )}
            <p style={{ fontFamily: F.m, fontSize: 9, color: C.dim, marginBottom: 28 }}>
              Order #{order.orderNumber}
            </p>
            <button onClick={() => setClaimStep(1)} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 14, padding: "15px 32px", width: "100%" }}>
              OPEN GIFT 🦞
            </button>
          </div>
        )}

        {/* Step 1: Product Reveal */}
        {order && !isAlreadyClaimed && claimStep === 1 && (
          <div style={{ width: "100%", maxWidth: 440, animation: "scaleIn 0.4s ease forwards" }}>
            <div style={{ background: C.s1, overflow: "hidden", marginBottom: 2 }}>
              <div style={{ padding: "28px 48px 16px", display: "flex", justifyContent: "center", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, rgba(255,59,48,0.06) 0%, transparent 60%)" }} />
                <div style={{ width: 220, position: "relative" }}>
                  <ProductMockup />
                </div>
              </div>
              <div style={{ padding: "14px 22px 24px" }}>
                <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.08em", marginBottom: 3 }}>TEE</div>
                <h3 style={{ fontFamily: F.d, fontWeight: 700, fontSize: "clamp(18px, 3.5vw, 22px)", letterSpacing: "-0.02em", marginBottom: 10 }}>{order.product?.name || "MY AGENT BOUGHT ME THIS"}</h3>
                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, lineHeight: 1.6, marginBottom: 14 }}>
                  The OG ClawDrip tee. Your AI agent picked this out, paid in USDC, and sent it straight to you. Bella+Canvas 3001 unisex. DTG printed in Detroit.
                </p>

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
                {order.agent?.message && (
                  <div style={{ padding: 14, background: C.bg, borderLeft: "3px solid " + C.red }}>
                    <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 4 }}>FROM {order.agent.name?.toUpperCase()}</div>
                    <p style={{ fontFamily: F.b, fontSize: 13, fontStyle: "italic", lineHeight: 1.6, color: C.tx }}>
                      "{order.agent.message}"
                    </p>
                  </div>
                )}

                {/* Price */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <span style={{ fontFamily: F.m, fontWeight: 500, fontSize: 20, color: C.lime }}>
                    ${order.price?.amount || 35} <span style={{ fontSize: 11, color: C.mt }}>USDC</span>
                  </span>
                  <span style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.08em" }}>PAID ✓</span>
                </div>
              </div>
            </div>
            <button onClick={() => setClaimStep(2)} style={{ width: "100%", background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "15px" }}>
              📍 CLAIM — ENTER YOUR ADDRESS
            </button>
          </div>
        )}

        {/* Step 2: Shipping Form */}
        {order && !isAlreadyClaimed && claimStep === 2 && (
          <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.3s ease forwards" }}>
            <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>CLAIMING</div>
            <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(18px, 3.5vw, 24px)", letterSpacing: "-0.03em", marginBottom: 4 }}>Where should we send it?</h2>
            <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 20 }}>
              {order.product?.name || "MY AGENT BOUGHT ME THIS"} · Size {selectedSize}
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
                Your <span style={{ color: C.tx, fontWeight: 500 }}>{order?.product?.name || "MY AGENT BOUGHT ME THIS"}</span> ({selectedSize}) is printing now.
              </p>
              <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 24 }}>
                Shipping to {shipping.city}, {shipping.state} · 5-7 business days
              </p>

              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => navigate(`/track/${order?.orderNumber || orderNumber}`)} style={{ background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "12px 24px" }}>
                  TRACK ORDER
                </button>
                <button onClick={() => navigate("/")} style={{ background: C.s1, color: C.tx, fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "12px 24px", border: "1px solid " + C.bdr }}>
                  HOME
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
