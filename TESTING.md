# 🧪 Testing Guide - Shelby Verifiable RAG

Complete guide to test your application before deployment.

---

## 🚀 Quick Start Testing

### 1. Install Dependencies
```bash
cd /Users/jay/src/shelby-verifiable-rag
pnpm install
```

### 2. Configure Environment

**API (.env)**:
```bash
cp apps/api/env.example apps/api/.env
```

Edit `apps/api/.env`:
```env
PORT=4000
DATABASE_URL=./data.sqlite

# Get from https://geomi.dev
SHELBY_NETWORK=SHELBYNET
SHELBY_API_KEY=aptoslabs_your_key_here

# Generate new account or use existing
APTOS_PRIVATE_KEY=ed25519-priv-0x...

# Get from OpenAI
OPENAI_API_KEY=sk-...

# Config
EMBEDDINGS_PROVIDER=openai
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
CORS_ORIGIN=http://localhost:3000
SESSION_SECRET=$(openssl rand -base64 32)
```

**Web (.env.local)**:
```bash
cp apps/web/env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Start Services

**Terminal 1 - API Server**:
```bash
pnpm dev:api
```

Expected output:
```
📊 Database initialized: ./data.sqlite
☁️  Initializing Shelby client...
   Account: 0x...
🤖 Initializing embeddings (openai)...
✅ All services initialized

✅ API server running on http://localhost:4000
```

**Terminal 2 - Web App**:
```bash
pnpm dev:web
```

Expected output:
```
  ▲ Next.js 15.0.0
  - Local:        http://localhost:3000
  ✓ Ready in 2.3s
```

---

## 📝 Manual Testing Checklist

### Test 1: Authentication ✓
1. Open http://localhost:3000
2. Click "Login" in nav
3. Enter any email (e.g., `test@example.com`)
4. Should redirect to /packs

**Expected**: Cookie set, user created in database

### Test 2: File Upload ✓
1. Go to /packs
2. Click "New Pack"
3. Enter title: "Test Pack"
4. Add summary (optional)
5. Add tags: "test, demo"
6. Drag & drop a PDF or text file
7. Click "Create Pack"

**Expected**:
- Files upload to Shelby
- Text extracted from PDF
- Embeddings generated
- Pack created
- Redirects to pack detail page

**Verify**:
```bash
# Check database
sqlite3 apps/api/data.sqlite
SELECT * FROM source_packs;
SELECT * FROM docs;
SELECT * FROM chunks LIMIT 5;
```

### Test 3: Pack Details ✓
1. Click on newly created pack
2. Should see:
   - Pack title and metadata
   - List of documents
   - Shelby blob IDs
   - SHA256 hashes

**Expected**: All files listed with hashes

### Test 4: Make Pack Public ✓
1. On pack detail page, note visibility is "Private"
2. Go back to /packs
3. Click "Make Public" on the pack card
4. Refresh page

**Expected**: Visibility changed to "Public"

### Test 5: Public Discovery ✓
1. Go to homepage (/)
2. Should see your public pack in the list
3. Try searching by title or tag

**Expected**: Pack appears in search results

### Test 6: Query (Private) ✓
1. Go to /chat
2. Select your pack from dropdown
3. Ask: "What is this document about?"
4. Click Send

**Expected**:
- Answer appears within 5 seconds
- Citations listed below
- Each citation shows:
  - Snippet
  - Blob ID
  - SHA256
  - "Verify" button

### Test 7: Citation Verification ✓
1. On chat page with results
2. Click "Verify on Shelby" on a citation

**Expected**:
- Button shows "Verifying..."
- After 2-3 seconds: Green checkmark "✓ Verified on Shelby"
- Hash matches

### Test 8: Public Query ✓
1. Open incognito window (not logged in)
2. Go to http://localhost:3000
3. Find your public pack
4. Click on it
5. Click "Ask Questions About This Pack"

**Expected**: Can query without login

### Test 9: CLI Upload ✓
1. Create test folder:
   ```bash
   mkdir test-docs
   echo "Test content" > test-docs/file1.txt
   echo "More content" > test-docs/file2.txt
   ```

2. Get your user ID:
   ```bash
   # From login response or database
   sqlite3 apps/api/data.sqlite "SELECT user_id FROM users LIMIT 1;"
   ```

3. Upload via CLI:
   ```bash
   cd apps/cli
   USER_ID=your_user_id pnpm dev upload ../../test-docs --title "CLI Test Pack"
   ```

**Expected**: Files uploaded, pack created

---

## 🔍 Testing API Endpoints with cURL

### Health Check
```bash
curl http://localhost:4000/health
```

### Login
```bash
curl -X POST http://localhost:4000/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  -c cookies.txt -v
```

### Create Pack
```bash
# Create test file
echo "Shelby is a decentralized storage system" > test.txt

curl -X POST http://localhost:4000/packs \
  -b cookies.txt \
  -F "title=API Test Pack" \
  -F "summary=Testing via API" \
  -F "tags=test,api" \
  -F "files=@test.txt"
```

### List Packs
```bash
curl http://localhost:4000/packs \
  -b cookies.txt
```

### Query
```bash
curl -X POST http://localhost:4000/query \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Shelby?",
    "pack_id": "<pack_id_from_previous_step>"
  }'
```

### Verify
```bash
# Get blob_id from query response
curl "http://localhost:4000/verify/<blob_id>"
```

---

## 🐛 Common Issues & Solutions

### Issue: "Shelby upload failed"
**Solution**:
- Check `SHELBY_API_KEY` is set correctly
- Verify `APTOS_PRIVATE_KEY` is valid ed25519 key
- Check Shelby network is accessible
- Ensure Aptos account has APT tokens for gas

### Issue: "OpenAI API error"
**Solution**:
- Check `OPENAI_API_KEY` is valid
- Verify API key has credits
- Check rate limits

### Issue: "No embeddings generated"
**Solution**:
- Switch to local provider temporarily:
  ```env
  EMBEDDINGS_PROVIDER=local
  ```
- Note: Local uses hash-based, not semantic

### Issue: "CORS error"
**Solution**:
- Check `CORS_ORIGIN` in API matches web app URL exactly
- Include protocol (http:// or https://)
- No trailing slash

### Issue: "Upload timeout"
**Solution**:
- Large files take time for OCR
- Disable OCR for testing
- Check file size limits

### Issue: "Database locked"
**Solution**:
- SQLite WAL mode should prevent this
- If persists, restart API server
- Consider PostgreSQL for production

---

## 📊 Performance Benchmarks

### Target Metrics
- **Upload**: < 30s for 10 PDF files (no OCR)
- **Upload**: < 2 min for 10 images (with OCR)
- **Query**: < 3s for answer + 5 citations
- **Verify**: < 2s to re-fetch and hash
- **Discover**: < 500ms to list 100 packs

### Measuring Performance
```bash
# Time a query
time curl -X POST http://localhost:4000/query \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"question":"test"}'
```

---

## 🔬 Advanced Testing

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Create test script
cat > load-test.yml << EOF
config:
  target: http://localhost:4000
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - name: "Query test"
    flow:
      - post:
          url: "/query"
          json:
            question: "test"
          headers:
            x-user-id: "test-user"
EOF

# Run
artillery run load-test.yml
```

### End-to-End Test Script
```bash
#!/bin/bash
# test-e2e.sh

set -e

echo "🧪 Running E2E tests..."

# Login
USER=$(curl -s -X POST http://localhost:4000/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@test.com"}' \
  -c /tmp/cookies.txt)

USER_ID=$(echo $USER | jq -r '.user_id')
echo "✓ Logged in as $USER_ID"

# Upload
echo "test content" > /tmp/test.txt
PACK=$(curl -s -X POST http://localhost:4000/packs \
  -b /tmp/cookies.txt \
  -F "title=E2E Test" \
  -F "files=@/tmp/test.txt")

PACK_ID=$(echo $PACK | jq -r '.pack_id')
echo "✓ Created pack $PACK_ID"

# Wait for indexing
sleep 5

# Query
RESULT=$(curl -s -X POST http://localhost:4000/query \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"what is this?\",\"pack_id\":\"$PACK_ID\"}")

ANSWER=$(echo $RESULT | jq -r '.answer')
echo "✓ Got answer: ${ANSWER:0:50}..."

# Verify
BLOB_ID=$(echo $RESULT | jq -r '.citations[0].shelby_blob_id')
VERIFY=$(curl -s "http://localhost:4000/verify/$BLOB_ID")

OK=$(echo $VERIFY | jq -r '.ok')
if [ "$OK" == "true" ]; then
  echo "✓ Verification passed"
else
  echo "✗ Verification failed"
  exit 1
fi

echo "\n🎉 All tests passed!"
```

---

## 🎯 Test Coverage Goals

- [ ] Unit tests for core packages (70%+)
- [ ] Integration tests for API (80%+)
- [ ] E2E tests for critical flows (100%)
- [ ] Component tests for UI (60%+)

---

## ✅ Definition of Done

Application is ready when:
1. ✅ All smoke tests pass
2. ✅ E2E script runs successfully
3. ✅ Performance benchmarks met
4. ✅ No console errors in browser
5. ✅ Mobile responsive
6. ✅ Works in incognito (public features)
7. ✅ Verification always succeeds for valid blobs
8. ✅ Clear error messages for failures

---

**Test thoroughly before deploying to production!** 🚀

