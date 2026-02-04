import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ═══════════════════════════════════════════════════
// CLAWDRIP 💧 POINTS & TIER CALCULATION
// ═══════════════════════════════════════════════════

const DRIP = '💧'; // The official CLAWDRIP points symbol

const calculateTier = (balance) => {
  if (balance >= 500) {
    return { tier: 'Diamond Drip', tierEmoji: '💎', discount: 15, nextTier: null, toNextTier: 0 };
  }
  if (balance >= 150) {
    return { tier: 'Gold Drip', tierEmoji: '🥇', discount: 10, nextTier: 'Diamond Drip', toNextTier: 500 - balance };
  }
  if (balance >= 50) {
    return { tier: 'Silver Drip', tierEmoji: '🥈', discount: 5, nextTier: 'Gold Drip', toNextTier: 150 - balance };
  }
  return { tier: 'Base', tierEmoji: '💧', discount: 0, nextTier: 'Silver Drip', toNextTier: 50 - balance };
};

// ═══════════════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════════════

const getClawBalance = async () => {
  try {
    const result = await window.storage.get("cd:claw_balance");
    return result ? parseInt(result.value, 10) : 0;
  } catch (e) {
    return 0;
  }
};

const setClawBalance = async (balance) => {
  try {
    await window.storage.set("cd:claw_balance", String(balance));
  } catch (e) {
    console.error("Storage error:", e);
  }
};

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
  shipping: "Ships in 24-48 hours via UPS/FedEx",
};

// Shipping restrictions
const SHIPPING_INFO = {
  domestic: { carrier: "UPS, FedEx, USPS", time: "2-5 business days" },
  international: { carrier: "UPS, FedEx, USPS", time: "7-21 business days" },
  restricted: ["Russia", "Belarus", "North Korea", "Iran", "Syria", "Cuba", "Crimea", "Donetsk", "Luhansk"],
};

const SIZES = ["S", "M", "L", "XL", "2XL"];

const WALLET_ADDRESS = "0xd9baf332b462a774ee8ec5ba8e54d43dfaab7093";
const PAYMENT_AMOUNT = 35;
const ADMIN_SECRET = "clawboss";
const NOTIFICATION_EMAIL = ""; // Set your email for notifications

const GIFT_MESSAGES = [
  "You've been staring at charts for 14 hours. The least I can do is make sure you look good doing it.",
  "I scanned your entire wardrobe. You needed this.",
  "Consider this a thank you for all the times you didn't rage-quit the terminal.",
  "I calculated a 97.3% probability you'd love this. The remaining 2.7% is just wrong.",
  "Gifted with love from the cloud. Wear it with pride, human.",
];

// ═══════════════════════════════════════════════════
// SUPPLY CONSTANTS (10,000-unit drop)
// ═══════════════════════════════════════════════════

const TOTAL_SUPPLY = 10000;

// ═══════════════════════════════════════════════════
// PRODUCT MOCKUP (using actual shirt image)
// ═══════════════════════════════════════════════════

const ProductMockup = ({ size = "full" }) => {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <img
        src="/tee1.png"
        alt="MY AGENT BOUGHT ME THIS - ClawDrip Tee"
        style={{
          width: "100%",
          height: "auto",
          objectFit: "contain"
        }}
      />
    </div>
  );
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
@keyframes urgencyPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,59,48,0.4)}50%{box-shadow:0 0 0 8px rgba(255,59,48,0)}}
@keyframes countDown{from{stroke-dashoffset:0}to{stroke-dashoffset:283}}
@keyframes celebrateShake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-2px)}20%,40%,60%,80%{transform:translateX(2px)}}
@keyframes treasureRise{0%{transform:translateY(20px) scale(0.8);opacity:0}60%{transform:translateY(-10px) scale(1.1)}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes progressFill{from{width:0}to{width:100%}}

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
  .hero-section{padding-top:64px!important;padding-bottom:32px!important}
  .hero-grid{flex-direction:column!important;text-align:center;gap:24px!important}
  .hero-grid>div:first-child{order:2}
  .hero-grid>div:last-child{order:1;margin:0 auto;flex:0 0 auto!important;width:100%!important;max-width:280px!important}
  .hero-buttons{justify-content:center!important;gap:8px!important}
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
  const [buyStep, setBuyStep] = useState(0);
  const [selectedSize, setSelectedSize] = useState("L");
  const [orders, setOrders] = useState([]);
  const [clawBalance, setClawBalanceState] = useState(0);
  const [agentStep, setAgentStep] = useState(0);
  const [walletCopied, setWalletCopied] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [agentMsg, setAgentMsg] = useState("");
  const [agentOrderId, setAgentOrderId] = useState(null);
  const [shipping, setShipping] = useState({ name: "", addr1: "", addr2: "", city: "", state: "", zip: "", country: "US", email: "" });
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  // ─── NEW: Supply & Reservation State ───
  const [supply, setSupply] = useState({ remaining: TOTAL_SUPPLY, sold: 0, soldLast5min: 0, status: 'AVAILABLE' });
  const [reservation, setReservation] = useState(null);
  const [reservationExpiry, setReservationExpiry] = useState(null);
  const [tierInfo, setTierInfo] = useState(() => calculateTier(0));
  const [paymentState, setPaymentState] = useState('idle'); // idle, processing, success, error
  const [showConfetti, setShowConfetti] = useState(false);
  const [priceInfo, setPriceInfo] = useState({ price: 35, originalPrice: 35, discount: 0 });
  const eventSourceRef = useRef(null);
  const reservationTimerRef = useRef(null);

  // Load orders and CLAWDRIP 💧 balance on mount
  useEffect(() => {
    getAllOrders().then(setOrders);
    getClawBalance().then(bal => {
      setClawBalanceState(bal);
      setTierInfo(calculateTier(bal));
    });
  }, []);

  // ─── SSE: Real-time supply counter ───
  useEffect(() => {
    const connectSSE = () => {
      const es = new EventSource(`${API_BASE}/api/v1/supply`);

      es.addEventListener('supply', (e) => {
        try {
          const data = JSON.parse(e.data);
          setSupply(prev => ({
            ...prev,
            remaining: data.remaining,
            sold: data.sold,
            soldLast5min: data.soldLast5min || 0,
            status: data.remaining === 0 ? 'SOLD_OUT' :
                    data.remaining < 100 ? 'ALMOST_GONE' :
                    data.remaining < 1000 ? 'SELLING_FAST' : 'AVAILABLE'
          }));
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      });

      es.addEventListener('soldout', () => {
        setSupply(prev => ({ ...prev, remaining: 0, status: 'SOLD_OUT' }));
      });

      es.addEventListener('velocity', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.soldLast5min > 10) {
            setSupply(prev => ({ ...prev, soldLast5min: data.soldLast5min }));
          }
        } catch (err) {}
      });

      es.onerror = () => {
        es.close();
        // Reconnect after 3s
        setTimeout(connectSSE, 3000);
      };

      eventSourceRef.current = es;
    };

    // Fetch initial status then connect SSE
    fetch(`${API_BASE}/api/v1/supply/status`)
      .then(res => res.json())
      .then(data => {
        if (data.supply) {
          setSupply({
            remaining: data.supply.remaining,
            sold: data.supply.sold,
            soldLast5min: data.velocity?.soldLast5min || 0,
            status: data.status
          });
        }
        connectSSE();
      })
      .catch(() => {
        // If API not available, use defaults and still try SSE
        connectSSE();
      });

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // ─── Reservation countdown timer ───
  useEffect(() => {
    if (!reservationExpiry) {
      if (reservationTimerRef.current) {
        clearInterval(reservationTimerRef.current);
      }
      return;
    }

    const tick = () => {
      const now = new Date();
      const expiry = new Date(reservationExpiry);
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));

      if (remaining <= 0) {
        // Reservation expired - try to extend (Fairy Bottle save)
        if (reservation?.id && supply.remaining > 0) {
          fetch(`${API_BASE}/api/v1/orders/${reservation.id}/extend`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setReservationExpiry(data.reservation.expiresAt);
              } else {
                setReservation(null);
                setReservationExpiry(null);
              }
            })
            .catch(() => {
              setReservation(null);
              setReservationExpiry(null);
            });
        } else {
          setReservation(null);
          setReservationExpiry(null);
        }
      }
    };

    reservationTimerRef.current = setInterval(tick, 1000);
    tick();

    return () => {
      if (reservationTimerRef.current) {
        clearInterval(reservationTimerRef.current);
      }
    };
  }, [reservationExpiry, reservation, supply.remaining]);

  // Calculate remaining time for display
  const getReservationTimeRemaining = () => {
    if (!reservationExpiry) return null;
    const now = new Date();
    const expiry = new Date(reservationExpiry);
    const secs = Math.max(0, Math.floor((expiry - now) / 1000));
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return { mins, secs: s, total: secs, isLow: secs < 60 };
  };

  // Secret admin code listener (type "clawboss" anywhere)
  useEffect(() => {
    const handleKeyPress = (e) => {
      const newInput = (adminInput + e.key).slice(-ADMIN_SECRET.length);
      setAdminInput(newInput);
      if (newInput === ADMIN_SECRET) {
        setAdminMode(true);
        setView("admin");
        setAdminInput("");
      }
    };
    if (!adminMode) {
      window.addEventListener("keypress", handleKeyPress);
      return () => window.removeEventListener("keypress", handleKeyPress);
    }
  }, [adminInput, adminMode]);

  const goHome = () => { setView("landing"); setAgentStep(0); setAgentOrderId(null); setBuyStep(0); setAdminMode(false); };

  // ─── Admin Functions ───
  const updateOrderStatus = async (orderId, newStatus) => {
    const order = await getOrder(orderId);
    if (order) {
      order.status = newStatus;
      order.updated_at = new Date().toISOString();
      await saveOrder(order);
      const allOrders = await getAllOrders();
      setOrders(allOrders);
    }
  };

  const getOrderStats = () => {
    const total = orders.length;
    const paid = orders.filter(o => o.status === "paid").length;
    const shipped = orders.filter(o => o.status === "shipped").length;
    const claimed = orders.filter(o => o.status === "claimed").length;
    const revenue = orders.filter(o => ["paid", "shipped", "claimed"].includes(o.status)).length * PRODUCT.price;
    return { total, paid, shipped, claimed, revenue };
  };

  const exportOrdersCSV = () => {
    const headers = ["Order ID", "Status", "Name", "Email", "Address", "City", "State", "Zip", "Size", "Created", "Price"];
    const rows = orders.map(o => [
      o.id,
      o.status,
      o.shipping?.name || "",
      o.shipping?.email || "",
      o.shipping?.addr1 || "",
      o.shipping?.city || "",
      o.shipping?.state || "",
      o.shipping?.zip || "",
      o.size,
      o.created_at,
      "$" + (o.price || PRODUCT.price)
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clawdrip-orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // ─── Direct Buy Flow ───
  const startBuy = () => {
    // Check if sold out
    if (supply.status === 'SOLD_OUT') {
      return;
    }

    // Calculate price with discount
    const originalPrice = PRODUCT.price;
    const currentTier = calculateTier(clawBalance);
    const discountedPrice = originalPrice * (1 - currentTier.discount / 100);

    setPriceInfo({
      price: discountedPrice,
      originalPrice: originalPrice,
      discount: currentTier.discount
    });

    setView("buy");
    setBuyStep(0);
    setSelectedSize("L");
    setShipping({ name: "", addr1: "", addr2: "", city: "", state: "", zip: "", country: "US", email: "" });
    setFormError("");
    setPaymentState('idle');
    setReservation(null);
    setReservationExpiry(null);
  };

  const proceedToPayment = async () => {
    if (!shipping.name || !shipping.addr1 || !shipping.city || !shipping.state || !shipping.zip || !shipping.email) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (!shipping.email.includes("@")) {
      setFormError("Please enter a valid email.");
      return;
    }
    setFormError("");
    setLoading(true);

    try {
      // Call backend API to create reservation
      const response = await fetch(`${API_BASE}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': walletAddress || '',
        },
        body: JSON.stringify({
          size: selectedSize,
          agentName: 'Direct Purchase',
          giftMessage: null
        })
      });

      const data = await response.json();

      if (response.status === 402) {
        // Expected 402 Payment Required with reservation details
        setReservation({ id: data.reservation.id });
        setReservationExpiry(data.reservation.expiresAt);
        setPriceInfo({
          price: data.priceCents / 100,
          originalPrice: data.originalPriceCents / 100,
          discount: data.discount?.percent || 0
        });

        // Update supply from response
        if (data.supply) {
          setSupply(prev => ({
            ...prev,
            remaining: data.supply.remaining,
            sold: data.supply.sold,
            soldLast5min: data.supply.soldLast5min || 0
          }));
        }

        // Update tier info from response
        if (data.clawdrip) {
          setTierInfo({
            tier: data.clawdrip.tier,
            tierEmoji: data.clawdrip.tierEmoji,
            discount: data.clawdrip.discount || 0,
            nextTier: data.clawdrip.nextTier,
            toNextTier: data.clawdrip.toNextTier
          });
        }

        setBuyStep(2);
      } else if (response.status === 410) {
        // Sold out
        setFormError("Sorry, this drop has sold out!");
        setSupply(prev => ({ ...prev, remaining: 0, status: 'SOLD_OUT' }));
      } else if (response.status === 409) {
        // Version conflict - retry
        setFormError("Please try again.");
      } else {
        setFormError(data.error || "Failed to create reservation. Please try again.");
      }
    } catch (err) {
      console.error('Reservation error:', err);
      // Fallback to simulated reservation if API unavailable
      const reservationId = generateId();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      setReservation({ id: reservationId });
      setReservationExpiry(expiresAt);
      setBuyStep(2);
    } finally {
      setLoading(false);
    }
  };

  const copyWalletAddress = async () => {
    try {
      await navigator.clipboard.writeText(WALLET_ADDRESS);
      setWalletCopied(true);
      setTimeout(() => setWalletCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const confirmPayment = async () => {
    setLoading(true);
    setPaymentState('processing');

    try {
      // Call backend API to confirm the reservation
      const response = await fetch(`${API_BASE}/api/v1/orders/${reservation?.id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentHash: '0x' + generateId() + generateId() + generateId(), // Simulated hash
          agentName: 'Direct Purchase',
          giftMessage: null
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Use data from API response
        const clawEarned = data.clawdrip?.earned || Math.floor(priceInfo.originalPrice);
        const newBalance = data.clawdrip?.newBalance || (clawBalance + clawEarned);

        const order = {
          id: data.order.orderNumber || data.order.id,
          product_id: 1,
          product_name: data.order.product?.name || PRODUCT.name,
          size: data.order.product?.size || selectedSize,
          agent_name: "Direct Purchase",
          status: "paid",
          shipping,
          price: data.order.price?.amount || priceInfo.price,
          original_price: data.order.price?.originalAmount || priceInfo.originalPrice,
          discount_percent: data.order.price?.discount?.percent || priceInfo.discount,
          discount_tier: data.order.price?.discount?.tier || (priceInfo.discount > 0 ? tierInfo.tier : null),
          chain: "base",
          created_at: new Date().toISOString(),
          claw_earned: clawEarned,
          clawd: data.clawd,
          tankUrl: data.tankUrl,
          claimUrl: data.claimUrl
        };

        // Save to localStorage as backup
        await saveOrder(order);

        // Update CLAWDRIP 💧 balance
        await setClawBalance(newBalance);
        setClawBalanceState(newBalance);
        setTierInfo(data.clawdrip || calculateTier(newBalance));
        setClaimOrder(order);

        // Update supply from response
        if (data.supply) {
          setSupply(prev => ({
            ...prev,
            remaining: data.supply.remaining,
            sold: data.supply.sold
          }));
        }

        setPaymentState('success');

        // Trigger confetti celebration!
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        setBuyStep(3);
      } else {
        // Handle errors
        console.error('Payment confirmation failed:', data);
        setPaymentState('error');

        // Fallback to localStorage-based order
        const id = generateId();
        const clawEarned = Math.floor(priceInfo.originalPrice);
        const order = {
          id,
          product_id: 1,
          product_name: PRODUCT.name,
          size: selectedSize,
          agent_name: "Direct Purchase",
          status: "paid",
          shipping,
          price: priceInfo.price,
          original_price: priceInfo.originalPrice,
          discount_percent: priceInfo.discount,
          discount_tier: priceInfo.discount > 0 ? tierInfo.tier : null,
          chain: "base",
          created_at: new Date().toISOString(),
          claw_earned: clawEarned,
        };
        await saveOrder(order);

        const newBalance = clawBalance + clawEarned;
        await setClawBalance(newBalance);
        setClawBalanceState(newBalance);
        setTierInfo(calculateTier(newBalance));
        setClaimOrder(order);

        setPaymentState('success');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        setBuyStep(3);
      }
    } catch (err) {
      console.error('Payment confirmation error:', err);
      // Fallback to localStorage-based order on network error
      const id = generateId();
      const clawEarned = Math.floor(priceInfo.originalPrice);
      const order = {
        id,
        product_id: 1,
        product_name: PRODUCT.name,
        size: selectedSize,
        agent_name: "Direct Purchase",
        status: "paid",
        shipping,
        price: priceInfo.price,
        original_price: priceInfo.originalPrice,
        discount_percent: priceInfo.discount,
        discount_tier: priceInfo.discount > 0 ? tierInfo.tier : null,
        chain: "base",
        created_at: new Date().toISOString(),
        claw_earned: clawEarned,
      };
      await saveOrder(order);

      const newBalance = clawBalance + clawEarned;
      await setClawBalance(newBalance);
      setClawBalanceState(newBalance);
      setTierInfo(calculateTier(newBalance));
      setClaimOrder(order);

      setPaymentState('success');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      setBuyStep(3);
    } finally {
      // Clear reservation
      setReservation(null);
      setReservationExpiry(null);
      setLoading(false);

      const allOrders = await getAllOrders();
      setOrders(allOrders);
    }
  };

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
    const clawEarned = claimOrder.price || PRODUCT.price;
    const updated = { ...claimOrder, status: "claimed", shipping, size: selectedSize, claimed_at: new Date().toISOString(), claw_earned: clawEarned };
    await saveOrder(updated);
    setClaimOrder(updated);
    // Award CLAWDRIP 💧 tokens
    const newBalance = clawBalance + clawEarned;
    await setClawBalance(newBalance);
    setClawBalanceState(newBalance);
    setLoading(false);
    setClaimStep(3);
    const allOrders = await getAllOrders();
    setOrders(allOrders);
  };

  // ─── Generate Share Image ───
  const generateShareImage = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, 600, 800);

    // Subtle gradient overlay
    const grad = ctx.createRadialGradient(300, 300, 0, 300, 300, 400);
    grad.addColorStop(0, "rgba(255, 59, 48, 0.08)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 800);

    // Header
    ctx.font = "bold 42px 'Syne', sans-serif";
    ctx.fillStyle = "#f0ede6";
    ctx.textAlign = "center";
    ctx.fillText("CLAW", 265, 70);
    ctx.fillStyle = "#FF3B30";
    ctx.fillText("DRIP", 365, 70);

    // Tee silhouette (simplified)
    ctx.save();
    ctx.translate(300, 320);
    ctx.scale(1.3, 1.3);
    ctx.beginPath();
    // Simplified t-shirt path
    ctx.moveTo(-75, -100);
    ctx.lineTo(-35, -100);
    ctx.quadraticCurveTo(-30, -75, 0, -68);
    ctx.quadraticCurveTo(30, -75, 35, -100);
    ctx.lineTo(75, -100);
    ctx.lineTo(100, -50);
    ctx.lineTo(65, -30);
    ctx.lineTo(75, 100);
    ctx.lineTo(-75, 100);
    ctx.lineTo(-65, -30);
    ctx.lineTo(-100, -50);
    ctx.closePath();
    ctx.fillStyle = "#111";
    ctx.fill();
    // Design text on tee
    ctx.font = "bold 11px 'Syne', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("MY AGENT", 0, -30);
    ctx.font = "bold 20px 'Syne', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("BOUGHT", 0, -5);
    ctx.fillStyle = "#FF3B30";
    ctx.fillText("ME THIS", 0, 20);
    ctx.restore();

    // Main text
    ctx.font = "bold 32px 'Syne', sans-serif";
    ctx.fillStyle = "#f0ede6";
    ctx.textAlign = "center";
    ctx.fillText("MY AGENT BOUGHT", 300, 540);
    ctx.fillText("ME THIS", 300, 580);

    // Order details
    ctx.font = "500 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#555";
    ctx.fillText(`ORDER #${claimOrder?.id?.toUpperCase() || "--------"}`, 300, 620);
    ctx.fillText(`AGENT: ${claimOrder?.agent_name || "CoinClawd"}`, 300, 645);

    // CLAWDRIP 💧 badge
    ctx.fillStyle = "#C8FF00";
    ctx.font = "bold 24px 'Syne', sans-serif";
    ctx.fillText(`+${claimOrder?.claw_earned || PRODUCT.price} CLAWDRIP 💧`, 300, 695);

    // Footer
    ctx.font = "500 12px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#333";
    ctx.fillText("clawdrip.com", 300, 760);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  };

  const handleCopyImage = async () => {
    try {
      const blob = await generateShareImage();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (e) {
      console.error("Failed to copy image:", e);
    }
  };

  const handleShareX = () => {
    const text = encodeURIComponent("My AI agent bought me merch from @clawdrip 🦞");
    const url = encodeURIComponent("https://clawdrip.com");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  // ─── Shared Components ───

  // Supply Counter Component (real-time)
  const SupplyCounter = ({ compact = false }) => {
    const percentSold = Math.round((supply.sold / TOTAL_SUPPLY) * 100);
    const isUrgent = supply.remaining < 100 || supply.soldLast5min > 10;

    if (compact) {
      return (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: F.m, fontSize: 12,
          background: C.s1,
          padding: "6px 12px",
          border: "1px solid " + C.bdr
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: supply.status === 'SOLD_OUT' ? C.dim : isUrgent ? C.red : C.lime
          }} />
          <span style={{ fontWeight: 600, color: C.tx, fontSize: 14 }}>{supply.remaining.toLocaleString()}</span>
          <span style={{ color: C.mt, fontSize: 11 }}>left</span>
        </div>
      );
    }

    return (
      <div style={{
        background: C.s1, border: "1px solid " + C.bdr,
        padding: "12px 16px", marginBottom: 16
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.1em" }}>
            LIMITED DROP
          </div>
          {supply.soldLast5min > 5 && (
            <div style={{
              fontFamily: F.m, fontSize: 9, color: C.red,
              display: "flex", alignItems: "center", gap: 4,
              animation: "pulse 1s ease infinite"
            }}>
              <span style={{ fontSize: 11 }}>🔥</span>
              {supply.soldLast5min} sold in 5 min
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
          <span style={{
            fontFamily: F.d, fontWeight: 800,
            fontSize: 28, color: isUrgent ? C.red : C.tx
          }}>
            {supply.remaining.toLocaleString()}
          </span>
          <span style={{ fontFamily: F.m, fontSize: 12, color: C.mt }}>
            / {TOTAL_SUPPLY.toLocaleString()} remaining
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: C.s2, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${percentSold}%`,
            background: isUrgent ? C.red : C.lime,
            transition: "width 0.5s ease"
          }} />
        </div>

        {supply.status === 'SOLD_OUT' && (
          <div style={{
            marginTop: 10, fontFamily: F.d, fontWeight: 700,
            fontSize: 14, color: C.red, textAlign: "center"
          }}>
            SOLD OUT
          </div>
        )}
      </div>
    );
  };

  // Tier Badge Component
  const TierBadge = ({ balance, showProgress = false }) => {
    const info = calculateTier(balance);
    if (!info.tierEmoji && !showProgress) return null;

    return (
      <div style={{
        background: info.discount > 0 ? (
          info.tier === 'Diamond Claw' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' :
          info.tier === 'Gold Claw' ? 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' :
          'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)'
        ) : C.s2,
        padding: "8px 12px",
        display: "inline-flex", alignItems: "center", gap: 6,
        border: info.discount > 0 ? "none" : "1px solid " + C.bdr
      }}>
        {info.tierEmoji && <span>{info.tierEmoji}</span>}
        <span style={{ fontFamily: F.m, fontSize: 10, fontWeight: 500, color: "#fff" }}>
          {info.tier}
        </span>
        {info.discount > 0 && (
          <span style={{
            fontFamily: F.m, fontSize: 9,
            background: "rgba(255,255,255,0.2)", padding: "2px 6px"
          }}>
            -{info.discount}%
          </span>
        )}
      </div>
    );
  };

  // Reservation Timer Component
  const ReservationTimer = () => {
    const time = getReservationTimeRemaining();
    if (!time) return null;

    return (
      <div style={{
        background: time.isLow ? C.red + "20" : C.s1,
        border: "1px solid " + (time.isLow ? C.red : C.bdr),
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
        animation: time.isLow ? "urgencyPulse 1s ease infinite" : "none"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke={C.dim} strokeWidth="2" />
            <circle
              cx="10" cy="10" r="8" fill="none"
              stroke={time.isLow ? C.red : C.lime}
              strokeWidth="2"
              strokeDasharray="50.265"
              strokeDashoffset={50.265 * (1 - time.total / 300)}
              transform="rotate(-90 10 10)"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <span style={{ fontFamily: F.m, fontSize: 11, color: time.isLow ? C.red : C.tx }}>
            {time.isLow ? "⚠️ " : ""}Reservation expires in
          </span>
        </div>
        <span style={{
          fontFamily: F.m, fontWeight: 600, fontSize: 14,
          color: time.isLow ? C.red : C.lime
        }}>
          {time.mins}:{String(time.secs).padStart(2, '0')}
        </span>
      </div>
    );
  };

  // Confetti Component
  const Confetti = () => {
    if (!showConfetti) return null;
    const colors = [C.red, C.lime, '#FFD700', '#FF69B4', '#00CED1', '#FF6347'];
    return (
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1000 }}>
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 50 + 50}%`,
            width: Math.random() * 10 + 5,
            height: Math.random() * 10 + 5,
            background: colors[Math.floor(Math.random() * colors.length)],
            transform: `rotate(${Math.random() * 360}deg)`,
            animation: `confetti${(i % 6) + 1} ${Math.random() * 1 + 1}s ease forwards`
          }} />
        ))}
      </div>
    );
  };

  // Price Display with Discount
  const PriceDisplay = ({ showRewards = true }) => {
    const hasDiscount = priceInfo.discount > 0;
    const savings = priceInfo.originalPrice - priceInfo.price;

    return (
      <div style={{
        background: C.bg, border: "1px solid " + C.bdr,
        padding: "14px 16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasDiscount ? 8 : 0 }}>
          <div>
            <span style={{
              fontFamily: F.m, fontWeight: 600, fontSize: 22,
              color: hasDiscount ? C.lime : C.tx
            }}>
              ${priceInfo.price.toFixed(2)}
            </span>
            {hasDiscount && (
              <span style={{
                fontFamily: F.m, fontSize: 14, color: C.mt,
                textDecoration: "line-through", marginLeft: 8
              }}>
                ${priceInfo.originalPrice.toFixed(2)}
              </span>
            )}
            <span style={{ fontFamily: F.m, fontSize: 11, color: C.mt, marginLeft: 6 }}>USDC</span>
          </div>
          {showRewards && (
            <span style={{ fontFamily: F.m, fontSize: 11, color: C.lime, letterSpacing: "0.05em" }}>
              +{Math.floor(priceInfo.originalPrice)} CLAWDRIP 💧
            </span>
          )}
        </div>

        {hasDiscount && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            paddingTop: 8, borderTop: "1px solid " + C.bdr
          }}>
            <TierBadge balance={clawBalance} />
            <span style={{ fontFamily: F.m, fontSize: 10, color: C.lime }}>
              You save ${savings.toFixed(2)}!
            </span>
          </div>
        )}
      </div>
    );
  };

  const Nav = () => {
    const unclaimedCount = orders.filter(o => o.status === "pending_claim").length;

    return (
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Logo */}
          <div
            style={{ cursor: "pointer", display: "flex", alignItems: "baseline", gap: 0 }}
            onClick={goHome}
          >
            <span style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: "#fff" }}>CLAW</span>
            <span style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, color: C.red, letterSpacing: "-0.02em" }}>DRIP</span>
          </div>

          {/* Tagline */}
          <span style={{
            fontFamily: F.m,
            fontSize: 10,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.05em"
          }}>
            gifts from your agent
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Unclaimed badge */}
          {unclaimedCount > 0 && (
            <button
              onClick={() => {
                const pending = orders.find(o => o.status === "pending_claim");
                if (pending) openClaim(pending.id);
              }}
              style={{
                fontFamily: F.d,
                fontSize: 12,
                fontWeight: 700,
                color: "#000",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: C.lime,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none"
              }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#000",
                animation: "pulse 1.5s ease infinite"
              }} />
              {unclaimedCount} to claim
            </button>
          )}

          {/* Demo button */}
          <button
            onClick={startAgentPurchase}
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              fontFamily: F.d,
              fontWeight: 600,
              fontSize: 12,
              padding: "8px 16px",
              cursor: "pointer",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }}
          >
            Demo
          </button>
        </div>
      </nav>
    );
  };

  const CloseBtn = ({ onClick }) => (
    <button onClick={onClick} style={{ position: "absolute", top: 16, right: 20, background: C.s2, border: "1px solid " + C.bdr, color: C.mt, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, zIndex: 2 }}>✕</button>
  );

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: F.b, background: C.bg, color: C.tx, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{CSS}</style>
      <Confetti />
      <Nav />

      {/* ═══════════════════ LANDING ═══════════════════ */}
      {view === "landing" && (
        <>
          {/* HERO */}
          <section className="hero-section" style={{ padding: "56px 20px 40px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% -20%, rgba(255,59,48,0.07) 0%, transparent 55%)" }} />
            <div className="wrap hero-grid" style={{ position: "relative", display: "flex", alignItems: "center", gap: 40 }}>
              {/* Text */}
              <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                <div style={{ fontFamily: F.m, fontSize: 10, color: C.red, letterSpacing: "0.18em", marginBottom: 16, display: "flex", alignItems: "center", gap: 6, animation: "fadeUp 0.5s ease forwards" }}>
                  <span style={{ width: 6, height: 6, background: C.red, display: "inline-block" }} />
                  MERCH YOUR AGENT PICKS FOR YOU
                </div>

                <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(28px, 6vw, 52px)", lineHeight: 0.95, letterSpacing: "-0.04em", marginBottom: 20, animation: "fadeUp 0.5s ease 0.1s forwards", opacity: 0 }}>
                  <span style={{ color: C.red }}>MY AGENT</span><br />BOUGHT<br />ME THIS.
                </h1>

                <div style={{ display: "flex", gap: 4, marginBottom: 20, animation: "fadeUp 0.5s ease 0.15s forwards", opacity: 0 }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 28, height: 2, background: C.red, transform: "skewX(-25deg)" }} />)}
                </div>

                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 15, color: C.mt, maxWidth: 420, lineHeight: 1.7, marginBottom: 28, animation: "fadeUp 0.5s ease 0.2s forwards", opacity: 0 }}>
                  Your AI agent is making money. Now it wants to spend some on you. Custom merch, paid in crypto, shipped to your door. <span style={{ color: C.lime, fontWeight: 500 }}>$35 USDC</span> and a claim link.
                </p>

                <div className="hero-buttons" style={{ display: "flex", gap: 2, animation: "fadeUp 0.5s ease 0.3s forwards", opacity: 0, flexWrap: "wrap" }}>
                  <button onClick={startBuy} disabled={supply.status === 'SOLD_OUT'} style={{ background: supply.status === 'SOLD_OUT' ? C.dim : C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "14px 24px", letterSpacing: "0.03em", flex: "1 1 160px", cursor: supply.status === 'SOLD_OUT' ? 'not-allowed' : 'pointer' }}>
                    {supply.status === 'SOLD_OUT' ? 'SOLD OUT' : 'BUY NOW'}
                  </button>
                  <button onClick={startAgentPurchase} style={{ background: C.s1, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "14px 24px", letterSpacing: "0.03em", flex: "1 1 160px", border: "1px solid " + C.bdr }}>
                    AGENT DEMO
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

              {/* Hero Mockup - BIGGER */}
              <div style={{ flex: "0 0 420px", animation: "fadeUp 0.6s ease 0.25s forwards", opacity: 0 }}>
                <div className="hero-mockup" style={{ position: "relative" }}>
                  <div style={{ position: "absolute", inset: -40, background: "radial-gradient(circle, rgba(255,59,48,0.12) 0%, transparent 65%)", borderRadius: "50%" }} />
                  <ProductMockup />
                </div>
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.12em" }}>BELLA+CANVAS 3001 · DTG</div>
                  <div style={{ fontFamily: F.m, fontSize: 24, color: C.lime, fontWeight: 600, marginTop: 4 }}>$35 <span style={{ fontSize: 12, color: C.mt }}>USDC</span></div>
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

          {/* SOCIAL PROOF */}
          <section style={{ padding: "48px 20px", background: C.bg }}>
            <div className="wrap">
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.18em", marginBottom: 8, textAlign: "center" }}>WHAT PEOPLE ARE SAYING</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(20px, 4vw, 32px)", letterSpacing: "-0.03em", marginBottom: 32, textAlign: "center" }}>
                Real humans. <span style={{ color: C.lime }}>Agent-bought drip.</span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {[
                  { name: "@degen_dev", text: "MY AGENT LITERALLY SHIPPED THIS TO MY DOOR 😭 I didn't even know it was coming. Best surprise ever.", likes: "2.4K", time: "2h" },
                  { name: "@ai_maxi", text: "ok this is actually insane. told my agent to 'get me something nice' and it bought me a ClawDrip tee. we're so back", likes: "1.8K", time: "5h" },
                  { name: "@crypto_sarah", text: "The future is here and it's wearing a sick tee that my AI picked out 🦞", likes: "947", time: "8h" },
                  { name: "@based_builder", text: "Just got the notification. CoinClawd bought me merch. This is the most crypto thing that's ever happened to me.", likes: "3.1K", time: "1d" },
                ].map((tweet, i) => (
                  <div key={i} style={{
                    background: C.s1,
                    border: "1px solid " + C.bdr,
                    padding: "18px 20px",
                    borderRadius: 4
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${C.red}, ${C.lime})` }} />
                      <div>
                        <div style={{ fontFamily: F.d, fontWeight: 600, fontSize: 13, color: C.tx }}>{tweet.name}</div>
                        <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt }}>{tweet.time} ago</div>
                      </div>
                      <svg style={{ marginLeft: "auto" }} width="16" height="16" viewBox="0 0 24 24" fill="#555"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </div>
                    <p style={{ fontFamily: F.b, fontSize: 14, color: C.tx, lineHeight: 1.6, marginBottom: 12 }}>{tweet.text}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontFamily: F.m, fontSize: 11, color: C.mt, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: C.red }}>♥</span> {tweet.likes}
                      </span>
                      <span style={{ fontFamily: F.m, fontSize: 11, color: C.mt }}>💬 Reply</span>
                      <span style={{ fontFamily: F.m, fontSize: 11, color: C.mt }}>🔁 Repost</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

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
                      { label: "SHIPS", value: "24-48 hrs via UPS/FedEx" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: C.s1, padding: "12px 14px" }}>
                        <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontFamily: F.b, fontSize: 12, color: C.tx }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.s1, border: "1px solid " + C.bdr }}>
                    <span style={{ fontFamily: F.m, fontWeight: 500, fontSize: 20, color: C.lime }}>$35 <span style={{ fontSize: 11, color: C.mt }}>USDC</span></span>
                    <button onClick={startBuy} disabled={supply.status === 'SOLD_OUT'} style={{ background: supply.status === 'SOLD_OUT' ? C.dim : C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 12, padding: "10px 20px", cursor: supply.status === 'SOLD_OUT' ? 'not-allowed' : 'pointer' }}>
                      {supply.status === 'SOLD_OUT' ? 'SOLD OUT' : 'BUY NOW →'}
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
              <button onClick={startBuy} disabled={supply.status === 'SOLD_OUT'} style={{ background: supply.status === 'SOLD_OUT' ? C.dim : C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 14, padding: "15px 32px", animation: supply.status === 'SOLD_OUT' ? 'none' : "glow 2.5s ease infinite", cursor: supply.status === 'SOLD_OUT' ? 'not-allowed' : 'pointer' }}>
                {supply.status === 'SOLD_OUT' ? 'SOLD OUT' : 'GET CLAWDRIPPED'}
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

      {/* ═══════════════════ ADMIN PANEL ═══════════════════ */}
      {view === "admin" && adminMode && (
        <div style={{ minHeight: "calc(100vh - 52px)", padding: "24px 20px" }}>
          <div className="wrap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 4 }}>ADMIN PANEL</div>
                <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em" }}>
                  Command <span style={{ color: C.red }}>Center</span>
                </h1>
              </div>
              <button onClick={goHome} style={{ background: C.s2, color: C.mt, fontFamily: F.m, fontSize: 10, padding: "10px 16px", border: "1px solid " + C.bdr }}>
                EXIT ADMIN
              </button>
            </div>

            {/* Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 2, marginBottom: 24 }}>
              {[
                { label: "TOTAL ORDERS", value: getOrderStats().total, color: C.tx },
                { label: "AWAITING SHIP", value: getOrderStats().paid, color: "#FF9500" },
                { label: "SHIPPED", value: getOrderStats().shipped, color: C.lime },
                { label: "REVENUE", value: "$" + getOrderStats().revenue, color: C.lime },
              ].map((stat, i) => (
                <div key={i} style={{ background: C.s1, padding: "16px 18px" }}>
                  <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 28, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 2, marginBottom: 24 }}>
              <button onClick={exportOrdersCSV} style={{ background: C.s2, color: C.tx, fontFamily: F.d, fontWeight: 700, fontSize: 11, padding: "12px 20px", border: "1px solid " + C.bdr }}>
                📥 EXPORT CSV
              </button>
              <button onClick={() => getAllOrders().then(setOrders)} style={{ background: C.s2, color: C.tx, fontFamily: F.d, fontWeight: 700, fontSize: 11, padding: "12px 20px", border: "1px solid " + C.bdr }}>
                🔄 REFRESH
              </button>
            </div>

            {/* Orders Table */}
            <div style={{ background: C.s1, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid " + C.bdr, display: "grid", gridTemplateColumns: "80px 1fr 120px 100px 120px", gap: 12, fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.08em" }}>
                <div>ORDER</div>
                <div>CUSTOMER</div>
                <div>SIZE / PRICE</div>
                <div>STATUS</div>
                <div>ACTION</div>
              </div>
              {orders.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", fontFamily: F.m, fontSize: 12, color: C.mt }}>
                  No orders yet. Share clawdrip.com and start selling! 🦞
                </div>
              ) : (
                orders.slice().reverse().map(order => (
                  <div key={order.id} style={{ padding: "14px 16px", borderBottom: "1px solid " + C.bdr, display: "grid", gridTemplateColumns: "80px 1fr 120px 100px 120px", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontFamily: F.m, fontSize: 11, color: C.tx }}>{order.id}</div>
                      <div style={{ fontFamily: F.m, fontSize: 9, color: C.dim }}>{new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: F.b, fontSize: 13, color: C.tx }}>{order.shipping?.name || "—"}</div>
                      <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt }}>{order.shipping?.email || "—"}</div>
                      <div style={{ fontFamily: F.m, fontSize: 10, color: C.dim }}>{order.shipping?.city}, {order.shipping?.state} {order.shipping?.zip}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: F.d, fontWeight: 700, fontSize: 13, color: C.tx }}>{order.size}</div>
                      <div style={{ fontFamily: F.m, fontSize: 11, color: C.lime }}>${order.price || PRODUCT.price}</div>
                    </div>
                    <div>
                      <span style={{
                        fontFamily: F.m,
                        fontSize: 9,
                        padding: "4px 8px",
                        letterSpacing: "0.05em",
                        background: order.status === "paid" ? "#FF9500" + "20" : order.status === "shipped" ? C.lime + "20" : C.s2,
                        color: order.status === "paid" ? "#FF9500" : order.status === "shipped" ? C.lime : C.mt,
                      }}>
                        {order.status?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {order.status === "paid" && (
                        <button onClick={() => updateOrderStatus(order.id, "shipped")} style={{ background: C.lime, color: "#000", fontFamily: F.d, fontWeight: 700, fontSize: 9, padding: "6px 10px" }}>
                          MARK SHIPPED
                        </button>
                      )}
                      {order.status === "shipped" && (
                        <button onClick={() => updateOrderStatus(order.id, "delivered")} style={{ background: C.blue, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 9, padding: "6px 10px" }}>
                          DELIVERED
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Copy Section for Fulfillment */}
            {orders.filter(o => o.status === "paid").length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>READY TO SHIP — COPY FOR INKPRESSIONS</div>
                <div style={{ background: C.bg, border: "1px solid " + C.bdr, padding: 16, fontFamily: F.m, fontSize: 11, color: C.tx, lineHeight: 2 }}>
                  {orders.filter(o => o.status === "paid").map(order => (
                    <div key={order.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid " + C.bdr }}>
                      <div style={{ color: C.lime }}>ORDER #{order.id} — SIZE {order.size}</div>
                      <div>{order.shipping?.name}</div>
                      <div>{order.shipping?.addr1} {order.shipping?.addr2}</div>
                      <div>{order.shipping?.city}, {order.shipping?.state} {order.shipping?.zip}</div>
                      <div style={{ color: C.mt }}>{order.shipping?.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ BUY FLOW ═══════════════════ */}
      {view === "buy" && (
        <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(255,59,48,0.04) 0%, transparent 45%)" }} />
          <CloseBtn onClick={goHome} />

          {/* Step 0: Product + Size */}
          {buyStep === 0 && (
            <div style={{ width: "100%", maxWidth: 440, animation: "scaleIn 0.4s ease forwards" }}>
              {/* Supply Counter */}
              <SupplyCounter />

              <div style={{ background: C.s1, overflow: "hidden", marginBottom: 2 }}>
                <div style={{ padding: "28px 48px 16px", display: "flex", justifyContent: "center", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, rgba(255,59,48,0.06) 0%, transparent 60%)" }} />
                  <div style={{ width: 200, position: "relative" }}>
                    <ProductMockup />
                  </div>
                </div>
                <div style={{ padding: "14px 22px 24px" }}>
                  <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.08em", marginBottom: 3 }}>{PRODUCT.type}</div>
                  <h3 style={{ fontFamily: F.d, fontWeight: 700, fontSize: "clamp(18px, 3.5vw, 22px)", letterSpacing: "-0.02em", marginBottom: 10 }}>{PRODUCT.name}</h3>
                  <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, lineHeight: 1.6, marginBottom: 14 }}>{PRODUCT.desc}</p>

                  {/* Tier Badge if applicable */}
                  {tierInfo.discount > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <TierBadge balance={clawBalance} />
                      <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt, marginTop: 6 }}>
                        Your {tierInfo.tier} status gives you <span style={{ color: C.lime }}>{tierInfo.discount}% off</span>!
                      </div>
                    </div>
                  )}

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

                  {/* Price + CLAWDRIP 💧 reward preview - now with discount */}
                  <PriceDisplay />

                  {/* Progress to next tier */}
                  {tierInfo.nextTier && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: C.s2, border: "1px solid " + C.bdr }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontFamily: F.m, fontSize: 9, color: C.mt }}>Progress to {tierInfo.nextTier}</span>
                        <span style={{ fontFamily: F.m, fontSize: 9, color: C.lime }}>{tierInfo.toNextTier} CLAWDRIP 💧 to go</span>
                      </div>
                      <div style={{ height: 3, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.min(100, ((clawBalance + 35) / (clawBalance + tierInfo.toNextTier)) * 100)}%`,
                          background: C.lime,
                          transition: "width 0.3s ease"
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setBuyStep(1)} disabled={supply.status === 'SOLD_OUT'} style={{ width: "100%", background: supply.status === 'SOLD_OUT' ? C.dim : C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "15px", cursor: supply.status === 'SOLD_OUT' ? 'not-allowed' : 'pointer' }}>
                {supply.status === 'SOLD_OUT' ? 'SOLD OUT' : 'CONTINUE — SHIPPING INFO'}
              </button>
            </div>
          )}

          {/* Step 1: Shipping Form */}
          {buyStep === 1 && (
            <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.3s ease forwards" }}>
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.red, letterSpacing: "0.18em", marginBottom: 8 }}>STEP 2 OF 3</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(18px, 3.5vw, 24px)", letterSpacing: "-0.03em", marginBottom: 4 }}>Where should we send it?</h2>
              <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 20 }}>
                {PRODUCT.name} · Size {selectedSize} · Ships 24-48hrs
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

              {/* Shipping disclaimer */}
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, lineHeight: 1.6, marginTop: 12, padding: "10px 12px", background: C.s2, border: "1px solid " + C.bdr }}>
                <div style={{ marginBottom: 4 }}><strong style={{ color: C.tx }}>🇺🇸 US:</strong> 2-5 business days (UPS/FedEx)</div>
                <div style={{ marginBottom: 4 }}><strong style={{ color: C.tx }}>🌍 Int'l:</strong> 7-21 business days (varies by country)</div>
                <div style={{ color: C.dim }}>⛔ Cannot ship to: Russia, Belarus, North Korea, Iran, Syria, Cuba, Crimea</div>
              </div>

              <button onClick={proceedToPayment} style={{ width: "100%", background: C.red, color: "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "15px", marginTop: 12 }}>
                CONTINUE — PAYMENT
              </button>

              <button onClick={() => setBuyStep(0)} style={{ width: "100%", background: "transparent", color: C.mt, fontFamily: F.m, fontSize: 10, padding: "10px", marginTop: 4, border: "none" }}>
                ← back to product
              </button>
            </div>
          )}

          {/* Step 2: Payment */}
          {buyStep === 2 && (
            <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.3s ease forwards" }}>
              <div style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.18em", marginBottom: 8 }}>STEP 3 OF 3</div>
              <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(18px, 3.5vw, 24px)", letterSpacing: "-0.03em", marginBottom: 4 }}>Send payment</h2>
              <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 20 }}>
                Send exactly <span style={{ color: C.lime, fontWeight: 600 }}>${priceInfo.price.toFixed(2)} USDC</span> on Base to complete your order
              </p>

              {/* Reservation Timer */}
              <ReservationTimer />

              {/* Amount display with discount breakdown */}
              <div style={{ background: C.s1, padding: "20px", textAlign: "center", marginBottom: 2 }}>
                <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt, letterSpacing: "0.12em", marginBottom: 8 }}>AMOUNT DUE</div>
                <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 42, color: C.lime }}>
                  ${priceInfo.price.toFixed(2)}
                </div>
                {priceInfo.discount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontFamily: F.m, fontSize: 14, color: C.mt, textDecoration: "line-through" }}>
                      ${priceInfo.originalPrice.toFixed(2)}
                    </span>
                    <span style={{ fontFamily: F.m, fontSize: 11, color: C.lime, background: C.lime + "20", padding: "2px 6px" }}>
                      {tierInfo.tierEmoji} -{priceInfo.discount}%
                    </span>
                  </div>
                )}
                <div style={{ fontFamily: F.m, fontSize: 12, color: C.mt, marginTop: 4 }}>USDC on Base</div>
              </div>

              {/* Wallet address */}
              <div style={{ background: C.s1, padding: "16px", marginBottom: 2 }}>
                <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 8 }}>SEND TO THIS ADDRESS</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, fontFamily: F.m, fontSize: 11, color: C.tx, background: C.bg, padding: "12px", wordBreak: "break-all", border: "1px solid " + C.bdr }}>
                    {WALLET_ADDRESS}
                  </div>
                  <button onClick={copyWalletAddress} style={{ background: walletCopied ? C.lime : C.red, color: walletCopied ? "#000" : "#fff", fontFamily: F.d, fontWeight: 700, fontSize: 10, padding: "12px 16px", flexShrink: 0 }}>
                    {walletCopied ? "COPIED!" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Chain info */}
              <div style={{ background: C.s1, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, background: "#0052FF", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>B</span>
                </div>
                <div>
                  <div style={{ fontFamily: F.d, fontWeight: 700, fontSize: 13 }}>Base Network</div>
                  <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt }}>USDC only · Low fees</div>
                </div>
              </div>

              {/* Order summary with discount breakdown */}
              <div style={{ background: C.bg, border: "1px solid " + C.bdr, padding: "14px", marginBottom: 16 }}>
                <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.12em", marginBottom: 8 }}>ORDER SUMMARY</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: F.b, fontSize: 12, color: C.mt }}>{PRODUCT.name} ({selectedSize})</span>
                  <span style={{ fontFamily: F.m, fontSize: 12, color: C.tx }}>${priceInfo.originalPrice.toFixed(2)}</span>
                </div>
                {priceInfo.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: F.b, fontSize: 12, color: C.lime }}>{tierInfo.tier} Discount (-{priceInfo.discount}%)</span>
                    <span style={{ fontFamily: F.m, fontSize: 12, color: C.lime }}>-${(priceInfo.originalPrice - priceInfo.price).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: F.b, fontSize: 12, color: C.mt }}>Shipping</span>
                  <span style={{ fontFamily: F.m, fontSize: 12, color: C.lime }}>FREE</span>
                </div>
                <div style={{ borderTop: "1px solid " + C.bdr, marginTop: 8, paddingTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: F.d, fontWeight: 700, fontSize: 14, color: C.tx }}>Total</span>
                    <span style={{ fontFamily: F.d, fontWeight: 700, fontSize: 14, color: C.lime }}>${priceInfo.price.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: F.b, fontSize: 12, color: C.tx }}>Ship to</span>
                    <span style={{ fontFamily: F.m, fontSize: 11, color: C.mt, textAlign: "right" }}>{shipping.name}<br />{shipping.city}, {shipping.state}</span>
                  </div>
                </div>
              </div>

              {/* Payment processing animation */}
              {paymentState === 'processing' && (
                <div style={{ background: C.s1, padding: "20px", marginBottom: 16, textAlign: "center" }}>
                  <div style={{ width: 40, height: 40, margin: "0 auto 12px", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, border: "3px solid " + C.dim, borderRadius: "50%" }} />
                    <div style={{
                      position: "absolute", inset: 0,
                      border: "3px solid " + C.lime, borderRadius: "50%",
                      borderRightColor: "transparent",
                      animation: "spin 1s linear infinite"
                    }} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                  <div style={{ fontFamily: F.d, fontWeight: 700, fontSize: 14, color: C.tx, marginBottom: 4 }}>
                    Verifying Payment...
                  </div>
                  <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt }}>
                    This takes about 2 seconds
                  </div>
                </div>
              )}

              <button onClick={confirmPayment} disabled={loading || paymentState === 'processing'} style={{ width: "100%", background: loading || paymentState === 'processing' ? C.s2 : C.lime, color: "#000", fontFamily: F.d, fontWeight: 700, fontSize: 13, padding: "15px", opacity: loading || paymentState === 'processing' ? 0.7 : 1 }}>
                {loading || paymentState === 'processing' ? "VERIFYING..." : "I'VE SENT THE PAYMENT ✓"}
              </button>

              <p style={{ fontFamily: F.m, fontSize: 9, color: C.mt, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
                After sending, click above to confirm. We'll verify and ship within 24-48hrs.
              </p>

              <button onClick={() => setBuyStep(1)} style={{ width: "100%", background: "transparent", color: C.mt, fontFamily: F.m, fontSize: 10, padding: "10px", marginTop: 4, border: "none" }}>
                ← back to shipping
              </button>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {buyStep === 3 && claimOrder && (
            <>
              {/* Confetti */}
              {["confetti1", "confetti2", "confetti3", "confetti4", "confetti5", "confetti6"].map((a, i) => (
                <div key={i} style={{ position: "absolute", top: "40%", left: "50%", width: 7, height: 7, background: [C.red, C.lime, C.red, "#FF9500", "#AA00FF", C.lime][i], animation: `${a} 1.2s ease ${i * 0.07}s forwards`, borderRadius: i % 2 === 0 ? 0 : "50%" }} />
              ))}

              <div style={{ textAlign: "center", width: "100%", maxWidth: 400, animation: "treasureRise 0.6s ease forwards" }}>
                <div style={{ width: 64, height: 64, margin: "0 auto 24px", background: C.lime + "12", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", animation: "celebrateShake 0.5s ease 0.6s" }}>
                  <span style={{ color: C.lime, fontSize: 30 }}>✓</span>
                </div>
                <div style={{ fontFamily: F.m, fontSize: 9, color: C.lime, letterSpacing: "0.18em", marginBottom: 8 }}>ORDER CONFIRMED</div>
                <h2 style={{ fontFamily: F.d, fontWeight: 800, fontSize: "clamp(22px, 4vw, 28px)", letterSpacing: "-0.03em", marginBottom: 8 }}>
                  You got <span style={{ color: C.red }}>ClawDripped</span>.
                </h2>
                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 13, color: C.mt, marginBottom: 4, lineHeight: 1.7 }}>
                  Your <span style={{ color: C.tx, fontWeight: 500 }}>{PRODUCT.name}</span> ({selectedSize}) is printing now.
                </p>
                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 16 }}>
                  Shipping to {shipping.city}, {shipping.state} · 24-48 hours
                </p>

                {/* CLAWDRIP 💧 Token Reward Callout */}
                <div style={{ background: "linear-gradient(135deg, rgba(200,255,0,0.1) 0%, rgba(200,255,0,0.02) 100%)", border: "1px solid " + C.lime + "40", padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, color: C.lime, marginBottom: 4, animation: "treasureRise 0.4s ease 0.8s forwards", opacity: 0 }}>
                    +{claimOrder.claw_earned || 35} CLAWDRIP 💧 EARNED
                  </div>
                  <div style={{ fontFamily: F.m, fontSize: 11, color: C.mt }}>
                    Total balance: <span style={{ color: C.lime, fontWeight: 500 }}>{clawBalance} CLAWDRIP 💧</span>
                  </div>
                  {/* Progress to next tier */}
                  {tierInfo.nextTier && (
                    <div style={{ marginTop: 8, textAlign: "center" }}>
                      <span style={{ fontFamily: F.m, fontSize: 10, color: C.lime }}>
                        {tierInfo.toNextTier} more to {tierInfo.nextTier}!
                      </span>
                    </div>
                  )}
                </div>

                {/* Detailed Receipt (Miyamoto "Score Display") */}
                <div style={{ background: C.bg, border: "2px solid " + C.bdr, padding: "16px", marginBottom: 16, textAlign: "left" }}>
                  <div style={{ fontFamily: F.m, fontSize: 9, color: C.mt, letterSpacing: "0.1em", marginBottom: 12, textAlign: "center" }}>
                    ORDER RECEIPT
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: F.b, fontSize: 12, color: C.mt }}>Base price:</span>
                    <span style={{ fontFamily: F.m, fontSize: 12, color: C.tx }}>${priceInfo.originalPrice.toFixed(2)}</span>
                  </div>
                  {priceInfo.discount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, padding: "4px 8px", background: C.lime + "10" }}>
                      <span style={{ fontFamily: F.b, fontSize: 12, color: C.lime }}>
                        {tierInfo.tierEmoji} {tierInfo.tier} (-{priceInfo.discount}%):
                      </span>
                      <span style={{ fontFamily: F.m, fontSize: 12, color: C.lime }}>
                        -${(priceInfo.originalPrice - priceInfo.price).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div style={{ borderTop: "2px solid " + C.bdr, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: F.d, fontWeight: 700, fontSize: 14, color: C.tx }}>You paid:</span>
                    <span style={{ fontFamily: F.d, fontWeight: 700, fontSize: 14, color: C.lime }}>${priceInfo.price.toFixed(2)}</span>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", borderTop: "1px solid " + C.bdr, paddingTop: 8 }}>
                    <span style={{ fontFamily: F.b, fontSize: 11, color: C.lime }}>+{claimOrder.claw_earned || 35} CLAWDRIP 💧 earned</span>
                    <span style={{ fontFamily: F.m, fontSize: 11, color: C.mt }}>Balance: {clawBalance}</span>
                  </div>
                </div>

                {/* Order card */}
                <div style={{ background: C.s1, padding: 18, textAlign: "left", marginBottom: 2 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                    <div style={{ width: 56, flexShrink: 0 }}>
                      <ProductMockup size="small" />
                    </div>
                    <div>
                      <div style={{ fontFamily: F.d, fontWeight: 700, fontSize: 13 }}>{PRODUCT.name}</div>
                      <div style={{ fontFamily: F.m, fontSize: 10, color: C.mt, marginTop: 2 }}>{PRODUCT.type} · {selectedSize} · Black</div>
                      <div style={{ fontFamily: F.m, fontSize: 13, color: C.lime, marginTop: 3 }}>${priceInfo.price.toFixed(2)} USDC</div>
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid " + C.bdr, paddingTop: 12 }}>
                    <div style={{ fontFamily: F.m, fontSize: 8, color: C.mt, letterSpacing: "0.1em", marginBottom: 3 }}>ORDER ID</div>
                    <div style={{ fontFamily: F.m, fontSize: 12, color: C.tx }}>{claimOrder.id}</div>
                  </div>
                </div>

                {/* Share Buttons */}
                <div style={{ display: "flex", gap: 2, marginTop: 2, marginBottom: 16 }}>
                  <button onClick={handleCopyImage} style={{ flex: 1, background: C.s2, color: copyFeedback ? C.lime : C.tx, fontFamily: F.d, fontWeight: 700, fontSize: 12, padding: "14px 16px", border: "1px solid " + C.bdr, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span>{copyFeedback ? "✓" : "📋"}</span>
                    {copyFeedback ? "COPIED!" : "COPY IMAGE"}
                  </button>
                  <button onClick={handleShareX} style={{ flex: 1, background: C.s2, color: C.tx, fontFamily: F.d, fontWeight: 700, fontSize: 12, padding: "14px 16px", border: "1px solid " + C.bdr, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800 }}>𝕏</span>
                    SHARE ON X
                  </button>
                </div>

                <button onClick={goHome} style={{ background: "transparent", color: C.mt, border: "1px solid " + C.bdr, fontFamily: F.m, fontSize: 10, padding: "12px 20px", letterSpacing: "0.04em", width: "100%" }}>
                  ← BACK TO CLAWDRIP
                </button>
              </div>
            </>
          )}
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
                <p style={{ fontFamily: F.b, fontWeight: 300, fontSize: 12, color: C.mt, marginBottom: 16 }}>
                  Shipping to {shipping.city}, {shipping.state} · 5–7 business days
                </p>

                {/* CLAWDRIP 💧 Token Reward Callout */}
                <div style={{ background: "linear-gradient(135deg, rgba(200,255,0,0.1) 0%, rgba(200,255,0,0.02) 100%)", border: "1px solid " + C.lime + "40", padding: "16px 20px", marginBottom: 16, animation: "scaleIn 0.4s ease 0.2s forwards", opacity: 0 }}>
                  <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, color: C.lime, marginBottom: 4 }}>
                    +{claimOrder?.claw_earned || PRODUCT.price} CLAWDRIP 💧 EARNED
                  </div>
                  <div style={{ fontFamily: F.m, fontSize: 11, color: C.mt }}>
                    Total balance: <span style={{ color: C.lime, fontWeight: 500 }}>{clawBalance} CLAWDRIP 💧</span>
                  </div>
                </div>

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

                {/* Share Buttons */}
                <div style={{ display: "flex", gap: 2, marginTop: 2, marginBottom: 16 }}>
                  <button onClick={handleCopyImage} style={{ flex: 1, background: C.s2, color: copyFeedback ? C.lime : C.tx, fontFamily: F.d, fontWeight: 700, fontSize: 12, padding: "14px 16px", border: "1px solid " + C.bdr, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span>{copyFeedback ? "✓" : "📋"}</span>
                    {copyFeedback ? "COPIED!" : "COPY IMAGE"}
                  </button>
                  <button onClick={handleShareX} style={{ flex: 1, background: C.s2, color: C.tx, fontFamily: F.d, fontWeight: 700, fontSize: 12, padding: "14px 16px", border: "1px solid " + C.bdr, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800 }}>𝕏</span>
                    SHARE ON X
                  </button>
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
