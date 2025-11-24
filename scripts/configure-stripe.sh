#!/usr/bin/env bash
set -euo pipefail

# Keystroke Symphony v5 - Stripe Configuration Helper
# This script helps configure Stripe products and webhooks

echo "💳 Keystroke Symphony v5 - Stripe Configuration"
echo "================================================"
echo ""

# Check if stripe CLI is installed
STRIPE_CLI_AVAILABLE=false
if command -v stripe &> /dev/null; then
    STRIPE_CLI_AVAILABLE=true
    echo "✅ Stripe CLI found"
else
    echo "⚠️  Stripe CLI not found (optional)"
    echo "You can still configure via web UI: https://dashboard.stripe.com/"
fi

echo ""
echo "This script will guide you through Stripe configuration."
echo "You'll need to create 2 products and configure a webhook."
echo ""

read -p "Continue? (y/n): " CONTINUE
if [ "$CONTINUE" != "y" ]; then
    exit 0
fi

# Step 1: Create Products
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Create Stripe Products"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Go to: https://dashboard.stripe.com/test/products"
echo ""
echo "Create Product 1: Keystroke Symphony Base"
echo "  - Name: Keystroke Symphony Base"
echo "  - Description: Recording, Download, Early Access"
echo "  - Price: \$4.99 USD monthly recurring"
echo ""
echo "Create Product 2: Keystroke Symphony Premium"
echo "  - Name: Keystroke Symphony Premium"
echo "  - Description: Remix, All Modules, 30min Consultation (1x/month)"
echo "  - Price: \$9.99 USD monthly recurring"
echo ""

read -p "Press Enter when products are created..."

echo ""
read -p "Enter TIER_1 Price ID (starts with price_): " TIER_1_PRICE_ID
read -p "Enter TIER_2 Price ID (starts with price_): " TIER_2_PRICE_ID

if [ -z "$TIER_1_PRICE_ID" ] || [ -z "$TIER_2_PRICE_ID" ]; then
    echo "❌ Error: Both price IDs are required"
    exit 1
fi

echo ""
echo "✅ Price IDs saved"

# Step 2: Configure Webhook
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Configure Webhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Enter your Supabase project reference (e.g., abcdefghijklmnop): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Project reference is required"
    exit 1
fi

WEBHOOK_URL="https://$PROJECT_REF.supabase.co/functions/v1/stripe-webhook"

echo ""
echo "Go to: https://dashboard.stripe.com/test/webhooks"
echo ""
echo "Click 'Add endpoint' and use:"
echo "  Endpoint URL: $WEBHOOK_URL"
echo ""
echo "Select these events:"
echo "  ✓ checkout.session.completed"
echo "  ✓ customer.subscription.created"
echo "  ✓ customer.subscription.updated"
echo "  ✓ customer.subscription.deleted"
echo "  ✓ invoice.payment_succeeded"
echo "  ✓ invoice.payment_failed"
echo ""

read -p "Press Enter when webhook is created..."

echo ""
read -p "Enter Webhook Signing Secret (starts with whsec_): " WEBHOOK_SECRET

if [ -z "$WEBHOOK_SECRET" ]; then
    echo "❌ Error: Webhook secret is required"
    exit 1
fi

echo ""
echo "✅ Webhook configured"

# Step 3: Get API Keys
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Get API Keys"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Go to: https://dashboard.stripe.com/test/apikeys"
echo ""

read -p "Enter Publishable Key (starts with pk_test_): " PUBLISHABLE_KEY
read -p "Enter Secret Key (starts with sk_test_): " SECRET_KEY

if [ -z "$PUBLISHABLE_KEY" ] || [ -z "$SECRET_KEY" ]; then
    echo "❌ Error: Both API keys are required"
    exit 1
fi

echo ""
echo "✅ API keys saved"

# Step 4: Generate configuration
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Configuration Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CONFIG_FILE="stripe-config.env"

cat > "$CONFIG_FILE" << EOF
# Stripe Configuration
# Generated: $(date)

# Frontend (Cloudflare Pages)
VITE_STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY

# Backend (Supabase Secrets)
STRIPE_SECRET_KEY=$SECRET_KEY
STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET
STRIPE_PRICE_TIER_1=$TIER_1_PRICE_ID
STRIPE_PRICE_TIER_2=$TIER_2_PRICE_ID

# Webhook URL
STRIPE_WEBHOOK_URL=$WEBHOOK_URL
EOF

echo "Configuration saved to: $CONFIG_FILE"
echo ""
echo "Next steps:"
echo ""
echo "1. Add to Cloudflare Pages environment variables:"
echo "   VITE_STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY"
echo ""
echo "2. Add to Supabase secrets:"
if command -v supabase &> /dev/null; then
    echo "   Run: supabase secrets set \\"
    echo "     STRIPE_SECRET_KEY=\"$SECRET_KEY\" \\"
    echo "     STRIPE_WEBHOOK_SECRET=\"$WEBHOOK_SECRET\" \\"
    echo "     STRIPE_PRICE_TIER_1=\"$TIER_1_PRICE_ID\" \\"
    echo "     STRIPE_PRICE_TIER_2=\"$TIER_2_PRICE_ID\""
else
    echo "   Or set manually in Supabase dashboard"
fi
echo ""
echo "3. Test webhook with Stripe CLI:"
echo "   stripe listen --forward-to $WEBHOOK_URL"
echo ""

echo "✅ Stripe configuration complete!"
echo ""
echo "⚠️  IMPORTANT: Keep $CONFIG_FILE secure! It contains sensitive keys."
echo "   Add to .gitignore: echo '$CONFIG_FILE' >> .gitignore"
