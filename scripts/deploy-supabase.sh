#!/usr/bin/env bash
set -euo pipefail

# Keystroke Symphony v5 - Manual Supabase Deployment
# This script deploys the database schema and Edge Functions to Supabase

echo "🗄️  Keystroke Symphony v5 - Supabase Deployment"
echo "================================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found"
    echo "Install with: npm install -g supabase"
    echo ""
    echo "Alternative: Deploy via web UI"
    echo "1. Go to https://supabase.com/dashboard"
    echo "2. SQL Editor → Run backend/schema.sql"
    echo "3. Edge Functions → Upload from backend/functions/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend/ directory not found"
    echo "Run this script from the project root directory"
    exit 1
fi

# Check if logged in
echo "Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo "🔐 Not logged in. Running supabase login..."
    supabase login
fi

# List projects and prompt for selection
echo ""
echo "Available Supabase projects:"
supabase projects list

echo ""
read -p "Enter your project reference ID (e.g., abcdefghijklmnop): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Project reference ID is required"
    exit 1
fi

# Link project
echo ""
echo "🔗 Linking to Supabase project..."
supabase link --project-ref "$PROJECT_REF"

# Ask if user wants to deploy schema
echo ""
read -p "Deploy database schema? (y/n): " DEPLOY_SCHEMA

if [ "$DEPLOY_SCHEMA" = "y" ]; then
    echo ""
    echo "📊 Deploying database schema..."

    if [ ! -f "backend/schema.sql" ]; then
        echo "❌ Error: backend/schema.sql not found"
        exit 1
    fi

    supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"

    echo "✅ Schema deployed!"
fi

# Deploy Edge Functions
echo ""
echo "⚡ Deploying Edge Functions..."
echo ""

cd backend

FUNCTIONS=(
    "analyze-performance"
    "create-checkout-session"
    "create-portal-session"
    "generate-song"
    "recordings"
    "sessions"
    "stripe-webhook"
)

for func in "${FUNCTIONS[@]}"; do
    if [ -d "functions/$func" ]; then
        echo "Deploying $func..."
        supabase functions deploy "$func" --no-verify-jwt
    else
        echo "⚠️  Warning: functions/$func not found, skipping..."
    fi
done

cd ..

echo ""
echo "✅ Edge Functions deployed!"

# Set secrets
echo ""
read -p "Set function secrets? (y/n): " SET_SECRETS

if [ "$SET_SECRETS" = "y" ]; then
    echo ""
    echo "🔐 Setting function secrets..."
    echo "Enter values (or press Enter to skip):"
    echo ""

    read -p "STRIPE_SECRET_KEY: " STRIPE_SECRET_KEY
    read -p "STRIPE_WEBHOOK_SECRET: " STRIPE_WEBHOOK_SECRET
    read -p "STRIPE_PRICE_TIER_1: " STRIPE_PRICE_TIER_1
    read -p "STRIPE_PRICE_TIER_2: " STRIPE_PRICE_TIER_2
    read -p "GEMINI_API_KEY: " GEMINI_API_KEY

    SECRETS=""
    [ -n "$STRIPE_SECRET_KEY" ] && SECRETS="$SECRETS STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY"
    [ -n "$STRIPE_WEBHOOK_SECRET" ] && SECRETS="$SECRETS STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET"
    [ -n "$STRIPE_PRICE_TIER_1" ] && SECRETS="$SECRETS STRIPE_PRICE_TIER_1=$STRIPE_PRICE_TIER_1"
    [ -n "$STRIPE_PRICE_TIER_2" ] && SECRETS="$SECRETS STRIPE_PRICE_TIER_2=$STRIPE_PRICE_TIER_2"
    [ -n "$GEMINI_API_KEY" ] && SECRETS="$SECRETS GEMINI_API_KEY=$GEMINI_API_KEY"

    if [ -n "$SECRETS" ]; then
        supabase secrets set $SECRETS
        echo "✅ Secrets set!"
    else
        echo "⚠️  No secrets provided, skipping..."
    fi
fi

echo ""
echo "✅ Supabase deployment complete!"
echo ""
echo "Summary:"
supabase functions list
echo ""
echo "Next steps:"
echo "1. Get your API keys: Settings → API"
echo "2. Update Cloudflare environment variables"
echo "3. Test Edge Functions with curl or Postman"
