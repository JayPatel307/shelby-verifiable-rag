#!/bin/bash
# GCP Infrastructure Setup Script
# Run this once to create all GCP resources

set -e

# Configuration - UPDATE THESE!
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
DB_INSTANCE="shelby-rag-db"
DB_NAME="shelby_rag"
DB_PASSWORD="CHANGE_ME_TO_SECURE_PASSWORD"

echo "🚀 Setting up GCP infrastructure for Shelby RAG..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📦 Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com

# Create Cloud SQL instance
echo ""
echo "🗄️  Creating Cloud SQL PostgreSQL instance..."
echo "   (This takes 5-10 minutes)"
gcloud sql instances create $DB_INSTANCE \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password=$DB_PASSWORD \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7 \
  --availability-type=zonal \
  || echo "Instance might already exist"

# Create database
echo ""
echo "📊 Creating database..."
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE \
  || echo "Database might already exist"

# Get connection name
echo ""
echo "🔗 Getting connection name..."
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
echo "   Connection: $CONNECTION_NAME"

# Create secrets
echo ""
echo "🔐 Creating secrets..."

# OpenAI API Key
echo -n "Enter your OpenAI API key: "
read -s OPENAI_KEY
echo ""
echo -n "$OPENAI_KEY" | gcloud secrets create openai-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "Secret might already exist"

# Shelby API Key
echo "Enter your Shelby API key: "
read -s SHELBY_KEY
echo ""
echo -n "$SHELBY_KEY" | gcloud secrets create shelby-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "Secret might already exist"

# Aptos Private Key
echo "Enter your Aptos private key: "
read -s APTOS_KEY
echo ""
echo -n "$APTOS_KEY" | gcloud secrets create aptos-private-key \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "Secret might already exist"

# Session Secret
SESSION_SECRET=$(openssl rand -base64 32)
echo -n "$SESSION_SECRET" | gcloud secrets create session-secret \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "Secret might already exist"

# Grant Cloud Run access to secrets
echo ""
echo "🔓 Granting Cloud Run access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for SECRET in openai-api-key shelby-api-key aptos-private-key session-secret; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    || true
done

# Create service account for Cloud Run
echo ""
echo "👤 Creating service account..."
gcloud iam service-accounts create shelby-rag-api \
  --display-name="Shelby RAG API Service Account" \
  || echo "Service account might already exist"

# Grant Cloud SQL client role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:shelby-rag-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client" \
  || true

echo ""
echo "✅ GCP Infrastructure setup complete!"
echo ""
echo "📝 Save these values for deployment:"
echo "   PROJECT_ID=$PROJECT_ID"
echo "   REGION=$REGION"
echo "   CONNECTION_NAME=$CONNECTION_NAME"
echo ""
echo "🔗 Database connection string (for local testing):"
echo "   postgresql://postgres:$DB_PASSWORD@/shelby_rag?host=/cloudsql/$CONNECTION_NAME"
echo ""
echo "📌 Next step: Run ./deploy/deploy-api.sh to deploy the API"

