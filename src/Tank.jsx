/**
 * ClawDrip Tank - Award-Winning 3D Clawd Experience
 *
 * A Three.js/React Three Fiber powered interactive clawd tank.
 * QR code on shirt -> scan -> meet your digital clawd creator.
 *
 * "The shirt is a portal. The clawd is the soul."
 */

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  Float,
  MeshTransmissionMaterial,
  MeshDistortMaterial,
  Sparkles,
  Text,
  useTexture,
  OrbitControls,
  PerspectiveCamera
} from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ═══════════════════════════════════════════════════
// TANK SKIN THEMES
// ═══════════════════════════════════════════════════

const TANK_THEMES = {
  default: {
    water: '#1a3d5c',
    waterDeep: '#0a1f2c',
    bubbleColor: '#4a9eff',
    ambientLight: '#2a4a6a',
    causticIntensity: 0.3,
    gravel: '#2a2a2a',
    plant: '#1a5a3a'
  },
  coral_reef: {
    water: '#1a4a5c',
    waterDeep: '#0a2a3c',
    bubbleColor: '#ff7aa8',
    ambientLight: '#4a6a7a',
    causticIntensity: 0.5,
    gravel: '#c4a882',
    plant: '#ff6b9d'
  },
  deep_sea: {
    water: '#0a1520',
    waterDeep: '#050a10',
    bubbleColor: '#00ffaa',
    ambientLight: '#1a2a3a',
    causticIntensity: 0.2,
    gravel: '#1a1a2a',
    plant: '#00aa77'
  },
  neon_city: {
    water: '#1a0a2a',
    waterDeep: '#0a0515',
    bubbleColor: '#ff00ff',
    ambientLight: '#4a1a6a',
    causticIntensity: 0.6,
    gravel: '#2a1a3a',
    plant: '#00ffff'
  },
  void: {
    water: '#050505',
    waterDeep: '#000000',
    bubbleColor: '#ffffff',
    ambientLight: '#1a1a1a',
    causticIntensity: 0.1,
    gravel: '#0a0a0a',
    plant: '#333333'
  },
  rainbow: {
    water: '#2a1a4a',
    waterDeep: '#1a0a2a',
    bubbleColor: '#ffaa00',
    ambientLight: '#5a3a7a',
    causticIntensity: 0.7,
    gravel: '#3a2a4a',
    plant: '#ff6600'
  },
  gold: {
    water: '#2a2510',
    waterDeep: '#1a1508',
    bubbleColor: '#ffd700',
    ambientLight: '#6a5a3a',
    causticIntensity: 0.5,
    gravel: '#8b7355',
    plant: '#daa520'
  }
};

// ═══════════════════════════════════════════════════
// 3D COMPONENTS
// ═══════════════════════════════════════════════════

/**
 * Animated Bubble Particles
 */
function Bubbles({ count = 50, theme }) {
  const ref = useRef();
  const bubbles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 3,
        Math.random() * 4 - 2,
        (Math.random() - 0.5) * 3
      ],
      speed: 0.2 + Math.random() * 0.5,
      size: 0.02 + Math.random() * 0.05,
      wobble: Math.random() * Math.PI * 2
    }));
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    const children = ref.current.children;
    const time = state.clock.elapsedTime;

    children.forEach((bubble, i) => {
      const data = bubbles[i];
      bubble.position.y += data.speed * 0.02;
      bubble.position.x = data.position[0] + Math.sin(time * 2 + data.wobble) * 0.1;

      if (bubble.position.y > 2.5) {
        bubble.position.y = -2;
      }
    });
  });

  return (
    <group ref={ref}>
      {bubbles.map((bubble, i) => (
        <mesh key={i} position={bubble.position}>
          <sphereGeometry args={[bubble.size, 8, 8]} />
          <meshStandardMaterial
            color={theme.bubbleColor}
            transparent
            opacity={0.6}
            emissive={theme.bubbleColor}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Animated Clawd Character (Lobster)
 */
function ClawdCharacter({ mood, onInteract }) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const leftClawRef = useRef();
  const rightClawRef = useRef();
  const eyeLeftRef = useRef();
  const eyeRightRef = useRef();
  const antennaLeftRef = useRef();
  const antennaRightRef = useRef();

  const [isWaving, setIsWaving] = useState(false);
  const { pointer, viewport } = useThree();

  // Look at cursor
  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;

    // Gentle breathing animation
    if (bodyRef.current) {
      bodyRef.current.scale.y = 1 + Math.sin(time * 2) * 0.02;
    }

    // Antenna wiggle
    if (antennaLeftRef.current && antennaRightRef.current) {
      antennaLeftRef.current.rotation.z = Math.sin(time * 3) * 0.2 - 0.3;
      antennaRightRef.current.rotation.z = -Math.sin(time * 3 + 0.5) * 0.2 + 0.3;
    }

    // Look at mouse
    const x = (pointer.x * viewport.width) / 2;
    const y = (pointer.y * viewport.height) / 2;

    if (eyeLeftRef.current && eyeRightRef.current) {
      const lookX = THREE.MathUtils.clamp(x * 0.05, -0.05, 0.05);
      const lookY = THREE.MathUtils.clamp(y * 0.05, -0.03, 0.03);
      eyeLeftRef.current.position.x = -0.15 + lookX;
      eyeLeftRef.current.position.y = 0.4 + lookY;
      eyeRightRef.current.position.x = 0.15 + lookX;
      eyeRightRef.current.position.y = 0.4 + lookY;
    }

    // Claw idle animation
    if (leftClawRef.current && rightClawRef.current && !isWaving) {
      leftClawRef.current.rotation.z = Math.sin(time * 1.5) * 0.1 + 0.3;
      rightClawRef.current.rotation.z = -Math.sin(time * 1.5 + 0.3) * 0.1 - 0.3;
    }
  });

  // Wave animation on click
  const handleClick = () => {
    if (isWaving) return;
    setIsWaving(true);
    onInteract?.();

    if (rightClawRef.current) {
      gsap.to(rightClawRef.current.rotation, {
        z: -1.2,
        duration: 0.2,
        yoyo: true,
        repeat: 3,
        onComplete: () => setIsWaving(false)
      });
    }
  };

  // Mood affects colors
  const bodyColor = useMemo(() => {
    const colors = {
      vibing: '#ff4444',
      creative: '#ff6644',
      sleepy: '#cc3333',
      excited: '#ff2222',
      philosophical: '#aa4444',
      sassy: '#ff5588',
      chill: '#dd5555'
    };
    return colors[mood] || colors.vibing;
  }, [mood]);

  return (
    <Float
      speed={2}
      rotationIntensity={0.2}
      floatIntensity={0.5}
    >
      <group
        ref={groupRef}
        onClick={handleClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'default'}
      >
        {/* Body */}
        <mesh ref={bodyRef} position={[0, 0, 0]}>
          <capsuleGeometry args={[0.3, 0.5, 8, 16]} />
          <MeshDistortMaterial
            color={bodyColor}
            speed={2}
            distort={0.1}
            radius={1}
          />
        </mesh>

        {/* Head */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>

        {/* Eyes */}
        <mesh ref={eyeLeftRef} position={[-0.15, 0.55, 0.2]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
          {/* Pupil */}
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </mesh>

        <mesh ref={eyeRightRef} position={[0.15, 0.55, 0.2]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </mesh>

        {/* Antennae */}
        <group ref={antennaLeftRef} position={[-0.1, 0.7, 0]}>
          <mesh rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.02, 0.01, 0.3, 8]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
          <mesh position={[-0.1, 0.15, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.5} />
          </mesh>
        </group>

        <group ref={antennaRightRef} position={[0.1, 0.7, 0]}>
          <mesh rotation={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.02, 0.01, 0.3, 8]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
          <mesh position={[0.1, 0.15, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.5} />
          </mesh>
        </group>

        {/* Left Claw */}
        <group ref={leftClawRef} position={[-0.4, 0.1, 0]} rotation={[0, 0, 0.3]}>
          <mesh>
            <boxGeometry args={[0.15, 0.25, 0.1]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
          {/* Claw pincers */}
          <mesh position={[0.05, 0.15, 0]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.06, 0.12, 0.05]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
          <mesh position={[-0.05, 0.15, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.06, 0.12, 0.05]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        </group>

        {/* Right Claw */}
        <group ref={rightClawRef} position={[0.4, 0.1, 0]} rotation={[0, 0, -0.3]}>
          <mesh>
            <boxGeometry args={[0.15, 0.25, 0.1]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
          <mesh position={[-0.05, 0.15, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.06, 0.12, 0.05]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
          <mesh position={[0.05, 0.15, 0]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.06, 0.12, 0.05]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        </group>

        {/* Tail segments */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, -0.4 - i * 0.12, -0.1 - i * 0.05]} scale={[1 - i * 0.15, 1, 1]}>
            <capsuleGeometry args={[0.12 - i * 0.02, 0.05, 4, 8]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        ))}

        {/* Legs (simplified) */}
        {[-1, 1].map((side) =>
          [0, 1, 2].map((i) => (
            <mesh
              key={`${side}-${i}`}
              position={[side * 0.25, -0.1 - i * 0.15, 0]}
              rotation={[0, 0, side * 0.5]}
            >
              <cylinderGeometry args={[0.02, 0.015, 0.2, 6]} />
              <meshStandardMaterial color={bodyColor} />
            </mesh>
          ))
        )}
      </group>
    </Float>
  );
}

/**
 * Glass Tank Container
 */
function GlassTank({ theme }) {
  return (
    <group>
      {/* Tank walls (transparent glass) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <MeshTransmissionMaterial
          backside
          thickness={0.2}
          roughness={0.05}
          transmission={0.95}
          ior={1.5}
          chromaticAberration={0.02}
          clearcoat={1}
          clearcoatRoughness={0.1}
          color={theme.water}
        />
      </mesh>

      {/* Gravel floor */}
      <mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.8, 3.8]} />
        <meshStandardMaterial color={theme.gravel} roughness={0.9} />
      </mesh>

      {/* Decorative rocks */}
      {[
        [-1, -1.6, 0.5],
        [0.8, -1.65, -0.3],
        [-0.5, -1.7, -0.8],
        [1.2, -1.55, 0.8]
      ].map((pos, i) => (
        <mesh key={i} position={pos} rotation={[Math.random(), Math.random(), 0]}>
          <dodecahedronGeometry args={[0.15 + Math.random() * 0.1, 0]} />
          <meshStandardMaterial color={theme.gravel} roughness={0.8} />
        </mesh>
      ))}

      {/* Simple plant decorations */}
      {[-1.2, 1.0].map((x, i) => (
        <group key={i} position={[x, -1.5, i % 2 ? 0.5 : -0.5]}>
          {[0, 0.15, 0.3].map((h, j) => (
            <mesh key={j} position={[j * 0.05, h, 0]} rotation={[0, 0, Math.sin(j) * 0.2]}>
              <capsuleGeometry args={[0.02, 0.2, 4, 8]} />
              <meshStandardMaterial
                color={theme.plant}
                emissive={theme.plant}
                emissiveIntensity={0.1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Underwater Caustics Effect
 */
function Caustics({ intensity }) {
  const lightRef = useRef();

  useFrame((state) => {
    if (lightRef.current) {
      const time = state.clock.elapsedTime;
      lightRef.current.position.x = Math.sin(time * 0.5) * 2;
      lightRef.current.position.z = Math.cos(time * 0.3) * 2;
      lightRef.current.intensity = 1 + Math.sin(time * 2) * intensity;
    }
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 3, 0]}
      intensity={1}
      color="#4a9eff"
      distance={10}
      decay={2}
    />
  );
}

/**
 * Main 3D Scene
 */
function TankScene({ clawd, onClawdInteract }) {
  const theme = TANK_THEMES[clawd?.tankSkin] || TANK_THEMES.default;

  return (
    <>
      <color attach="background" args={[theme.waterDeep]} />
      <fog attach="fog" args={[theme.water, 3, 10]} />

      <ambientLight intensity={0.4} color={theme.ambientLight} />
      <Caustics intensity={theme.causticIntensity} />

      <Sparkles
        count={30}
        scale={4}
        size={2}
        speed={0.3}
        color={theme.bubbleColor}
        opacity={0.3}
      />

      <GlassTank theme={theme} />
      <Bubbles count={40} theme={theme} />

      <ClawdCharacter
        mood={clawd?.mood || 'vibing'}
        onInteract={onClawdInteract}
      />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.5}
        autoRotate
        autoRotateSpeed={0.5}
      />

      <Environment preset="night" />
    </>
  );
}

// ═══════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════

/**
 * Glassmorphism Chat Interface
 */
function ChatInterface({ clawd, orderNumber, onMessageSent }) {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Fetch chat history
    fetch(`${API_BASE}/api/v1/clawds/${orderNumber}/history`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          setHistory(data.messages.slice(-10)); // Last 10 messages
        }
      })
      .catch(() => {});
  }, [orderNumber]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMsg = message.trim();
    setMessage('');
    setLoading(true);

    // Optimistic update
    setHistory(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const res = await fetch(`${API_BASE}/api/v1/clawds/${orderNumber}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });

      const data = await res.json();

      if (data.message) {
        setHistory(prev => [...prev, {
          role: 'clawd',
          content: data.message,
          mood: data.mood
        }]);
        onMessageSent?.(data);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.chatHeader}>
        <span style={styles.chatTitle}>{clawd?.name || 'Clawd'}</span>
        <span style={styles.moodBadge}>{clawd?.mood || 'vibing'}</span>
      </div>

      <div style={styles.chatMessages}>
        {history.length === 0 && (
          <div style={styles.emptyChat}>
            Say hi to your clawd!
          </div>
        )}
        {history.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMessage : styles.clawdMessage)
            }}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.message, ...styles.clawdMessage, opacity: 0.6 }}>
            <span style={styles.typingIndicator}>...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={styles.chatInputContainer}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Say something..."
          style={styles.chatInput}
          maxLength={500}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !message.trim()}
          style={styles.sendButton}
        >
          Send
        </button>
      </div>
    </div>
  );
}

/**
 * Clawd Info Card
 */
function InfoCard({ clawd }) {
  const orderDate = clawd?.product?.orderedAt
    ? new Date(clawd.product.orderedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      })
    : 'Unknown';

  return (
    <div style={styles.infoCard}>
      <h2 style={styles.clawdName}>{clawd?.name || 'Clawd'} #{clawd?.orderNumber?.slice(-6)}</h2>
      <p style={styles.infoText}>Born: {orderDate}</p>
      <p style={styles.infoText}>Product: {clawd?.product?.name || 'Unknown'}</p>
      <p style={styles.infoText}>Mood: {clawd?.mood || 'vibing'}</p>
      <p style={styles.infoText}>Conversations: {clawd?.conversationCount || 0}</p>
      {clawd?.lastMessage && (
        <p style={styles.lastMessage}>"{clawd.lastMessage.substring(0, 50)}..."</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN TANK PAGE
// ═══════════════════════════════════════════════════

export default function Tank({ orderNumber: propOrderNumber }) {
  // Get order number from URL or prop
  const orderNumber = propOrderNumber || window.location.pathname.split('/tank/')[1];

  const [clawd, setClawd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderNumber) {
      setError('No order number provided');
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/v1/clawds/${orderNumber}`)
      .then(res => {
        if (!res.ok) throw new Error('Clawd not found');
        return res.json();
      })
      .then(data => {
        setClawd(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [orderNumber]);

  const handleClawdInteract = () => {
    // Clawd was clicked - could trigger special animation or sound
    // Clawd interaction registered
  };

  const handleMessageSent = (data) => {
    // Update mood if changed
    if (data.moodChanged && data.mood) {
      setClawd(prev => prev ? { ...prev, mood: data.mood } : prev);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Loading your clawd...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h1 style={styles.errorTitle}>Clawd Not Found</h1>
        <p style={styles.errorText}>{error}</p>
        <a href="/" style={styles.homeLink}>Back to ClawDrip</a>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 3D Tank Canvas */}
      <div style={styles.canvasContainer}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
          <Suspense fallback={null}>
            <TankScene clawd={clawd} onClawdInteract={handleClawdInteract} />
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div style={styles.uiOverlay}>
        {/* Header */}
        <div style={styles.header}>
          <a href="/" style={styles.logo}>ClawDrip</a>
          <span style={styles.tankId}>Tank #{orderNumber}</span>
        </div>

        {/* Info Card */}
        <InfoCard clawd={clawd} />

        {/* Chat Interface */}
        <ChatInterface
          clawd={clawd}
          orderNumber={orderNumber}
          onMessageSent={handleMessageSent}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#030303',
    fontFamily: "'Outfit', sans-serif"
  },
  canvasContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  },
  uiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    pointerEvents: 'auto'
  },
  logo: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#FF3B30',
    textDecoration: 'none',
    fontFamily: "'Syne', sans-serif"
  },
  tankId: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'JetBrains Mono', monospace"
  },
  infoCard: {
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '20px',
    maxWidth: '280px',
    border: '1px solid rgba(255,255,255,0.1)',
    pointerEvents: 'auto',
    marginBottom: 'auto'
  },
  clawdName: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 12px 0',
    fontFamily: "'Syne', sans-serif"
  },
  infoText: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    margin: '4px 0'
  },
  lastMessage: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    marginTop: '12px'
  },
  chatContainer: {
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '16px',
    maxWidth: '400px',
    width: '100%',
    alignSelf: 'flex-end',
    border: '1px solid rgba(255,255,255,0.1)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '50vh'
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  chatTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff'
  },
  moodBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    background: 'rgba(255,59,48,0.2)',
    color: '#FF3B30',
    borderRadius: '12px'
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: '100px',
    maxHeight: '200px'
  },
  emptyChat: {
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    padding: '20px',
    fontSize: '14px'
  },
  message: {
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    maxWidth: '80%',
    wordBreak: 'break-word'
  },
  userMessage: {
    background: 'rgba(255,59,48,0.2)',
    color: '#fff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: '4px'
  },
  clawdMessage: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: '4px'
  },
  typingIndicator: {
    animation: 'pulse 1s infinite'
  },
  chatInputContainer: {
    display: 'flex',
    gap: '8px'
  },
  chatInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  },
  sendButton: {
    background: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  loadingContainer: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#030303'
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '18px',
    fontFamily: "'Outfit', sans-serif"
  },
  errorContainer: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#030303',
    padding: '20px'
  },
  errorTitle: {
    color: '#FF3B30',
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '12px',
    fontFamily: "'Syne', sans-serif"
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '16px',
    marginBottom: '24px'
  },
  homeLink: {
    color: '#FF3B30',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600'
  }
};
