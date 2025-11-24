#!/usr/bin/env bash
set -euo pipefail

# Keystroke Symphony v5 - Manual Cloudflare Pages Deployment
# This script deploys the frontend to Cloudflare Pages using Wrangler CLI

echo "🚀 Keystroke Symphony v5 - Cloudflare Pages Deployment"
echo "========================================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: Wrangler CLI not found"
    echo "Install with: npm install -g wrangler"
    echo "Or use the web UI: https://dash.cloudflare.com/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Run this script from the project root directory"
    exit 1
fi

# Check environment variables
echo "Checking environment variables..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local found"
    source .env.local
else
    echo "⚠️  Warning: .env.local not found"
    echo "Make sure environment variables are set"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci

# Build project
echo ""
echo "🔨 Building project..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist/ directory not found"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Deploy to Cloudflare Pages
echo "📤 Deploying to Cloudflare Pages..."
echo ""

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Not logged in. Running wrangler login..."
    wrangler login
fi

# Deploy
wrangler pages deploy dist \
    --project-name=keystroke-symphony-v5 \
    --branch=master \
    --commit-dirty=true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Visit https://dash.cloudflare.com/ to see your deployment"
echo "2. Configure environment variables in Cloudflare Pages settings"
echo "3. Set up custom domain (optional)"
