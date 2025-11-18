# 🚀 Deploy to Production NOW - Step by Step

**Time Required**: 60-90 minutes  
**Cost**: $34/month (~$204 for 6 months)

---

## ✅ Pre-Deployment Checklist

Before starting, ensure you have:
- [ ] GCP account with billing enabled
- [ ] Vercel account (free)
- [ ] Your Shelby credentials (you have these!)
- [ ] OpenAI API key (you have this!)
- [ ] `gcloud` CLI installed
- [ ] `vercel` CLI installed

---

## 📋 Deployment Steps

### Step 1: Get Google OAuth Credentials (5 minutes)

1. **Go to**: https://console.cloud.google.com/apis/credentials
2. **Create OAuth Client ID**:
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     http://localhost:3000/api/auth/callback/google
     https://your-app.vercel.app/api/auth/callback/google
     ```
3. **Copy**: Client ID and Client Secret
4. **Save for later** (you'll add to Vercel)

---

### Step 2: Prepare Deployment Config (5 minutes)

```bash
cd /Users/jay/src/shelby-verifiable-rag/deploy

# Copy and edit config
cp config.example.sh config.sh
nano config.sh
```

**Update these values**:
```bash
# Your GCP project ID (find at console.cloud.google.com)
GCP_PROJECT_ID="your-actual-project-id"

# Your credentials (you already have these!)
SHELBY_API_KEY="AG-6DKRUSNQP4NHFZ2IH9SZITY6WJHMJLI1Z"
APTOS_PRIVATE_KEY="ed25519-priv-0xd8503d294c6ecb42009b246c71a860db37ce419e3d4bf89d7689d276f2c94713"
OPENAI_API_KEY="sk-proj-rtWjRB..." # Your OpenAI key

# Google OAuth (from Step 1)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
```

---

### Step 3: Run GCP Setup (20 minutes)

This creates Cloud SQL, secrets, and IAM permissions.

```bash
cd /Users/jay/src/shelby-verifiable-rag/deploy
./gcp-setup.sh
```

**What it does**:
- ✅ Creates PostgreSQL database (takes 5-10 min)
- ✅ Stores secrets in Secret Manager
- ✅ Sets up IAM permissions
- ✅ Configures service accounts

**Wait for completion**, then continue.

---

### Step 4: Deploy API to Cloud Run (15 minutes)

```bash
cd /Users/jay/src/shelby-verifiable-rag/deploy

# Edit script with your project ID
nano deploy-api.sh
# Update: PROJECT_ID="your-actual-project-id"

# Deploy!
./deploy-api.sh
```

**What it does**:
- ✅ Builds Docker image
- ✅ Pushes to Container Registry
- ✅ Deploys to Cloud Run
- ✅ Connects to Cloud SQL
- ✅ Configures secrets

**Save the API URL** from output:
```
https://shelby-rag-api-xxxxx.run.app
```

**Test it**:
```bash
curl https://shelby-rag-api-xxxxx.run.app/health
```

---

### Step 5: Deploy Web to Vercel (10 minutes)

#### A. Link Vercel Project
```bash
cd /Users/jay/src/shelby-verifiable-rag/apps/web
vercel
```

Follow prompts:
- Link to existing project or create new
- Set root directory to `apps/web`

#### B. Set Environment Variables

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

Add these (for all environments: Production, Preview, Development):

```
NEXT_PUBLIC_API_URL=https://shelby-rag-api-xxxxx.run.app
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
```

#### C. Deploy
```bash
vercel --prod
```

**Save the Vercel URL** from output:
```
https://shelby-rag-xyz123.vercel.app
```

---

### Step 6: Update OAuth Redirect URI (5 minutes)

#### A. Update Google OAuth
1. Go back to: https://console.cloud.google.com/apis/credentials
2. Edit your OAuth client
3. Add authorized redirect URI:
   ```
   https://your-actual-vercel-url.vercel.app/api/auth/callback/google
   ```
4. Save

#### B. Update Cloud Run CORS
```bash
gcloud run services update shelby-rag-api \
  --update-env-vars CORS_ORIGIN=https://your-actual-vercel-url.vercel.app \
  --region us-central1
```

---

### Step 7: Test Production! (5 minutes)

1. **Open**: https://your-app.vercel.app
2. **Click**: "Login"
3. **Sign in**: With your Google account
4. **Upload**: A test file
5. **Query**: Ask a question
6. **Verify**: Click verify button

**If all works**: 🎉 **YOU'RE LIVE!**

---

## 🐛 Quick Troubleshooting

### API not responding:
```bash
# Check logs
gcloud run services logs read shelby-rag-api --region us-central1 --limit 50

# Check service status
gcloud run services describe shelby-rag-api --region us-central1
```

### Web app CORS error:
- Verify CORS_ORIGIN in Cloud Run matches Vercel URL exactly
- No trailing slash!

### Google OAuth not working:
- Check redirect URI matches exactly (including https://)
- Verify credentials are set in Vercel
- Check browser console for errors

### Database connection error:
```bash
# Test Cloud SQL connection
gcloud sql connect shelby-rag-db --user=postgres
```

---

## 💰 Expected Costs

### Initial Setup:
- GCP: $0 (setup is free)
- Vercel: $0 (deployment is free)

### Monthly Running:
- Cloud Run: $10-15
- Cloud SQL: $7-9
- Shelby: $5-10
- OpenAI: $10-15

**Total**: ~$34/month

---

## 🎯 What You'll Have After Deployment

✅ **Production API** on Cloud Run  
✅ **Professional UI** on Vercel global CDN  
✅ **PostgreSQL database** with auto-backups  
✅ **Google OAuth** authentication  
✅ **Auto-scaling** (1-10 instances)  
✅ **HTTPS** everywhere  
✅ **Zero-downtime deploys**  
✅ **Global CDN** (fast worldwide)  

---

## 📞 Ready to Deploy?

### Option A: Manual Deployment (Recommended for first time)
Follow the steps above one by one. Understand each step.

### Option B: One-Command Deploy (For experienced users)
```bash
cd deploy
./deploy-all.sh
```

**I recommend Option A for your first deployment!**

---

## 🚀 Let's Start!

**Begin with Step 1**: Get your Google OAuth credentials from:
👉 https://console.cloud.google.com/apis/credentials

Then move through each step. Ask me if you get stuck on any step!

**Which step are you on?** I can help you through it! 🎯

