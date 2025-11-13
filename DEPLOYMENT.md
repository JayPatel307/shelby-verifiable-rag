# 🚀 Deployment Guide - Shelby Verifiable RAG

Complete guide to deploy your Shelby RAG app to production.

---

## 📋 Pre-Deployment Checklist

### 1. API Keys Required
- [ ] **Shelby API Key** - Get from [geomi.dev](https://geomi.dev)
- [ ] **Aptos Private Key** - Generate or use existing
- [ ] **OpenAI API Key** - For embeddings & LLM
- [ ] **Session Secret** - Generate random string

### 2. Test Locally
- [ ] API server runs successfully
- [ ] Web app connects to API
- [ ] Upload works end-to-end
- [ ] Query returns answers with citations
- [ ] Verification works

---

## 🎯 Deployment Architecture

### Recommended Setup
```
┌─────────────────┐
│  Vercel (Web)   │ ← Next.js 15 frontend
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│ Railway (API)   │ ← Express server
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌──────┐
│ Shelby │ │OpenAI│
└────────┘ └──────┘
```

---

## 🌐 Option 1: Vercel Frontend + Railway API (Recommended)

### Step 1: Deploy API to Railway

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Link project
   cd apps/api
   railway init
   ```

2. **Configure Environment Variables** in Railway Dashboard:
   ```env
   PORT=4000
   DATABASE_URL=./data.sqlite
   SHELBY_NETWORK=SHELBYNET
   SHELBY_API_KEY=your_key
   APTOS_PRIVATE_KEY=your_key
   OPENAI_API_KEY=your_key
   EMBEDDINGS_PROVIDER=openai
   LLM_PROVIDER=openai
   LLM_MODEL=gpt-4o-mini
   CORS_ORIGIN=https://your-app.vercel.app
   SESSION_SECRET=your_random_secret
   MAX_FILE_BYTES=26214400
   ```

3. **Deploy**
   ```bash
   railway up
   ```

4. **Note Your API URL**: `https://your-api.up.railway.app`

### Step 2: Deploy Web to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd apps/web
   vercel
   ```

3. **Set Environment Variable** in Vercel Dashboard:
   ```env
   NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
   ```

4. **Redeploy** after setting env var:
   ```bash
   vercel --prod
   ```

---

## 🔧 Option 2: All-in-One Vercel Deployment

Convert Express API to Next.js API routes.

### Step 1: Move API Logic

1. Create `apps/web/src/app/api/` directory
2. Convert each Express route to Next.js route handler
3. Example: `apps/api/src/routes/packs.ts` → `apps/web/src/app/api/packs/route.ts`

### Step 2: Update Imports

```typescript
// apps/web/src/app/api/packs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { packManager } from '@/lib/services'

export async function POST(req: NextRequest) {
  // Same logic as Express route
  // Return NextResponse.json()
}
```

### Step 3: Deploy

```bash
cd apps/web
vercel --prod
```

### Pros/Cons
✅ Single deployment  
✅ No CORS issues  
❌ Serverless cold starts  
❌ File upload size limits (Vercel: 4.5MB body limit)

---

## 🐳 Option 3: Docker Deployment

### Create Dockerfiles

**apps/api/Dockerfile**:
```dockerfile
FROM node:20-alpine
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install deps
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build
WORKDIR /app/apps/api
RUN pnpm build

EXPOSE 4000
CMD ["node", "dist/index.js"]
```

**apps/web/Dockerfile**:
```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/web
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

### Deploy with Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: ./apps/api
    ports:
      - "4000:4000"
    env_file:
      - ./apps/api/.env
    volumes:
      - ./data:/app/data

  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:4000
    depends_on:
      - api
```

---

## 🗄️ Database Considerations

### Development (SQLite)
✅ Current setup - works great for MVP  
✅ Includes in deployment  
⚠️ Not ideal for high traffic

### Production (PostgreSQL)

1. **Create Postgres Instance** (Railway, Supabase, Neon)

2. **Create Migration Package**:
   ```bash
   mkdir packages/database/migrations
   ```

3. **Update Schema** for PostgreSQL:
   - Replace `TEXT DEFAULT (datetime('now'))` with `TIMESTAMP DEFAULT NOW()`
   - Use `SERIAL` for auto-increment IDs
   - Install `pg` driver

4. **Update Database Client**:
   ```typescript
   // Create PostgreSQLDatabase class implementing DatabaseClient
   import { Pool } from 'pg'
   ```

---

## 🔐 Security for Production

### Must-Do
1. **Replace Dev Auth**
   - Implement NextAuth.js or Clerk
   - Remove email-only login

2. **Rate Limiting**
   - Already added for `/public_query`
   - Add for other endpoints

3. **Input Validation**
   - Already implemented
   - Add additional sanitization

4. **CORS**
   - Update `CORS_ORIGIN` to production domain
   - Lock down in production

### Environment Secrets
```bash
# Generate strong secrets
openssl rand -base64 32  # For SESSION_SECRET
```

---

## 📊 Monitoring & Observability

### Recommended Tools
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Vercel Analytics**: Performance monitoring
- **Better Stack**: Log aggregation

### Add Logging
```typescript
// apps/api/src/middleware/logging.ts
import morgan from 'morgan'

app.use(morgan('combined'))
```

---

## ⚡ Performance Optimization

### 1. Database
```sql
-- Add indexes
CREATE INDEX idx_chunks_embedding ON chunks USING GIN(embedding);
```

### 2. Caching
```typescript
// Add Redis for query results
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)
```

### 3. CDN
- Use Vercel's CDN for static assets
- Cache public pack list

### 4. Lazy Loading
- Implement pagination for large pack lists
- Stream LLM responses

---

## 🧪 Testing in Production

### Smoke Tests
```bash
# Health check
curl https://your-api.com/health

# Login
curl -X POST https://your-api.com/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Discover
curl https://your-api.com/discover
```

### Monitor
- Response times < 3s for queries
- Upload success rate > 95%
- Verification accuracy 100%

---

## 🔄 CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm build
      
      - name: Deploy to Vercel
        run: vercel deploy --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

---

## 🎯 Vercel-Specific Configuration

### vercel.json (for API on Vercel)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "apps/api/src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "apps/api/src/index.ts"
    }
  ]
}
```

### next.config.js (already configured)
```javascript
output: 'standalone'  // For Docker/self-hosted
```

---

## 📱 Custom Domain

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records

### SSL
✅ Automatic with Vercel  
✅ Automatic with Railway

---

## 🔍 Debugging Production Issues

### Check Logs
```bash
# Vercel
vercel logs

# Railway
railway logs
```

### Common Issues

**CORS Errors**
- Update `CORS_ORIGIN` in API env vars
- Check domain matches exactly

**Upload Fails**
- Check file size limits
- Verify Shelby API key is valid
- Check Aptos account has funds

**Query Timeout**
- Increase serverless function timeout
- Optimize vector search
- Add caching

**Verification Fails**
- Check blob_id format
- Verify Shelby network matches
- Check account permissions

---

## 💰 Cost Estimates (Monthly)

### Minimal Traffic (< 1000 users)
- **Vercel**: $0 (Hobby plan)
- **Railway**: $5-20 (depending on usage)
- **OpenAI**: $10-50 (embeddings + LLM)
- **Shelby**: Depends on storage used

### Total: ~$15-70/month

### Scaling Up (10K users)
- **Vercel**: $20 (Pro plan)
- **Railway**: $50-100
- **OpenAI**: $200-500
- **Database**: $25 (Postgres)

### Total: ~$295-645/month

---

## ✅ Post-Deployment Checklist

- [ ] All environment variables set
- [ ] API health check returns 200
- [ ] Web app loads successfully
- [ ] Can create account
- [ ] Can upload files
- [ ] Files appear on Shelby
- [ ] Can query and get answers
- [ ] Citations show correctly
- [ ] Verification works
- [ ] Public packs visible in discover
- [ ] Mobile responsive
- [ ] Error pages work
- [ ] Custom domain configured (if applicable)
- [ ] Analytics/monitoring setup
- [ ] Backups configured

---

## 🆘 Rollback Plan

### Vercel
```bash
# Rollback to previous deployment
vercel rollback
```

### Railway
- Use Railway dashboard to rollback
- Or redeploy previous git commit

### Database
- Keep database backups
- Test migrations in staging first

---

## 📞 Support Resources

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Shelby Docs](https://docs.shelby.xyz)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Ready to deploy? Follow the steps above and you'll be live in 30 minutes!** 🚀

