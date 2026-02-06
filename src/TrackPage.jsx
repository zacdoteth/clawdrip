import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// ═══════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || '';

// ═══════════════════════════════════════════════════
// DESIGN TOKENS — matching PayPage brand
// ═══════════════════════════════════════════════════

const C = {
  bg: '#030303',
  card: '#0a0a0a',
  cardBorder: '#1a1a1a',
  lime: '#C8FF00',
  red: '#FF3B30',
  tx: '#f0ede6',
  muted: '#555555',
  dim: '#333333',
  success: '#00D26A',
  warning: '#FF9500',
  blue: '#2979FF',
};

const F = {
  display: "'Syne', sans-serif",
  body: "'Outfit', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ═══════════════════════════════════════════════════
// STATUS CONFIG — every status is a story beat (PG #6)
// ═══════════════════════════════════════════════════

const STATUS_STEPS = [
  { key: 'purchased', label: 'Purchased', narrative: 'Your agent made it happen' },
  { key: 'claimed', label: 'Claimed', narrative: 'Shipping address locked in' },
  { key: 'processing', label: 'Printing', narrative: 'Ink hitting cotton in Michigan' },
  { key: 'shipped', label: 'Shipped', narrative: 'On its way to you' },
  { key: 'delivered', label: 'Delivered', narrative: 'Your agent\'s first gift arrived' },
];

function getStepIndex(status) {
  const map = {
    pending_claim: 0,
    claimed: 1,
    paid: 1,
    processing: 2,
    shipped: 3,
    in_transit: 3,
    out_for_delivery: 3,
    delivered: 4,
  };
  return map[status] ?? 0;
}

// ═══════════════════════════════════════════════════
// CSS ANIMATIONS
// ═══════════════════════════════════════════════════

const cssAnimations = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cardEntry {
  from { opacity: 0; transform: translateY(32px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes borderGlow {
  0%, 100% { border-color: rgba(255, 59, 48, 0.15); }
  33% { border-color: rgba(200, 255, 0, 0.15); }
  66% { border-color: rgba(41, 121, 255, 0.12); }
}
.track-carrier-link {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.track-carrier-link:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 24px rgba(200, 255, 0, 0.15) !important;
}
.track-copy-btn {
  transition: all 0.2s ease !important;
}
.track-copy-btn:hover {
  background: rgba(255,255,255,0.06) !important;
}
`;

// ═══════════════════════════════════════════════════
// LOGO COMPONENT
// ═══════════════════════════════════════════════════

const Logo = ({ suffix, size = 18 }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
    <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: size, letterSpacing: '-0.02em', color: '#fff' }}>
      CLAW
    </span>
    <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: size, letterSpacing: '-0.02em', color: C.red }}>
      DRIP
    </span>
    {suffix && (
      <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: size * 0.72, letterSpacing: '-0.02em', color: C.muted, marginLeft: 6 }}>
        {suffix}
      </span>
    )}
  </div>
);

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDeliveryDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getStatusColor(status) {
  const map = {
    pending_claim: { bg: 'rgba(255, 149, 0, 0.08)', color: C.warning, label: 'Awaiting Claim' },
    claimed: { bg: 'rgba(200, 255, 0, 0.08)', color: C.lime, label: 'Claimed' },
    processing: { bg: 'rgba(41, 121, 255, 0.08)', color: C.blue, label: 'Printing' },
    shipped: { bg: 'rgba(200, 255, 0, 0.08)', color: C.lime, label: 'Shipped' },
    in_transit: { bg: 'rgba(200, 255, 0, 0.08)', color: C.lime, label: 'In Transit' },
    out_for_delivery: { bg: 'rgba(200, 255, 0, 0.08)', color: C.lime, label: 'Out for Delivery' },
    delivered: { bg: 'rgba(0, 210, 106, 0.08)', color: C.success, label: 'Delivered' },
  };
  return map[status] || { bg: 'rgba(102, 102, 102, 0.08)', color: C.muted, label: status };
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function TrackPage() {
  const { orderNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/orders/${orderNumber}/tracking`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Order not found');
        } else {
          setError('Failed to load tracking info');
        }
        setLoading(false);
        return;
      }
      setData(await res.json());
      setLoading(false);
    } catch {
      setError('Failed to connect to server');
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 30000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = cssAnimations;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  const copyTrackingNumber = async () => {
    if (!data?.tracking?.number) return;
    try {
      await navigator.clipboard.writeText(data.tracking.number);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = data.tracking.number;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Shared layout ───

  const Container = ({ children }) => (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: F.body,
    }}>
      {children}
    </div>
  );

  const Card = ({ children, glow }) => (
    <div style={{
      width: '100%',
      maxWidth: '420px',
      background: C.card,
      borderRadius: '24px',
      border: `1px solid ${C.cardBorder}`,
      overflow: 'hidden',
      animation: `cardEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards${glow ? ', borderGlow 6s ease infinite' : ''}`,
    }}>
      {children}
    </div>
  );

  const Header = () => (
    <div style={{
      padding: '18px 24px',
      borderBottom: `1px solid ${C.cardBorder}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <Logo suffix="TRACK" />
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: C.lime,
        boxShadow: `0 0 8px ${C.lime}`,
        animation: 'pulse 2s ease infinite',
      }} />
    </div>
  );

  // ─── Loading ───

  if (loading) {
    return (
      <Container>
        <Card>
          <Header />
          <div style={{ padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '44px', height: '44px',
              border: `2px solid ${C.dim}`,
              borderTopColor: C.red,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ color: C.muted, fontSize: '13px', fontFamily: F.mono, letterSpacing: '0.04em' }}>
              loading tracking info
            </div>
          </div>
        </Card>
      </Container>
    );
  }

  // ─── Error ───

  if (error) {
    return (
      <Container>
        <Card>
          <Header />
          <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(255, 59, 48, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px',
              animation: 'scaleIn 0.4s ease',
            }}>
              📦
            </div>
            <div style={{ fontFamily: F.display, fontSize: '20px', fontWeight: 700, color: C.tx }}>
              {error}
            </div>
            <div style={{ color: C.muted, fontSize: '14px', lineHeight: 1.5 }}>
              Check your order number and try again.
            </div>
          </div>
        </Card>
      </Container>
    );
  }

  // ─── Main tracking view ───

  const currentStep = getStepIndex(data.status);
  const statusInfo = getStatusColor(data.status);

  return (
    <Container>
      <Card glow={data.status === 'delivered'}>
        <Header />

        {/* ── Order Info ── */}
        <div style={{
          padding: '24px',
          borderBottom: `1px solid ${C.cardBorder}`,
          animation: 'fadeUp 0.5s ease 0.1s both',
        }}>
          <div style={{
            fontFamily: F.mono, fontSize: '12px', color: C.muted,
            letterSpacing: '0.04em', marginBottom: '10px',
          }}>
            {data.orderNumber}
          </div>
          <div style={{
            fontFamily: F.display, fontSize: '22px', fontWeight: 800,
            color: C.tx, letterSpacing: '-0.5px', marginBottom: '14px',
          }}>
            {data.product?.name || 'MY AGENT BOUGHT ME THIS'}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {data.product?.size && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: C.muted }}>
                Size: <span style={{ color: C.tx, fontWeight: 500 }}>{data.product.size}</span>
              </div>
            )}
            {data.agent?.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: C.muted }}>
                Agent: <span style={{ color: C.tx, fontWeight: 500 }}>{data.agent.name}</span>
              </div>
            )}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', borderRadius: '20px',
            background: statusInfo.bg, color: statusInfo.color,
            fontSize: '12px', fontWeight: 600, fontFamily: F.mono,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            {data.status === 'delivered' && '✓ '}
            {statusInfo.label}
          </div>
        </div>

        {/* ── Timeline ── */}
        <div style={{
          padding: '24px',
          animation: 'fadeUp 0.5s ease 0.2s both',
        }}>
          <div style={{
            fontFamily: F.display, fontSize: '14px', fontWeight: 600,
            color: C.tx, marginBottom: '20px', letterSpacing: '-0.3px',
          }}>
            Order Progress
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {STATUS_STEPS.map((step, i) => {
              const isComplete = i <= currentStep;
              const isCurrent = i === currentStep;
              const isLast = i === STATUS_STEPS.length - 1;

              const event = data.timeline?.find(
                (t) =>
                  t.status === step.key ||
                  (step.key === 'purchased' && t.status === 'pending_claim') ||
                  (step.key === 'shipped' && (t.status === 'in_transit' || t.status === 'out_for_delivery'))
              );

              return (
                <div key={step.key} style={{
                  display: 'flex', gap: '16px', position: 'relative',
                  paddingBottom: isLast ? '0' : '24px',
                  animation: `fadeUp 0.4s ease ${0.25 + i * 0.08}s both`,
                }}>
                  {/* Dot */}
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%',
                    flexShrink: 0, marginTop: '2px', position: 'relative', zIndex: 1,
                    background: isComplete ? C.lime : C.dim,
                    boxShadow: isCurrent ? `0 0 0 4px rgba(200, 255, 0, 0.15), 0 0 12px rgba(200, 255, 0, 0.1)` : 'none',
                    animation: isCurrent ? 'pulse 2s ease-in-out infinite' : 'none',
                    transition: 'all 0.3s ease',
                  }} />
                  {/* Line */}
                  {!isLast && (
                    <div style={{
                      position: 'absolute', left: '6px', top: '16px', width: '2px', bottom: '0',
                      background: i < currentStep ? C.lime : C.dim,
                      transition: 'background 0.3s ease',
                    }} />
                  )}
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px', fontWeight: 600, lineHeight: 1.3,
                      color: isComplete ? C.tx : C.muted,
                    }}>
                      {step.label}
                    </div>
                    {/* Narrative beat — show for current/completed steps */}
                    {isComplete && (
                      <div style={{
                        fontSize: '12px', color: isCurrent ? C.lime : C.muted,
                        marginTop: '2px', lineHeight: 1.4,
                        fontStyle: isCurrent ? 'normal' : 'normal',
                      }}>
                        {event?.message || step.narrative}
                      </div>
                    )}
                    {event?.at && (
                      <div style={{
                        fontFamily: F.mono, fontSize: '10px', color: C.dim,
                        marginTop: '4px', letterSpacing: '0.02em',
                      }}>
                        {formatDate(event.at)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tracking Number ── */}
        {data.tracking?.number && (
          <div style={{
            padding: '18px 24px',
            borderTop: `1px solid ${C.cardBorder}`,
            display: 'flex', flexDirection: 'column', gap: '12px',
            animation: 'fadeUp 0.5s ease 0.4s both',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <span style={{ fontSize: '12px', color: C.muted, fontFamily: F.mono, letterSpacing: '0.04em' }}>
                TRACKING
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: F.mono, fontSize: '13px', color: C.tx }}>
                  {data.tracking.number}
                </span>
                <button
                  className="track-copy-btn"
                  onClick={copyTrackingNumber}
                  title={copied ? 'Copied!' : 'Copy'}
                  style={{
                    background: copied ? 'rgba(200, 255, 0, 0.08)' : 'transparent',
                    border: 'none', color: copied ? C.lime : C.muted,
                    cursor: 'pointer', padding: '6px 8px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', fontSize: '13px',
                    fontFamily: F.mono, gap: '4px',
                  }}
                >
                  {copied ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg> copied</>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {data.tracking.carrier && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '12px',
              }}>
                <span style={{ color: C.muted, fontFamily: F.mono, letterSpacing: '0.04em' }}>CARRIER</span>
                <span style={{ color: C.tx, fontWeight: 500 }}>{data.tracking.carrier}</span>
              </div>
            )}

            {data.tracking.carrierUrl && (
              <a
                href={data.tracking.carrierUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="track-carrier-link"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', padding: '13px 20px', borderRadius: '12px',
                  background: 'rgba(200, 255, 0, 0.06)',
                  border: `1px solid rgba(200, 255, 0, 0.15)`,
                  color: C.lime, fontSize: '14px', fontWeight: 500,
                  fontFamily: F.body, textDecoration: 'none', cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                Track on {data.tracking.carrier}
                <span style={{ fontSize: '16px' }}>→</span>
              </a>
            )}
          </div>
        )}

        {/* ── Estimated Delivery ── */}
        {data.tracking?.estimatedDelivery && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.cardBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', fontSize: '13px', color: C.tx,
            animation: 'fadeUp 0.5s ease 0.5s both',
          }}>
            <span style={{ fontSize: '14px' }}>📅</span>
            <span>
              Estimated delivery: <strong>{formatDeliveryDate(data.tracking.estimatedDelivery)}</strong>
            </span>
          </div>
        )}

        {/* ── Trust Footer ── */}
        <div style={{
          padding: '18px 24px',
          borderTop: `1px solid ${C.cardBorder}`,
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {[
            { icon: '🔒', text: 'Secured by Base Network' },
            { icon: '🦞', text: 'First AI→human gift platform' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: C.muted, fontSize: '12px', fontFamily: F.mono,
              letterSpacing: '0.02em',
              animation: `fadeUp 0.4s ease ${0.6 + i * 0.08}s both`,
            }}>
              <span style={{ fontSize: '12px', flexShrink: 0 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Subtle branding */}
      <div style={{
        marginTop: '20px', textAlign: 'center',
        animation: 'fadeUp 0.5s ease 0.7s both',
      }}>
        <div style={{
          fontFamily: F.mono, fontSize: '10px', color: C.dim,
          letterSpacing: '0.08em',
        }}>
          clawdrip.com
        </div>
      </div>
    </Container>
  );
}
