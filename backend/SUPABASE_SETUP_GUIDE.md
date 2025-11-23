# Supabase Setup Guide - Keystroke Symphony v5

**Version:** 1.0
**Last Updated:** 2025-11-22
**Estimated Time:** 2 hours
**Prerequisites:** None (we'll create everything from scratch)

---

## Overview

This guide walks you through setting up a complete Supabase backend for Keystroke Symphony, including:
- Creating a new Supabase project
- Configuring authentication
- Running database migrations
- Setting up storage buckets
- Deploying Edge Functions
- Obtaining API keys for frontend integration

---

## Step 1: Create Supabase Account & Project (15 minutes)

### 1.1 Sign Up for Supabase

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Verify your email address

### 1.2 Create New Project

1. Once logged in, click "New Project"
2. Fill in project details:
   - **Organization:** Create new or select existing
   - **Name:** `keystroke-symphony` (or your preferred name)
   - **Database Password:** Generate a strong password (save it securely!)
   - **Region:** Select closest to your target users:
     - US East (North Virginia) - `us-east-1`
     - US West (Oregon) - `us-west-2`
     - Europe (Frankfurt) - `eu-central-1`
     - Asia Pacific (Singapore) - `ap-southeast-1`
   - **Pricing Plan:** Free (for development), Pro (for production)

3. Click "Create new project"
4. Wait 2-3 minutes for project provisioning

### 1.3 Collect API Keys

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar) → **API**
2. Copy these values to a secure location:

```bash
# Project URL
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co

# Anon/Public Key (safe to use in frontend)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key (SECRET - backend only!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANT:**
- The **anon key** is safe to expose in your frontend code
- The **service role key** bypasses Row Level Security - NEVER expose it to clients!
- Store the service role key in environment variables only

---

## Step 2: Configure Authentication (20 minutes)

### 2.1 Enable Email/Password Authentication

1. Go to **Authentication** → **Providers** in the Supabase Dashboard
2. Email provider should be enabled by default
3. Configure email settings:
   - **Enable email confirmations:** ON (recommended)
   - **Secure email change:** ON
   - **Double confirm email changes:** ON

### 2.2 Configure Email Templates

Go to **Authentication** → **Email Templates**

#### Confirmation Email

Subject: `Confirm Your Email - Keystroke Symphony`

Body:
```html
<h2>Welcome to Keystroke Symphony!</h2>
<p>You're one step away from creating music with your keyboard.</p>
<p>Click the link below to verify your email address:</p>
<p><a href="{{ .ConfirmationURL }}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm Email</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>
<p style="color: #666; font-size: 12px; margin-top: 32px;">
  If the button doesn't work, copy and paste this link into your browser:<br>
  {{ .ConfirmationURL }}
</p>
```

#### Password Reset Email

Subject: `Reset Your Password - Keystroke Symphony`

Body:
```html
<h2>Reset Your Password</h2>
<p>We received a request to reset your password for Keystroke Symphony.</p>
<p>Click the link below to create a new password:</p>
<p><a href="{{ .ConfirmationURL }}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request a password reset, you can safely ignore this email.</p>
<p style="color: #666; font-size: 12px; margin-top: 32px;">
  If the button doesn't work, copy and paste this link into your browser:<br>
  {{ .ConfirmationURL }}
</p>
```

### 2.3 Configure Redirect URLs

Go to **Authentication** → **URL Configuration**

Add these redirect URLs (adjust domains for your deployment):

```
# Local development
http://localhost:3000/*
http://localhost:5173/*

# Production (replace with your domain)
https://keystroke-symphony.pages.dev/*
https://yourdomain.com/*
```

### 2.4 (Optional) Enable OAuth Providers

If you want social login:

#### Google OAuth

1. Go to **Authentication** → **Providers** → **Google**
2. Toggle ON
3. Follow instructions to create OAuth credentials at https://console.cloud.google.com
4. Enter Client ID and Client Secret
5. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`

#### GitHub OAuth

1. Go to **Authentication** → **Providers** → **GitHub**
2. Toggle ON
3. Create OAuth app at https://github.com/settings/developers
4. Enter Client ID and Client Secret
5. Add callback URL: `https://your-project.supabase.co/auth/v1/callback`

---

## Step 3: Create Database Schema (30 minutes)

### 3.1 Open SQL Editor

1. Go to **SQL Editor** in the Supabase Dashboard
2. Click **New Query**

### 3.2 Run Migration Script

Copy the entire contents of `DATABASE_MIGRATION.sql` (provided in this backend folder) and paste into the SQL Editor.

**Or run it in sections:**

1. **First, create the helper function:**
   - Run the `update_updated_at_column()` function

2. **Then create tables in order:**
   - `profiles` (must be first - referenced by other tables)
   - `recordings`
   - `sessions`
   - `forum_posts`
   - `forum_comments`
   - `achievements`

3. **Create views:**
   - `leaderboard_wpm`
   - `leaderboard_accuracy`
   - `leaderboard_weekly`

4. **Create stored procedures:**
   - `handle_new_user()`
   - `update_user_stats_after_session()`
   - `reset_daily_sessions_if_needed()`

5. **Create triggers:**
   - `on_auth_user_created`
   - `trigger_update_user_stats`

Click **RUN** to execute the migration.

### 3.3 Verify Schema

Run this query to verify all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected output:
```
achievements
forum_comments
forum_posts
profiles
recordings
sessions
```

Verify views:

```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';
```

Expected output:
```
leaderboard_accuracy
leaderboard_weekly
leaderboard_wpm
```

### 3.4 Test Row Level Security (RLS)

Create a test user through the Authentication tab, then run:

```sql
-- Test as authenticated user
SET request.jwt.claim.sub = 'user-uuid-here';

-- Should return empty (no data yet)
SELECT * FROM profiles WHERE id = auth.uid();

-- Should work (RLS allows users to view own profile)
SELECT * FROM profiles WHERE id = 'user-uuid-here';
```

---

## Step 4: Create Storage Bucket (15 minutes)

### 4.1 Create Recordings Bucket

1. Go to **Storage** in the Supabase Dashboard
2. Click **New Bucket**
3. Configure:
   - **Name:** `recordings`
   - **Public bucket:** OFF (private - requires authentication)
   - **File size limit:** 50 MB (adjust as needed)
   - **Allowed MIME types:** `video/webm`, `video/mp4`

4. Click **Create bucket**

### 4.2 Set Storage Policies

Go to **Storage** → **Policies** → `recordings` bucket

Click **New Policy** and create these 3 policies:

#### Policy 1: Upload Own Recordings

```sql
CREATE POLICY "Users can upload own recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 2: Read Own Recordings

```sql
CREATE POLICY "Users can read own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 3: Delete Own Recordings

```sql
CREATE POLICY "Users can delete own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 4.3 Test Storage

Upload a test file through the Dashboard:

1. Go to **Storage** → `recordings`
2. Create a folder with a UUID: `00000000-0000-0000-0000-000000000000`
3. Upload a sample `.webm` file
4. Verify you can view/download it

**File path convention:**
```
recordings/{user_id}/{recording_id}.webm
```

---

## Step 5: Configure Environment Variables for Edge Functions (10 minutes)

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add these secrets (they'll be available as environment variables in your Edge Functions):

```bash
GEMINI_API_KEY=your-gemini-api-key-here
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key (from Agent 2)
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret (from Agent 2)
```

**How to get Gemini API Key:**
1. Go to https://ai.google.dev/
2. Click "Get API Key in Google AI Studio"
3. Create a new API key
4. Copy the key and paste it into Supabase secrets

---

## Step 6: Install Supabase CLI (10 minutes)

The CLI is required to deploy Edge Functions.

### 6.1 Install CLI

**macOS/Linux:**
```bash
brew install supabase/tap/supabase
```

**Windows (PowerShell):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**npm (any platform):**
```bash
npm install -g supabase
```

### 6.2 Login to Supabase

```bash
supabase login
```

This will open a browser to authenticate. Follow the prompts.

### 6.3 Link Your Project

```bash
supabase link --project-ref your-project-ref
```

**Find your project ref:**
- Go to **Project Settings** → **General**
- Copy the "Reference ID" (e.g., `xxxxxxxxxxx`)

Enter your database password when prompted.

---

## Step 7: Deploy Edge Functions (30 minutes)

### 7.1 Navigate to Backend Directory

```bash
cd /path/to/keystroke-symphony5-review/backend
```

### 7.2 Deploy Each Function

Deploy all Edge Functions with these commands:

```bash
# 1. Generate Song
supabase functions deploy generate-song --no-verify-jwt

# 2. Analyze Performance
supabase functions deploy analyze-performance

# 3. Recordings (CRUD)
supabase functions deploy recordings

# 4. Sessions (POST)
supabase functions deploy sessions

# 5. Forum (CRUD)
supabase functions deploy forum

# 6. Leaderboards (GET)
supabase functions deploy leaderboards

# 7. Stripe Checkout
supabase functions deploy stripe-checkout

# 8. Stripe Webhook
supabase functions deploy stripe-webhook --no-verify-jwt

# 9. Stripe Portal
supabase functions deploy stripe-portal
```

**Flags explained:**
- `--no-verify-jwt`: Allows unauthenticated access (for public endpoints like webhooks)
- Default behavior: Requires authentication (JWT token)

### 7.3 Verify Deployment

List deployed functions:

```bash
supabase functions list
```

Expected output:
```
analyze-performance
forum
generate-song
leaderboards
recordings
sessions
stripe-checkout
stripe-portal
stripe-webhook
```

### 7.4 Get Function URLs

Your Edge Functions are now accessible at:

```
https://your-project.supabase.co/functions/v1/{function-name}
```

Example:
```
https://xxxxxxxxxxx.supabase.co/functions/v1/generate-song
```

---

## Step 8: Test Edge Functions (20 minutes)

Use the provided test scripts in `TESTING_GUIDE.md` or test manually:

### Test with cURL

#### 1. Generate Song (No Auth Required)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-song \
  -H "Content-Type: application/json" \
  -d '{"theme": "sunset over mountains", "mode": "FREE_PLAY"}'
```

Expected response:
```json
{
  "theme": "sunset over mountains",
  "text": "golden light fades beyond the peaks",
  "mood": "serene",
  "tempo": 85,
  "soundProfile": "warm-dreamy",
  "scale": "C-major-pentatonic",
  "musicalStyle": "ambient"
}
```

#### 2. Create Session (Requires Auth)

First, get an auth token by signing up/logging in through your frontend, then:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "challengeId": null,
    "mode": "FREE_PLAY",
    "theme": "test",
    "wpm": 85,
    "accuracy": 95.5,
    "duration": 60000,
    "mistakes": 3,
    "totalChars": 85,
    "combo": 20,
    "maxCombo": 30
  }'
```

---

## Step 9: Configure CORS (If Needed) (5 minutes)

If you encounter CORS errors when calling Edge Functions from your frontend:

1. Go to **Project Settings** → **API Settings**
2. Add your frontend URL to **CORS allowed origins:**
   - `http://localhost:3000`
   - `http://localhost:5173`
   - `https://your-production-domain.com`

**Note:** Supabase Edge Functions should automatically handle CORS for authenticated requests, but explicit configuration may be needed for public endpoints.

---

## Step 10: Create `.env.local` for Frontend (5 minutes)

Create a `.env.local` file in your frontend project root:

```bash
# Supabase Configuration (from Step 1.3)
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# DO NOT INCLUDE SERVICE_ROLE_KEY IN FRONTEND!
# It's only for backend/Edge Functions
```

**Never commit `.env.local` to Git!** Add it to `.gitignore`.

---

## Step 11: Backup Database (Optional but Recommended) (5 minutes)

Create a backup before making any major changes:

```bash
# Using Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d).sql
```

Or use the Dashboard:
1. Go to **Database** → **Backups**
2. Click **Create Backup**
3. Wait for completion
4. Download backup file

**Restore from backup:**
```bash
supabase db reset --from-backup backup_20251122.sql
```

---

## Troubleshooting

### Issue: "relation does not exist" error

**Cause:** Tables weren't created properly
**Solution:** Re-run the migration script from Step 3.2

### Issue: "permission denied for table X"

**Cause:** RLS is blocking the query
**Solution:** Verify RLS policies are set up correctly. Check if user is authenticated.

### Issue: "Authentication required" on public endpoint

**Cause:** Edge Function requires JWT by default
**Solution:** Redeploy with `--no-verify-jwt` flag

### Issue: Edge Function deployment fails

**Cause:** Missing dependencies or syntax errors
**Solution:**
1. Check function logs: `supabase functions logs function-name`
2. Verify TypeScript syntax
3. Ensure all imports are Deno-compatible

### Issue: Storage upload returns 403 Forbidden

**Cause:** RLS policies not set on storage bucket
**Solution:** Re-create storage policies from Step 4.2

### Issue: Cannot connect to database

**Cause:** IP not whitelisted (if using direct PostgreSQL connection)
**Solution:** Go to **Project Settings** → **Database** → **Connection Pooling** and whitelist your IP

---

## Security Checklist

Before going to production:

- [ ] All RLS policies tested and working
- [ ] Service role key stored securely (not in frontend code)
- [ ] Email verification enabled
- [ ] Strong password requirements enforced
- [ ] Rate limiting implemented in Edge Functions
- [ ] Input validation on all user inputs
- [ ] HTTPS enforced (Supabase does this by default)
- [ ] Webhook signature verification (Stripe)
- [ ] Error messages don't leak sensitive data
- [ ] Database backups automated

---

## Next Steps

1. **Test Authentication:** Sign up a test user and verify email confirmation works
2. **Test Database:** Insert test data and verify RLS policies
3. **Test Storage:** Upload a test video file
4. **Test Edge Functions:** Use the testing guide to verify all endpoints work
5. **Integrate Frontend:** Update your React app to use Supabase client (see Agent 3 tasks)
6. **Monitor Usage:** Set up alerts in Supabase Dashboard for quota limits

---

## Useful Resources

- **Supabase Documentation:** https://supabase.com/docs
- **Edge Functions Guide:** https://supabase.com/docs/guides/functions
- **Row Level Security:** https://supabase.com/docs/guides/auth/row-level-security
- **Supabase CLI Reference:** https://supabase.com/docs/reference/cli
- **Community Discord:** https://discord.supabase.com

---

## Support

If you encounter issues:
1. Check Supabase Dashboard logs (Database → Logs, Edge Functions → Logs)
2. Search Supabase GitHub issues: https://github.com/supabase/supabase/issues
3. Ask in Supabase Discord: https://discord.supabase.com
4. Contact support (Pro plan only): support@supabase.com

---

**Congratulations!** Your Supabase backend is now fully configured and ready for integration with the Keystroke Symphony frontend.

**Estimated Total Time:** ~2 hours
**Next:** Proceed to frontend integration (Agent 3) or Stripe setup (Agent 2)
