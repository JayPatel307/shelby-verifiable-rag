#!/bin/bash
# One-Click Deployment Script
# Deploys entire stack to production

set -e

echo "🚀 Shelby RAG - Full Stack Deployment"
echo "======================================"
echo ""

# Check if config exists
if [ ! -f "config.sh" ]; then
    echo "❌ config.sh not found!"
    echo "   Copy config.example.sh to config.sh and fill in your values"
    exit 1
fi

# Load configuration
source config.sh

echo "📋 Configuration loaded:"
echo "   GCP Project: $GCP_PROJECT_ID"
echo "   Region: $GCP_REGION"
echo "   Service: $GCP_SERVICE_NAME"
echo ""

# Confirmation
read -p "🤔 Deploy to production? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment canceled"
    exit 0
fi

echo ""
echo "================================"
echo "Phase 1: Build & Test Locally"
echo "================================"
echo ""

cd ..

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Build all packages
echo "🔨 Building packages..."
pnpm build

# Build Docker image locally for testing
echo "🐳 Building Docker image..."
docker build -t shelby-rag-api-test -f apps/api/Dockerfile .

echo ""
echo "✅ Local build successful!"
echo ""

# Test Docker image
echo "🧪 Testing Docker image..."
docker run -d -p 8080:8080 \
  -e DATABASE_URL=./data.sqlite \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e EMBEDDINGS_PROVIDER=openai \
  -e LLM_PROVIDER=openai \
  --name shelby-test \
  shelby-rag-api-test

sleep 10

# Test health
if curl -f http://localhost:8080/health; then
    echo "✅ Docker image works!"
    docker stop shelby-test
    docker rm shelby-test
else
    echo "❌ Docker image test failed"
    docker logs shelby-test
    docker stop shelby-test
    docker rm shelby-test
    exit 1
fi

echo ""
echo "================================"
echo "Phase 2: Deploy API to Cloud Run"
echo "================================"
echo ""

cd deploy
./deploy-api.sh

# Capture API URL
API_URL=$(gcloud run services describe $GCP_SERVICE_NAME --region=$GCP_REGION --format="value(status.url)")
echo "📝 API URL: $API_URL"

echo ""
echo "================================"
echo "Phase 3: Deploy Web to Vercel"
echo "================================"
echo ""

# Update deploy-web.sh with actual API URL
sed -i.bak "s|API_URL=.*|API_URL=\"$API_URL\"|" deploy-web.sh

./deploy-web.sh

echo ""
echo "================================"
echo "Phase 4: Update CORS"
echo "================================"
echo ""

echo "📝 Please enter your Vercel URL (from deployment above):"
read VERCEL_URL

echo "🔄 Updating CORS..."
gcloud run services update $GCP_SERVICE_NAME \
  --update-env-vars CORS_ORIGIN=$VERCEL_URL \
  --region $GCP_REGION

echo ""
echo "======================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "🌐 Your URLs:"
echo "   API:  $API_URL"
echo "   Web:  $VERCEL_URL"
echo ""
echo "🧪 Test your deployment:"
echo "   1. Open $VERCEL_URL"
echo "   2. Login"
echo "   3. Upload a file"
echo "   4. Ask a question"
echo "   5. Verify a citation"
echo ""
echo "📊 Monitor your deployment:"
echo "   API Logs:  gcloud run services logs read $GCP_SERVICE_NAME --region $GCP_REGION"
echo "   Vercel:    vercel logs"
echo ""
echo "✅ All done! Your app is live! 🚀"

