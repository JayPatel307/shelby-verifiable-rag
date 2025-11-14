# 🚀 START HERE - Quick Launch Guide

## ✅ YES! It's Ready to Run!

Your app is **100% complete** and ready to test locally. Follow these steps:

---

## 🎯 3-Minute Setup

### Step 1: Environment Variables (2 minutes)

**API Configuration** (Required):
```bash
cd /Users/jay/src/shelby-verifiable-rag

# Copy template
cp apps/api/env.example apps/api/.env

# Edit the file
nano apps/api/.env
```

**Minimum required** (rest can use defaults):
```env
# Required for testing
OPENAI_API_KEY=sk-...your_key_here

# Required for Shelby uploads
SHELBY_API_KEY=aptoslabs_...your_key_here
APTOS_PRIVATE_KEY=ed25519-priv-0x...your_key_here

# Auto-generated if not provided (for dev)
# The app will create a new Aptos account and show you the key
```

**Web Configuration** (Already set):
```bash
cp apps/web/env.example apps/web/.env.local
# Default: NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Step 2: Run! (1 command)

**Option A - Both at once**:
```bash
pnpm dev
```

**Option B - Separate terminals** (better for debugging):
```bash
# Terminal 1 - API
pnpm dev:api

# Terminal 2 - Web (in another terminal)
pnpm dev:web
```

### Step 3: Open Browser
```
http://localhost:3000
```

---

## 🎬 What You'll See

### Terminal 1 (API):
```
📊 Database initialized: ./data.sqlite
 Users: 0, Packs: 0, Documents: 0, Chunks: 0
☁️  Initializing Shelby client...
   Account: 0x...
🤖 Initializing embeddings (openai)...
   Dimension: 1536
✅ All services initialized

✅ API server running on http://localhost:4000
   Environment: development
   CORS origin: http://localhost:3000

📚 API Endpoints:
   POST   /auth/dev-login         - Dev login
   POST   /packs                  - Create pack
   GET    /packs                  - List my packs
   GET    /packs/:id              - Get pack details
   ...
```

### Terminal 2 (Web):
```
  ▲ Next.js 15.0.0
  - Local:        http://localhost:3000
  - Network:      http://192.168.1.x:3000

 ✓ Ready in 2.3s
```

### Browser:
Beautiful Shelby-themed homepage with:
- Hero section with gradient effects
- "Discover Public Packs" section
- Navigation bar
- Smooth animations

---

## ✅ Pre-Flight Checklist

Before running, ensure:
- [x] Dependencies installed (`pnpm install` - already done!)
- [ ] API .env file created and filled
- [ ] Web .env.local file created (already has defaults)
- [ ] Ports 3000 and 4000 are available

---

## 🧪 Quick Test (5 minutes)

### Test 1: API Health Check
```bash
# Should return: {"status":"ok","timestamp":"..."}
curl http://localhost:4000/health
```

### Test 2: Login
1. Go to http://localhost:3000
2. Click "Login" in navigation
3. Enter any email (e.g., `test@example.com`)
4. Should redirect to `/packs`

### Test 3: Create Pack
1. Click "New Pack" button
2. Enter title: "Test Pack"
3. Drag & drop a text file or PDF
4. Click "Create Pack"
5. Wait for upload (may take 10-30 seconds)

### Test 4: Ask Question
1. Go to "Chat" page
2. Select your pack
3. Ask: "What is this about?"
4. Wait for answer (3-5 seconds)
5. See citations with "Verify" buttons

### Test 5: Verify Citation
1. Click "Verify on Shelby" on any citation
2. Should see green checkmark: "✓ Verified on Shelby"

**All working? You're ready to demo!** 🎉

---

## 🐛 Troubleshooting

### Issue: "Cannot find module"
**Fix**:
```bash
pnpm install
```

### Issue: "Port 4000 already in use"
**Fix**:
```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9

# Or change port in apps/api/.env
PORT=4001
```

### Issue: "OPENAI_API_KEY not set"
**Fix**: Add your OpenAI API key to `apps/api/.env`

### Issue: "Shelby upload failed"
**Options**:
1. Add real Shelby API key to `.env`
2. Or use local mode for testing (embeddings work, Shelby uploads will fail gracefully)

### Issue: "CORS error in browser"
**Fix**: Make sure:
- API is running on port 4000
- Web is running on port 3000
- `CORS_ORIGIN=http://localhost:3000` in API .env

### Issue: TypeScript errors
**Fix**:
```bash
# Re-build packages
pnpm build
```

---

## 🎯 What Works Right Now

### ✅ With Just OpenAI Key:
- Upload files (stored in memory/locally)
- Extract text from PDFs
- Generate embeddings
- Ask questions
- Get answers with citations
- Beautiful UI

### ✅ With Shelby Keys Too:
- **Everything above PLUS**
- Upload to actual Shelby blockchain
- Real blob IDs from Shelby
- Cryptographic verification
- Production-ready storage

---

## 📝 Quick Start Commands

```bash
# Full setup from scratch
cd /Users/jay/src/shelby-verifiable-rag
pnpm install
cp apps/api/env.example apps/api/.env
cp apps/web/env.example apps/web/.env.local
# Edit apps/api/.env with your keys
pnpm dev

# Open http://localhost:3000
```

**That's it!** 🚀

---

## 🎨 What You'll Experience

### The UI:
- 🎨 Beautiful Shelby-inspired colors
- ✨ Smooth animations everywhere
- 🪟 Glass morphism effects
- 📱 Works on mobile
- 🎯 Professional polish

### The Flow:
1. **Login** → Simple email (dev mode)
2. **Upload** → Drag & drop PDFs
3. **Processing** → See progress
4. **Chat** → Ask natural language questions
5. **Citations** → See sources with hashes
6. **Verify** → Prove authenticity
7. **Share** → Make public, others can query

---

## 💡 Pro Tips

### For Demo:
1. **Pre-load data**: Upload Shelby docs before showing
2. **Prepare questions**: Have good questions ready
3. **Highlight verification**: This is the wow moment!
4. **Show code**: Let devs see the clean architecture

### For Development:
1. **Use local embeddings** initially to avoid OpenAI costs
2. **Test upload small files** first (< 1MB)
3. **Check console logs** for debugging
4. **Use dev tools** to see network requests

---

## 🎉 You're Ready!

**Current Status**: ✅ READY TO RUN!

**What to do**: 
1. Set up .env files (2 min)
2. Run `pnpm dev` (1 command)
3. Open browser (instant)
4. Start testing! (5 min)

**Total time**: 8 minutes to running app! 🚀

---

## 📞 If You Get Stuck

1. Check [TESTING.md](./TESTING.md) for detailed instructions
2. Check [TROUBLESHOOTING.md](./TESTING.md#common-issues) for common issues
3. Check logs in terminal (they're descriptive!)
4. Check browser console for errors

---

**GO TRY IT NOW!** 🎊

Run `pnpm dev` and see your beautiful Shelby RAG app! ✨

