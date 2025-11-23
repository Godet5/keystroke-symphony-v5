# Keystroke Symphony v5 - Deployment Guide

**Status**: Frontend complete, ready for production deployment
**Last Updated**: 2025-11-23
**Repository**: https://github.com/Godet5/keystroke-symphony-v5

---

## Quick Deploy Checklist

- [ ] Deploy frontend to Cloudflare Pages
- [ ] Create Supabase project and deploy schema
- [ ] Deploy 7 Supabase Edge Functions
- [ ] Configure Stripe products and webhooks
- [ ] Update environment variables
- [ ] End-to-end testing

---

## Step 1: Deploy Frontend to Cloudflare Pages (15 min)

### Via Web Dashboard (Recommended)

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. Select **GitHub** and authorize Cloudflare to access your repositories
4. Select repository: `Godet5/keystroke-symphony-v5`
5. Configure build settings:
   - **Production branch**: `master`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave empty)

6. Add environment variables (click "Add variable"):
   ```
   VITE_GEMINI_API_KEY=placeholder_for_now
   ```
   *(We'll add Supabase and Stripe keys after backend setup)*

7. Click **Save and Deploy**
8. Wait 2-3 minutes for build to complete
9. Copy your deployment URL (e.g., `https://keystroke-symphony-v5.pages.dev`)

### Verify Deployment

- Visit the URL and verify Module 1 works (PUBLIC access)
- Test tier cycling: Click subscription toggle in header
- Confirm paywalls show for:
  - Community (requires EMAIL_SUBSCRIBER)
  - Modules 2+ (requires EMAIL_SUBSCRIBER)
  - Recording toggle (requires TIER_1)

---

## Step 2: Create Supabase Project (30 min)

### Create Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Configure:
   - **Organization**: Your organization
   - **Name**: `keystroke-symphony-v5`
   - **Database Password**: Generate strong password (SAVE THIS!)
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
   - **Pricing Plan**: Free tier is fine for development

4. Click **Create new project**
5. Wait 2-3 minutes for provisioning

### Deploy Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy entire contents of `backend/schema.sql` from your repository
4. Paste into SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Verify no errors in output

Expected tables created:
- `users` (with RLS policies)
- `sessions` (with RLS policies)
- `recordings` (with RLS policies)
- `subscriptions` (with RLS policies)

### Get API Keys

1. Go to **Settings** → **API**
2. Copy the following (you'll need these):
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public** key: `eyJhbGc...` (safe to expose in frontend)
   - **service_role** key: `eyJhbGc...` (KEEP SECRET - backend only)

---

## Step 3: Deploy Supabase Edge Functions (20 min)

### Install Supabase CLI

```bash
npm install -g supabase
```

If this fails on Termux (ARM64 issues), use Docker or deploy via web:
- Go to **Edge Functions** in Supabase dashboard
- Upload each function manually

### Link to Project

```bash
cd ~/keystroke-symphony5-review/backend
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

*(Project ref is in your Project URL: `https://YOUR_PROJECT_REF.supabase.co`)*

### Deploy All Functions

```bash
# Deploy each function
supabase functions deploy analyze-performance
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy generate-song
supabase functions deploy recordings
supabase functions deploy sessions
supabase functions deploy stripe-webhook
```

### Set Function Secrets

```bash
# Stripe keys (get from Stripe dashboard - Step 4)
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# Gemini API key (if using AI features)
supabase secrets set GEMINI_API_KEY=your_gemini_key
```

### Verify Functions

```bash
supabase functions list
```

You should see all 7 functions listed.

---

## Step 4: Configure Stripe (20 min)

### Create Products

1. Go to https://dashboard.stripe.com/test/products
2. Click **Add product**

**Product 1: Keystroke Symphony Base**
- Name: `Keystroke Symphony Base`
- Description: `Recording, Download, Early Access`
- Pricing:
  - Model: **Recurring**
  - Price: **$4.99 USD**
  - Billing period: **Monthly**
- Click **Save product**
- Copy the **Price ID** (starts with `price_xxx`)

**Product 2: Keystroke Symphony Premium**
- Name: `Keystroke Symphony Premium`
- Description: `Remix, All Modules, 30min Consultation (1x/month)`
- Pricing:
  - Model: **Recurring**
  - Price: **$9.99 USD**
  - Billing period: **Monthly**
- Click **Save product**
- Copy the **Price ID** (starts with `price_xxx`)

### Configure Webhook

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Configure:
   - **Endpoint URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
   - **Description**: `Keystroke Symphony subscription updates`
   - **Events to send**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_xxx`)

### Get API Keys

1. Go to **Developers** → **API keys**
2. Copy:
   - **Publishable key**: `pk_test_xxx` (frontend)
   - **Secret key**: `sk_test_xxx` (backend - KEEP SECRET)

### Update Supabase Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_PRICE_TIER_1=price_xxx  # $4.99 product
supabase secrets set STRIPE_PRICE_TIER_2=price_xxx  # $9.99 product
```

---

## Step 5: Update Environment Variables (10 min)

### Cloudflare Pages

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Environment variables**
3. Add the following (Production environment):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_GEMINI_API_KEY=your_gemini_key_if_using_ai
```

4. Click **Save**
5. Go to **Deployments** and click **Retry deployment** to rebuild with new env vars
6. Wait 2-3 minutes for redeployment

### Local Development (Optional)

Create `.env.local` in project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_GEMINI_API_KEY=your_gemini_key
```

---

## Step 6: End-to-End Testing (15 min)

### Test Public Access (No Account)

1. Visit your Cloudflare Pages URL in **incognito mode**
2. Verify:
   - ✅ Module 1 "Rhythm Basics" is accessible
   - ✅ Modules 2-5 show lock icon
   - ✅ Community shows "Sign up free" message
   - ✅ Studio shows lock icon
   - ✅ Recording toggle shows "$4.99" lock

### Test EMAIL_SUBSCRIBER (Free Account)

1. Open browser console
2. Cycle tier by clicking subscription toggle → Select "EMAIL"
3. Verify:
   - ✅ Modules 2-5 are now accessible
   - ✅ Community is accessible (can view posts)
   - ✅ Studio is accessible
   - ✅ Recording toggle still shows "$4.99" lock

### Test TIER_1 ($4.99 Subscription)

1. Cycle tier to "TIER_1"
2. Verify:
   - ✅ Recording toggle is now enabled
   - ✅ Can record typing sessions
   - ✅ Recordings save to localStorage
   - ✅ Can download recordings

### Test TIER_2 ($9.99 Subscription)

1. Cycle tier to "TIER_2"
2. Verify:
   - ✅ Remix feature is accessible
   - ✅ All modules available
   - ✅ Full feature access

### Test Stripe Checkout (Real Payment Flow)

**WARNING**: Use Stripe test mode cards only!

1. Click subscription toggle → Select upgrade option
2. Should redirect to Stripe Checkout
3. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
4. Complete checkout
5. Should redirect back to app with subscription active
6. Verify features unlocked based on tier

**Test Card Numbers**:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

### Test Stripe Webhook

1. Complete a test checkout (as above)
2. Check Supabase **Table Editor** → `subscriptions`
3. Verify new row created with:
   - `user_id` matches authenticated user
   - `stripe_subscription_id` populated
   - `tier` matches purchased plan
   - `status = 'active'`

### Test Edge Functions

Use curl or Postman:

```bash
# Test sessions endpoint
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/sessions \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"wpm": 65, "accuracy": 95, "duration": 120}'

# Test recordings endpoint
curl -X GET https://YOUR_PROJECT_REF.supabase.co/functions/v1/recordings \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected: 200 OK responses with JSON data.

---

## Troubleshooting

### Build Fails on Cloudflare Pages

**Error**: "Command not found: npm"
**Fix**: Cloudflare auto-detects Node.js. If it fails, add build config:
- Framework preset: **Vite**
- Node version: **18** (or latest LTS)

**Error**: "Module not found: @supabase/supabase-js"
**Fix**: Ensure `package.json` includes all dependencies. Run `npm install` locally to verify.

### Supabase Schema Errors

**Error**: "relation 'users' already exists"
**Fix**: Drop existing tables first:
```sql
DROP TABLE IF EXISTS subscriptions, recordings, sessions, users CASCADE;
```
Then re-run schema.sql.

**Error**: "Row-level security is not enabled"
**Fix**: RLS is defined in schema.sql. Verify all tables have `ENABLE ROW LEVEL SECURITY` statements.

### Stripe Webhook Not Firing

1. Check webhook URL is correct: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
2. Verify webhook secret is set: `supabase secrets list`
3. Check Stripe dashboard → Webhooks → Your endpoint → **Attempts** tab for errors
4. Test with Stripe CLI:
   ```bash
   stripe trigger checkout.session.completed
   ```

### Edge Functions Not Deploying

**Error**: "Failed to deploy: unauthorized"
**Fix**: Re-link project: `supabase link --project-ref xxx`

**Error**: "Module not found: stripe"
**Fix**: Add `import_map.json` to `backend/functions/` with Deno dependencies (see Supabase docs).

---

## Production Checklist

Before going live:

- [ ] Switch Stripe to **live mode** (not test mode)
- [ ] Update Stripe keys in Supabase secrets and Cloudflare env vars
- [ ] Set up custom domain in Cloudflare Pages
- [ ] Enable SSL/TLS (auto-configured by Cloudflare)
- [ ] Update webhook URLs to use production domain
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Configure rate limiting on Edge Functions
- [ ] Enable Supabase backups (auto-enabled on paid plans)
- [ ] Add terms of service and privacy policy pages
- [ ] Set up email notifications for failed payments (Stripe)
- [ ] Test payment failure flows (card declines, expired cards)

---

## Cost Estimates

**Monthly Operating Costs** (estimated):

| Service | Plan | Cost |
|---------|------|------|
| Cloudflare Pages | Free (500 builds/mo) | $0 |
| Supabase | Free (500MB DB, 2GB bandwidth) | $0 |
| Stripe | 2.9% + $0.30 per transaction | Variable |
| Custom Domain (optional) | Cloudflare Registrar | ~$10/year |

**Scaling Costs**:
- Supabase Pro: $25/mo (8GB DB, 250GB bandwidth)
- Cloudflare Pages Pro: $20/mo (unlimited builds)

**Total for starting**: **$0/month** (using free tiers)

---

## Next Steps

1. **Deploy frontend** (Step 1) - Get live URL
2. **Set up backend** (Steps 2-3) - Database + Edge Functions
3. **Configure payments** (Step 4) - Stripe integration
4. **Update env vars** (Step 5) - Connect all services
5. **Test thoroughly** (Step 6) - Verify all features work
6. **Go live** - Share URL, monitor usage, iterate

---

## Support Resources

- **Cloudflare Pages**: https://developers.cloudflare.com/pages/
- **Supabase Docs**: https://supabase.com/docs
- **Stripe Testing**: https://stripe.com/docs/testing
- **GitHub Repo**: https://github.com/Godet5/keystroke-symphony-v5
- **Issues**: https://github.com/Godet5/keystroke-symphony-v5/issues

---

**Deployment Status**: ✅ Frontend Ready | ⏳ Backend Pending | ⏳ Payment Integration Pending

Good luck with your deployment! 🚀
