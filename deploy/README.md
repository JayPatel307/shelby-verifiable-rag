# 🚀 Production Deployment Instructions

Complete step-by-step guide to deploy Shelby RAG to production.

---

## 📋 Prerequisites

### Required Accounts:
- [ ] GCP account with billing enabled
- [ ] Vercel account
- [ ] GitHub account (for CI/CD)
- [ ] OpenAI API key
- [ ] Shelby account (funded with APT + ShelbyUSD)

### Local Tools:
- [ ] gcloud CLI installed
- [ ] Docker installed (for local testing)
- [ ] Vercel CLI installed
- [ ] pnpm installed

---

## 🎯 Deployment Process (60 minutes)

### Phase 1: GCP Infrastructure Setup (20 minutes)

#### Step 1: Configure project
```bash
cd deploy
cp config.example.sh config.sh
nano config.sh  # Fill in your values
```

#### Step 2: Run setup script
```bash
./gcp-setup.sh
```

This creates:
- ✅ Cloud SQL PostgreSQL instance
- ✅ Database and schema
- ✅ Secret Manager secrets
- ✅ Service accounts
- ✅ IAM permissions

**Wait 5-10 minutes** for Cloud SQL to provision.

#### Step 3: Verify database
```bash
# Connect via cloud proxy
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432 &

# Test connection
psql -h localhost -U postgres -d shelby_rag
# Password: your DB password

# Check tables
\dt

# Exit
\q
```

---

### Phase 2: Deploy API to Cloud Run (15 minutes)

#### Step 1: Test Docker build locally
```bash
cd /Users/jay/src/shelby-verifiable-rag

# Build image
docker build -t shelby-rag-api -f apps/api/Dockerfile .

# Test locally
docker run -p 8080:8080 \
  -e DATABASE_URL=./data.sqlite \
  -e OPENAI_API_KEY=your_key \
  shelby-rag-api

# Test
curl http://localhost:8080/health
```

#### Step 2: Deploy to Cloud Run
```bash
cd deploy
./deploy-api.sh
```

This will:
- Build Docker image
- Push to GCR (Google Container Registry)
- Deploy to Cloud Run
- Configure secrets and environment
- Connect to Cloud SQL

#### Step 3: Test deployed API
```bash
# Get URL from output, then:
API_URL="https://shelby-rag-api-xxxxx.run.app"

# Test health
curl $API_URL/health

# Test endpoints
curl -X POST $API_URL/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

### Phase 3: Deploy Web to Vercel (15 minutes)

#### Step 1: Link Vercel project
```bash
cd apps/web
vercel
# Follow prompts, link to existing project or create new
```

#### Step 2: Configure environment
```bash
# Set API URL (from Cloud Run deployment)
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://shelby-rag-api-xxxxx.run.app
```

#### Step 3: Deploy
```bash
vercel --prod
```

Or use the script:
```bash
cd ../../deploy
./deploy-web.sh
```

#### Step 4: Get Vercel URL
```bash
# From deploy output, something like:
https://shelby-rag-abc123.vercel.app
```

---

### Phase 4: Update CORS (5 minutes)

#### Update Cloud Run with Vercel URL
```bash
gcloud run services update shelby-rag-api \
  --update-env-vars CORS_ORIGIN=https://your-app.vercel.app \
  --region us-central1
```

---

### Phase 5: Test End-to-End (5 minutes)

#### Test full flow:
1. Open https://your-app.vercel.app
2. Login
3. Upload a file
4. Ask a question
5. Verify citation

**If all works**: ✅ Deployment complete!

---

## 🔄 CI/CD Setup (Optional but Recommended)

### Step 1: Create GCP Service Account Key
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@PROJECT_ID.iam.gserviceaccount.com

# Copy content (you'll add to GitHub secrets)
cat key.json
```

### Step 2: Add GitHub Secrets

Go to: GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: Contents of key.json
- `DATABASE_URL`: PostgreSQL connection string
- `CLOUD_SQL_CONNECTION_NAME`: project:region:instance
- `CORS_ORIGIN`: https://your-app.vercel.app
- `VERCEL_TOKEN`: From vercel.com/account/tokens
- `VERCEL_ORG_ID`: From Vercel dashboard
- `VERCEL_PROJECT_ID`: From Vercel dashboard

### Step 3: Enable Workflow

The workflow is already in `.github/workflows/deploy.yml`

Now every push to `main` will auto-deploy! 🎉

---

## 🔧 Update Deployment

### Update API:
```bash
# Make code changes, commit, then:
cd deploy
./deploy-api.sh
```

### Update Web:
```bash
# Make code changes, commit, then:
cd deploy
./deploy-web.sh
```

### Or use CI/CD:
```bash
git push origin main
# Automatically deploys!
```

---

## 📊 Monitor Deployment

### Cloud Run Logs:
```bash
gcloud run services logs read shelby-rag-api \
  --region us-central1 \
  --limit 100
```

### Cloud SQL Logs:
```bash
gcloud sql operations list \
  --instance shelby-rag-db
```

### Vercel Logs:
```bash
vercel logs
```

---

## 🐛 Troubleshooting

### API won't start:
```bash
# Check logs
gcloud run services logs tail shelby-rag-api --region us-central1

# Common issues:
# - Database connection failed
# - Missing secrets
# - Out of memory
```

### Database connection fails:
```bash
# Test Cloud SQL connection
gcloud sql connect shelby-rag-db --user=postgres

# Check if API has permission
gcloud sql instances describe shelby-rag-db | grep serviceAccountEmailAddress
```

### Secrets not accessible:
```bash
# Verify IAM permissions
gcloud secrets get-iam-policy openai-api-key

# Add if missing:
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 💰 Cost Management

### Monitor Costs:
```bash
# Cloud Run
gcloud run services describe shelby-rag-api \
  --region us-central1 \
  --format="value(status.traffic)"

# Billing
gcloud billing accounts list
gcloud billing projects describe PROJECT_ID
```

### Reduce Costs:
```bash
# Scale down when idle
gcloud run services update shelby-rag-api \
  --min-instances 0 \
  --region us-central1

# Use smaller DB tier
gcloud sql instances patch shelby-rag-db \
  --tier db-f1-micro
```

---

## 🔄 Rollback

### Rollback Cloud Run:
```bash
# List revisions
gcloud run revisions list --service shelby-rag-api --region us-central1

# Rollback to previous
gcloud run services update-traffic shelby-rag-api \
  --to-revisions REVISION_NAME=100 \
  --region us-central1
```

### Rollback Vercel:
```bash
vercel rollback
```

---

## ✅ Post-Deployment Checklist

- [ ] API health check returns 200
- [ ] Web app loads without errors
- [ ] Can login
- [ ] Can upload files
- [ ] Files visible in pack details
- [ ] Can query and get answers
- [ ] Citations show blob IDs
- [ ] Verification works
- [ ] Delete functionality works
- [ ] Public packs visible
- [ ] Mobile responsive
- [ ] CORS configured correctly
- [ ] Secrets working
- [ ] Database connected
- [ ] Monitoring enabled

---

## 📞 Support

If deployment fails:
1. Check Cloud Run logs
2. Verify all secrets are set
3. Test database connection
4. Check IAM permissions
5. Review error messages carefully

---

**Ready to deploy? Start with `./gcp-setup.sh`** 🚀

