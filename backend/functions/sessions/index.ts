// ============================================
// EDGE FUNCTION: sessions
// ============================================
// Purpose: Save typing session performance data and award badges
// Triggers database stored procedures for stats updates
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
  rhythmHistory?: Array<{ time: number; wpm: number }>;
}

interface SessionRequest {
  stats: TypingStats;
  challengeId?: string;
  mode: 'CURRICULUM' | 'FREE_PLAY' | 'PLAYBACK';
  theme?: string;
}

interface Badge {
  type: string;
  name: string;
  description: string;
  data?: object;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Badge definitions and criteria
const BADGE_CRITERIA = [
  {
    type: 'FIRST_SESSION',
    name: 'First Steps',
    description: 'Completed your first typing session',
    check: (profile: any, stats: TypingStats) => profile.total_sessions === 0,
  },
  {
    type: 'HYPERSONIC',
    name: 'Hypersonic Typist',
    description: 'Achieved 100+ WPM',
    check: (profile: any, stats: TypingStats) => stats.wpm >= 100,
  },
  {
    type: 'PERFECT_FLOW',
    name: 'Perfect Flow',
    description: 'Maintained 100% accuracy',
    check: (profile: any, stats: TypingStats) => stats.accuracy >= 100 && stats.totalChars >= 50,
  },
  {
    type: 'SPEED_DEMON',
    name: 'Speed Demon',
    description: 'Achieved 80+ WPM',
    check: (profile: any, stats: TypingStats) => stats.wpm >= 80,
  },
  {
    type: 'ACCURACY_MASTER',
    name: 'Accuracy Master',
    description: 'Achieved 98%+ accuracy',
    check: (profile: any, stats: TypingStats) => stats.accuracy >= 98 && stats.totalChars >= 50,
  },
  {
    type: 'COMBO_KING',
    name: 'Combo King',
    description: 'Achieved a 100+ character combo',
    check: (profile: any, stats: TypingStats) => stats.maxCombo >= 100,
  },
  {
    type: 'DEDICATED_PRACTICE',
    name: 'Dedicated Practice',
    description: 'Completed 10 sessions',
    check: (profile: any, stats: TypingStats) => profile.total_sessions + 1 === 10,
  },
  {
    type: 'MARATHON_TYPIST',
    name: 'Marathon Typist',
    description: 'Completed 50 sessions',
    check: (profile: any, stats: TypingStats) => profile.total_sessions + 1 === 50,
  },
  {
    type: 'CENTURY_CLUB',
    name: 'Century Club',
    description: 'Completed 100 sessions',
    check: (profile: any, stats: TypingStats) => profile.total_sessions + 1 === 100,
  },
  {
    type: 'ENDURANCE',
    name: 'Endurance Expert',
    description: 'Typed for 5+ minutes continuously',
    check: (profile: any, stats: TypingStats) => stats.duration >= 300000, // 5 minutes
  },
];

async function checkAndAwardBadges(
  supabase: any,
  userId: string,
  stats: TypingStats
): Promise<Badge[]> {
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_sessions, best_wpm, best_accuracy')
    .eq('id', userId)
    .single();

  if (!profile) {
    return [];
  }

  // Get existing badges
  const { data: existingBadges } = await supabase
    .from('achievements')
    .select('badge_type')
    .eq('user_id', userId);

  const existingBadgeTypes = new Set(
    (existingBadges || []).map((b: any) => b.badge_type)
  );

  // Check which badges should be awarded
  const newBadges: Badge[] = [];

  for (const badgeDef of BADGE_CRITERIA) {
    // Skip if already earned
    if (existingBadgeTypes.has(badgeDef.type)) {
      continue;
    }

    // Check if criteria met
    if (badgeDef.check(profile, stats)) {
      newBadges.push({
        type: badgeDef.type,
        name: badgeDef.name,
        description: badgeDef.description,
        data: {
          wpm: stats.wpm,
          accuracy: stats.accuracy,
          earnedAt: new Date().toISOString(),
        },
      });

      // Insert badge into achievements table
      await supabase.from('achievements').insert({
        user_id: userId,
        badge_type: badgeDef.type,
        badge_data: {
          wpm: stats.wpm,
          accuracy: stats.accuracy,
        },
      });
    }
  }

  return newBadges;
}

serve(async (req: Request) => {
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
    const body: SessionRequest = await req.json();

    // Validate input
    if (!body.stats || !body.mode) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: stats and mode are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { stats, challengeId, mode, theme } = body;

    // Validate stats
    if (
      stats.wpm === undefined ||
      stats.accuracy === undefined ||
      stats.duration === undefined ||
      stats.mistakes === undefined ||
      stats.totalChars === undefined
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid stats: missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user can start a session (respects tier limits)
    const { data: canStart, error: limitError } = await supabase.rpc(
      'can_user_start_session',
      { user_uuid: user.id }
    );

    if (limitError) {
      console.error('Error checking session limit:', limitError);
      // Continue anyway (fail open)
    } else if (!canStart) {
      return new Response(
        JSON.stringify({
          error: 'Daily session limit reached',
          message: 'You have reached your daily session limit. Upgrade to PAID tier for unlimited sessions.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert session into database
    const { data: session, error: insertError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        challenge_id: challengeId || null,
        mode,
        theme: theme || null,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        duration: stats.duration,
        mistakes: stats.mistakes,
        total_chars: stats.totalChars,
        combo: stats.combo || 0,
        max_combo: stats.maxCombo || 0,
        rhythm_history: stats.rhythmHistory || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save session', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment session count
    await supabase.rpc('increment_session_count', { user_uuid: user.id });

    // Note: update_user_stats_after_session trigger runs automatically via database trigger

    // Check and award badges
    const newBadges = await checkAndAwardBadges(supabase, user.id, stats);

    // Return success
    return new Response(
      JSON.stringify({
        sessionId: session.id,
        badges: newBadges,
        message: 'Session saved successfully',
        ...(newBadges.length > 0 && { badgeMessage: `Congratulations! You earned ${newBadges.length} new badge(s)!` }),
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sessions function:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
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
// curl -X POST https://your-project.supabase.co/functions/v1/sessions \
//   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "stats": {
//       "wpm": 85,
//       "accuracy": 96.5,
//       "duration": 45000,
//       "mistakes": 6,
//       "totalChars": 150,
//       "combo": 75,
//       "maxCombo": 75,
//       "rhythmHistory": [{"time": 0, "wpm": 80}, {"time": 15000, "wpm": 90}]
//     },
//     "challengeId": "teach_01",
//     "mode": "CURRICULUM",
//     "theme": "Rhythm Basics"
//   }'
