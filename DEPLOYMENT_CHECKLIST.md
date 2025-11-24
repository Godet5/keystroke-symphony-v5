# Deployment Checklist - Keystroke Symphony v5

Quick reference checklist for deploying the application.

---

## Prerequisites

- [ ] GitHub account with repo access
- [ ] Cloudflare account
- [ ] Supabase account
- [ ] Stripe account (test mode)
- [ ] Environment variables ready

---

## Option A: Automated Deployment (GitHub Actions)

### One-Time Setup

1. **Add GitHub Secrets** (Settings → Secrets and variables → Actions)
   ```
   CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   SUPABASE_ACCESS_TOKEN=your_supabase_access_token
   SUPABASE_PROJECT_REF=your_project_reference
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   VITE_GEMINI_API_KEY=your_gemini_key
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   STRIPE_PRICE_TIER_1=price_xxx
   STRIPE_PRICE_TIER_2=price_xxx
   ```

2. **Enable GitHub Actions**
   - [ ] Go to Actions tab
   - [ ] Enable workflows if disabled
   - [ ] Workflows will run on every push to master

3. **Monitor Deployments**
   - [ ] Check Actions tab for workflow status
   - [ ] View deployment logs
   - [ ] Get deployment URL from Cloudflare Pages

### Triggering Deployments

- **Automatic**: Push to master branch
- **Manual**: Actions tab → Select workflow → Run workflow

---

## Option B: Manual Deployment (Scripts)

### 1. Frontend Deployment (15 min)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy to Cloudflare Pages
./scripts/deploy-cloudflare.sh
```

**Or via web UI**:
1. Go to https://dash.cloudflare.com/
2. Workers & Pages → Create → Connect Git
3. Select: `Godet5/keystroke-symphony-v5`
4. Build: `npm run build`, Output: `dist`
5. Deploy

### 2. Backend Deployment (30 min)

```bash
# Deploy Supabase
./scripts/deploy-supabase.sh
```

**Or via web UI**:
1. Create project at https://supabase.com/dashboard
2. SQL Editor → Run `backend/schema.sql`
3. Edge Functions → Upload from `backend/functions/`

### 3. Stripe Configuration (20 min)

```bash
# Interactive Stripe setup
./scripts/configure-stripe.sh
```

**Or via web UI**:
1. Create 2 products ($4.99, $9.99 monthly)
2. Set up webhook to Supabase
3. Copy API keys and price IDs

---

## Verification Checklist

### Frontend
- [ ] Site loads at Cloudflare Pages URL
- [ ] Module 1 works (PUBLIC access)
- [ ] Tier cycling works (subscription toggle)
- [ ] Community shows "Sign up free" for PUBLIC
- [ ] Recording shows "$4.99" lock

### Backend
- [ ] Database tables created (users, sessions, recordings, subscriptions)
- [ ] RLS policies active
- [ ] All 7 Edge Functions deployed
- [ ] Functions respond to test requests

### Stripe Integration
- [ ] Products created ($4.99, $9.99)
- [ ] Webhook configured and receiving events
- [ ] Test checkout works (test card: 4242 4242 4242 4242)
- [ ] Subscription creates database record

### Environment Variables
- [ ] Cloudflare Pages has all VITE_ variables
- [ ] Supabase has all STRIPE_ secrets
- [ ] Keys match between services

---

## Testing Protocol

### Tier Access Testing

1. **PUBLIC (no account)**
   - ✓ Module 1 accessible
   - ✗ Modules 2+ locked
   - ✗ Community locked
   - ✗ Recording locked

2. **EMAIL_SUBSCRIBER ($0)**
   - ✓ All modules accessible
   - ✓ Community accessible
   - ✗ Recording locked

3. **TIER_1 ($4.99/mo)**
   - ✓ Recording enabled
   - ✓ Download enabled

4. **TIER_2 ($9.99/mo)**
   - ✓ Remix accessible
   - ✓ All features unlocked

### Stripe Testing

Use test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Auth required: `4000 0025 0000 3155`

Test flow:
1. Select tier upgrade
2. Redirects to Stripe Checkout
3. Complete with test card
4. Redirects back to app
5. Features unlock immediately
6. Check database: subscription record created
7. Check Stripe webhook logs: events received

---

## Troubleshooting

### Build Fails
- Check node version (18+)
- Clear node_modules: `rm -rf node_modules && npm install`
- Check environment variables are set

### Functions Not Deploying
- Verify Supabase CLI linked: `supabase projects list`
- Check function syntax errors
- Verify secrets are set: `supabase secrets list`

### Stripe Webhook Not Firing
- Verify webhook URL correct
- Check webhook secret matches
- Test with Stripe CLI: `stripe listen --forward-to [URL]`
- Check function logs in Supabase

### Environment Variables Not Working
- Cloudflare: Must start with `VITE_` for frontend
- Supabase: No prefix, set as secrets
- Restart services after updating variables

---

## Production Readiness

Before going live:

- [ ] Switch Stripe to live mode
- [ ] Update all Stripe keys (live, not test)
- [ ] Set up custom domain in Cloudflare
- [ ] Enable SSL/TLS (auto with Cloudflare)
- [ ] Add terms of service page
- [ ] Add privacy policy page
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure rate limiting
- [ ] Enable Supabase backups
- [ ] Test payment failure flows
- [ ] Load testing (optional)

---

## Quick Reference

### Useful Commands

```bash
# Check deployment status
gh run list

# View latest deployment
gh run view --web

# Supabase functions status
supabase functions list

# Stripe webhook testing
stripe listen --forward-to https://xxx.supabase.co/functions/v1/stripe-webhook

# Cloudflare Pages logs
wrangler pages deployment list --project-name keystroke-symphony-v5
```

### Important URLs

- **GitHub Repo**: https://github.com/Godet5/keystroke-symphony-v5
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Stripe Dashboard**: https://dashboard.stripe.com/test

---

**Status**: Ready for deployment
**Deployment Methods**: GitHub Actions (automated) OR Manual scripts
**Estimated Time**: 2 hours (manual) OR 30 min (automated after setup)
