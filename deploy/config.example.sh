#!/bin/bash
# Deployment Configuration Template
# 1. Copy this file: cp config.example.sh config.sh
# 2. Edit config.sh with your actual values
# 3. Never commit config.sh (it's in .gitignore)

# ============================================
# GCP Configuration
# ============================================
export GCP_PROJECT_ID="YOUR-GCP-PROJECT-ID"  # Find at console.cloud.google.com (top dropdown)
export GCP_REGION="us-central1"
export GCP_SERVICE_NAME="shelby-rag-api"

# ============================================
# Cloud SQL
# ============================================
export DB_INSTANCE_NAME="shelby-rag-db"
export DB_NAME="shelby_rag"
export DB_USER="postgres"
export DB_PASSWORD="GENERATE-WITH-OPENSSL-RAND"  # Run: openssl rand -base64 32
export CLOUD_SQL_CONNECTION_NAME="will-be-filled-by-setup-script"

# ============================================
# Shelby Credentials
# ============================================
export SHELBY_API_KEY="AG-YOUR-SHELBY-API-KEY"
export APTOS_PRIVATE_KEY="ed25519-priv-0xYOUR-PRIVATE-KEY"
export APTOS_ACCOUNT_ADDRESS="0xYOUR-ACCOUNT-ADDRESS"

# ============================================
# OpenAI
# ============================================
export OPENAI_API_KEY="sk-proj-YOUR-OPENAI-API-KEY"

# ============================================
# Google OAuth (from Google Cloud Console)
# ============================================
export GOOGLE_CLIENT_ID="YOUR-CLIENT-ID.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-YOUR-SECRET"

# ============================================
# Vercel (get from Vercel dashboard)
# ============================================
export VERCEL_ORG_ID="your-org-id"
export VERCEL_PROJECT_ID="your-project-id"
export VERCEL_TOKEN="your-token"

# ============================================
# CORS (update after Vercel deploy)
# ============================================
export CORS_ORIGIN="https://your-app.vercel.app"

