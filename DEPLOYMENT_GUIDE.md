# 🚀 Production Deployment Guide

**Target Scale**: 100-300 users  
**Requirements**: High reliability, no downtime, cost-effective  
**Infrastructure**: GCP + Vercel + Shelby

---

## 🎯 Recommended Architecture

### Why This Setup?

**Frontend on Vercel**:
- ✅ Built for Next.js (zero config)
- ✅ Global CDN (fast worldwide)
- ✅ Free tier (enough for 300 users)
- ✅ Zero-downtime deploys
- ✅ Automatic HTTPS

**Backend on GCP Cloud Run**:
- ✅ Serverless (scales 0→N automatically)
- ✅ Pay per use (cheap at your scale)
- ✅ Built-in load balancing
- ✅ Docker-based (easy to deploy)
- ✅ 99.95% uptime SLA
- ✅ Company GCP account

**Database on GCP Cloud SQL**:
- ✅ Managed PostgreSQL
- ✅ Automatic backups
- ✅ High availability option
- ✅ Same region as Cloud Run (low latency)

**Storage on Shelby**:
- ✅ Already decentralized
- ✅ Verifiable on-chain
- ✅ No additional infrastructure needed

---

## 📋 Pre-Deployment Checklist

### 1. Generate Your Own Shelby Account
```bash
# Install Shelby CLI
npm install -g @shelby-protocol/cli

# Initialize and create account
shelby init

# Get your credentials
cat ~/.shelby/config.yaml

# Fund your account (get testnet tokens):
# APT: https://docs.shelby.xyz/apis/faucet/aptos
# ShelbyUSD: https://docs.shelby.xyz/apis/faucet/shelbyusd
```

### 2. Get API Keys
- [ ] OpenAI API key (already have)
- [ ] Your own Shelby account credentials (generated above)
- [ ] Vercel account
- [ ] GCP project with billing enabled

### 3. Prepare Code
- [ ] All code committed to GitHub
- [ ] Environment variables documented
- [ ] Database migration ready

---

## 🔧 Step 1: Migrate Database (SQLite → PostgreSQL)

### Why PostgreSQL?
- SQLite is file-based (not suitable for Cloud Run)
- PostgreSQL handles concurrent users better
- Better for production workloads

### Create Cloud SQL Instance

```bash
# Enable Cloud SQL API
gcloud services enable sqladmin.googleapis.com

# Create PostgreSQL instance
gcloud sql instances create shelby-rag-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create shelby_rag \
  --instance=shelby-rag-db

# Get connection name
gcloud sql instances describe shelby-rag-db | grep connectionName
```

### Update Schema for PostgreSQL

The schema needs minor changes:
```sql
-- Replace SQLite datetime() with PostgreSQL NOW()
-- packages/database/src/schema.sql

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()  -- Changed from datetime('now')
);

-- Repeat for all tables
```

I can create a PostgreSQL adapter if needed!

---

## 🐳 Step 2: Deploy API to GCP Cloud Run

### Create Dockerfile

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS builder
WORKDIR /app/apps/api
RUN pnpm build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

WORKDIR /app/apps/api
RUN pnpm install --prod --frozen-lockfile

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
```

### Deploy to Cloud Run

```bash
cd /Users/jay/src/shelby-verifiable-rag

# Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/shelby-rag-api apps/api

# Deploy to Cloud Run
gcloud run deploy shelby-rag-api \
  --image gcr.io/YOUR_PROJECT_ID/shelby-rag-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 60s \
  --max-instances 10 \
  --min-instances 1 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=postgresql://user:pass@/shelby_rag?host=/cloudsql/PROJECT:REGION:INSTANCE" \
  --set-secrets "OPENAI_API_KEY=openai-key:latest" \
  --set-secrets "APTOS_PRIVATE_KEY=aptos-key:latest" \
  --set-secrets "SHELBY_API_KEY=shelby-key:latest"
```

### Store Secrets in Secret Manager

```bash
# Create secrets
echo -n "YOUR_OPENAI_KEY" | gcloud secrets create openai-key --data-file=-
echo -n "YOUR_APTOS_KEY" | gcloud secrets create aptos-key --data-file=-
echo -n "YOUR_SHELBY_KEY" | gcloud secrets create shelby-key --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding openai-key \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🌐 Step 3: Deploy Frontend to Vercel

### Configure Vercel

```bash
cd apps/web

# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel
```

### Set Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://shelby-rag-api-xxxxx.run.app
```

### Redeploy
```bash
vercel --prod
```

---

## 🔒 Step 4: Security Hardening

### Update CORS

In Cloud Run, set env var:
```bash
CORS_ORIGIN=https://your-app.vercel.app
```

### Add Rate Limiting

Already implemented for public endpoints!

### Enable HTTPS Only

- ✅ Vercel: Automatic
- ✅ Cloud Run: Automatic

### Secure Secrets

- ✅ Use Secret Manager (done above)
- ❌ Never commit .env to git

---

## 💰 Cost Estimate (Monthly)

### For 100-300 Users:

**Vercel (Frontend)**:
- Free tier: $0
- (Or Pro: $20/month for team features)

**GCP Cloud Run (API)**:
- ~1M requests/month: $5-15
- Minimal idle cost with min-instances=1: $10
- **Total**: ~$15-25/month

**GCP Cloud SQL (PostgreSQL)**:
- db-f1-micro: $7/month
- Backups: $2/month
- **Total**: ~$9/month

**OpenAI**:
- Embeddings (text-embedding-3-small): ~$5-20/month
- GPT-4o-mini: ~$10-30/month
- **Total**: ~$15-50/month

**Shelby Storage**:
- Depends on data volume
- Pay for APT gas + ShelbyUSD storage
- Estimate: $10-30/month

**Grand Total: $49-114/month** 💰

---

## 🎯 Alternative: All-in-One Vercel (Simplest)

### If You Want Simpler Deployment:

Convert Express API to Next.js API routes:

```typescript
// apps/web/app/api/packs/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Same logic as Express route
  return NextResponse.json(result)
}
```

**Pros**:
- ✅ Single deployment
- ✅ One platform to manage
- ✅ No CORS issues

**Cons**:
- ❌ 4.5MB request limit (Vercel)
- ❌ Function timeout limits
- ❌ Less flexible for large files

**Best for**: < 50 users, smaller files

---

## 🏗️ Deployment Steps (Recommended: GCP + Vercel)

### Phase 1: Database (30 minutes)
1. Create Cloud SQL PostgreSQL instance
2. Migrate schema
3. Test connection locally

### Phase 2: API Backend (45 minutes)
1. Create Dockerfile
2. Build and push to GCR
3. Deploy to Cloud Run
4. Set environment variables
5. Test API endpoints

### Phase 3: Frontend (15 minutes)
1. Update `NEXT_PUBLIC_API_URL`
2. Deploy to Vercel
3. Test full flow

### Phase 4: Monitoring (30 minutes)
1. Set up Cloud Logging
2. Set up error alerting
3. Add uptime monitoring

**Total Time**: ~2 hours

---

## 📊 High Availability Setup

### For Zero Downtime:

**Cloud Run**:
```bash
--min-instances 2 \  # Always have 2 instances running
--max-instances 20   # Scale up to 20
```

**Cloud SQL**:
```bash
--availability-type REGIONAL  # Multi-zone failover
```

**Vercel**:
- Already globally distributed
- Multiple edge locations
- Automatic failover

**Cost**: +$50/month for HA setup

---

## 🔍 Monitoring & Alerts

### Set Up Alerts

```bash
# Cloud Run alerts
gcloud monitoring policies create \
  --notification-channels=YOUR_CHANNEL \
  --condition-threshold-value=10 \
  --condition-threshold-duration=60s \
  --condition-display-name="API Error Rate High"

# Uptime checks
gcloud monitoring uptime create https://your-api.run.app/health
```

### Recommended Tools:
- **Cloud Logging**: Already included
- **Sentry**: Error tracking
- **Better Stack**: Log aggregation
- **Vercel Analytics**: Frontend monitoring

---

## 🔄 CI/CD Pipeline

### GitHub Actions for Auto-Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: shelby-rag-api
          image: gcr.io/${{ secrets.GCP_PROJECT_ID }}/shelby-rag-api

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 🎯 My Recommendation

### For Your Use Case (100-300 users):

**Go with: GCP Cloud Run + Vercel + Cloud SQL**

**Why?**:
1. ✅ Company already has GCP
2. ✅ Cost-effective ($50-100/month)
3. ✅ Auto-scaling (handles traffic spikes)
4. ✅ High reliability (99.95% uptime)
5. ✅ Easy to maintain
6. ✅ Professional setup

**Alternative (Simpler)**:
If you want ultra-simple, use Vercel for everything:
- Convert Express to Next.js API routes
- Use Vercel Postgres
- One-click deploy
- But: File size limits, function timeouts

---

## 📝 Next Steps to Deploy

### This Week:
1. **Create PostgreSQL adapter** (I can do this)
2. **Test with Cloud SQL** (locally first)
3. **Create Dockerfile** for API
4. **Deploy to GCP Cloud Run**
5. **Deploy web to Vercel**

### Need Me To:
- [ ] Create PostgreSQL database adapter?
- [ ] Create Docker configuration?
- [ ] Create deployment scripts?
- [ ] Set up CI/CD pipeline?

**I can build all of this for you!** Should I continue? 🚀

---

## 💡 Storage Strategy

### User Data Flow:
```
User uploads file
  ↓
Stored in PostgreSQL (metadata: filename, size, hash)
  ↓
File uploaded to Shelby (blob_id returned)
  ↓
Vector embeddings stored in PostgreSQL
  ↓
User queries → Search PostgreSQL → Return Shelby blob_ids
  ↓
Verification → Re-fetch from Shelby → Verify hash
```

### What Goes Where:
- **PostgreSQL**: Metadata, embeddings, user data
- **Shelby**: Actual file content (immutable, verifiable)
- **Vercel Edge**: Static assets, pages
- **Cloud Run**: API logic, file processing

---

## 🎯 Would You Like Me To:

### Option 1: Build Full GCP + Vercel Setup (Recommended)
- Create PostgreSQL adapter
- Docker configuration
- Deployment scripts
- CI/CD pipeline
- **Time**: 1-2 hours of work

### Option 2: Quick Vercel-Only Deploy
- Convert to Next.js API routes
- Use Vercel Postgres
- Deploy in 30 minutes
- **Trade-off**: File size limits

### Option 3: Document Current Setup
- Keep SQLite for now
- Deploy as-is for demo
- Migrate to PostgreSQL later

**Which approach would you like?** I recommend **Option 1** for production reliability! 🏗️

