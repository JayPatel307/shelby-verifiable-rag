# 🚀 Setup & Usage Guide

Complete guide to run, test, and deploy your Shelby Verifiable RAG app.

---

## ⚡ Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
cd /Users/jay/src/shelby-verifiable-rag
pnpm install
```

### 2. Configure API
```bash
# API is already configured with:
# - OpenAI API key ✅
# - Shelby account (Akasha's) ✅
# - Database path ✅

# To verify:
cat apps/api/.env
```

### 3. Run Both Servers
```bash
# Terminal 1 - API (port 4000)
pnpm dev:api

# Terminal 2 - Web (port 3000)
pnpm dev:web
```

### 4. Open Browser
```
http://localhost:3000
```

---

## 📝 Current Configuration

### API (.env)
- ✅ OpenAI API Key configured
- ✅ Using real Shelby account (Akasha's funded account)
- ⚠️ Shelby SDK currently in mock mode (debugging network config)
- ✅ Embeddings: OpenAI (real)
- ✅ LLM: GPT-4o-mini (real)
- ✅ Database: SQLite

### What Works:
- ✅ File uploads (stored in database)
- ✅ Text extraction from PDFs
- ✅ OpenAI embeddings (semantic search)
- ✅ RAG queries with LLM
- ✅ Citation generation
- ⚠️ Shelby storage (mock mode - will fix)
- ✅ Delete packs & documents

---

## 🧪 Testing the App

### Test 1: Upload a File
1. Login with any email
2. Go to "My Packs"
3. Click "New Pack"
4. Upload a small text file first (< 1MB)
5. Should see file in pack details

### Test 2: Upload Shelby Docs
1. Upload: `/Users/jay/src/shelby-verifiable-rag/plan/shelby_docs.txt`
2. Wait 1-2 minutes (large file)
3. Should see:
   - File listed
   - Size shown
   - Chunks created

### Test 3: Ask Questions
1. Go to "Chat"
2. Select your pack
3. Ask: "What is Shelby hot storage?"
4. Should get answer with citations

### Test 4: Delete
1. Go to pack detail page
2. Click red trash icon on a file
3. Or click "Delete Pack" button

---

## 🔧 Troubleshooting

### Issue: Upload shows 0 documents
**Cause**: Upload error (check API logs)
**Fix**: Check `/tmp/api.log` for errors

### Issue: No citations in query
**Cause**: Text extraction or embedding failed
**Fix**: Check if file type is supported

### Issue: "Failed to fetch"
**Cause**: API not running or CORS issue
**Fix**: 
```bash
# Check API is running
curl http://localhost:4000/health

# Restart if needed
pkill -f "tsx watch"
pnpm dev:api
```

### Issue: Large file upload timeout
**Solution**: Files > 5MB with many pages take 1-2 minutes
- Be patient
- Check API logs: `tail -f /tmp/api.log`

---

## 🔑 About Shelby Credentials

### Current Setup (Akasha's Account):
```
Account: 0x4a17...7399
Private Key: ed25519-priv-0xd850...4713
API Key: AG-6DKRUS...
```

### Why Mock Mode?
The Shelby SDK initialization is failing with network config.
We're debugging this but the app works perfectly otherwise!

### To Generate Your Own Account:
```bash
# Install Shelby CLI
npm install -g @shelby-protocol/cli

# Initialize
shelby init

# Get credentials
cat ~/.shelby/config.yaml

# Fund account:
# https://docs.shelby.xyz/apis/faucet/aptos
# https://docs.shelby.xyz/apis/faucet/shelbyusd
```

---

## 📊 Database Commands

### View Data:
```bash
sqlite3 apps/api/data.sqlite

# List packs
SELECT * FROM source_packs;

# List documents
SELECT * FROM docs;

# List chunks (limited)
SELECT chunk_id, pack_id, substr(text, 1, 50) as preview 
FROM chunks LIMIT 10;

# Stats
SELECT 
  (SELECT COUNT(*) FROM source_packs) as packs,
  (SELECT COUNT(*) FROM docs) as docs,
  (SELECT COUNT(*) FROM chunks) as chunks;
```

### Reset Database:
```bash
rm apps/api/data.sqlite
# Restart API - will recreate schema
```

---

## 🌐 Deployment to Vercel

### Step 1: Prepare
```bash
# Build to test
cd apps/web
pnpm build
```

### Step 2: Deploy Web
```bash
cd apps/web
vercel
```

### Step 3: Deploy API (Railway recommended)
```bash
cd apps/api
railway init
railway up
```

### Step 4: Update Environment
In Vercel dashboard, set:
```
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

---

## 🐛 Common Issues & Fixes

### Port Already in Use
```bash
# Kill processes
pkill -f "tsx watch|next dev"

# Or specific port
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### Web App Not Updating
```bash
# Clear Next.js cache
rm -rf apps/web/.next
pnpm dev:web
```

### API Crashes
```bash
# Check logs
tail -f /tmp/api.log

# Restart
pkill -f "tsx watch"
pnpm dev:api
```

---

## 📦 Package Scripts

```bash
# Run both (from root)
pnpm dev

# Individual
pnpm dev:api    # API server
pnpm dev:web    # Web app  
pnpm cli        # CLI tool

# Build
pnpm build      # All packages

# Clean
pnpm clean      # Remove node_modules
```

---

## 🎯 Features Working

### ✅ Fully Working:
- Authentication (dev mode)
- File upload UI (drag-drop)
- Text extraction (PDF, text, etc.)
- OpenAI embeddings (semantic)
- RAG queries with GPT-4o-mini
- Citation display
- Delete packs & documents
- Beautiful UI with animations
- Mobile responsive

### ⚠️ Partially Working:
- Shelby storage (mock mode currently)
- Will upload to real Shelby once SDK init is fixed

---

## 💡 Tips

### For Best Experience:
1. **Start with small files** (< 1MB) first
2. **Use text/PDF files** (best supported)
3. **Wait for upload** (progress shown)
4. **Check API logs** if issues occur

### For Demo:
1. Pre-upload Shelby docs
2. Prepare good questions
3. Show the beautiful UI
4. Highlight verification feature

---

## 📞 Need Help?

- Check `README.md` for overview
- Check `ARCHITECTURE.md` for system design
- Check API logs: `tail -f /tmp/api.log`
- Check browser console for frontend errors

---

**Your app is working! Test it now at http://localhost:3000** 🚀

