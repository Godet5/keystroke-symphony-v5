-- ============================================
-- KEYSTROKE SYMPHONY - INITIAL DATABASE SCHEMA
-- ============================================
-- Version: 1.0
-- Last Updated: 2025-11-23
-- Description: Complete database schema with RLS policies, triggers, and views
--
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Open Supabase Dashboard > SQL Editor
-- 3. Paste and run
-- 4. Verify success: SELECT * FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================

-- Enable UUID extension (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE 1: PROFILES (Extended User Data)
-- ============================================

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PAID', 'OWNER')),

  -- Stripe Integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  subscription_current_period_end TIMESTAMPTZ,

  -- Usage Tracking
  daily_sessions_used INTEGER DEFAULT 0,
  daily_limit INTEGER DEFAULT 1, -- Free tier: 1 session/day, Paid: unlimited
  last_session_reset_at TIMESTAMPTZ DEFAULT NOW(),

  -- Stats
  total_sessions INTEGER DEFAULT 0,
  best_wpm INTEGER DEFAULT 0,
  best_accuracy NUMERIC(5,2) DEFAULT 0,
  total_playtime_minutes INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_tier ON public.profiles(tier);
CREATE INDEX idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- TABLE 2: RECORDINGS
-- ============================================

CREATE TABLE public.recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- milliseconds
  is_public BOOLEAN DEFAULT FALSE,

  -- Recording Data
  config JSONB NOT NULL, -- SongConfig: {theme, text, mood, tempo, soundProfile, scale, musicalStyle}
  events JSONB NOT NULL, -- NoteEvent[]: [{char, time, duration}]

  -- Media Files
  video_url TEXT, -- Supabase Storage URL (e.g., recordings/user123/rec456.webm)
  video_size_bytes INTEGER,
  thumbnail_url TEXT, -- Optional: canvas screenshot

  -- Stats
  wpm INTEGER,
  accuracy NUMERIC(5,2),

  -- Social
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recordings
CREATE INDEX idx_recordings_user_id ON public.recordings(user_id);
CREATE INDEX idx_recordings_public ON public.recordings(is_public) WHERE is_public = true;
CREATE INDEX idx_recordings_created_at ON public.recordings(created_at DESC);

-- Trigger
CREATE TRIGGER update_recordings_updated_at
BEFORE UPDATE ON public.recordings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for recordings
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recordings"
  ON public.recordings FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own recordings"
  ON public.recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings"
  ON public.recordings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings"
  ON public.recordings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TABLE 3: SESSIONS (Performance Analytics)
-- ============================================

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Session Context
  challenge_id TEXT, -- e.g., 'teach_01', 'practice_02', NULL for free play
  mode TEXT NOT NULL CHECK (mode IN ('CURRICULUM', 'FREE_PLAY', 'PLAYBACK')),
  theme TEXT,

  -- Performance Metrics
  wpm INTEGER NOT NULL,
  accuracy NUMERIC(5,2) NOT NULL,
  duration INTEGER NOT NULL, -- milliseconds
  mistakes INTEGER NOT NULL,
  total_chars INTEGER NOT NULL,
  combo INTEGER NOT NULL,
  max_combo INTEGER NOT NULL,

  -- Advanced Analytics
  rhythm_history JSONB, -- [{time: number, wpm: number}]

  -- AI Analysis
  ai_analysis JSONB, -- AnalysisResult: {title, critique, score}
  ai_analysis_generated BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_challenge_id ON public.sessions(challenge_id);
CREATE INDEX idx_sessions_mode ON public.sessions(mode);
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX idx_sessions_wpm ON public.sessions(wpm DESC);
CREATE INDEX idx_sessions_accuracy ON public.sessions(accuracy DESC);

-- RLS Policies for sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: No UPDATE or DELETE - sessions are immutable for analytics integrity

-- ============================================
-- TABLE 4: FORUM POSTS
-- ============================================

CREATE TABLE public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- Metadata
  is_pinned BOOLEAN DEFAULT FALSE, -- Admin can pin important posts
  is_locked BOOLEAN DEFAULT FALSE, -- Prevent new comments

  -- Engagement
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for forum_posts
CREATE INDEX idx_forum_posts_author_id ON public.forum_posts(author_id);
CREATE INDEX idx_forum_posts_created_at ON public.forum_posts(created_at DESC);
CREATE INDEX idx_forum_posts_tags ON public.forum_posts USING GIN(tags);
CREATE INDEX idx_forum_posts_likes ON public.forum_posts(likes DESC);

-- Trigger
CREATE TRIGGER update_forum_posts_updated_at
BEFORE UPDATE ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for forum_posts
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posts"
  ON public.forum_posts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts"
  ON public.forum_posts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts"
  ON public.forum_posts FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================
-- TABLE 5: FORUM COMMENTS
-- ============================================

CREATE TABLE public.forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Content
  content TEXT NOT NULL,

  -- Engagement
  likes INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for forum_comments
CREATE INDEX idx_forum_comments_post_id ON public.forum_comments(post_id);
CREATE INDEX idx_forum_comments_author_id ON public.forum_comments(author_id);
CREATE INDEX idx_forum_comments_created_at ON public.forum_comments(created_at DESC);

-- Trigger
CREATE TRIGGER update_forum_comments_updated_at
BEFORE UPDATE ON public.forum_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update post comment count and updated_at
CREATE OR REPLACE FUNCTION update_post_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts
    SET
      comment_count = comment_count + 1,
      updated_at = NOW()
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_posts
    SET
      comment_count = GREATEST(0, comment_count - 1),
      updated_at = NOW()
    WHERE id = OLD.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_on_comment
AFTER INSERT OR DELETE ON public.forum_comments
FOR EACH ROW EXECUTE FUNCTION update_post_on_comment();

-- RLS Policies for forum_comments
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON public.forum_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.forum_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own comments"
  ON public.forum_comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own comments"
  ON public.forum_comments FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================
-- TABLE 6: ACHIEVEMENTS/BADGES
-- ============================================

CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Badge Info
  badge_type TEXT NOT NULL, -- 'Hypersonic', 'Perfect Flow', 'Obsidian Tier', etc.
  badge_data JSONB, -- Additional metadata (e.g., {wpm: 120, session_id: 'xxx'})

  -- Timestamps
  earned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: user can only earn each badge once
  UNIQUE(user_id, badge_type)
);

-- Indexes for achievements
CREATE INDEX idx_achievements_user_id ON public.achievements(user_id);
CREATE INDEX idx_achievements_badge_type ON public.achievements(badge_type);
CREATE INDEX idx_achievements_earned_at ON public.achievements(earned_at DESC);

-- RLS Policies for achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view all achievements"
  ON public.achievements FOR SELECT
  USING (true);

-- Note: Badges are awarded by backend Edge Functions only (no INSERT policy for users)

-- ============================================
-- LEADERBOARD VIEWS
-- ============================================

-- WPM Leaderboard (All-Time Best)
CREATE OR REPLACE VIEW public.leaderboard_wpm AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.tier,
  MAX(s.wpm) as best_wpm,
  AVG(s.accuracy)::NUMERIC(5,2) as avg_accuracy,
  COUNT(s.id) as total_sessions,
  MAX(s.created_at) as last_session_at
FROM public.sessions s
JOIN public.profiles p ON s.user_id = p.id
GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.tier
ORDER BY best_wpm DESC
LIMIT 100;

-- Accuracy Leaderboard
CREATE OR REPLACE VIEW public.leaderboard_accuracy AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.tier,
  AVG(s.accuracy)::NUMERIC(5,2) as avg_accuracy,
  COUNT(s.id) as total_sessions,
  MAX(s.wpm) as best_wpm
FROM public.sessions s
JOIN public.profiles p ON s.user_id = p.id
WHERE s.total_chars >= 50 -- Filter out very short sessions
GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.tier
HAVING COUNT(s.id) >= 5 -- At least 5 sessions for consistency
ORDER BY avg_accuracy DESC
LIMIT 100;

-- Weekly Leaderboard
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.tier,
  MAX(s.wpm) as best_wpm,
  AVG(s.accuracy)::NUMERIC(5,2) as avg_accuracy,
  COUNT(s.id) as sessions_this_week
FROM public.sessions s
JOIN public.profiles p ON s.user_id = p.id
WHERE s.created_at >= NOW() - INTERVAL '7 days'
GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.tier
ORDER BY best_wpm DESC
LIMIT 100;

-- Grant SELECT on views to authenticated users
GRANT SELECT ON public.leaderboard_wpm TO authenticated, anon;
GRANT SELECT ON public.leaderboard_accuracy TO authenticated, anon;
GRANT SELECT ON public.leaderboard_weekly TO authenticated, anon;

-- ============================================
-- DATABASE TRIGGERS (Business Logic)
-- ============================================

-- Trigger 1: Automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    ), -- Use metadata username or derive from email
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Update user stats after session
CREATE OR REPLACE FUNCTION public.update_user_stats_after_session()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    total_sessions = total_sessions + 1,
    best_wpm = GREATEST(best_wpm, NEW.wpm),
    best_accuracy = GREATEST(best_accuracy, NEW.accuracy),
    total_playtime_minutes = total_playtime_minutes + (NEW.duration / 60000)::INTEGER,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_user_stats
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_after_session();

-- ============================================
-- UTILITY FUNCTIONS (Callable from Edge Functions)
-- ============================================

-- Function to reset daily session limit (call before checking limits)
CREATE OR REPLACE FUNCTION public.reset_daily_sessions_if_needed(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET
    daily_sessions_used = 0,
    last_session_reset_at = NOW()
  WHERE
    id = user_uuid AND
    last_session_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can start a new session (respects tier limits)
CREATE OR REPLACE FUNCTION public.can_user_start_session(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  sessions_used INTEGER;
  session_limit INTEGER;
BEGIN
  -- First reset if needed
  PERFORM public.reset_daily_sessions_if_needed(user_uuid);

  -- Get user's tier and usage
  SELECT tier, daily_sessions_used, daily_limit
  INTO user_tier, sessions_used, session_limit
  FROM public.profiles
  WHERE id = user_uuid;

  -- PAID and OWNER tiers have unlimited sessions
  IF user_tier IN ('PAID', 'OWNER') THEN
    RETURN TRUE;
  END IF;

  -- FREE tier: check against limit
  RETURN sessions_used < session_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment daily session count
CREATE OR REPLACE FUNCTION public.increment_session_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET daily_sessions_used = daily_sessions_used + 1
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STORAGE BUCKET SETUP (Run separately if needed)
-- ============================================
-- Note: Storage buckets are typically created via Supabase Dashboard
-- If you need to create via SQL, uncomment below:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('recordings', 'recordings', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- CREATE POLICY "Users can upload own recordings"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'recordings' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );

-- CREATE POLICY "Users can read own recordings"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'recordings' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );

-- CREATE POLICY "Users can delete own recordings"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (
--   bucket_id = 'recordings' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );

-- CREATE POLICY "Public recordings are viewable by everyone"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (
--   bucket_id = 'recordings' AND
--   (storage.foldername(name))[1] = 'public'
-- );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration succeeded:

-- Check all tables were created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Check all RLS policies are enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check all triggers were created
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Check all views were created
-- SELECT table_name FROM information_schema.views WHERE table_schema = 'public';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- ✅ 6 tables created (profiles, recordings, sessions, forum_posts, forum_comments, achievements)
-- ✅ 3 leaderboard views created (wpm, accuracy, weekly)
-- ✅ RLS policies enabled on all tables
-- ✅ Triggers configured (auto-profile, stats update, comment count)
-- ✅ Utility functions created (session limits, resets)
--
-- Next steps:
-- 1. Verify with: SELECT * FROM information_schema.tables WHERE table_schema = 'public';
-- 2. Test auth: Sign up a test user and check profiles table
-- 3. Deploy Edge Functions
-- ============================================
