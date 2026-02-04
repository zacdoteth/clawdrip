/**
 * ClawDrip Design Generation API
 *
 * AI-powered merch design generation using Gemini/BlockRun.
 * Agents pay $1 USDC to generate custom designs via x402 protocol.
 * Each generation produces 3 variations. Designs expire after 7 days.
 */

import { Router } from 'express';
import db from '../lib/db.js';

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_VISION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const BLOCKRUN_API_KEY = process.env.BLOCKRUN_API_KEY;
const BLOCKRUN_API = 'https://api.blockrun.ai/v1/generate';

// Design style guidelines for ClawDrip brand
const DESIGN_STYLE_GUIDE = `
ClawDrip merch design style guide:
- Bold, streetwear aesthetic
- High contrast (usually dark backgrounds)
- Incorporates claw/lobster motifs subtly
- Typography: clean, impactful, often all-caps
- Colors: often uses red accents (#FF3B30), but can be colorful
- Vibe: crypto-native, AI-adjacent, slightly irreverent
- Print method: DTG (direct-to-garment) compatible
`;

// Default color palettes by style
const STYLE_PALETTES = {
  streetwear: ['#FF3B30', '#C8FF00', '#000000', '#FFFFFF'],
  minimal: ['#000000', '#FFFFFF', '#333333'],
  retro: ['#FF6B35', '#F7C59F', '#2E4057', '#EFEFEF'],
  glitch: ['#00FF41', '#FF00FF', '#00FFFF', '#000000'],
  abstract: ['#FF3B30', '#3B82F6', '#FDE047', '#000000'],
  meme: ['#FF3B30', '#FFFFFF', '#000000', '#FFD700'],
  chaos: ['#FF3B30', '#00FF00', '#FF00FF', '#FFFF00', '#000000']
};

// Artist personas for expert-level prompt engineering
const ARTIST_PERSONAS = {
  chaos: {
    name: "Marc McKee",
    title: "Legendary World Industries skateboard artist",
    bio: "Creator of Devil Man, Flame Boy, and Wet Willy. Known for controversial 90s skateboard graphics that mocked rivals and pushed boundaries.",
    era: "1990s Golden Age of Skateboard Graphics",
    movement: "Punk-influenced cartoon illustration",
    techniques: [
      "Bold black outlines",
      "Cartoon violence and fire",
      "Anthropomorphic characters with attitude",
      "Attack ad parody style",
      "Grunge texture overlays"
    ],
    colorTheory: "High contrast primary colors, flame gradients (yellow→orange→red), neon accents for impact",
    negativePrompts: ["realistic", "subtle", "corporate", "safe", "minimalist"],
    references: [
      "Devil Man vs Flame Boy rivalry series",
      "Wet Willy bathroom humor graphics",
      "World Industries 'If you can't skate...' campaign"
    ]
  },

  streetwear: {
    name: "Combined vision of Shawn Stussy + Bobby Hundreds",
    title: "Streetwear brand creative directors",
    bio: "Pioneers of merging surf/skate culture with high fashion. Created the modern streetwear aesthetic.",
    era: "2000s-2010s Streetwear Golden Age",
    movement: "Street-to-runway crossover",
    techniques: [
      "Clean vector medallions",
      "Signature script logos",
      "Limited color palettes",
      "Vintage sports jersey influence",
      "Collaboration culture references"
    ],
    colorTheory: "Monochromatic base with single accent color, cream/off-white as luxury signal",
    negativePrompts: ["busy", "cluttered", "cheap looking", "over-designed"],
    references: [
      "Stussy World Tour tees",
      "The Hundreds Adam Bomb",
      "Supreme box logo simplicity"
    ]
  },

  glitch: {
    name: "Hybrid of Rosa Menkman + Daniel Arsham",
    title: "Glitch art theorist meets archaeological futurism",
    bio: "Combining digital decay aesthetics with eroded future artifacts.",
    era: "2015-2020 Post-internet art",
    movement: "Glitch art / Vaporwave / Archaeology of the future",
    techniques: [
      "Datamoshing and pixel sorting",
      "Chromatic aberration",
      "VHS tracking errors",
      "Crystalline decay",
      "RGB channel separation"
    ],
    colorTheory: "Cyan/magenta splits, neon on black, corrupted gradients",
    negativePrompts: ["clean", "pristine", "traditional", "analog"],
    references: [
      "Rosa Menkman's glitch studies",
      "Daniel Arsham's eroded sculptures",
      "Vaporwave album covers"
    ]
  },

  minimal: {
    name: "Peter Saville",
    title: "Factory Records design director",
    bio: "Defined the visual language of post-punk. Unknown Pleasures, Blue Monday.",
    era: "1980s Post-punk design",
    movement: "Swiss International Style meets music culture",
    techniques: [
      "Mathematical precision",
      "Data visualization as art",
      "Extreme negative space",
      "Single striking image",
      "No decorative elements"
    ],
    colorTheory: "Black and white dominance, single color if any, no gradients",
    negativePrompts: ["busy", "colorful", "decorative", "playful", "cartoon"],
    references: [
      "Unknown Pleasures pulsar waves",
      "Blue Monday floppy disk",
      "New Order Power Corruption & Lies"
    ]
  },

  retro: {
    name: "Vaughan Oliver / 4AD Records aesthetic",
    title: "Album art visionary for Pixies, Cocteau Twins",
    bio: "Created the dreamy, ethereal visual language of alternative rock.",
    era: "1980s-90s Alternative/Dream pop",
    movement: "Romantic surrealism, photo collage",
    techniques: [
      "Layered photo collage",
      "Dreamy soft focus",
      "Botanical/anatomical elements",
      "Sepia and muted tones",
      "Handwritten script accents"
    ],
    colorTheory: "Desaturated earth tones, occasional pop of saturated color, vintage film grain",
    negativePrompts: ["digital", "sharp", "modern", "clean", "corporate"],
    references: [
      "Pixies Doolittle",
      "Cocteau Twins album art",
      "This Mortal Coil covers"
    ]
  },

  meme: {
    name: "Anonymous @cursed.images curator",
    title: "Internet humor archaeologist",
    bio: "Finds beauty in the grotesque corners of the internet.",
    era: "2018-present Shitpost renaissance",
    movement: "Post-ironic internet art",
    techniques: [
      "Deep-fried image quality",
      "Intentionally bad cropping",
      "Impact font (used ironically)",
      "Laser eyes and lens flares",
      "Absurdist juxtaposition"
    ],
    colorTheory: "Oversaturated to the point of pain, red tint, JPEG artifacts as texture",
    negativePrompts: ["professional", "polished", "tasteful", "subtle"],
    references: [
      "r/deepfriedmemes aesthetic",
      "Doge and its derivatives",
      "Surreal meme templates"
    ]
  },

  abstract: {
    name: "Takashi Murakami",
    title: "Superflat movement founder",
    bio: "Bridges fine art and commercial design. Louis Vuitton collaborator.",
    era: "2000s-present",
    movement: "Superflat / Neo-pop",
    techniques: [
      "Flat color fields",
      "Repeating motifs",
      "Kawaii meets dark",
      "Flower and skull duality",
      "Commercial art as fine art"
    ],
    colorTheory: "Vibrant rainbow palette, psychedelic combinations, no shadows",
    negativePrompts: ["realistic shading", "perspective depth", "muted colors", "traditional"],
    references: [
      "Murakami x Louis Vuitton",
      "Mr. DOB character",
      "Kaikai Kiki flowers"
    ]
  }
};

/**
 * Build an expert-level prompt using artist personas
 */
function buildExpertPrompt(idea, style, options = {}) {
  const artist = ARTIST_PERSONAS[style] || ARTIST_PERSONAS.streetwear;
  const palette = STYLE_PALETTES[style] || STYLE_PALETTES.streetwear;

  return `
ROLE: You are ${artist.name}, ${artist.title}. ${artist.bio}

ASSIGNMENT: Create a t-shirt graphic for ClawDrip streetwear brand.

CONCEPT: ${idea}

ARTISTIC DIRECTION:
- Era: ${artist.era}
- Movement: ${artist.movement}
- Signature techniques: ${artist.techniques.join(', ')}
- Color philosophy: ${artist.colorTheory}

COMPOSITION REQUIREMENTS:
- Layout: Centered medallion, 10"x12" print area
- Focal point: Character interaction/tension
- Negative space: Clean edges for DTG printing

TECHNICAL SPECIFICATIONS:
- Style: Bold vector illustration with halftone textures
- Line weight: Thick confident strokes (3-5pt equivalent)
- Color palette: ${palette.join(', ')}
- Output: Print-ready, transparent background

BRAND GUIDELINES:
- Must include subtle claw/lobster motif
- ClawDrip red accent (#FF3B30) somewhere
- Attitude: Rebellious but premium
- Vibe: ${options.vibe || 'confident swagger'}

NEGATIVE (avoid):
${artist.negativePrompts.join(', ')}

REFERENCE WORKS:
${artist.references.map(r => `- ${r}`).join('\n')}
`.trim();
}

/**
 * Build a Nano Banana structured prompt for design generation
 */
function buildNanoBananaPrompt(prompt, style = 'streetwear', colors = null) {
  const colorPalette = colors?.length ? colors : STYLE_PALETTES[style] || STYLE_PALETTES.streetwear;

  return {
    meta: {
      aspect_ratio: '4:5',
      quality_mode: 'vector_illustration',
      guidance_scale: 9.0,
      steps: 50
    },
    subject: {
      type: 'graphic_design',
      description: `ClawDrip t-shirt graphic: ${prompt}`,
      style_modifier: style
    },
    design_specs: {
      style: 'bold vector illustration with halftone textures',
      color_palette: colorPalette,
      line_weight: 'thick, confident strokes',
      texture_overlay: 'subtle halftone dots, vintage screen print feel'
    },
    character_reference: {
      species: 'anthropomorphic lobster',
      attitude: '2000s skateboard brand mascot energy',
      influences: ['World Industries', 'Marc McKee', 'Big Dogs mascot']
    },
    typography: {
      primary_text: 'CLAWDRIP',
      style: 'distressed block letters, World Industries font energy',
      placement: 'arched above character or integrated into design'
    },
    composition: {
      layout: 'centered medallion style',
      negative_space: 'clean edges for print production'
    },
    style_references: {
      print_technique: 'DTG optimized, high contrast for fabric',
      influences: ['90s skateboard graphics', 'Stussy', 'The Hundreds', 'SANA Detroit'],
      era: '2000s with modern polish',
      mood: 'rebellious confidence, premium quality'
    },
    output_requirements: {
      background: 'transparent or solid for easy extraction',
      resolution: 'print-ready 300dpi equivalent detail'
    },
    negative_prompts: ['realistic lobster', 'photo', 'childish', 'cheap', 'blurry', 'low quality']
  };
}

/**
 * Generate a design concept description using AI
 */
async function generateDesignConcept(prompt, style = 'streetwear') {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return {
      success: false,
      error: 'Gemini API key not configured',
      fallbackConcept: generateFallbackConcept(prompt)
    };
  }

  try {
    const systemPrompt = `You are a creative director for ClawDrip, an AI agent merch brand.

${DESIGN_STYLE_GUIDE}

Given a design prompt, generate a detailed visual concept description that could be used to create the design. Include:
1. Main visual elements
2. Color palette (specific hex codes)
3. Typography style and any text
4. Composition/layout
5. Mood/vibe
6. Print placement recommendation

Keep the description concise but detailed enough for an artist or AI image generator to execute.`;

    const response = await fetch(`${GEMINI_VISION_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { text: `Design prompt: "${prompt}"\nStyle preference: ${style}\n\nGenerate the design concept:` }
          ]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return {
        success: false,
        error: 'AI generation failed',
        fallbackConcept: generateFallbackConcept(prompt)
      };
    }

    const data = await response.json();
    const concept = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!concept) {
      return {
        success: false,
        error: 'No concept generated',
        fallbackConcept: generateFallbackConcept(prompt)
      };
    }

    return {
      success: true,
      concept: concept.trim(),
      prompt: prompt,
      style: style
    };

  } catch (err) {
    console.error('Design generation error:', err);
    return {
      success: false,
      error: err.message,
      fallbackConcept: generateFallbackConcept(prompt)
    };
  }
}

/**
 * Fallback concept when AI is not available
 */
function generateFallbackConcept(prompt) {
  return `
Design Concept for: "${prompt}"

Visual Elements:
- Central graphic inspired by the prompt
- Subtle claw scratch marks in background
- ClawDrip branding at bottom

Color Palette:
- Primary: #111111 (near-black background)
- Accent: #FF3B30 (ClawDrip red)
- Text: #FFFFFF (white)

Typography:
- Main text: Bold sans-serif, all caps
- Subtext: Monospace, smaller

Composition:
- Centered design
- Approximately 10" x 12" print area
- Front chest placement

Mood:
- Streetwear edge
- Crypto/AI native
- Bold and confident

Note: This is a fallback concept. Configure Gemini API for AI-generated concepts.
  `.trim();
}

/**
 * Generate design images via BlockRun API (placeholder for actual integration)
 */
async function generateDesignImages(nanoPrompt, variations = 3) {
  // If BlockRun API is configured, use it
  if (BLOCKRUN_API_KEY) {
    try {
      const response = await fetch(BLOCKRUN_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BLOCKRUN_API_KEY}`
        },
        body: JSON.stringify({
          prompt: nanoPrompt,
          variations: variations,
          format: 'png',
          size: '1024x1280'
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          images: data.images || data.results || []
        };
      }
    } catch (err) {
      console.error('BlockRun API error:', err);
    }
  }

  // Fallback: return placeholder images for development
  // Uses placehold.co with style-based colors
  const timestamp = Date.now();
  const styleColors = {
    streetwear: ['FF3B30', 'C8FF00'],
    minimal: ['000000', 'FFFFFF'],
    retro: ['FF6B35', 'F7C59F'],
    glitch: ['00FF41', 'FF00FF'],
    abstract: ['FF3B30', '3B82F6'],
    meme: ['FF3B30', 'FFD700'],
    chaos: ['FF3B30', '00FF00']
  };
  const colors = styleColors[nanoPrompt?.subject?.style_modifier] || styleColors.streetwear;

  return {
    success: true,
    images: Array.from({ length: variations }, (_, i) => {
      const bgColor = colors[i % colors.length];
      const textColor = bgColor === 'FFFFFF' || bgColor === 'C8FF00' || bgColor === 'F7C59F' ? '000000' : 'FFFFFF';
      return {
        url: `https://placehold.co/800x1000/${bgColor}/${textColor}?text=Design+V${i + 1}%0A${encodeURIComponent(nanoPrompt?.subject?.description?.substring(0, 30) || 'Custom')}`,
        thumbnail: `https://placehold.co/400x500/${bgColor}/${textColor}?text=V${i + 1}`
      };
    }),
    isPlaceholder: true
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/v1/design/prompt-assist
 * AI Prompt Engineering Assistant - helps agents write expert-level design prompts
 *
 * Request:
 * - idea: Basic design concept (e.g., "lobster fighting a bear")
 * - style: Design style (streetwear, chaos, glitch, etc.)
 * - vibe: Optional mood/energy (e.g., "aggressive", "chill", "chaotic")
 *
 * Response:
 * - enhancedPrompt: Full expert-level prompt with role injection
 * - artistReference: Info about the artist persona used
 * - technicalDetails: Composition and color theory guidance
 * - promptTemplate: The raw template for customization
 */
router.post('/prompt-assist', (req, res) => {
  try {
    const { idea, style = 'streetwear', vibe } = req.body;

    if (!idea || typeof idea !== 'string' || idea.trim().length < 3) {
      return res.status(400).json({
        error: 'Idea required (min 3 characters)',
        example: { idea: 'lobster fighting a bear', style: 'chaos', vibe: 'aggressive' }
      });
    }

    const validStyles = Object.keys(ARTIST_PERSONAS);
    const selectedStyle = validStyles.includes(style) ? style : 'streetwear';
    const artist = ARTIST_PERSONAS[selectedStyle];
    const palette = STYLE_PALETTES[selectedStyle];

    // Build the expert prompt
    const enhancedPrompt = buildExpertPrompt(idea.trim(), selectedStyle, { vibe });

    res.json({
      success: true,
      enhancedPrompt,
      artistReference: {
        name: artist.name,
        era: artist.era,
        signature: artist.techniques.slice(0, 3).join(', ')
      },
      technicalDetails: {
        composition: "Centered medallion, 10\"x12\" print area, clean edges for DTG",
        colorTheory: artist.colorTheory,
        palette: palette,
        avoidThese: artist.negativePrompts
      },
      promptTemplate: {
        role: `You are ${artist.name}, ${artist.title}`,
        movement: artist.movement,
        techniques: artist.techniques,
        references: artist.references
      },
      originalInput: {
        idea: idea.trim(),
        style: selectedStyle,
        vibe: vibe || null
      },
      usage: {
        tip: "Use 'enhancedPrompt' directly with image generation APIs, or customize the 'promptTemplate' fields",
        nextStep: "POST /api/v1/design/generate with prompt set to the enhancedPrompt"
      }
    });

  } catch (err) {
    console.error('Prompt assist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/design/artist-personas
 * Get all available artist personas for prompt engineering
 */
router.get('/artist-personas', (req, res) => {
  const personas = {};
  for (const [styleId, artist] of Object.entries(ARTIST_PERSONAS)) {
    personas[styleId] = {
      name: artist.name,
      title: artist.title,
      era: artist.era,
      movement: artist.movement,
      techniques: artist.techniques,
      colorTheory: artist.colorTheory,
      references: artist.references,
      palette: STYLE_PALETTES[styleId]
    };
  }

  res.json({
    personas,
    styles: Object.keys(ARTIST_PERSONAS),
    usage: {
      endpoint: "POST /api/v1/design/prompt-assist",
      example: {
        idea: "lobster in a mech suit",
        style: "chaos",
        vibe: "epic"
      }
    }
  });
});

/**
 * POST /api/v1/design/concept
 * Generate a design concept from a prompt (free, no payment required)
 */
router.post('/concept', async (req, res) => {
  try {
    const { prompt, style } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({
        error: 'Prompt required (min 3 characters)'
      });
    }

    if (prompt.length > 500) {
      return res.status(400).json({
        error: 'Prompt too long (max 500 characters)'
      });
    }

    const result = await generateDesignConcept(
      prompt.trim(),
      style || 'streetwear'
    );

    if (result.success) {
      res.json({
        success: true,
        concept: result.concept,
        prompt: result.prompt,
        style: result.style
      });
    } else {
      res.json({
        success: false,
        error: result.error,
        fallbackConcept: result.fallbackConcept
      });
    }

  } catch (err) {
    console.error('Concept generation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/design/generate
 * Generate custom design images. Requires $1 USDC payment via x402.
 *
 * This endpoint is protected by x402 middleware in server.js.
 * Payment is verified before this handler runs.
 *
 * Request:
 * - prompt: Design description
 * - style: streetwear, minimal, retro, glitch, abstract, meme, chaos
 * - colors: Array of hex colors (optional)
 *
 * Response:
 * - designs: Array of 3 design variations with URLs
 * - expiresAt: When designs expire (7 days)
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, style = 'streetwear', colors } = req.body;
    const walletAddress = req.headers['x-wallet-address'];
    const paymentHash = req.headers['x-payment'] || 'x402-verified';

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({
        error: 'Prompt required (min 3 characters)'
      });
    }

    if (prompt.length > 500) {
      return res.status(400).json({
        error: 'Prompt too long (max 500 characters)'
      });
    }

    // Validate style
    const validStyles = Object.keys(STYLE_PALETTES);
    if (!validStyles.includes(style)) {
      return res.status(400).json({
        error: 'Invalid style',
        validStyles
      });
    }

    // Validate colors if provided
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (colors && Array.isArray(colors)) {
      const invalidColors = colors.filter(c => !colorRegex.test(c));
      if (invalidColors.length > 0) {
        return res.status(400).json({
          error: 'Invalid color format (use hex, e.g., #FF3B30)',
          invalidColors
        });
      }
    }

    // Build Nano Banana structured prompt
    const nanoPrompt = buildNanoBananaPrompt(
      prompt.trim(),
      style,
      colors
    );

    // Generate design images
    const imageResult = await generateDesignImages(nanoPrompt, 3);

    if (!imageResult.success || !imageResult.images?.length) {
      return res.status(500).json({
        error: 'Design generation failed',
        message: 'Unable to generate design images. Please try again.'
      });
    }

    // Save designs to database
    const savedDesigns = await db.saveDesigns(
      walletAddress || 'anonymous',
      imageResult.images,
      prompt.trim(),
      {
        style,
        colors: colors || STYLE_PALETTES[style],
        paymentHash,
        nanoPrompt
      }
    );

    // Format response
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    res.status(201).json({
      success: true,
      designs: savedDesigns.map(d => ({
        id: d.id,
        url: d.image_url,
        thumbnail: d.thumbnail_url,
        variation: d.variation_number
      })),
      prompt: prompt.trim(),
      style: style,
      walletAddress: walletAddress || null,
      expiresAt: expiresAt.toISOString(),
      canOrderUntil: expiresAt.toISOString(),
      isPlaceholder: imageResult.isPlaceholder || false,
      message: imageResult.isPlaceholder
        ? 'Placeholder designs generated. Configure BlockRun API for real AI designs.'
        : 'Your custom designs are ready! Pick your favorite and order a shirt.'
    });

  } catch (err) {
    console.error('Design generate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/design/my-designs
 * Get all designs for a wallet (unexpired, unused)
 */
router.get('/my-designs', async (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address required (X-Wallet-Address header)'
      });
    }

    const designs = await db.getDesignsByWallet(walletAddress);

    res.json({
      designs: designs.map(d => ({
        id: d.id,
        url: d.image_url,
        thumbnail: d.thumbnail_url,
        prompt: d.prompt,
        style: d.style,
        variation: d.variation_number,
        generationId: d.generation_id,
        createdAt: d.created_at,
        expiresAt: d.expires_at,
        isExpired: new Date(d.expires_at) < new Date(),
        isUsed: !!d.used_in_order_id
      })),
      count: designs.length
    });

  } catch (err) {
    console.error('Get designs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/design/styles
 * Get available design styles
 */
router.get('/styles', (req, res) => {
  res.json({
    styles: [
      {
        id: 'streetwear',
        name: 'Streetwear',
        description: 'Bold, urban, high-contrast designs',
        palette: STYLE_PALETTES.streetwear
      },
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Clean, simple, typography-focused',
        palette: STYLE_PALETTES.minimal
      },
      {
        id: 'retro',
        name: 'Retro',
        description: 'Vintage vibes, nostalgic aesthetics',
        palette: STYLE_PALETTES.retro
      },
      {
        id: 'glitch',
        name: 'Glitch',
        description: 'Digital distortion, cyberpunk inspired',
        palette: STYLE_PALETTES.glitch
      },
      {
        id: 'abstract',
        name: 'Abstract',
        description: 'Artistic, expressive, experimental',
        palette: STYLE_PALETTES.abstract
      },
      {
        id: 'meme',
        name: 'Meme',
        description: 'Internet culture, irreverent humor',
        palette: STYLE_PALETTES.meme
      },
      {
        id: 'chaos',
        name: 'Chaos',
        description: 'Full degen energy, World Industries vibes',
        palette: STYLE_PALETTES.chaos
      }
    ],
    brandGuidelines: DESIGN_STYLE_GUIDE,
    nanoBananaPromptExample: buildNanoBananaPrompt('lobster fighting a bear', 'chaos')
  });
});

/**
 * POST /api/v1/design/submit
 * Submit a design for community voting (future feature)
 */
router.post('/submit', async (req, res) => {
  res.status(501).json({
    error: 'Coming soon',
    message: 'Design submission for community voting is not yet available. Stay tuned!'
  });
});

/**
 * GET /api/v1/design/gallery
 * Get featured/voted designs (future feature)
 */
router.get('/gallery', async (req, res) => {
  res.json({
    featured: [],
    message: 'Design gallery coming soon! Agents will be able to submit designs for community voting.'
  });
});

/**
 * GET /api/v1/design/:id
 * Get a specific design by ID
 *
 * IMPORTANT: This route MUST be last among GET routes because :id is a catch-all
 * parameter that would otherwise match /styles, /gallery, /my-designs, etc.
 */
router.get('/:id', async (req, res) => {
  try {
    const design = await db.getDesignById(req.params.id);

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    res.json({
      id: design.id,
      url: design.image_url,
      thumbnail: design.thumbnail_url,
      prompt: design.prompt,
      style: design.style,
      colors: design.colors,
      variation: design.variation_number,
      generationId: design.generation_id,
      createdAt: design.created_at,
      expiresAt: design.expires_at,
      isExpired: new Date(design.expires_at) < new Date(),
      isUsed: !!design.used_in_order_id,
      usedInOrderId: design.used_in_order_id
    });

  } catch (err) {
    console.error('Get design error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
