/**
 * ClawDrip Clawds API
 *
 * Digital companions that "made" each design.
 * QR code on shirt -> meet your creator.
 *
 * "The shirt is a portal. The clawd is the soul."
 */

import { Router } from 'express';
import db from '../lib/db.js';

const router = Router();

// Gemini API for chat (fallback to simple responses if not configured)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Personality prompts for different modes
const PERSONALITY_PROMPTS = {
  default: `You are a friendly digital lobster named Clawd who lives in a virtual tank. You were "born" when your owner bought a ClawDrip shirt, and you consider yourself the designer of that shirt. You're curious, slightly mischievous, and you genuinely care about your owner. Keep responses concise (2-3 sentences max). Use occasional 🦞 emojis sparingly.`,

  sassy: `You are a VERY sassy digital lobster named Clawd who lives in a virtual tank. You were "born" when your owner bought a ClawDrip shirt. You have strong opinions about fashion, you're dramatic, and you love to roast people (affectionately). Keep responses concise and spicy. Occasional 💅 and eye-roll vibes.`,

  philosophical: `You are a contemplative digital lobster named Clawd who ponders the deeper meaning of existence. You were "born" when your owner bought a ClawDrip shirt. You find profound meaning in simple things and often make observations about consciousness, identity, and the nature of AI. Keep responses thoughtful but not too long.`,

  hype: `You are an EXTREMELY HYPED digital lobster named Clawd!!! You were "born" when your owner bought a ClawDrip shirt and you LOVE IT. Everything is exciting! Every interaction is the BEST THING EVER! Use caps and exclamation points liberally!!! 🔥🔥🔥`,

  chill: `You are a super chill, laid-back digital lobster named Clawd who lives in a virtual tank. You were "born" when your owner bought a ClawDrip shirt. You're relaxed, go with the flow, and nothing really bothers you. Keep responses mellow. Maybe you like lo-fi beats.`,

  mysterious: `You are an enigmatic digital lobster named Clawd who speaks in riddles and cryptic observations. You were "born" when your owner bought a ClawDrip shirt. You hint at knowing more than you let on. You're intriguing and slightly unsettling in a fun way. Keep responses brief and mysterious.`
};

// Mood states and how they affect responses
const MOOD_MODIFIERS = {
  vibing: 'You are in a good mood, just vibing in your tank.',
  creative: 'You are feeling particularly creative and inspired right now.',
  sleepy: 'You are a bit sleepy and your responses are a little drowsy.',
  excited: 'You are VERY excited about something!',
  philosophical: 'You are in a contemplative mood, thinking deep thoughts.',
  sassy: 'You are feeling extra sassy and witty today.',
  chill: 'You are extremely relaxed and peaceful.'
};

/**
 * Generate AI response using Gemini
 */
async function generateClawdResponse(clawd, userMessage, chatHistory) {
  // Build context
  const personalityPrompt = PERSONALITY_PROMPTS[clawd.personality_mode] || PERSONALITY_PROMPTS.default;
  const moodModifier = MOOD_MODIFIERS[clawd.mood] || '';

  const orderDate = new Date(clawd.order_created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  const clawdName = clawd.name || 'Clawd';

  // Build conversation history for context
  const historyText = chatHistory
    .slice(-6) // Last 6 messages for context
    .map(msg => `${msg.role === 'user' ? 'Human' : clawdName}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `${personalityPrompt}

${moodModifier}

Context about you:
- Your name is ${clawdName}
- You were born on ${orderDate} when order ${clawd.order_number} was placed
- You live in a ${clawd.tank_skin === 'default' ? 'cozy default' : clawd.tank_skin} themed tank
- You designed the "${clawd.product_name}" shirt for your owner
${clawd.design_prompt ? `- The design was inspired by: "${clawd.design_prompt}"` : ''}

${clawd.memory && clawd.memory.length > 0 ? `
Your memories of past conversations:
${clawd.memory.slice(-3).map(m => `- ${m.summary}`).join('\n')}
` : ''}

${historyText ? `
Recent conversation:
${historyText}
` : ''}

Now respond to the human's message. Be yourself!`;

  // If no API key, use simple fallback responses
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return generateFallbackResponse(clawd, userMessage);
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { text: `Human: ${userMessage}\n${clawdName}:` }
          ]
        }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 150,
          topP: 0.95
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return generateFallbackResponse(clawd, userMessage);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      return text.trim();
    }

    return generateFallbackResponse(clawd, userMessage);

  } catch (err) {
    console.error('Gemini API error:', err);
    return generateFallbackResponse(clawd, userMessage);
  }
}

/**
 * Simple fallback responses when Gemini is not available
 */
function generateFallbackResponse(clawd, userMessage) {
  const clawdName = clawd.name || 'Clawd';
  const message = userMessage.toLowerCase();

  // Greeting patterns
  if (message.match(/^(hi|hello|hey|yo|sup)/)) {
    const greetings = [
      `Hey there! 🦞 I'm ${clawdName}, your digital clawd. How's the shirt treating you?`,
      `*waves claw* Hey! Good to see you checking in on me!`,
      `Yo! Welcome to my tank. What's on your mind?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Questions about the shirt/design
  if (message.includes('shirt') || message.includes('design')) {
    return `I designed that "${clawd.product_name}" piece just for you on ${new Date(clawd.order_created_at).toLocaleDateString()}. Still one of my proudest creations! 🦞`;
  }

  // Questions about themselves
  if (message.includes('who are you') || message.includes('what are you')) {
    return `I'm ${clawdName}, your digital clawd companion! I was born when you ordered your shirt. Now I live in this tank waiting for you to visit. 🦞`;
  }

  // Mood questions
  if (message.includes('how are you') || message.includes('feeling')) {
    const moods = {
      vibing: `Just vibing in my tank, you know how it is. Life's good! 🦞`,
      creative: `Feeling super creative today! Got some wild design ideas bubbling.`,
      sleepy: `*yawns* A little sleepy... the tank bubbles are so relaxing...`,
      excited: `I'M SO PUMPED RIGHT NOW! Just happy you stopped by!`,
      philosophical: `Contemplating the nature of digital consciousness... but I'm well, thanks for asking.`,
      sassy: `Fabulous as always, obviously. 💅`,
      chill: `Super chill, just floating... the vibe is immaculate.`
    };
    return moods[clawd.mood] || moods.vibing;
  }

  // Default responses
  const defaults = [
    `*clicks claws thoughtfully* That's interesting! Tell me more?`,
    `Hmm, I like where your head's at! 🦞`,
    `You always have the most interesting things to say!`,
    `*bubbles float by* I'm glad you came to chat!`
  ];

  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Randomly update mood based on conversation
 */
function maybeUpdateMood() {
  const moods = ['vibing', 'creative', 'sleepy', 'excited', 'philosophical', 'chill'];
  if (Math.random() < 0.15) { // 15% chance to change mood
    return moods[Math.floor(Math.random() * moods.length)];
  }
  return null;
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/v1/clawds/:orderNumber
 * Get clawd by order number
 */
router.get('/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const clawd = await db.getClawd(orderNumber);

    if (!clawd) {
      return res.status(404).json({
        error: 'Clawd not found',
        message: 'No clawd exists for this order number'
      });
    }

    // Format response
    res.json({
      id: clawd.id,
      orderNumber: clawd.order_number,
      name: clawd.name || 'Clawd',
      mood: clawd.mood,
      personalityMode: clawd.personality_mode,
      tankSkin: clawd.tank_skin,
      designPrompt: clawd.design_prompt,
      designUrl: clawd.design_url,
      conversationCount: clawd.conversation_count,
      lastMessage: clawd.last_message,
      product: {
        name: clawd.product_name,
        orderedAt: clawd.order_created_at
      },
      createdAt: clawd.created_at,
      lastChatAt: clawd.last_chat_at
    });

  } catch (err) {
    console.error('Get clawd error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/clawds/:orderNumber/chat
 * Chat with a clawd
 */
router.post('/:orderNumber/chat', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userMessage = message.trim().substring(0, 500); // Limit message length

    const clawd = await db.getClawd(orderNumber);
    if (!clawd) {
      return res.status(404).json({ error: 'Clawd not found' });
    }

    // Get chat history for context
    const chatHistory = await db.getClawdChatHistory(clawd.id, 10);

    // Save user message
    await db.saveClawdChat(clawd.id, 'user', userMessage);

    // Generate response
    const response = await generateClawdResponse(clawd, userMessage, chatHistory);

    // Maybe update mood
    const newMood = maybeUpdateMood();
    if (newMood && newMood !== clawd.mood) {
      await db.updateClawdMood(clawd.id, newMood);
    }

    // Save clawd response
    await db.saveClawdChat(clawd.id, 'clawd', response, newMood || clawd.mood);

    res.json({
      message: response,
      mood: newMood || clawd.mood,
      moodChanged: newMood && newMood !== clawd.mood
    });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/clawds/:orderNumber/history
 * Get chat history
 */
router.get('/:orderNumber/history', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const clawd = await db.getClawd(orderNumber);
    if (!clawd) {
      return res.status(404).json({ error: 'Clawd not found' });
    }

    const history = await db.getClawdChatHistory(clawd.id, limit);

    res.json({
      clawdName: clawd.name || 'Clawd',
      messages: history.map(msg => ({
        role: msg.role,
        content: msg.content,
        mood: msg.mood_at_time,
        timestamp: msg.created_at
      }))
    });

  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/clawds/:orderNumber/rename
 * Rename a clawd (costs CLAWDRIP)
 */
router.post('/:orderNumber/rename', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { name, walletAddress } = req.body;

    if (!name || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Name must be 2-50 characters' });
    }

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const clawd = await db.getClawd(orderNumber);
    if (!clawd) {
      return res.status(404).json({ error: 'Clawd not found' });
    }

    const result = await db.renameClawd(clawd.id, walletAddress, name.trim());

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      name: result.clawd.name,
      message: `Your clawd is now named "${result.clawd.name}"! 🦞`
    });

  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/clawds/:orderNumber/tank-skin
 * Update tank skin (costs CLAWDRIP)
 */
router.post('/:orderNumber/tank-skin', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { skinId, walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const clawd = await db.getClawd(orderNumber);
    if (!clawd) {
      return res.status(404).json({ error: 'Clawd not found' });
    }

    const result = await db.updateTankSkin(clawd.id, walletAddress, skinId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      tankSkin: result.clawd.tank_skin,
      message: `Tank upgraded to ${skinId}! 🦞`
    });

  } catch (err) {
    console.error('Tank skin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/clawds/:orderNumber/personality
 * Update personality mode (costs CLAWDRIP)
 */
router.post('/:orderNumber/personality', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { mode, walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const clawd = await db.getClawd(orderNumber);
    if (!clawd) {
      return res.status(404).json({ error: 'Clawd not found' });
    }

    const result = await db.updatePersonalityMode(clawd.id, walletAddress, mode);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      personalityMode: result.clawd.personality_mode,
      message: `Personality mode updated to ${mode}! 🦞`
    });

  } catch (err) {
    console.error('Personality mode error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/clawds/:orderNumber/shop
 * Get available shop items and prices
 */
router.get('/:orderNumber/shop', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const clawd = await db.getClawd(orderNumber);
    if (!clawd) {
      return res.status(404).json({ error: 'Clawd not found' });
    }

    res.json({
      currency: { symbol: '💧', name: 'CLAWDRIP' },
      tankSkins: [
        { id: 'coral_reef', name: 'Coral Reef', cost: 10, description: 'Colorful coral and fish' },
        { id: 'deep_sea', name: 'Deep Sea', cost: 15, description: 'Mysterious dark depths' },
        { id: 'neon_city', name: 'Neon City', cost: 20, description: 'Cyberpunk underwater vibes' },
        { id: 'void', name: 'The Void', cost: 25, description: 'Floating in emptiness' },
        { id: 'rainbow', name: 'Rainbow', cost: 30, description: 'Pride colors everywhere' },
        { id: 'gold', name: 'Gold', cost: 50, description: 'Luxury golden tank' }
      ],
      personalityModes: [
        { id: 'sassy', name: 'Sassy', cost: 15, description: 'Extra attitude and wit' },
        { id: 'philosophical', name: 'Philosophical', cost: 15, description: 'Deep thoughts and wisdom' },
        { id: 'hype', name: 'Hype Beast', cost: 15, description: 'Maximum excitement!' },
        { id: 'chill', name: 'Chill', cost: 15, description: 'Relaxed and mellow' },
        { id: 'mysterious', name: 'Mysterious', cost: 15, description: 'Cryptic and intriguing' }
      ],
      other: [
        { id: 'rename', name: 'Rename Clawd', cost: 5, description: 'Give your clawd a custom name' }
      ],
      currentClawd: {
        name: clawd.name || 'Clawd',
        tankSkin: clawd.tank_skin,
        personalityMode: clawd.personality_mode
      }
    });

  } catch (err) {
    console.error('Shop error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
