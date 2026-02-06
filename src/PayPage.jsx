import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// ═══════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || '';

// ═══════════════════════════════════════════════════
// DESIGN TOKENS (matching App.jsx)
// ═══════════════════════════════════════════════════

const C = {
  bg: '#030303',
  card: '#111111',
  cardBorder: '#1a1a1a',
  lime: '#C8FF00',
  tx: '#f0ede6',
  muted: '#666666',
  dim: '#333333',
  qrBg: '#FFFFFF',
  success: '#00D26A',
  warning: '#FF9500',
};

const F = {
  display: "'Syne', sans-serif",
  body: "'Outfit', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

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
    maxWidth: '400px',
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
  qrSection: {
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  qrContainer: {
    position: 'relative',
    background: C.qrBg,
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  qrImage: {
    width: '220px',
    height: '220px',
    display: 'block',
  },
  logoOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '48px',
    height: '48px',
    background: C.qrBg,
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  agentMessage: {
    textAlign: 'center',
    color: C.muted,
    fontSize: '15px',
    lineHeight: 1.4,
  },
  agentName: {
    color: C.tx,
    fontWeight: 600,
  },
  amountSection: {
    textAlign: 'center',
  },
  amount: {
    fontFamily: F.display,
    fontSize: '42px',
    fontWeight: 800,
    color: C.tx,
    letterSpacing: '-1px',
  },
  currency: {
    fontSize: '20px',
    color: C.muted,
    fontWeight: 400,
  },
  networkBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(200, 255, 0, 0.1)',
    border: `1px solid ${C.lime}`,
    borderRadius: '20px',
    padding: '6px 14px',
    marginTop: '8px',
    color: C.lime,
    fontSize: '13px',
    fontWeight: 500,
  },
  divider: {
    width: '100%',
    height: '1px',
    background: C.cardBorder,
  },
  addressSection: {
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  addressText: {
    fontFamily: F.mono,
    fontSize: '14px',
    color: C.muted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyButton: {
    background: 'transparent',
    border: 'none',
    color: C.tx,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    fontSize: '18px',
  },
  timerSection: {
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'rgba(255, 149, 0, 0.05)',
    borderTop: `1px solid ${C.cardBorder}`,
    borderBottom: `1px solid ${C.cardBorder}`,
  },
  timerIcon: {
    fontSize: '16px',
  },
  timerText: {
    fontFamily: F.mono,
    fontSize: '14px',
    color: C.warning,
    fontWeight: 500,
  },
  walletButtons: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  walletButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px 24px',
    borderRadius: '12px',
    border: `1px solid ${C.cardBorder}`,
    background: 'transparent',
    color: C.tx,
    fontSize: '15px',
    fontWeight: 500,
    fontFamily: F.body,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textDecoration: 'none',
  },
  walletButtonPrimary: {
    background: C.lime,
    border: `1px solid ${C.lime}`,
    color: '#030303',
  },
  trustSection: {
    padding: '20px 24px',
    borderTop: `1px solid ${C.cardBorder}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  trustItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: C.muted,
    fontSize: '13px',
  },
  trustIcon: {
    fontSize: '14px',
  },
  // Success state
  successContainer: {
    padding: '48px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(0, 210, 106, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '40px',
    animation: 'scaleIn 0.4s ease-out',
  },
  successTitle: {
    fontFamily: F.display,
    fontSize: '24px',
    fontWeight: 700,
    color: C.tx,
    textAlign: 'center',
  },
  successText: {
    color: C.muted,
    fontSize: '15px',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  claimButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 32px',
    borderRadius: '12px',
    background: C.lime,
    color: '#030303',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: F.body,
    cursor: 'pointer',
    border: 'none',
    textDecoration: 'none',
  },
  // Error state
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
  // Loading state
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
  // Confetti
  confettiContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 1000,
  },
  confetti: {
    position: 'absolute',
    width: '10px',
    height: '10px',
    borderRadius: '2px',
  },
};

// CSS animations
const cssAnimations = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes confettiFall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}
`;

// ═══════════════════════════════════════════════════
// CONFETTI COMPONENT
// ═══════════════════════════════════════════════════

const Confetti = () => {
  const colors = [C.lime, '#FF3B30', '#2979FF', '#FF9500', '#00D26A', '#FF00FF'];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: `${6 + Math.random() * 8}px`,
  }));

  return (
    <div style={styles.confettiContainer}>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          style={{
            ...styles.confetti,
            left: piece.left,
            width: piece.size,
            height: piece.size,
            background: piece.color,
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

  return { timeLeft, isExpired };
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
        setTimeout(() => setShowConfetti(false), 4000);
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
  const { timeLeft, isExpired } = useCountdown(gift?.timing?.expiresAt);

  // Copy address to clipboard
  const copyAddress = async () => {
    if (!gift?.funding?.wallet?.address) return;
    try {
      await navigator.clipboard.writeText(gift.funding.wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
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
    // EIP-681 format for Ethereum payments
    // For USDC on Base, we need the token contract
    const usdcBase = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    return {
      // Coinbase Wallet deep link
      coinbase: `https://go.cb-w.com/pay?address=${address}&amount=${amount}&asset=USDC&chainId=8453`,
      // Rainbow wallet
      rainbow: `rainbow://send?address=${address}&amount=${amount}&assetAddress=${usdcBase}&chainId=8453`,
      // Generic ethereum: URI (works with many wallets)
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

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <div style={styles.loadingText}>Loading payment details...</div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>😕</div>
            <div style={styles.errorTitle}>{error}</div>
            <div style={styles.errorText}>
              Please check the link and try again.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state (payment received)
  if (gift?.status === 'purchased' || gift?.status === 'funded') {
    return (
      <div style={styles.container}>
        {showConfetti && <Confetti />}
        <div style={styles.card}>
          <div style={styles.header}>
            <span style={styles.logo}>🦞</span>
            <span style={styles.brandName}>CLAWDRIP PAY</span>
          </div>
          <div style={styles.successContainer}>
            <div style={styles.successIcon}>✓</div>
            <div style={styles.successTitle}>Payment Received!</div>
            <div style={styles.successText}>
              Your gift is being processed.
              {gift?.order?.claimUrl && (
                <>
                  <br />
                  Check your messages for the claim link!
                </>
              )}
            </div>
            {gift?.order?.claimUrl && (
              <a
                href={gift.order.claimUrl}
                style={styles.claimButton}
              >
                Claim Your Gift →
              </a>
            )}
          </div>
          <div style={styles.trustSection}>
            <div style={styles.trustItem}>
              <span style={styles.trustIcon}>🔒</span>
              <span>Secured by Base Network</span>
            </div>
            <div style={styles.trustItem}>
              <span style={styles.trustIcon}>✓</span>
              <span>Payment confirmed on-chain</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expired state
  if (isExpired || gift?.status === 'expired') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <span style={styles.logo}>🦞</span>
            <span style={styles.brandName}>CLAWDRIP PAY</span>
          </div>
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>⏰</div>
            <div style={styles.errorTitle}>Payment Link Expired</div>
            <div style={styles.errorText}>
              This payment request has expired.
              <br />
              Ask your agent to create a new one!
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main payment view
  const walletAddress = gift?.funding?.wallet?.address || '';
  const shortAddress = gift?.funding?.wallet?.addressShort ||
    `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const amount = gift?.funding?.required || 35;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${walletAddress}`;
  const walletLinks = getWalletLinks(walletAddress, amount);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.logo}>🦞</span>
          <span style={styles.brandName}>CLAWDRIP PAY</span>
        </div>

        {/* QR Code Section */}
        <div style={styles.qrSection}>
          {/* QR Code with logo overlay */}
          <div style={styles.qrContainer}>
            <img
              src={qrUrl}
              alt="Payment QR Code"
              style={styles.qrImage}
            />
            <div style={styles.logoOverlay}>🦞</div>
          </div>

          {/* Agent message */}
          <div style={styles.agentMessage}>
            <span style={styles.agentName}>{gift?.agentName || 'Your agent'}</span> is buying you a gift
          </div>

          {/* Amount */}
          <div style={styles.amountSection}>
            <div style={styles.amount}>
              ${amount.toFixed(2)} <span style={styles.currency}>USDC</span>
            </div>
            <div style={styles.networkBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
              on Base
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Address */}
        <div style={styles.addressSection}>
          <span style={styles.addressText}>{shortAddress}</span>
          <button
            style={styles.copyButton}
            onClick={copyAddress}
            title={copied ? 'Copied!' : 'Copy address'}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>

        {/* Countdown Timer */}
        <div style={styles.timerSection}>
          <span style={styles.timerIcon}>⏳</span>
          <span style={styles.timerText}>Expires in {timeLeft}</span>
        </div>

        {/* Wallet Deep Links */}
        <div style={styles.walletButtons}>
          <a
            href={walletLinks.coinbase}
            style={{ ...styles.walletButton, ...styles.walletButtonPrimary }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
            Open in Coinbase Wallet
          </a>
          <a
            href={walletLinks.rainbow}
            style={styles.walletButton}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>🌈</span>
            Open in Rainbow
          </a>
        </div>

        {/* Trust Signals */}
        <div style={styles.trustSection}>
          <div style={styles.trustItem}>
            <span style={styles.trustIcon}>🔒</span>
            <span>Secured by Base Network</span>
          </div>
          <div style={styles.trustItem}>
            <span style={{ color: '#FFD700', letterSpacing: '2px' }}>★★★★★</span>
            <span>1,247 gifts delivered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
