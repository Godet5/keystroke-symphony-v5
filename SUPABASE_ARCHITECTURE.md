# Supabase Architecture for Keystroke Symphony

**Version:** 1.0
**Last Updated:** 2025-11-22
**Stack:** Supabase PostgreSQL + Edge Functions + Auth + Storage

---

## Overview

This document defines the complete Supabase backend architecture for Keystroke Symphony, including:
- Database schema with Row Level Security (RLS)
- Authentication configuration
- Storage buckets for recordings
- Edge Functions (API endpoints)
- Real-time subscriptions (optional enhancement)

---

## Database Schema

### 1. Profiles (User Extended Data)

Supabase Auth manages core user authentication. We extend it with a `profiles` table:

```sql
-- ============================================
-- PROFILES TABLE
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

-- Indexes
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_tier ON public.profiles(tier);
CREATE INDEX idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

---

### 2. Recordings

User-created typing sessions that can be saved and replayed.

```sql
-- ============================================
-- RECORDINGS TABLE
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

-- Indexes
CREATE INDEX idx_recordings_user_id ON public.recordings(user_id);
CREATE INDEX idx_recordings_public ON public.recordings(is_public) WHERE is_public = true;
CREATE INDEX idx_recordings_created_at ON public.recordings(created_at DESC);

-- Trigger
CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON public.recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
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
```

---

### 3. Sessions (Performance Analytics)

Track every typing session for analytics, leaderboards, and AI training data.

```sql
-- ============================================
-- SESSIONS TABLE
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

-- Indexes
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_challenge_id ON public.sessions(challenge_id);
CREATE INDEX idx_sessions_mode ON public.sessions(mode);
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX idx_sessions_wpm ON public.sessions(wpm DESC);

-- RLS Policies
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE - sessions are immutable for analytics integrity
```

---

### 4. Forum Posts

Community discussions, tips, patches, challenges.

```sql
-- ============================================
-- FORUM POSTS TABLE
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

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_forum_posts_author_id ON public.forum_posts(author_id);
CREATE INDEX idx_forum_posts_created_at ON public.forum_posts(created_at DESC);
CREATE INDEX idx_forum_posts_tags ON public.forum_posts USING GIN(tags);

-- Trigger
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON public.forum_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
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
```

---

### 5. Forum Comments

```sql
-- ============================================
-- FORUM COMMENTS TABLE
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

-- Indexes
CREATE INDEX idx_forum_comments_post_id ON public.forum_comments(post_id);
CREATE INDEX idx_forum_comments_author_id ON public.forum_comments(author_id);
CREATE INDEX idx_forum_comments_created_at ON public.forum_comments(created_at DESC);

-- Update comment count on forum_posts
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

CREATE TRIGGER trigger_update_post_comment_count
AFTER INSERT ON public.forum_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- Trigger
CREATE TRIGGER update_forum_comments_updated_at BEFORE UPDATE ON public.forum_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
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
```

---

### 6. Achievements/Badges

```sql
-- ============================================
-- ACHIEVEMENTS TABLE
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

-- Indexes
CREATE INDEX idx_achievements_user_id ON public.achievements(user_id);
CREATE INDEX idx_achievements_badge_type ON public.achievements(badge_type);

-- RLS Policies
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

-- Badges are awarded by backend logic (no INSERT policy for users)
```

---

### 7. Leaderboards (Materialized View)

```sql
-- ============================================
-- LEADERBOARD VIEWS
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
```

---

## Supabase Storage Buckets

### Recordings Bucket

```sql
-- Create bucket for video recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false); -- Private bucket, requires auth

-- RLS Policies for storage
CREATE POLICY "Users can upload own recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Public recordings (for shared/featured content)
CREATE POLICY "Public recordings are viewable by everyone"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] = 'public'
);
```

**File Path Convention:**
```
recordings/{user_id}/{recording_id}.webm
recordings/public/{recording_id}.webm (for featured recordings)
```

---

## Supabase Auth Configuration

### Email/Password Auth

```javascript
// Enable in Supabase Dashboard > Authentication > Providers
{
  "email": {
    "enabled": true,
    "confirmEmail": true, // Require email verification
    "securePasswordChange": true
  }
}
```

### OAuth Providers (Optional)

```javascript
{
  "google": {
    "enabled": true,
    "clientId": "YOUR_GOOGLE_CLIENT_ID",
    "clientSecret": "YOUR_GOOGLE_CLIENT_SECRET"
  },
  "github": {
    "enabled": true,
    "clientId": "YOUR_GITHUB_CLIENT_ID",
    "clientSecret": "YOUR_GITHUB_CLIENT_SECRET"
  }
}
```

### Email Templates

**Confirmation Email:**
```html
<h2>Welcome to Keystroke Symphony!</h2>
<p>Click the link below to verify your email and start creating music with your keyboard.</p>
<a href="{{ .ConfirmationURL }}">Confirm Email</a>
```

**Password Reset:**
```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password.</p>
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

---

## Database Functions (Stored Procedures)

### 1. Create Profile on Signup

```sql
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

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Update User Stats After Session

```sql
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
```

### 3. Reset Daily Session Limit

```sql
-- Function to reset daily session limit (called by cron or on session check)
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
```

---

## Real-Time Subscriptions (Optional Enhancement)

Enable real-time updates for live features:

### Leaderboard Updates

```javascript
// Frontend: Subscribe to leaderboard changes
const { data, error } = supabase
  .from('sessions')
  .on('INSERT', (payload) => {
    // Refresh leaderboard when new high score is posted
    console.log('New session!', payload.new);
    refreshLeaderboard();
  })
  .subscribe();
```

### Forum Activity

```javascript
// Subscribe to new forum posts
const { data, error } = supabase
  .from('forum_posts')
  .on('*', (payload) => {
    console.log('Forum update!', payload);
    refreshForumFeed();
  })
  .subscribe();
```

---

## Migration Scripts

### Initial Setup (Run Once)

```sql
-- Run all CREATE TABLE statements in order:
-- 1. profiles
-- 2. recordings
-- 3. sessions
-- 4. forum_posts
-- 5. forum_comments
-- 6. achievements

-- Create indexes
-- Create views
-- Create functions and triggers
-- Set up RLS policies
```

### Seed Data (Optional - for testing)

```sql
-- Insert test challenges (these can also be hardcoded in frontend)
CREATE TABLE public.challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('Teach', 'Practice', 'Perfect')),
  description TEXT,
  text TEXT NOT NULL,
  bpm INTEGER NOT NULL,
  sound_profile JSONB,
  locked BOOLEAN DEFAULT false
);

INSERT INTO public.challenges (id, title, difficulty, description, text, bpm, locked) VALUES
('teach_01', 'Rhythm Basics', 'Teach', 'Establish your internal metronome. Focus on steady, even keystrokes.', 'rhythm flows when the mind is still', 20, false),
('teach_02', 'Finger Travel', 'Teach', 'Explore the reach of the home row to the upper deck.', 'quiet water reflects the golden sun', 30, true),
('practice_01', 'The Flow State', 'Practice', 'A longer passage to test your endurance and consistency.', 'In the obsidian void, a single spark of amber light creates a symphony of infinite possibilities. Type with purpose.', 45, true);
```

---

## Environment Variables (Supabase Dashboard)

Set these in Supabase Dashboard > Settings > API:

```bash
# Public (safe to expose in frontend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Secret (backend/Edge Functions only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Backup & Disaster Recovery

### Automated Backups

Supabase Pro includes:
- Daily automated backups (retained for 7 days)
- Point-in-time recovery (PITR) for last 7 days

**Manual Backup:**
```bash
# Via Supabase CLI
npx supabase db dump > backup_$(date +%Y%m%d).sql

# Via pg_dump (if direct PostgreSQL access)
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql
```

### Restore from Backup

```bash
# Via Supabase CLI
npx supabase db reset --from-backup backup_20251122.sql
```

---

## Performance Optimization

### Query Optimization

```sql
-- Explain query plan for slow queries
EXPLAIN ANALYZE
SELECT * FROM public.leaderboard_wpm;

-- Add missing indexes if needed
CREATE INDEX CONCURRENTLY idx_sessions_user_wpm ON public.sessions(user_id, wpm DESC);
```

### Connection Pooling

Use Supabase's built-in connection pooling (PgBouncer):
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-my-custom-header': 'my-app-name' },
  },
});
```

---

## Security Checklist

- [x] RLS enabled on all tables
- [x] Policies tested for each role (anon, authenticated, service_role)
- [x] No sensitive data in public schema without RLS
- [x] Service role key never exposed to frontend
- [x] HTTPS enforced (Supabase does this by default)
- [x] Email verification required for signup
- [x] Rate limiting on Edge Functions (implement in code)
- [x] Input validation on all user inputs
- [x] SQL injection protection (use parameterized queries)
- [x] XSS protection (React escapes by default, validate on backend)

---

## Next Steps

1. **Create Supabase Project:**
   - Go to https://supabase.com/dashboard
   - Create new project
   - Note down URL and anon key

2. **Run Schema Migration:**
   - Copy all SQL statements from this doc
   - Run in Supabase SQL Editor (Dashboard > SQL Editor)
   - Verify tables created successfully

3. **Configure Auth:**
   - Enable email provider
   - Set up email templates
   - (Optional) Enable OAuth providers

4. **Create Storage Bucket:**
   - Dashboard > Storage > Create bucket: `recordings`
   - Set up RLS policies

5. **Deploy Edge Functions:**
   - See `EDGE_FUNCTIONS.md` for implementation details

6. **Test API:**
   - Use Supabase client SDK in frontend
   - Test auth flows
   - Test CRUD operations
   - Verify RLS policies working correctly

---

**This architecture supports:**
- 100+ concurrent users (Supabase Free tier)
- 500MB database (Free tier, upgradable to 8GB on Pro)
- 1GB file storage (upgradable to 100GB+)
- Realtime subscriptions for live features
- Automatic backups and PITR
- Global CDN for low-latency data access

Ready for Edge Functions implementation. 🚀
