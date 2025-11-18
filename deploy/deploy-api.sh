#!/bin/bash
# Deploy API to GCP Cloud Run

set -e

# Configuration - UPDATE THESE!
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
SERVICE_NAME="shelby-rag-api"
CONNECTION_NAME="your-project:us-central1:shelby-rag-db"
CORS_ORIGIN="https://your-app.vercel.app"  # Update after deploying web

echo "🚀 Deploying Shelby RAG API to Cloud Run..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Build and push Docker image
echo "🐳 Building Docker image..."
cd "$(dirname "$0")/.."

gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --timeout=20m \
  apps/api

echo ""
echo "☁️  Deploying to Cloud Run..."

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 60s \
  --max-instances 10 \
  --min-instances 1 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "DATABASE_URL=postgresql://postgres:PASSWORD@/shelby_rag?host=/cloudsql/$CONNECTION_NAME" \
  --set-env-vars "EMBEDDINGS_PROVIDER=openai" \
  --set-env-vars "LLM_PROVIDER=openai" \
  --set-env-vars "LLM_MODEL=gpt-4o-mini" \
  --set-env-vars "CORS_ORIGIN=$CORS_ORIGIN" \
  --set-env-vars "MAX_FILE_BYTES=26214400" \
  --set-env-vars "MAX_FILES_PER_PACK=1000" \
  --set-env-vars "SHELBY_EXPIRATION_DAYS=30" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest" \
  --set-secrets "SHELBY_API_KEY=shelby-api-key:latest" \
  --set-secrets "APTOS_PRIVATE_KEY=aptos-private-key:latest" \
  --set-secrets "SESSION_SECRET=session-secret:latest" \
  --add-cloudsql-instances $CONNECTION_NAME \
  --service-account shelby-rag-api@$PROJECT_ID.iam.gserviceaccount.com

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 API URL: $SERVICE_URL"
echo ""
echo "🧪 Test it:"
echo "   curl $SERVICE_URL/health"
echo ""
echo "📌 Next steps:"
echo "   1. Test API endpoints"
echo "   2. Update CORS_ORIGIN if needed"
echo "   3. Deploy web app to Vercel"
echo "   4. Set NEXT_PUBLIC_API_URL=$SERVICE_URL in Vercel"

