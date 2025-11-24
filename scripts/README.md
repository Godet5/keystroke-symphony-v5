# Deployment Scripts

Manual deployment scripts for Keystroke Symphony v5.

## Available Scripts

### `deploy-cloudflare.sh`
Deploys the frontend to Cloudflare Pages using Wrangler CLI.

**Requirements**:
- Wrangler CLI installed (`npm install -g wrangler`)
- Logged in to Cloudflare (`wrangler login`)

**Usage**:
```bash
./scripts/deploy-cloudflare.sh
```

---

### `deploy-supabase.sh`
Deploys database schema and Edge Functions to Supabase.

**Requirements**:
- Supabase CLI installed (`npm install -g supabase`)
- Logged in to Supabase (`supabase login`)

**Usage**:
```bash
./scripts/deploy-supabase.sh
```

**What it does**:
1. Links to your Supabase project
2. Deploys database schema (optional)
3. Deploys all 7 Edge Functions
4. Sets function secrets (optional)

---

### `configure-stripe.sh`
Interactive setup for Stripe products, webhooks, and API keys.

**Requirements**:
- Stripe account (test mode)
- Supabase project reference

**Usage**:
```bash
./scripts/configure-stripe.sh
```

**What it does**:
1. Guides you through creating 2 products ($4.99, $9.99)
2. Configures webhook to Supabase
3. Collects API keys
4. Generates `stripe-config.env` with all settings

---

## Quick Start

1. **Make scripts executable** (already done):
   ```bash
   chmod +x scripts/*.sh
   ```

2. **Deploy in order**:
   ```bash
   # 1. Frontend
   ./scripts/deploy-cloudflare.sh

   # 2. Backend
   ./scripts/deploy-supabase.sh

   # 3. Stripe
   ./scripts/configure-stripe.sh
   ```

3. **Update environment variables**:
   - Cloudflare Pages: Add `VITE_*` variables
   - Supabase: Set secrets from `stripe-config.env`

---

## Alternative: GitHub Actions

For automated deployment, use GitHub Actions workflows instead:
- `.github/workflows/deploy.yml` - Cloudflare Pages
- `.github/workflows/deploy-supabase.yml` - Supabase Edge Functions

See `DEPLOYMENT_CHECKLIST.md` for setup instructions.

---

## Troubleshooting

### Script won't run
```bash
# Make executable
chmod +x scripts/*.sh

# Check for Windows line endings
dos2unix scripts/*.sh  # if available
```

### Wrangler not found
```bash
npm install -g wrangler
wrangler login
```

### Supabase CLI not found
```bash
npm install -g supabase
supabase login
```

### Permission denied
```bash
# Run with bash explicitly
bash scripts/deploy-cloudflare.sh
```

---

## Security Notes

- Never commit `stripe-config.env` to git
- Keep API keys and secrets secure
- Use test mode for development
- Switch to live mode only for production

---

**See also**: `DEPLOYMENT_GUIDE.md` and `DEPLOYMENT_CHECKLIST.md`
