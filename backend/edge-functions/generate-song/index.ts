import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const GenerateSongSchema = z.object({
  theme: z.string().min(1).max(200),
  mode: z.enum(['CURRICULUM', 'FREE_PLAY', 'PLAYBACK']),
});

// Rate limiting (in-memory, simple implementation)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(ip);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Fallback configuration
const FALLBACK_CONFIG = {
  theme: 'tranquil waters',
  text: 'gentle waves flow beneath the moonlight',
  mood: 'serene',
  tempo: 60,
  soundProfile: {
    oscillatorType: 'sine',
    attack: 0.1,
    decay: 0.4,
    sustain: 0.2,
    release: 0.8,
    filterFreq: 1000,
    filterQ: 1,
    distortion: 0,
    reverbMix: 0.5
  },
  scale: 'pentatonic',
  musicalStyle: 'Dreamy'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Rate limiting (10 req/min per IP)
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp, 10, 60000)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again in 1 minute.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const validatedData = GenerateSongSchema.parse(body);

    // Get Gemini API key from environment
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ ...FALLBACK_CONFIG }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build prompt based on mode
    let prompt = '';
    if (validatedData.mode === 'CURRICULUM') {
      prompt = `Generate a "Practice" level typing challenge based on the theme: "${validatedData.theme}".
Text should be poetic, rhythmic, and focus on flow.
Return JSON with text (10-15 words), mood, tempo (40-80 BPM), and a soundProfile.`;
    } else {
      prompt = `Create a soundscape for free improvisation based on: "${validatedData.theme}".
The user will type to create music.
Return JSON with mood, tempo (60-120 BPM), and a sophisticated soundProfile.
Text should be a short inspirational phrase (10-15 words).`;
    }

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                mood: { type: 'string' },
                tempo: { type: 'number' },
                soundProfile: {
                  type: 'object',
                  properties: {
                    oscillatorType: { type: 'string', enum: ['sine', 'square', 'sawtooth', 'triangle'] },
                    attack: { type: 'number' },
                    decay: { type: 'number' },
                    sustain: { type: 'number' },
                    release: { type: 'number' },
                    filterFreq: { type: 'number' },
                    filterQ: { type: 'number' },
                    distortion: { type: 'number' },
                    reverbMix: { type: 'number' }
                  },
                  required: ['oscillatorType', 'attack', 'decay', 'sustain', 'release', 'filterFreq', 'filterQ', 'distortion', 'reverbMix']
                }
              },
              required: ['text', 'mood', 'tempo', 'soundProfile']
            }
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', await geminiResponse.text());
      return new Response(
        JSON.stringify({ ...FALLBACK_CONFIG }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return new Response(
        JSON.stringify({ ...FALLBACK_CONFIG }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const parsedConfig = JSON.parse(generatedText);

    // Return generated song config
    const songConfig = {
      theme: validatedData.theme,
      text: parsedConfig.text || FALLBACK_CONFIG.text,
      mood: parsedConfig.mood || FALLBACK_CONFIG.mood,
      tempo: parsedConfig.tempo || FALLBACK_CONFIG.tempo,
      soundProfile: parsedConfig.soundProfile || FALLBACK_CONFIG.soundProfile,
      scale: 'pentatonic',
      musicalStyle: 'Dreamy'
    };

    return new Response(
      JSON.stringify(songConfig),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in generate-song:', error);

    // Return fallback on any error
    return new Response(
      JSON.stringify({
        error: 'Failed to generate song',
        fallback: FALLBACK_CONFIG
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
