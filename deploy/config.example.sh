#!/bin/bash
# Deployment Configuration
# Copy this to config.sh and fill in your values
# Add config.sh to .gitignore (contains secrets)

# GCP Configuration
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"
export GCP_SERVICE_NAME="shelby-rag-api"

# Cloud SQL
export DB_INSTANCE_NAME="shelby-rag-db"
export DB_NAME="shelby_rag"
export DB_USER="postgres"
export DB_PASSWORD="your-secure-password"
export CLOUD_SQL_CONNECTION_NAME="project:region:instance"

# Shelby
export SHELBY_API_KEY="AG-..."
export APTOS_PRIVATE_KEY="ed25519-priv-0x..."
export APTOS_ACCOUNT_ADDRESS="0x..."

# OpenAI
export OPENAI_API_KEY="sk-proj-..."

# Vercel
export VERCEL_ORG_ID="your-org-id"
export VERCEL_PROJECT_ID="your-project-id"
export VERCEL_TOKEN="your-token"

# CORS (update after first deploy)
export CORS_ORIGIN="https://your-app.vercel.app"

