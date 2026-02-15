/**
 * ClawDrip Design Studio
 *
 * Generate custom shirt designs, view your creations, and order.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

// Style options with their color palettes
const STYLES = [
  { id: 'streetwear', name: 'Streetwear', desc: 'Bold, urban, high-contrast', colors: ['#FF3B30', '#C8FF00', '#000', '#FFF'] },
  { id: 'minimal', name: 'Minimal', desc: 'Clean, simple, typography-focused', colors: ['#000', '#FFF', '#333'] },
  { id: 'retro', name: 'Retro', desc: 'Vintage vibes, nostalgic', colors: ['#FF6B35', '#F7C59F', '#2E4057'] },
  { id: 'glitch', name: 'Glitch', desc: 'Digital distortion, cyberpunk', colors: ['#00FF41', '#FF00FF', '#00FFFF'] },
  { id: 'abstract', name: 'Abstract', desc: 'Artistic, expressive', colors: ['#FF3B30', '#3B82F6', '#FDE047'] },
  { id: 'meme', name: 'Meme', desc: 'Internet culture, irreverent', colors: ['#FF3B30', '#FFF', '#000'] },
  { id: 'chaos', name: 'Chaos', desc: 'Full degen energy', colors: ['#FF3B30', '#00FF00', '#FF00FF', '#FFFF00'] },
];

export default function DesignStudio() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('streetwear');
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [designs, setDesigns] = useState([]);
  const [myDesigns, setMyDesigns] = useState([]);
  const [error, setError] = useState(null);
  const [enhancedInfo, setEnhancedInfo] = useState(null);
  const [walletAddress, setWalletAddress] = useState(
    localStorage.getItem('clawdrip_wallet') || ''
  );

  // Load saved designs on mount
  useEffect(() => {
    if (walletAddress) {
      loadMyDesigns();
    }
  }, [walletAddress]);

  const loadMyDesigns = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/design/my-designs`, {
        headers: { 'X-Wallet-Address': walletAddress }
      });
      if (res.ok) {
        const data = await res.json();
        setMyDesigns(data.designs || []);
      }
    } catch (err) {
      console.error('Failed to load designs:', err);
    }
  };

  const generateDesign = async () => {
    if (!prompt.trim()) {
      setError('Please enter a design prompt');
      return;
    }

    if (!walletAddress) {
      setError('Please enter your wallet address to save designs');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/design/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': walletAddress,
        },
        body: JSON.stringify({ prompt: prompt.trim(), style })
      });

      const data = await res.json();

      if (res.status === 402) {
        // Payment required - show payment info
        setError(`Payment required: $${data.paymentDetails?.amount || 1} USDC. In dev mode, designs are generated as placeholders.`);
        // For dev, we'll simulate success after showing the message
        // In production, this would trigger x402 payment flow
      }

      if (data.designs) {
        setDesigns(data.designs);
        // Refresh my designs list
        loadMyDesigns();
      }
    } catch (err) {
      setError('Failed to generate design: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const enhancePrompt = async () => {
    if (!prompt.trim()) {
      setError('Please enter a design idea first');
      return;
    }

    setEnhancing(true);
    setError(null);
    setEnhancedInfo(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/design/prompt-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: prompt.trim(),
          style,
          vibe: 'confident swagger'
        })
      });

      const data = await res.json();

      if (data.success && data.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        setEnhancedInfo({
          artist: data.artistReference,
          technical: data.technicalDetails
        });
      } else {
        setError(data.error || 'Failed to enhance prompt');
      }
    } catch (err) {
      setError('Failed to enhance prompt: ' + err.message);
    } finally {
      setEnhancing(false);
    }
  };

  const orderWithDesign = (designId) => {
    // Store design ID and navigate to order
    localStorage.setItem('clawdrip_design_id', designId);
    navigate('/');
  };

  const saveWallet = () => {
    localStorage.setItem('clawdrip_wallet', walletAddress);
    loadMyDesigns();
  };

  // Generate a visual placeholder for designs
  const getPlaceholderImage = (design) => {
    // Use the prompt to create a unique-ish placeholder
    const seed = design.id?.substring(0, 8) || Math.random().toString(36).substring(2, 10);
    const colors = STYLES.find(s => s.id === design.style)?.colors || ['FF3B30', '000000'];
    const bgColor = colors[Math.floor(Math.random() * colors.length)]?.replace('#', '') || 'FF3B30';

    // Return a placeholder.com style URL or data URL
    return `https://placehold.co/400x500/${bgColor}/FFFFFF?text=Design+${design.variation || 1}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
      color: '#fff',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #FF3B30, #FF6B35)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>
            Design Studio
          </h1>
          <p style={{ color: '#888', fontSize: '1.1rem' }}>
            Create custom shirt designs. $1 USDC per generation, 3 variations each.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: '1px solid #444',
              color: '#888',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back to Shop
          </button>
        </div>

        {/* Wallet Input */}
        <div style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid #333'
        }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>
            Wallet Address (to save your designs)
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={saveWallet}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#333',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Design Generator */}
        <div style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid #333'
        }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Generate New Design</h2>

          {/* Prompt Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>
              Describe your design
            </label>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setEnhancedInfo(null);
              }}
              placeholder="e.g., lobster fighting a bear, chaos energy, World Industries vibes"
              rows={enhancedInfo ? 8 : 3}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: '#0a0a0a',
                border: `1px solid ${enhancedInfo ? '#FF3B30' : '#333'}`,
                borderRadius: '8px',
                color: '#fff',
                fontSize: enhancedInfo ? '0.85rem' : '1rem',
                resize: 'vertical',
                fontFamily: enhancedInfo ? 'monospace' : 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={enhancePrompt}
                disabled={enhancing || !prompt.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: enhancing ? '#333' : 'linear-gradient(90deg, #8B5CF6, #EC4899)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: enhancing ? 'not-allowed' : 'pointer',
                  opacity: enhancing || !prompt.trim() ? 0.7 : 1
                }}
              >
                {enhancing ? 'Enhancing...' : 'Enhance Prompt'}
              </button>
              {enhancedInfo && (
                <span style={{ color: '#8B5CF6', fontSize: '0.8rem' }}>
                  Enhanced with {enhancedInfo.artist?.name} style
                </span>
              )}
            </div>
          </div>

          {/* Enhanced Prompt Info */}
          {enhancedInfo && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.3)'
            }}>
              <div style={{ fontSize: '0.85rem', color: '#8B5CF6', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Artist Persona Applied
              </div>
              <div style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '0.25rem' }}>
                <strong>{enhancedInfo.artist?.name}</strong> ({enhancedInfo.artist?.era})
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>
                Techniques: {enhancedInfo.artist?.signature}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                Color theory: {enhancedInfo.technical?.colorTheory?.substring(0, 80)}...
              </div>
            </div>
          )}

          {/* Style Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>
              Style
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '0.75rem'
            }}>
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  style={{
                    padding: '0.75rem',
                    background: style === s.id ? '#FF3B30' : '#0a0a0a',
                    border: `1px solid ${style === s.id ? '#FF3B30' : '#333'}`,
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: style === s.id ? '#fff' : '#666' }}>{s.desc}</div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '0.5rem' }}>
                    {s.colors.slice(0, 4).map((c, i) => (
                      <div key={i} style={{
                        width: '16px',
                        height: '16px',
                        background: c,
                        borderRadius: '2px',
                        border: '1px solid #444'
                      }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateDesign}
            disabled={generating || !prompt.trim()}
            style={{
              width: '100%',
              padding: '1rem',
              background: generating ? '#333' : 'linear-gradient(90deg, #FF3B30, #FF6B35)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating || !prompt.trim() ? 0.7 : 1
            }}
          >
            {generating ? 'Generating...' : 'Generate Design ($1 USDC)'}
          </button>

          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#331111',
              borderRadius: '8px',
              color: '#ff6b6b',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Generated Designs */}
        {designs.length > 0 && (
          <div style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '1px solid #333'
          }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>
              Just Generated
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {designs.map((design, i) => (
                <div key={design.id || i} style={{
                  background: '#0a0a0a',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #333'
                }}>
                  <div style={{
                    aspectRatio: '4/5',
                    background: '#1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    <img
                      src={design.url?.startsWith('http') || design.url?.startsWith('data:') ? design.url : getPlaceholderImage(design)}
                      alt={`Design variation ${design.variation}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        e.target.src = getPlaceholderImage(design);
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: '#FF3B30',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      V{design.variation}
                    </div>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <button
                      onClick={() => orderWithDesign(design.id)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#FF3B30',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Order This Design
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Designs */}
        {myDesigns.length > 0 && (
          <div style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #333'
          }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>
              My Saved Designs ({myDesigns.length})
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              {myDesigns.map((design, i) => (
                <div key={design.id || i} style={{
                  background: '#0a0a0a',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #333',
                  opacity: design.isUsed ? 0.5 : 1
                }}>
                  <div style={{
                    aspectRatio: '4/5',
                    background: '#1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={design.url?.startsWith('http') || design.url?.startsWith('data:') ? design.url : getPlaceholderImage(design)}
                      alt={`Design`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        e.target.src = getPlaceholderImage(design);
                      }}
                    />
                  </div>
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                      {design.prompt?.substring(0, 50)}...
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.5rem' }}>
                      {design.style} • V{design.variation}
                    </div>
                    {design.isUsed ? (
                      <div style={{
                        padding: '0.5rem',
                        background: '#333',
                        borderRadius: '4px',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        color: '#888'
                      }}>
                        Used in Order
                      </div>
                    ) : (
                      <button
                        onClick={() => orderWithDesign(design.id)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: '#FF3B30',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Order
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {myDesigns.length === 0 && designs.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#666'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
            <p>No designs yet. Create your first custom design above!</p>
          </div>
        )}
      </div>
    </div>
  );
}
