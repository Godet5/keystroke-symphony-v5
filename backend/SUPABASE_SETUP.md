# Supabase Setup Guide - Keystroke Symphony v5

**Version:** 1.0
**Last Updated:** 2025-11-23
**Estimated Time:** 30 minutes

---

## Overview

This guide walks you through setting up a Supabase project for Keystroke Symphony, including:
- Creating a Supabase account and project
- Obtaining API keys
- Configuring environment variables
- Preparing for database migration

---

## Prerequisites

- Email address for Supabase account
- GitHub account (optional, for OAuth login)
- Basic understanding of PostgreSQL

---

## Step 1: Create Supabase Account

1. Navigate to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up using one of these methods:
   - Email/Password
   - GitHub OAuth (recommended for developers)
   - GitLab OAuth
   - Bitbucket OAuth

4. Verify your email address if using email/password signup

---

## Step 2: Create New Project

1. Once logged in, you'll see the Supabase Dashboard
2. Click **"New Project"** (or **"+ New project"**)
3. Fill in project details:

   **Organization:**
   - Select existing organization or create new one
   - Organization name: `DGF-Creations` (or your organization name)

   **Project Settings:**
   - **Name:** `keystroke-symphony` (or `keystroke-symphony-prod`)
   - **Database Password:** Generate a strong password (SAVE THIS!)
     - Click the "Generate" button for a secure random password
     - Store in password manager (1Password, LastPass, etc.)
   - **Region:** Select closest to your target users
     - US East (North Virginia) - `us-east-1` (recommended for US users)
     - EU West (Ireland) - `eu-west-1` (recommended for EU users)
     - Southeast Asia (Singapore) - `ap-southeast-1` (for Asia-Pacific)
   - **Pricing Plan:** Free (sufficient for MVP, upgrade later)

4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning to complete

---

## Step 3: Get API Keys

Once your project is ready:

1. In the left sidebar, click **"Settings"** (gear icon)
2. Navigate to **"API"** section
3. You'll see two important sections:

### Project API Keys

**SUPABASE_URL:**
```
https://your-project-ref.supabase.co
```
- Example: `https://abcdefghijklmnop.supabase.co`
- This is your unique project URL
- **Copy this value**

**anon public (SUPABASE_ANON_KEY):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMzg5MzI0NSwiZXhwIjoxOTM5NDY5MjQ1fQ.abc123xyz
```
- This is a JWT token for client-side use
- Safe to expose in frontend code (protected by RLS policies)
- **Copy this value**

**service_role secret (SUPABASE_SERVICE_ROLE_KEY):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjIzODkzMjQ1LCJleHAiOjE5Mzk0NjkyNDV9.xyz789abc
```
- This is a privileged token that bypasses RLS policies
- **NEVER expose in frontend code**
- Only use in Edge Functions and backend services
- **Copy this value** (you'll need it for Edge Functions)

---

## Step 4: Configure Environment Variables

### For Local Development

Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# DO NOT commit this file to Git!
```

**Important:**
- Replace `your-project-ref` with your actual project reference
- Replace `your-anon-key-here` with the anon public key
- Add `.env.local` to `.gitignore` (should already be there)

### For Edge Functions (Supabase Secrets)

You'll set these later when deploying Edge Functions:

```bash
# These will be set in Supabase Dashboard > Edge Functions > Manage Secrets
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
GEMINI_API_KEY=your-gemini-api-key-here
STRIPE_SECRET_KEY=your-stripe-secret-key-here
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret-here
```

---

## Step 5: Verify Setup

1. In Supabase Dashboard, click **"SQL Editor"** in the left sidebar
2. Run a test query to verify database is accessible:

```sql
SELECT NOW();
```

3. You should see the current timestamp returned
4. If successful, your database is ready!

---

## Step 6: Configure Authentication Providers

1. In the left sidebar, navigate to **"Authentication" > "Providers"**
2. Enable Email provider (should be enabled by default)
3. Configure settings:

   **Email Auth:**
   - ✅ Enable Email provider
   - ✅ Confirm email (recommended for production)
   - ❌ Secure email change (optional, can enable later)
   - ❌ Secure password change (optional, can enable later)

4. Scroll down to **Site URL** settings:
   - **Site URL:** `http://localhost:3000` (for local dev)
   - **Redirect URLs:** Add these URLs (one per line):
     ```
     http://localhost:3000/**
     https://keystroke-symphony.pages.dev/**
     https://yourdomain.com/**
     ```
   - This allows auth redirects from these domains

5. Click **"Save"**

### Optional: Enable OAuth Providers

If you want Google/GitHub login:

1. Scroll to **"Auth Providers"** section
2. Click **"Google"** or **"GitHub"**
3. Follow the setup wizard (requires creating OAuth apps in Google/GitHub)
4. For now, email/password is sufficient

---

## Step 7: Customize Email Templates (Optional)

1. Navigate to **"Authentication" > "Email Templates"**
2. Customize these templates to match your brand:

   **Confirm signup:**
   ```html
   <h2>Welcome to Keystroke Symphony!</h2>
   <p>Click the link below to verify your email and start creating music with your keyboard.</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
   ```

   **Reset password:**
   ```html
   <h2>Reset Your Password</h2>
   <p>Click the link below to reset your password for Keystroke Symphony.</p>
   <p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
   ```

3. Click **"Save"** for each template

---

## Step 8: Enable Realtime (Optional)

Keystroke Symphony can use realtime subscriptions for live leaderboard updates:

1. Navigate to **"Database" > "Replication"**
2. Enable replication for these tables (do this AFTER running migrations):
   - `sessions` (for live leaderboard updates)
   - `forum_posts` (for live forum feed)
   - `forum_comments` (for live comment threads)

For now, skip this step. You can enable it later.

---

## Step 9: Create Storage Bucket

1. In the left sidebar, navigate to **"Storage"**
2. Click **"Create a new bucket"**
3. Configure bucket:
   - **Name:** `recordings`
   - **Public bucket:** ❌ Unchecked (private bucket, requires auth)
   - **File size limit:** 50 MB (adjust as needed)
   - **Allowed MIME types:** `video/webm,video/mp4` (for recording videos)

4. Click **"Create bucket"**
5. The bucket is now ready for storage policies (added during migration)

---

## Step 10: Install Supabase CLI (Optional, for advanced users)

The Supabase CLI is useful for local development and migrations:

```bash
# Install via npm
npm install -g supabase

# Or via Homebrew (macOS/Linux)
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Test connection
supabase db remote commit
```

For most users, the web dashboard is sufficient.

---

## Environment Variables Summary

After completing this setup, you should have these values:

### Public (Safe to expose in frontend)
- `VITE_SUPABASE_URL`: `https://your-project-ref.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `eyJhbGc...` (long JWT token)

### Secret (Backend/Edge Functions only)
- `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGc...` (different JWT token)
- Database Password: (stored in password manager, rarely needed)

### To be added later (from other agents)
- `GEMINI_API_KEY`: From Google AI Studio
- `STRIPE_SECRET_KEY`: From Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET`: From Stripe webhook setup
- `VITE_SENTRY_DSN`: From Sentry.io (optional, for error tracking)

---

## Next Steps

✅ Supabase project created
✅ API keys obtained
✅ Environment variables configured
✅ Auth providers enabled
✅ Storage bucket created

**Now proceed to:**
1. **Run database migration:** See `migrations/001_initial_schema.sql`
2. **Deploy Edge Functions:** See `EDGE_FUNCTIONS_DEPLOY.md`
3. **Test API:** See `API_REFERENCE.md`

---

## Troubleshooting

### Issue: "Invalid API key" error

**Solution:**
- Verify you copied the full anon key (it's very long, ~200+ characters)
- Check for extra spaces or line breaks when copying
- Ensure `VITE_SUPABASE_URL` matches your project URL exactly

### Issue: "Project not found"

**Solution:**
- Wait 2-3 minutes after project creation
- Refresh the Supabase Dashboard
- Check project status in organization overview

### Issue: Can't access SQL Editor

**Solution:**
- Ensure project provisioning is complete (100%)
- Check internet connection
- Try a different browser (Chrome recommended)

### Issue: Auth emails not sending

**Solution:**
- Check spam folder
- Verify email provider is enabled
- For custom domains, configure SMTP settings
- Test with a different email address

---

## Security Best Practices

- ✅ **Never** commit `.env.local` to Git
- ✅ **Never** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- ✅ Always use Row Level Security (RLS) policies
- ✅ Enable email confirmation for production
- ✅ Use strong database passwords (20+ characters)
- ✅ Rotate API keys if compromised
- ✅ Enable two-factor authentication on your Supabase account

---

## Resources

- **Supabase Documentation:** https://supabase.com/docs
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Supabase Status:** https://status.supabase.com
- **Community Support:** https://discord.supabase.com

---

**Setup complete!** 🚀 You're now ready to run the database migration.
