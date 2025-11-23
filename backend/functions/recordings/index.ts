// ============================================
// EDGE FUNCTION: recordings
// ============================================
// Purpose: CRUD operations for user recordings
// Endpoints: GET /recordings, POST /recordings, GET /recordings/:id, DELETE /recordings/:id
// Tier Requirement: PAID only
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface Recording {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  duration: number;
  is_public: boolean;
  config: object;
  events: object[];
  video_url?: string;
  video_size_bytes?: number;
  thumbnail_url?: string;
  wpm?: number;
  accuracy?: number;
  views?: number;
  likes?: number;
  created_at?: string;
  updated_at?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

async function handleGetRecordings(supabase: any, userId: string, url: URL) {
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const publicOnly = url.searchParams.get('public') === 'true';

  let query = supabase
    .from('recordings')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (publicOnly) {
    query = query.eq('is_public', true);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // Generate signed URLs for videos
  const recordingsWithUrls = await Promise.all(
    (data || []).map(async (recording: Recording) => {
      if (recording.video_url) {
        const { data: signedData } = await supabase.storage
          .from('recordings')
          .createSignedUrl(recording.video_url.replace('recordings/', ''), 3600); // 1 hour expiry

        return {
          ...recording,
          video_url: signedData?.signedUrl || recording.video_url,
        };
      }
      return recording;
    })
  );

  return new Response(
    JSON.stringify({ recordings: recordingsWithUrls, total: data?.length || 0 }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleGetRecording(supabase: any, userId: string, recordingId: string) {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: 'Recording not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check access permission (owner or public)
  if (data.user_id !== userId && !data.is_public) {
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate signed URL for video
  if (data.video_url) {
    const { data: signedData } = await supabase.storage
      .from('recordings')
      .createSignedUrl(data.video_url.replace('recordings/', ''), 3600);

    data.video_url = signedData?.signedUrl || data.video_url;
  }

  // Increment view count if not owner
  if (data.user_id !== userId) {
    await supabase
      .from('recordings')
      .update({ views: (data.views || 0) + 1 })
      .eq('id', recordingId);
  }

  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleCreateRecording(supabase: any, userId: string, userTier: string, req: Request) {
  // Check tier (PAID or OWNER only)
  if (!['PAID', 'OWNER'].includes(userTier)) {
    return new Response(
      JSON.stringify({
        error: 'Premium feature',
        message: 'Recording requires a paid subscription. Upgrade to unlock this feature.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const contentType = req.headers.get('content-type') || '';

  let recordingData: Partial<Recording>;
  let videoBlob: Uint8Array | null = null;

  if (contentType.includes('multipart/form-data')) {
    // Handle multipart form data (with video upload)
    const formData = await req.formData();

    recordingData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      duration: parseInt(formData.get('duration') as string),
      is_public: formData.get('is_public') === 'true',
      config: JSON.parse(formData.get('config') as string),
      events: JSON.parse(formData.get('events') as string),
      wpm: parseInt(formData.get('wpm') as string) || undefined,
      accuracy: parseFloat(formData.get('accuracy') as string) || undefined,
    };

    const videoFile = formData.get('video') as File;
    if (videoFile) {
      videoBlob = new Uint8Array(await videoFile.arrayBuffer());
    }
  } else {
    // Handle JSON (without video)
    const body = await req.json();
    recordingData = {
      title: body.title,
      description: body.description,
      duration: body.duration,
      is_public: body.is_public || false,
      config: body.config,
      events: body.events,
      wpm: body.wpm,
      accuracy: body.accuracy,
    };
  }

  // Validate required fields
  if (!recordingData.title || !recordingData.duration || !recordingData.config || !recordingData.events) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: title, duration, config, events' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate recording ID
  const recordingId = crypto.randomUUID();

  // Upload video to storage if provided
  let videoUrl: string | undefined;
  let videoSize: number | undefined;

  if (videoBlob) {
    const fileName = `${userId}/${recordingId}.webm`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(fileName, videoBlob, {
        contentType: 'video/webm',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Video upload error:', uploadError);
      // Continue without video rather than failing
    } else {
      videoUrl = `recordings/${fileName}`;
      videoSize = videoBlob.length;
    }
  }

  // Insert recording into database
  const { data, error } = await supabase
    .from('recordings')
    .insert({
      id: recordingId,
      user_id: userId,
      ...recordingData,
      video_url: videoUrl,
      video_size_bytes: videoSize,
    })
    .select()
    .single();

  if (error) {
    console.error('Database insert error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create recording', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ ...data, message: 'Recording created successfully' }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleDeleteRecording(supabase: any, userId: string, recordingId: string) {
  // Get recording to verify ownership and get video URL
  const { data: recording, error: fetchError } = await supabase
    .from('recordings')
    .select('user_id, video_url')
    .eq('id', recordingId)
    .single();

  if (fetchError || !recording) {
    return new Response(
      JSON.stringify({ error: 'Recording not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check ownership
  if (recording.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delete video from storage if exists
  if (recording.video_url) {
    const filePath = recording.video_url.replace('recordings/', '');
    await supabase.storage.from('recordings').remove([filePath]);
  }

  // Delete database record
  const { error: deleteError } = await supabase
    .from('recordings')
    .delete()
    .eq('id', recordingId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: 'Failed to delete recording', details: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ message: 'Recording deleted successfully' }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
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

    // Get user profile (for tier check)
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    const userTier = profile?.tier || 'FREE';

    // Parse URL and route to appropriate handler
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const recordingId = pathParts[pathParts.length - 1];

    // Route handling
    if (req.method === 'GET' && pathParts.length <= 2) {
      // GET /recordings - List recordings
      return await handleGetRecordings(supabase, user.id, url);
    } else if (req.method === 'GET' && pathParts.length > 2) {
      // GET /recordings/:id - Get single recording
      return await handleGetRecording(supabase, user.id, recordingId);
    } else if (req.method === 'POST') {
      // POST /recordings - Create recording
      return await handleCreateRecording(supabase, user.id, userTier, req);
    } else if (req.method === 'DELETE') {
      // DELETE /recordings/:id - Delete recording
      return await handleDeleteRecording(supabase, user.id, recordingId);
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in recordings function:', error);

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

// Test examples:
//
// List recordings:
// curl https://your-project.supabase.co/functions/v1/recordings \
//   -H "Authorization: Bearer YOUR_JWT_TOKEN"
//
// Create recording (JSON, no video):
// curl -X POST https://your-project.supabase.co/functions/v1/recordings \
//   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
//   -H "Content-Type: application/json" \
//   -d '{"title": "My Recording", "duration": 45000, "config": {...}, "events": [...]}'
//
// Delete recording:
// curl -X DELETE https://your-project.supabase.co/functions/v1/recordings/RECORDING_ID \
//   -H "Authorization: Bearer YOUR_JWT_TOKEN"
