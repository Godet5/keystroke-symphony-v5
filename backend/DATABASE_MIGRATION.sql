-- ============================================
-- KEYSTROKE SYMPHONY v5 - DATABASE MIGRATION
-- ============================================
-- Version: 1.0
-- Last Updated: 2025-11-22
-- Description: Complete database schema for Keystroke Symphony
-- Run Order: Execute this script in the Supabase SQL Editor
-- Estimated Time: 2-3 minutes
-- ============================================

-- ============================================
-- STEP 1: HELPER FUNCTIONS
-- ============================================

-- Function to auto-update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ============================================
-- STEP 2: CORE TABLES
-- ============================================

-- --------------------------------------------
-- PROFILES TABLE (User Extended Data)
-- --------------------------------------------
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

-- Trigger: Auto-update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- --------------------------------------------
-- RECORDINGS TABLE
-- --------------------------------------------
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

-- Trigger: Auto-update updated_at on recordings
CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON public.recordings
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

-- --------------------------------------------
-- SESSIONS TABLE (Performance Analytics)
-- --------------------------------------------
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

-- RLS Policies for sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE - sessions are immutable for analytics integrity

-- --------------------------------------------
-- FORUM POSTS TABLE
-- --------------------------------------------
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

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for forum_posts
CREATE INDEX idx_forum_posts_author_id ON public.forum_posts(author_id);
CREATE INDEX idx_forum_posts_created_at ON public.forum_posts(created_at DESC);
CREATE INDEX idx_forum_posts_tags ON public.forum_posts USING GIN(tags);

-- Trigger: Auto-update updated_at on forum_posts
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON public.forum_posts
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

-- --------------------------------------------
-- FORUM COMMENTS TABLE
-- --------------------------------------------
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

-- Function: Update post timestamp when comment is added
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts
    SET updated_at = NOW()
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update post when comment added
CREATE TRIGGER trigger_update_post_comment_count
AFTER INSERT ON public.forum_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- Trigger: Auto-update updated_at on forum_comments
CREATE TRIGGER update_forum_comments_updated_at BEFORE UPDATE ON public.forum_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- --------------------------------------------
-- ACHIEVEMENTS TABLE
-- --------------------------------------------
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

-- RLS Policies for achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

-- Badges are awarded by backend logic (no INSERT policy for users)

-- ============================================
-- STEP 3: LEADERBOARD VIEWS
-- ============================================

-- WPM Leaderboard (All-Time Best)
CREATE VIEW public.leaderboard_wpm AS
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
CREATE VIEW public.leaderboard_accuracy AS
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
CREATE VIEW public.leaderboard_weekly AS
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
GRANT SELECT ON public.leaderboard_wpm TO authenticated;
GRANT SELECT ON public.leaderboard_accuracy TO authenticated;
GRANT SELECT ON public.leaderboard_weekly TO authenticated;

-- ============================================
-- STEP 4: STORED PROCEDURES
-- ============================================

-- Automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    SPLIT_PART(NEW.email, '@', 1), -- Default username from email
    SPLIT_PART(NEW.email, '@', 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user stats after session completion
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

-- Reset daily session limit (call this from Edge Function or cron)
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

-- ============================================
-- STEP 5: TRIGGERS
-- ============================================

-- Trigger: Create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update user stats after session insert
CREATE TRIGGER trigger_update_user_stats
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_after_session();

-- ============================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================

-- Run these queries to verify schema was created correctly

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected output:
-- achievements
-- forum_comments
-- forum_posts
-- profiles
-- recordings
-- sessions

-- List all views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected output:
-- leaderboard_accuracy
-- leaderboard_weekly
-- leaderboard_wpm

-- List all functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Expected output (at minimum):
-- handle_new_user
-- reset_daily_sessions_if_needed
-- update_post_comment_count
-- update_updated_at_column
-- update_user_stats_after_session

-- ============================================
-- STEP 7: TEST DATA (OPTIONAL - for development only)
-- ============================================

-- Uncomment below to insert test data for development

/*
-- Create test profile (user must exist in auth.users first)
INSERT INTO public.profiles (id, username, display_name, tier)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'testuser',
  'Test User',
  'PAID'
);

-- Create test session
INSERT INTO public.sessions (
  user_id,
  challenge_id,
  mode,
  theme,
  wpm,
  accuracy,
  duration,
  mistakes,
  total_chars,
  combo,
  max_combo
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'teach_01',
  'CURRICULUM',
  'sunset',
  85,
  95.5,
  60000,
  3,
  85,
  20,
  30
);

-- Create test forum post
INSERT INTO public.forum_posts (
  author_id,
  title,
  content,
  tags
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Welcome to Keystroke Symphony!',
  'Share your typing experiences and musical creations here.',
  ARRAY['announcement', 'community']
);
*/

-- ============================================
-- END OF MIGRATION
-- ============================================

-- Summary:
-- ✅ 6 tables created (profiles, recordings, sessions, forum_posts, forum_comments, achievements)
-- ✅ 3 views created (leaderboard_wpm, leaderboard_accuracy, leaderboard_weekly)
-- ✅ 5 functions created (update_updated_at_column, handle_new_user, update_user_stats_after_session, reset_daily_sessions_if_needed, update_post_comment_count)
-- ✅ All RLS policies enabled
-- ✅ All indexes created
-- ✅ All triggers set up

-- Next steps:
-- 1. Verify all tables/views/functions were created (run verification queries above)
-- 2. Set up Supabase Storage bucket for recordings
-- 3. Deploy Edge Functions
-- 4. Test with frontend integration
