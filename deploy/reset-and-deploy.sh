#!/bin/bash
set -e

# Load config
source "$(dirname "$0")/config.sh"

echo "🔄 Reset and Deploy DataDock"
echo "================================"
echo ""

# Step 1: Wait for Cloud Build to finish
echo "⏳ Checking Cloud Build status..."
BUILD_ID=$(gcloud builds list --project=$GCP_PROJECT_ID --limit=1 --format="value(id)")
BUILD_STATUS=$(gcloud builds describe $BUILD_ID --project=$GCP_PROJECT_ID --format="value(status)")

if [ "$BUILD_STATUS" != "SUCCESS" ]; then
  echo "⏳ Waiting for build $BUILD_ID to complete..."
  gcloud builds log $BUILD_ID --stream --project=$GCP_PROJECT_ID
fi

echo "✅ Build completed successfully!"
echo ""

# Step 2: Reset Cloud SQL Database (drop all tables)
echo "🗑️  Resetting Cloud SQL database..."
echo "⚠️  This will DELETE ALL DATA in the database!"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 1
fi

gcloud sql connect $CLOUD_SQL_INSTANCE --user=postgres --project=$GCP_PROJECT_ID --quiet <<SQL
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
\q
SQL

echo "✅ Database reset complete!"
echo ""

# Step 3: Deploy API to Cloud Run
echo "🚀 Deploying API to Cloud Run..."
IMAGE_NAME="gcr.io/$GCP_PROJECT_ID/datadock-api:latest"

gcloud run deploy datadock-api \
  --image=$IMAGE_NAME \
  --platform=managed \
  --region=$GCP_REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DATABASE_URL=postgresql://postgres:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$GCP_PROJECT_ID:$GCP_REGION:$CLOUD_SQL_INSTANCE" \
  --set-env-vars="SHELBY_NETWORK=shelbynet" \
  --set-env-vars="EMBEDDINGS_PROVIDER=openai" \
  --set-env-vars="LLM_PROVIDER=openai" \
  --set-env-vars="LLM_MODEL=gpt-4o-mini" \
  --set-env-vars="CORS_ORIGIN=$WEB_URL" \
  --set-secrets="OPENAI_API_KEY=openai-api-key:latest" \
  --set-secrets="APTOS_PRIVATE_KEY=aptos-private-key:latest" \
  --set-secrets="SESSION_SECRET=session-secret:latest" \
  --add-cloudsql-instances="$GCP_PROJECT_ID:$GCP_REGION:$CLOUD_SQL_INSTANCE" \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --max-instances=10 \
  --project=$GCP_PROJECT_ID

API_URL=$(gcloud run services describe datadock-api --platform=managed --region=$GCP_REGION --format="value(status.url)" --project=$GCP_PROJECT_ID)
echo "✅ API deployed: $API_URL"
echo ""

# Step 4: Update Vercel environment variables
echo "🌐 Updating Vercel environment variables..."
vercel env rm NEXT_PUBLIC_API_URL production --yes || true
echo "$API_URL" | vercel env add NEXT_PUBLIC_API_URL production

echo "✅ Environment variables updated"
echo ""

# Step 5: Deploy to Vercel
echo "🚀 Deploying web app to Vercel..."
cd apps/web
vercel --prod --yes
cd ../..

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 URLs:"
echo "   API: $API_URL"
echo "   Web: $WEB_URL"
echo ""
echo "🎉 DataDock with Hybrid Architecture is live!"

