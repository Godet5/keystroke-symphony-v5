// ============================================
// EDGE FUNCTION: analyze-performance
// ============================================
// Purpose: Proxy Gemini API for AI analysis of typing performance
// Caches results in sessions table
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface TypingStats {
  wpm: number;
  accuracy: number;
  duration: number;
  mistakes: number;
  totalChars: number;
  combo: number;
  maxCombo: number;
}

interface SongConfig {
  theme: string;
  text: string;
  tempo?: number;
}

interface AnalysisRequest {
  stats: TypingStats;
  config: SongConfig;
  sessionId?: string; // If session already exists, update it
}

interface AnalysisResult {
  title: string;
  critique: string;
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
}

async function callGeminiForAnalysis(
  stats: TypingStats,
  config: SongConfig
): Promise<AnalysisResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `You are an expert typing coach for a music-based typing tutor called Keystroke Symphony. Analyze this typing performance and provide constructive feedback.

**Performance Stats:**
- WPM: ${stats.wpm}
- Accuracy: ${stats.accuracy.toFixed(1)}%
- Duration: ${Math.round(stats.duration / 1000)}s
- Mistakes: ${stats.mistakes}
- Total Characters: ${stats.totalChars}
- Max Combo: ${stats.maxCombo}

**Text Typed:** "${config.text}"
**Theme:** ${config.theme}

Provide analysis in EXACTLY this JSON format:
{
  "title": "A creative, encouraging title (3-6 words)",
  "critique": "A warm, constructive paragraph analyzing their performance. Mention specific strengths and areas for improvement. Reference musical concepts (rhythm, tempo, flow) when appropriate. Keep it under 150 words.",
  "score": 0-100 (overall performance score),
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"]
}

**Guidelines:**
- Be encouraging and specific
- For WPM < 30: Focus on accuracy over speed
- For WPM 30-60: Encourage steady rhythm
- For WPM > 60: Praise speed, suggest refining technique
- For accuracy > 95%: Celebrate precision
- For accuracy < 85%: Suggest slowing down
- Use musical metaphors (rhythm, tempo, crescendo, harmony)
- Keep tone positive and motivating

Return ONLY the JSON, no markdown code blocks.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
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

  // Extract JSON (remove markdown code blocks if present)
  let jsonStr = textResponse.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```\n?/g, '');
  }

  try {
    const analysis: AnalysisResult = JSON.parse(jsonStr);

    // Validate required fields
    if (!analysis.title || !analysis.critique || analysis.score === undefined) {
      throw new Error('Missing required fields in analysis');
    }

    // Ensure arrays exist
    analysis.strengths = analysis.strengths || [];
    analysis.improvements = analysis.improvements || [];

    return analysis;
  } catch (e) {
    console.error('Failed to parse Gemini response:', textResponse, e);
    // Return fallback analysis
    return generateFallbackAnalysis(stats);
  }
}

function generateFallbackAnalysis(stats: TypingStats): AnalysisResult {
  const { wpm, accuracy } = stats;

  let title = 'Steady Progress';
  let critique = '';
  const strengths: string[] = [];
  const improvements: string[] = [];
  let score = Math.round((wpm / 100) * 50 + accuracy / 2);

  if (wpm >= 80 && accuracy >= 95) {
    title = 'Virtuoso Performance!';
    critique = 'Your fingers move with the precision of a concert pianist. Exceptional speed paired with near-perfect accuracy shows true mastery. Your rhythm is solid, and your flow is uninterrupted. Keep pushing the tempo!';
    strengths.push('Exceptional speed', 'Outstanding accuracy');
    score = Math.min(95, score);
  } else if (wpm >= 60) {
    title = 'Strong Tempo';
    critique = `You're typing at a ${wpm} WPM clip with ${accuracy.toFixed(1)}% accuracy. Your rhythm is developing nicely. Focus on maintaining this tempo while refining your precision. Think of each keystroke as a musical note in a flowing melody.`;
    strengths.push('Good typing speed', 'Developing rhythm');
    if (accuracy < 90) {
      improvements.push('Slow down slightly for better accuracy');
    }
  } else if (wpm >= 30) {
    title = 'Finding Your Rhythm';
    critique = `At ${wpm} WPM, you're building a steady foundation. Your ${accuracy.toFixed(1)}% accuracy shows you're being mindful of each keystroke. Focus on consistent rhythm over speed. Let your fingers dance naturally across the keys.`;
    strengths.push('Steady pace', 'Careful typing');
    improvements.push('Practice daily to increase speed naturally');
  } else {
    title = 'Taking It Slow';
    critique = 'You're taking a measured approach, which is perfect for building muscle memory. Focus on accuracy first, and speed will follow. Think of this as learning a new musical instrument—patience and practice are key.';
    strengths.push('Thoughtful approach');
    improvements.push('Increase practice frequency', 'Focus on home row positioning');
  }

  if (accuracy < 85) {
    improvements.push('Review finger placement and posture');
  }

  return { title, critique, score, strengths, improvements };
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

    // Parse request body
    const body: AnalysisRequest = await req.json();

    // Validate input
    if (!body.stats || !body.config) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: stats and config are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If sessionId provided, check if analysis already exists (caching)
    if (body.sessionId) {
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('ai_analysis')
        .eq('id', body.sessionId)
        .eq('user_id', user.id)
        .single();

      if (existingSession?.ai_analysis) {
        // Return cached analysis
        return new Response(
          JSON.stringify(existingSession.ai_analysis),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-Cache': 'HIT',
            },
          }
        );
      }
    }

    // Generate new analysis
    const analysis = await callGeminiForAnalysis(body.stats, body.config);

    // If sessionId provided, update session with analysis
    if (body.sessionId) {
      await supabase
        .from('sessions')
        .update({
          ai_analysis: analysis,
          ai_analysis_generated: true,
        })
        .eq('id', body.sessionId)
        .eq('user_id', user.id);
    }

    // Return analysis
    return new Response(
      JSON.stringify(analysis),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    console.error('Error in analyze-performance function:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to generate analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Test with:
// curl -X POST https://your-project.supabase.co/functions/v1/analyze-performance \
//   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "stats": {"wpm": 75, "accuracy": 94.5, "duration": 45000, "mistakes": 8, "totalChars": 150, "combo": 45, "maxCombo": 45},
//     "config": {"theme": "Ocean Waves", "text": "The rhythm of typing mirrors the ebb and flow of ocean waves"}
//   }'
