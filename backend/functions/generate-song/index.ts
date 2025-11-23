// ============================================
// EDGE FUNCTION: generate-song
// ============================================
// Purpose: Proxy Gemini API to generate song configurations (hides API key from client)
// Rate Limit: 10 requests per minute per user
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface GenerateSongRequest {
  theme: string;
  mode: 'CURRICULUM' | 'FREE_PLAY' | 'PLAYBACK';
}

interface SongConfig {
  theme: string;
  text: string;
  mood: 'calm' | 'energetic' | 'mysterious' | 'playful';
  tempo: number;
  soundProfile: string;
  scale: string;
  musicalStyle: string;
}

// Rate limiting (in-memory store, resets on function cold start)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = 10; // 10 requests per minute
  const windowMs = 60 * 1000; // 1 minute

  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // New window
    rateLimitStore.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (userLimit.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: limit - userLimit.count };
}

function sanitizeTheme(theme: string): string {
  // Remove potentially harmful characters, limit length
  return theme
    .replace(/[<>{}]/g, '')
    .trim()
    .substring(0, 200);
}

async function callGeminiAPI(theme: string, mode: string): Promise<SongConfig> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = mode === 'CURRICULUM'
    ? `Generate a typing exercise text for a music-based typing tutor. Theme: "${theme}". Create a short, rhythmic sentence (40-80 characters) that flows well when typed. Make it inspiring and related to music, rhythm, or the theme. Return ONLY valid JSON with this exact structure:
{
  "theme": "${theme}",
  "text": "your generated text here",
  "mood": "calm|energetic|mysterious|playful",
  "tempo": 40-120,
  "soundProfile": "piano|synth|strings|ambient",
  "scale": "C major|D minor|E phrygian|etc",
  "musicalStyle": "classical|jazz|electronic|ambient"
}`
    : `Generate a creative typing prompt for free-play music creation. Theme: "${theme}". Create an evocative sentence (50-120 characters) that inspires musical typing. Return ONLY valid JSON with this exact structure:
{
  "theme": "${theme}",
  "text": "your generated text here",
  "mood": "calm|energetic|mysterious|playful",
  "tempo": 60-140,
  "soundProfile": "piano|synth|strings|ambient",
  "scale": "C major|D minor|E phrygian|etc",
  "musicalStyle": "classical|jazz|electronic|ambient"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API failed: ${response.status}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('Invalid response from Gemini API');
  }

  // Extract JSON from response (Gemini sometimes wraps in markdown code blocks)
  let jsonStr = textResponse.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```\n?/g, '');
  }

  try {
    const config: SongConfig = JSON.parse(jsonStr);

    // Validate required fields
    if (!config.text || !config.mood || !config.tempo) {
      throw new Error('Missing required fields in generated config');
    }

    return config;
  } catch (e) {
    console.error('Failed to parse Gemini response:', textResponse);
    // Return fallback config
    return {
      theme,
      text: mode === 'CURRICULUM'
        ? 'rhythm flows when the mind is still'
        : 'In the quiet space between thoughts, music emerges from the dance of fingers across keys.',
      mood: 'calm',
      tempo: 60,
      soundProfile: 'piano',
      scale: 'C major',
      musicalStyle: 'classical',
    };
  }
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Maximum 10 requests per minute. Please try again shortly.',
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': '60',
          },
        }
      );
    }

    // Parse request body
    const body: GenerateSongRequest = await req.json();

    // Validate input
    if (!body.theme || typeof body.theme !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: theme is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['CURRICULUM', 'FREE_PLAY', 'PLAYBACK'].includes(body.mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize theme
    const sanitizedTheme = sanitizeTheme(body.theme);

    // Call Gemini API
    const songConfig = await callGeminiAPI(sanitizedTheme, body.mode);

    // Return success
    return new Response(
      JSON.stringify(songConfig),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error) {
    console.error('Error in generate-song function:', error);

    // Return fallback config on error
    const fallbackConfig: SongConfig = {
      theme: 'Default',
      text: 'Let your fingers dance across the keys, creating melodies with every press.',
      mood: 'calm',
      tempo: 60,
      soundProfile: 'piano',
      scale: 'C major',
      musicalStyle: 'classical',
    };

    return new Response(
      JSON.stringify(fallbackConfig),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Test with:
// curl -X POST https://your-project.supabase.co/functions/v1/generate-song \
//   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
//   -H "Content-Type: application/json" \
//   -d '{"theme": "ocean waves", "mode": "FREE_PLAY"}'
