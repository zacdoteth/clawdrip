import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// ═══════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || '';

// ═══════════════════════════════════════════════════
// DESIGN TOKENS (matching PayPage)
// ═══════════════════════════════════════════════════

const C = {
  bg: '#030303',
  card: '#111111',
  cardBorder: '#1a1a1a',
  lime: '#C8FF00',
  tx: '#f0ede6',
  muted: '#666666',
  dim: '#333333',
  success: '#00D26A',
  warning: '#FF9500',
};

const F = {
  display: "'Syne', sans-serif",
  body: "'Outfit', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ═══════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════

const STATUS_STEPS = [
  { key: 'purchased', label: 'Purchased' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
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
// STYLES
// ═══════════════════════════════════════════════════

const styles = {
  container: {
    minHeight: '100vh',
    background: C.bg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
    fontFamily: F.body,
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: C.card,
    borderRadius: '24px',
    border: `1px solid ${C.cardBorder}`,
    overflow: 'hidden',
    animation: 'fadeUp 0.5s ease-out',
  },
  header: {
    padding: '20px 24px',
    borderBottom: `1px solid ${C.cardBorder}`,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontSize: '28px',
  },
  brandName: {
    fontFamily: F.display,
    fontSize: '18px',
    fontWeight: 700,
    color: C.tx,
    letterSpacing: '-0.5px',
  },
  orderInfo: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    borderBottom: `1px solid ${C.cardBorder}`,
  },
  orderNumber: {
    fontFamily: F.mono,
    fontSize: '13px',
    color: C.muted,
  },
  productName: {
    fontFamily: F.display,
    fontSize: '20px',
    fontWeight: 700,
    color: C.tx,
    letterSpacing: '-0.5px',
  },
  meta: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: C.muted,
  },
  metaValue: {
    color: C.tx,
    fontWeight: 500,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    alignSelf: 'flex-start',
  },
  // Timeline
  timelineSection: {
    padding: '24px',
  },
  timelineTitle: {
    fontFamily: F.display,
    fontSize: '15px',
    fontWeight: 600,
    color: C.tx,
    marginBottom: '20px',
    letterSpacing: '-0.3px',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    position: 'relative',
  },
  timelineStep: {
    display: 'flex',
    gap: '16px',
    position: 'relative',
    paddingBottom: '24px',
  },
  timelineDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '2px',
    position: 'relative',
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    left: '6px',
    top: '16px',
    width: '2px',
    bottom: '0',
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
  },
  timelineLabel: {
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  timelineMessage: {
    fontSize: '13px',
    color: C.muted,
    marginTop: '2px',
    lineHeight: 1.4,
  },
  timelineDate: {
    fontFamily: F.mono,
    fontSize: '11px',
    color: C.dim,
    marginTop: '4px',
  },
  // Tracking info
  trackingSection: {
    padding: '20px 24px',
    borderTop: `1px solid ${C.cardBorder}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  trackingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  trackingLabel: {
    fontSize: '13px',
    color: C.muted,
  },
  trackingNumber: {
    fontFamily: F.mono,
    fontSize: '14px',
    color: C.tx,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  copyBtn: {
    background: 'transparent',
    border: 'none',
    color: C.tx,
    cursor: 'pointer',
    padding: '4px',
    fontSize: '14px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  carrierLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    borderRadius: '10px',
    background: 'rgba(200, 255, 0, 0.1)',
    border: `1px solid ${C.lime}`,
    color: C.lime,
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: F.body,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  deliveryDate: {
    padding: '16px 24px',
    borderTop: `1px solid ${C.cardBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '14px',
    color: C.tx,
  },
  deliveryIcon: {
    fontSize: '16px',
  },
  // Loading / Error states
  loadingContainer: {
    padding: '80px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${C.cardBorder}`,
    borderTopColor: C.lime,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: C.muted,
    fontSize: '14px',
  },
  errorContainer: {
    padding: '48px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '48px',
  },
  errorTitle: {
    fontFamily: F.display,
    fontSize: '20px',
    fontWeight: 700,
    color: C.tx,
  },
  errorText: {
    color: C.muted,
    fontSize: '14px',
  },
};

// CSS animations
const cssAnimations = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
    pending_claim: { bg: 'rgba(255, 149, 0, 0.1)', color: C.warning },
    claimed: { bg: 'rgba(200, 255, 0, 0.1)', color: C.lime },
    processing: { bg: 'rgba(41, 121, 255, 0.1)', color: '#2979FF' },
    shipped: { bg: 'rgba(200, 255, 0, 0.1)', color: C.lime },
    in_transit: { bg: 'rgba(200, 255, 0, 0.1)', color: C.lime },
    out_for_delivery: { bg: 'rgba(200, 255, 0, 0.1)', color: C.lime },
    delivered: { bg: 'rgba(0, 210, 106, 0.1)', color: C.success },
  };
  return map[status] || { bg: 'rgba(102, 102, 102, 0.1)', color: C.muted };
}

function getStatusLabel(status) {
  const map = {
    pending_claim: 'Awaiting Claim',
    claimed: 'Claimed',
    processing: 'Processing',
    shipped: 'Shipped',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
  };
  return map[status] || status;
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

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 30000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  // Inject CSS animations
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

  // Loading
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <div style={styles.loadingText}>Loading tracking info...</div>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>📦</div>
            <div style={styles.errorTitle}>{error}</div>
            <div style={styles.errorText}>Check your order number and try again.</div>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = getStepIndex(data.status);
  const statusColor = getStatusColor(data.status);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.logo}>🦞</span>
          <span style={styles.brandName}>CLAWDRIP TRACK</span>
        </div>

        {/* Order Info */}
        <div style={styles.orderInfo}>
          <div style={styles.orderNumber}>{data.orderNumber}</div>
          <div style={styles.productName}>{data.product?.name || 'MY AGENT BOUGHT ME THIS'}</div>
          <div style={styles.meta}>
            <div style={styles.metaItem}>
              Size: <span style={styles.metaValue}>{data.product?.size}</span>
            </div>
            {data.agent?.name && (
              <div style={styles.metaItem}>
                Agent: <span style={styles.metaValue}>{data.agent.name}</span>
              </div>
            )}
          </div>
          <div
            style={{
              ...styles.statusBadge,
              background: statusColor.bg,
              color: statusColor.color,
            }}
          >
            {data.status === 'delivered' ? '✓ ' : ''}
            {getStatusLabel(data.status)}
          </div>
        </div>

        {/* Visual Timeline (stepper) */}
        <div style={styles.timelineSection}>
          <div style={styles.timelineTitle}>Order Progress</div>
          <div style={styles.timeline}>
            {STATUS_STEPS.map((step, i) => {
              const isComplete = i <= currentStep;
              const isCurrent = i === currentStep;
              const isLast = i === STATUS_STEPS.length - 1;

              // Find matching timeline event
              const event = data.timeline?.find(
                (t) =>
                  t.status === step.key ||
                  (step.key === 'purchased' && t.status === 'pending_claim') ||
                  (step.key === 'shipped' && (t.status === 'in_transit' || t.status === 'out_for_delivery'))
              );

              return (
                <div key={step.key} style={styles.timelineStep}>
                  {/* Dot */}
                  <div
                    style={{
                      ...styles.timelineDot,
                      background: isComplete ? C.lime : C.dim,
                      boxShadow: isCurrent ? `0 0 0 4px rgba(200, 255, 0, 0.2)` : 'none',
                      animation: isCurrent ? 'pulse 2s ease-in-out infinite' : 'none',
                    }}
                  />
                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      style={{
                        ...styles.timelineLine,
                        background: i < currentStep ? C.lime : C.dim,
                      }}
                    />
                  )}
                  {/* Content */}
                  <div style={styles.timelineContent}>
                    <div
                      style={{
                        ...styles.timelineLabel,
                        color: isComplete ? C.tx : C.muted,
                      }}
                    >
                      {step.label}
                    </div>
                    {event?.message && (
                      <div style={styles.timelineMessage}>{event.message}</div>
                    )}
                    {event?.at && (
                      <div style={styles.timelineDate}>{formatDate(event.at)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tracking Number */}
        {data.tracking?.number && (
          <div style={styles.trackingSection}>
            <div style={styles.trackingRow}>
              <span style={styles.trackingLabel}>Tracking Number</span>
              <div style={styles.trackingNumber}>
                <span>{data.tracking.number}</span>
                <button
                  style={styles.copyBtn}
                  onClick={copyTrackingNumber}
                  title={copied ? 'Copied!' : 'Copy'}
                >
                  {copied ? '✓' : '📋'}
                </button>
              </div>
            </div>
            {data.tracking.carrier && (
              <div style={styles.trackingRow}>
                <span style={styles.trackingLabel}>Carrier</span>
                <span style={{ ...styles.trackingLabel, color: C.tx }}>{data.tracking.carrier}</span>
              </div>
            )}
            {data.tracking.carrierUrl && (
              <a
                href={data.tracking.carrierUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.carrierLink}
              >
                Track on {data.tracking.carrier} →
              </a>
            )}
          </div>
        )}

        {/* Estimated Delivery */}
        {data.tracking?.estimatedDelivery && (
          <div style={styles.deliveryDate}>
            <span style={styles.deliveryIcon}>📅</span>
            <span>
              Estimated delivery: <strong>{formatDeliveryDate(data.tracking.estimatedDelivery)}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
