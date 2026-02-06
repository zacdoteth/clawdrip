import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';

// ═══════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || '';

// ═══════════════════════════════════════════════════
// DESIGN TOKENS — matching main site brand
// ═══════════════════════════════════════════════════

const C = {
  bg: '#030303',
  card: '#0a0a0a',
  cardInner: '#111111',
  cardBorder: '#1a1a1a',
  lime: '#C8FF00',
  red: '#FF3B30',
  tx: '#f0ede6',
  muted: '#555555',
  dim: '#333333',
  qrBg: '#FFFFFF',
  success: '#00D26A',
  warning: '#FF9500',
  blue: '#0052FF',
};

const F = {
  display: "'Syne', sans-serif",
  body: "'Outfit', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ═══════════════════════════════════════════════════
// CSS ANIMATIONS — award-winning motion system
// ═══════════════════════════════════════════════════

const cssAnimations = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes confettiFall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

@keyframes breathe {
  0%, 100% { box-shadow: 0 0 24px rgba(200, 255, 0, 0.06), 0 4px 24px rgba(0,0,0,0.3); }
  50% { box-shadow: 0 0 40px rgba(200, 255, 0, 0.14), 0 4px 32px rgba(0,0,0,0.4); }
}

@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes pulseRing {
  0% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(255, 59, 48, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes successGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 210, 106, 0.1); }
  50% { box-shadow: 0 0 60px rgba(0, 210, 106, 0.25); }
}

@keyframes cardEntry {
  from { opacity: 0; transform: translateY(32px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes tickUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes borderGlow {
  0%, 100% { border-color: rgba(255, 59, 48, 0.15); }
  33% { border-color: rgba(200, 255, 0, 0.15); }
  66% { border-color: rgba(41, 121, 255, 0.12); }
}

/* Hover effects for wallet buttons */
.pay-wallet-btn {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.pay-wallet-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
}
.pay-wallet-btn-primary:hover {
  box-shadow: 0 8px 32px rgba(200, 255, 0, 0.25) !important;
}
.pay-copy-btn {
  transition: all 0.2s ease !important;
}
.pay-copy-btn:hover {
  background: rgba(255,255,255,0.06) !important;
}
.pay-claim-btn {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.pay-claim-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 32px rgba(200, 255, 0, 0.3) !important;
}
`;

// ═══════════════════════════════════════════════════
// LOGO COMPONENT — real ClawDrip wordmark
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
// CONFETTI COMPONENT
// ═══════════════════════════════════════════════════

const Confetti = () => {
  const colors = [C.lime, C.red, '#2979FF', C.warning, C.success, '#FF00FF', '#fff'];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: `${6 + Math.random() * 8}px`,
    rotate: Math.random() > 0.5,
  }));

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1000 }}>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          style={{
            position: 'absolute',
            left: piece.left,
            width: piece.size,
            height: piece.rotate ? `${parseInt(piece.size) * 0.4}px` : piece.size,
            background: piece.color,
            borderRadius: piece.rotate ? '1px' : '2px',
            animation: `confettiFall ${piece.duration} ${piece.delay} ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// COUNTDOWN TIMER HOOK
// ═══════════════════════════════════════════════════

const useCountdown = (expiresAt) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        return;
      }

      setIsUrgent(diff < 5 * 60 * 1000); // < 5 minutes

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return { timeLeft, isExpired, isUrgent };
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function PayPage() {
  const { giftId } = useParams();
  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch gift status
  const fetchGiftStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/gift/${giftId}/status`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Gift not found');
        } else {
          setError('Failed to load payment details');
        }
        setLoading(false);
        return;
      }
      const data = await res.json();

      // Check if status changed to purchased (show confetti)
      if (gift && gift.status !== 'purchased' && data.status === 'purchased') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }

      setGift(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to connect to server');
      setLoading(false);
    }
  }, [giftId, gift]);

  // Initial fetch and polling
  useEffect(() => {
    fetchGiftStatus();

    // Poll every 5 seconds for payment status
    const pollInterval = setInterval(() => {
      fetchGiftStatus();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [fetchGiftStatus]);

  // Countdown timer
  const { timeLeft, isExpired, isUrgent } = useCountdown(gift?.timing?.expiresAt);

  // Copy address to clipboard
  const copyAddress = async () => {
    if (!gift?.funding?.wallet?.address) return;
    try {
      await navigator.clipboard.writeText(gift.funding.wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = gift.funding.wallet.address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate wallet deep links
  const getWalletLinks = (address, amount) => {
    const usdcBase = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    return {
      coinbase: `https://go.cb-w.com/pay?address=${address}&amount=${amount}&asset=USDC&chainId=8453`,
      rainbow: `rainbow://send?address=${address}&amount=${amount}&assetAddress=${usdcBase}&chainId=8453`,
      generic: `ethereum:${usdcBase}@8453/transfer?address=${address}&uint256=${amount * 1e6}`,
    };
  };

  // Inject CSS animations
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = cssAnimations;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

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
      animation: `cardEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards, ${glow ? 'borderGlow 6s ease infinite' : 'none'}`,
      position: 'relative',
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
      <Logo suffix="PAY" />
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: C.lime,
        boxShadow: `0 0 8px ${C.lime}`,
        animation: 'pulse 2s ease infinite',
      }} />
    </div>
  );

  const TrustFooter = ({ items }) => (
    <div style={{
      padding: '18px 24px',
      borderTop: `1px solid ${C.cardBorder}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: C.muted,
          fontSize: '12px',
          fontFamily: F.mono,
          letterSpacing: '0.02em',
          animation: `fadeUp 0.4s ease ${0.6 + i * 0.08}s both`,
        }}>
          <span style={{ fontSize: '12px', flexShrink: 0 }}>{item.icon}</span>
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );

  // ─── Loading state ───

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
              loading payment details
            </div>
          </div>
        </Card>
      </Container>
    );
  }

  // ─── Error state ───

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
              ✕
            </div>
            <div style={{ fontFamily: F.display, fontSize: '20px', fontWeight: 700, color: C.tx }}>
              {error}
            </div>
            <div style={{ color: C.muted, fontSize: '14px', lineHeight: 1.5 }}>
              Check the link and try again.
            </div>
          </div>
        </Card>
      </Container>
    );
  }

  // ─── Success state (payment received) ───

  if (gift?.status === 'purchased' || gift?.status === 'funded') {
    return (
      <Container>
        {showConfetti && <Confetti />}
        <Card glow>
          <Header />
          <div style={{
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            animation: 'successGlow 3s ease infinite',
          }}>
            {/* Success checkmark */}
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: `linear-gradient(135deg, rgba(0, 210, 106, 0.15), rgba(200, 255, 0, 0.08))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Copy */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: F.display, fontSize: '26px', fontWeight: 800,
                color: C.tx, letterSpacing: '-0.5px', marginBottom: '8px',
              }}>
                Payment Received
              </div>
              <div style={{
                color: C.muted, fontSize: '14px', lineHeight: 1.6,
                maxWidth: '280px',
              }}>
                {gift?.agentName
                  ? <>{`${gift.agentName}'s gift is being processed.`}<br />{'You just funded the first AI→human gift.'}</>
                  : <>{'Your gift is being processed.'}<br />{'Check your messages for the claim link.'}</>
                }
              </div>
            </div>

            {/* Claim CTA */}
            {gift?.order?.claimUrl && (
              <a
                href={gift.order.claimUrl}
                className="pay-claim-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 36px',
                  borderRadius: '12px',
                  background: C.lime,
                  color: '#030303',
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: F.display,
                  cursor: 'pointer',
                  border: 'none',
                  textDecoration: 'none',
                  letterSpacing: '-0.02em',
                  boxShadow: `0 4px 20px rgba(200, 255, 0, 0.2)`,
                }}
              >
                Claim Your Gift
                <span style={{ fontSize: '18px' }}>→</span>
              </a>
            )}
          </div>

          <TrustFooter items={[
            { icon: '🔒', text: 'Secured by Base Network' },
            { icon: '✓', text: 'Payment confirmed on-chain' },
          ]} />
        </Card>
      </Container>
    );
  }

  // ─── Expired state ───

  if (isExpired || gift?.status === 'expired') {
    return (
      <Container>
        <Card>
          <Header />
          <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(255, 149, 0, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px',
              animation: 'scaleIn 0.4s ease',
            }}>
              ⏰
            </div>
            <div style={{ fontFamily: F.display, fontSize: '20px', fontWeight: 700, color: C.tx }}>
              Link Expired
            </div>
            <div style={{ color: C.muted, fontSize: '14px', lineHeight: 1.5 }}>
              This payment request has expired.<br />
              Ask your agent to create a new one.
            </div>
          </div>
        </Card>
      </Container>
    );
  }

  // ─── Main payment view ───

  const walletAddress = gift?.funding?.wallet?.address || '';
  const shortAddress = gift?.funding?.wallet?.addressShort ||
    `${walletAddress.slice(0, 6)} · · · ${walletAddress.slice(-4)}`;
  const amount = gift?.funding?.required || 35;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${walletAddress}`;
  const walletLinks = getWalletLinks(walletAddress, amount);

  return (
    <Container>
      <Card glow>
        {/* ── Header ── */}
        <Header />

        {/* ── QR Code Section ── */}
        <div style={{
          padding: '32px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          animation: 'fadeUp 0.5s ease 0.1s both',
        }}>
          {/* QR Code */}
          <div style={{
            position: 'relative',
            background: C.qrBg,
            borderRadius: '16px',
            padding: '16px',
            animation: 'breathe 4s ease infinite',
          }}>
            <img
              src={qrUrl}
              alt="Payment QR Code"
              style={{ width: '200px', height: '200px', display: 'block', borderRadius: '4px' }}
            />
            {/* Logo overlay on QR */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '44px', height: '44px',
              background: C.qrBg,
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <span style={{ fontSize: '24px' }}>🦞</span>
            </div>
          </div>

          {/* Agent message */}
          <div style={{
            textAlign: 'center',
            animation: 'fadeUp 0.5s ease 0.2s both',
          }}>
            <div style={{ color: C.muted, fontSize: '14px', lineHeight: 1.4 }}>
              <span style={{ color: C.tx, fontWeight: 600 }}>{gift?.agentName || 'Your agent'}</span>
              {' '}is buying you a gift
            </div>
          </div>
        </div>

        {/* ── Amount ── */}
        <div style={{
          textAlign: 'center',
          padding: '0 24px 28px',
          animation: 'fadeUp 0.5s ease 0.25s both',
        }}>
          <div style={{
            fontFamily: F.display,
            fontSize: '44px',
            fontWeight: 800,
            color: C.tx,
            letterSpacing: '-1.5px',
            lineHeight: 1,
          }}>
            ${amount.toFixed(2)}
            <span style={{ fontSize: '18px', color: C.muted, fontWeight: 400, marginLeft: '8px', letterSpacing: '0' }}>
              USDC
            </span>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0, 82, 255, 0.08)',
            border: '1px solid rgba(0, 82, 255, 0.2)',
            borderRadius: '20px',
            padding: '5px 14px',
            marginTop: '10px',
            color: '#4D8FFF',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: F.mono,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
            on Base
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: '1px', background: C.cardBorder, margin: '0 24px' }} />

        {/* ── Address ── */}
        <div style={{
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          animation: 'fadeUp 0.5s ease 0.3s both',
        }}>
          <span style={{
            fontFamily: F.mono,
            fontSize: '13px',
            color: C.muted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}>
            {shortAddress}
          </span>
          <button
            className="pay-copy-btn"
            onClick={copyAddress}
            title={copied ? 'Copied!' : 'Copy address'}
            style={{
              background: copied ? 'rgba(200, 255, 0, 0.08)' : 'transparent',
              border: 'none',
              color: copied ? C.lime : C.muted,
              cursor: 'pointer',
              padding: '8px 10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontFamily: F.mono,
              gap: '4px',
            }}
          >
            {copied ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg> copied</>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Countdown Timer ── */}
        <div style={{
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: isUrgent ? 'rgba(255, 59, 48, 0.04)' : 'rgba(255, 149, 0, 0.03)',
          borderTop: `1px solid ${C.cardBorder}`,
          borderBottom: `1px solid ${C.cardBorder}`,
          animation: isUrgent ? 'pulseRing 2s ease infinite' : 'fadeUp 0.5s ease 0.35s both',
        }}>
          <span style={{ fontSize: '13px' }}>⏳</span>
          <span style={{
            fontFamily: F.mono,
            fontSize: '13px',
            color: isUrgent ? C.red : C.warning,
            fontWeight: 500,
            letterSpacing: '0.04em',
          }}>
            Expires in {timeLeft}
          </span>
        </div>

        {/* ── Wallet Buttons ── */}
        <div style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          animation: 'fadeUp 0.5s ease 0.4s both',
        }}>
          {/* Coinbase Wallet */}
          <a
            href={walletLinks.coinbase}
            className="pay-wallet-btn pay-wallet-btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '15px 24px',
              borderRadius: '12px',
              background: C.lime,
              border: 'none',
              color: '#030303',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: F.body,
              cursor: 'pointer',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
            }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div style={{
              width: '22px', height: '22px', borderRadius: '5px',
              background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            </div>
            Open in Coinbase Wallet
          </a>

          {/* Rainbow */}
          <a
            href={walletLinks.rainbow}
            className="pay-wallet-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '15px 24px',
              borderRadius: '12px',
              border: `1px solid ${C.dim}`,
              background: 'transparent',
              color: C.tx,
              fontSize: '15px',
              fontWeight: 500,
              fontFamily: F.body,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span style={{ fontSize: '18px' }}>🌈</span>
            Open in Rainbow
          </a>
        </div>

        {/* ── Trust Footer ── */}
        <TrustFooter items={[
          { icon: '🔒', text: 'Secured by Base Network' },
          { icon: '★', text: '1,247 gifts delivered' },
          { icon: '🦞', text: 'First AI→human gift platform' },
        ]} />
      </Card>

      {/* Subtle branding below card */}
      <div style={{
        marginTop: '20px',
        textAlign: 'center',
        animation: 'fadeUp 0.5s ease 0.6s both',
      }}>
        <div style={{
          fontFamily: F.mono,
          fontSize: '10px',
          color: C.dim,
          letterSpacing: '0.08em',
        }}>
          clawdrip.com
        </div>
      </div>
    </Container>
  );
}
