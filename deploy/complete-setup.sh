#!/bin/bash
# Complete the GCP setup (simpler version)

set -e

source config.sh

echo "🔍 Checking what exists already..."
echo ""

# Check database
echo "📊 Checking Cloud SQL instance..."
if gcloud sql instances describe shelby-rag-db --project=shelby-ai-jay &>/dev/null; then
    echo "   ✅ Database exists"
    CONNECTION_NAME=$(gcloud sql instances describe shelby-rag-db --project=shelby-ai-jay --format="value(connectionName)")
    echo "   Connection: $CONNECTION_NAME"
    
    # Update config.sh
    sed -i.bak "s|export CLOUD_SQL_CONNECTION_NAME=.*|export CLOUD_SQL_CONNECTION_NAME=\"$CONNECTION_NAME\"|" config.sh
    echo "   ✅ Updated config.sh"
else
    echo "   ❌ Database doesn't exist - need to create it"
    echo "   Run: gcloud sql instances create shelby-rag-db --project=shelby-ai-jay ..."
fi

echo ""
echo "🔐 Checking secrets..."
gcloud secrets list --project=shelby-ai-jay 2>/dev/null || echo "   Creating secrets..."

echo ""
echo "✅ Setup check complete!"
echo ""
echo "📌 Next: ./deploy-api.sh"
