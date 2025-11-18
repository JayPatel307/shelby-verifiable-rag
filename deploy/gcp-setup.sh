#!/bin/bash
# GCP Infrastructure Setup Script
# Run this once to create all GCP resources
# Reads configuration from config.sh (which contains your secrets)

set -e

# Load configuration from config.sh (NOT committed to git)
if [ ! -f "config.sh" ]; then
    echo "❌ config.sh not found!"
    echo ""
    echo "📝 Create it first:"
    echo "   1. cp config.example.sh config.sh"
    echo "   2. nano config.sh"
    echo "   3. Fill in: GCP_PROJECT_ID, DB_PASSWORD, Google OAuth, etc."
    echo ""
    exit 1
fi

echo "📋 Loading configuration from config.sh..."
source config.sh

# Validate required variables
if [ "$GCP_PROJECT_ID" = "YOUR-GCP-PROJECT-ID" ] || [ -z "$GCP_PROJECT_ID" ]; then
    echo "❌ GCP_PROJECT_ID not set in config.sh"
    exit 1
fi

if [ "$DB_PASSWORD" = "YOUR-SECURE-DB-PASSWORD" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ DB_PASSWORD not set in config.sh"
    echo "   Generate with: openssl rand -base64 32"
    exit 1
fi

echo "🚀 Setting up GCP infrastructure for Shelby RAG..."
echo "   Project: $GCP_PROJECT_ID"
echo "   Region: $GCP_REGION"
echo ""

# Set project
gcloud config set project $GCP_PROJECT_ID

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
echo "   (This takes 5-10 minutes - please wait)"
gcloud sql instances create $DB_INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$GCP_REGION \
  --root-password=$DB_PASSWORD \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7 \
  --availability-type=zonal \
  || echo "⚠️  Instance might already exist (that's OK)"

# Create database
echo ""
echo "📊 Creating database..."
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE_NAME \
  || echo "⚠️  Database might already exist (that's OK)"

# Get connection name
echo ""
echo "🔗 Getting connection name..."
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --format="value(connectionName)")
echo "   Connection: $CONNECTION_NAME"

# Update config.sh with connection name
sed -i.bak "s|export CLOUD_SQL_CONNECTION_NAME=.*|export CLOUD_SQL_CONNECTION_NAME=\"$CONNECTION_NAME\"|" config.sh
echo "   ✅ Updated config.sh with connection name"

# Create secrets in Secret Manager
echo ""
echo "🔐 Creating secrets in Secret Manager..."

# OpenAI
echo -n "$OPENAI_API_KEY" | gcloud secrets create openai-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "   ⚠️  openai-api-key already exists (updating version)"

# Shelby
echo -n "$SHELBY_API_KEY" | gcloud secrets create shelby-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "   ⚠️  shelby-api-key already exists"

# Aptos
echo -n "$APTOS_PRIVATE_KEY" | gcloud secrets create aptos-private-key \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "   ⚠️  aptos-private-key already exists"

# Session secret (generate)
SESSION_SECRET=$(openssl rand -base64 32)
echo -n "$SESSION_SECRET" | gcloud secrets create session-secret \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "   ⚠️  session-secret already exists"

echo "   ✅ All secrets created"

# Grant Cloud Run access to secrets
echo ""
echo "🔓 Granting Cloud Run access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for SECRET in openai-api-key shelby-api-key aptos-private-key session-secret; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    2>/dev/null || true
done

echo "   ✅ Permissions granted"

# Create dedicated service account
echo ""
echo "👤 Creating service account..."
gcloud iam service-accounts create shelby-rag-api \
  --display-name="Shelby RAG API Service Account" \
  2>/dev/null || echo "   ⚠️  Service account already exists (that's OK)"

# Grant Cloud SQL client role
echo "🔓 Granting Cloud SQL access to service account..."
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:shelby-rag-api@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client" \
  2>/dev/null || echo "   ⚠️  Permission might already exist (that's OK)"

echo ""
echo "======================================"
echo "✅ GCP Infrastructure Setup Complete!"
echo "======================================"
echo ""
echo "📝 Important Information:"
echo "   Project ID: $GCP_PROJECT_ID"
echo "   Region: $GCP_REGION"
echo "   Database: $DB_INSTANCE_NAME"
echo "   Connection: $CONNECTION_NAME"
echo ""
echo "🔗 Database connection string:"
echo "   postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME"
echo ""
echo "✅ config.sh has been updated with connection name"
echo ""
echo "📌 Next Step:"
echo "   ./deploy-api.sh"
echo ""

