#!/bin/bash
# Deploy Web App to Vercel

set -e

# Configuration - UPDATE THIS!
API_URL="https://your-api-xxxxx.run.app"  # From Cloud Run deployment

echo "🚀 Deploying Shelby RAG Web to Vercel..."
echo "   API URL: $API_URL"
echo ""

cd "$(dirname "$0")/../apps/web"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Set environment variable
echo "⚙️  Setting environment variables..."
vercel env add NEXT_PUBLIC_API_URL production <<EOF
$API_URL
EOF

echo ""
echo "🌐 Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📌 Next steps:"
echo "   1. Get your Vercel URL from output above"
echo "   2. Update CORS_ORIGIN in Cloud Run"
echo "   3. Redeploy API with new CORS_ORIGIN"
echo ""
echo "🔄 To update CORS:"
echo "   gcloud run services update shelby-rag-api \\"
echo "     --update-env-vars CORS_ORIGIN=https://your-app.vercel.app \\"
echo "     --region us-central1"

