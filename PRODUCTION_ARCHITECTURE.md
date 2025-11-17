# 🏗️ Production Architecture - Deep Dive

**Option B: Professional Setup (GCP Cloud Run + Vercel + Cloud SQL)**

Complete system design explanation for 100-300 users with high reliability.

---

## 🎯 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│  (Chrome, Safari, Firefox - anywhere in the world)                  │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 │ HTTPS (Automatic SSL)
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE NETWORK                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Next.js App (Static + Server Components)                    │   │
│  │  - HTML/CSS/JS delivered from nearest edge location          │   │
│  │  - API calls proxied to GCP                                  │   │
│  │  - Cached at 100+ locations worldwide                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 │ HTTPS (Authenticated requests)
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    GCP CLOUD RUN (API SERVER)                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Express.js API (Containerized)                              │   │
│  │  - Handles uploads, queries, verification                    │   │
│  │  - Processes files (PDF extraction, chunking)                │   │
│  │  - Generates embeddings                                      │   │
│  │  - Calls OpenAI for RAG                                      │   │
│  │  - Manages authentication                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Auto-scaling: 1-10 instances (based on traffic)                    │
│  Region: us-central1 (or closest to your users)                     │
└────┬─────────────────────────────────┬──────────────────────────────┘
     │                                 │
     │                                 │
     ↓                                 ↓
┌─────────────────────┐    ┌──────────────────────────┐
│  GCP CLOUD SQL      │    │  SHELBY BLOCKCHAIN       │
│  (PostgreSQL 15)    │    │  (Aptos + Storage)       │
│                     │    │                          │
│  Stores:            │    │  Stores:                 │
│  - User accounts    │    │  - Actual file content   │
│  - Pack metadata    │    │  - Immutable blobs       │
│  - Document records │    │  - On-chain verification │
│  - Text chunks      │    │  - Cryptographic proofs  │
│  - Vector embeddings│    │                          │
│  - Query history    │    │  Access via:             │
│                     │    │  - Shelby RPC            │
│  Auto backups daily │    │  - Aptos blockchain      │
│  High availability  │    │  - Decentralized         │
└─────────────────────┘    └──────────────────────────┘
```

---

## 📊 Data Storage Strategy

### What Goes Where and Why

#### **PostgreSQL (GCP Cloud SQL)** - "The Brain"
Stores all **metadata** and **searchable data**:

```sql
-- User accounts (authentication state)
users
  ├── user_id (UUID)
  ├── email
  └── created_at

-- Source packs (collections of documents)
source_packs
  ├── pack_id (UUID)
  ├── owner_user_id (→ users)
  ├── title, summary, tags
  ├── visibility (private/public/unlisted)
  ├── manifest_blob_id (→ Shelby)
  └── created_at

-- Documents (file metadata)
docs
  ├── doc_id (UUID)
  ├── pack_id (→ source_packs)
  ├── path (filename)
  ├── mime (file type)
  ├── bytes (file size)
  ├── sha256 (content hash for verification)
  ├── shelby_blob_id (→ Shelby storage)
  └── created_at

-- Chunks (searchable text segments)
chunks
  ├── chunk_id (UUID)
  ├── pack_id (→ source_packs)
  ├── doc_id (→ docs)
  ├── text (extracted text content)
  ├── start_byte, end_byte (position in file)
  ├── embedding (vector: float[1536])
  └── created_at
```

**Size**: ~100-500MB for 100 users  
**Why PostgreSQL**: Fast queries, vector search, concurrent access

#### **Shelby Blockchain** - "The Vault"
Stores **actual file content** (immutable):

```
Shelby Storage
  └── Blobs (files)
      ├── account_address/pack_id/file1.pdf
      ├── account_address/pack_id/file2.txt
      └── account_address/pack_id/manifest.json

Each blob has:
  - Unique blob_id
  - SHA256 hash (on-chain)
  - Expiration date
  - Cryptographic commitment
```

**Size**: Actual files (PDFs, texts) - 10MB to 10GB  
**Why Shelby**: Verifiable, decentralized, immutable, cryptographic proofs

#### **Vercel Edge Cache** - "The CDN"
Stores **static assets** and **page cache**:

```
Vercel Edge Locations (100+ worldwide)
  ├── HTML pages (pre-rendered)
  ├── JavaScript bundles
  ├── CSS stylesheets
  ├── Images, fonts
  └── API response cache (optional)
```

**Size**: ~10-50MB  
**Why Vercel**: Global CDN, instant loading anywhere

---

## 🔄 Complete Data Flow (User Upload)

### **Step-by-Step: User Uploads a PDF**

```
1. USER ACTION (Browser)
   ↓
   User drags PDF file (5MB) → Uploader component
   File read into memory as Buffer
   
2. FRONTEND (Next.js on Vercel)
   ↓
   FormData created with:
   - title: "Research Papers"
   - files: [paper.pdf]
   - tags: ["AI", "research"]
   
   POST request sent to:
   https://your-api.run.app/packs
   
3. VERCEL EDGE
   ↓
   Request routed to nearest edge
   Proxied to Cloud Run (with cookies)
   
4. GCP CLOUD RUN (API Server - Container)
   ↓
   a) Express receives multipart/form-data
   b) Multer extracts file from request
   c) Auth middleware validates user (cookie)
   
   d) PackManager.createPack() called
      ├── Generate pack_id (UUID)
      ├── INSERT into PostgreSQL → source_packs table
      │
      ├── For each file:
      │   ├── Compute SHA256 hash
      │   │
      │   ├── Upload to Shelby:
      │   │   └─→ ShelbyClient.upload()
      │   │       └─→ Shelby SDK
      │   │           └─→ Aptos transaction (costs APT gas)
      │   │               └─→ Shelby RPC stores blob
      │   │                   └─→ Returns blob_id
      │   │
      │   ├── Store in PostgreSQL:
      │   │   └─→ INSERT into docs table
      │   │       (path, mime, bytes, sha256, shelby_blob_id)
      │   │
      │   ├── Extract text:
      │   │   └─→ TextProcessor.extractText()
      │   │       └─→ pdf-parse library
      │   │           └─→ Returns full text
      │   │
      │   ├── Chunk text:
      │   │   └─→ TextProcessor.chunkText()
      │   │       └─→ Split into 1000-word chunks with overlap
      │   │
      │   └── Generate embeddings:
      │       └─→ For each chunk:
      │           └─→ OpenAI API call
      │               └─→ text-embedding-3-small
      │                   └─→ Returns float[1536] vector
      │                       └─→ INSERT into chunks table
      │
      └── Create manifest JSON
          └─→ Upload to Shelby
              └─→ UPDATE source_packs.manifest_blob_id
   
5. RESPONSE SENT BACK
   ↓
   Cloud Run → Vercel Edge → Browser
   {
     pack_id: "uuid",
     files: [
       {
         path: "paper.pdf",
         shelby_blob_id: "0x.../paper.pdf",
         sha256: "abc123...",
         indexed: true,
         chunks: 45
       }
     ]
   }
   
6. FRONTEND UPDATES
   ↓
   - Shows success message
   - Redirects to pack detail page
   - Displays file with blob_id and hash
```

**Time**: 10-30 seconds depending on file size  
**Cost per upload**: ~$0.01-0.02

---

## 🔍 Complete Query Flow (User Asks Question)

### **Step-by-Step: "What is Shelby hot storage?"**

```
1. USER ACTION
   ↓
   Types question in chat interface
   Selects pack from dropdown
   Clicks Send
   
2. FRONTEND
   ↓
   POST https://your-api.run.app/query
   Body: {
     question: "What is Shelby hot storage?",
     pack_id: "uuid-of-pack"
   }
   Headers: { Cookie: "uid=user_id" }
   
3. CLOUD RUN API
   ↓
   a) Auth middleware validates user
   
   b) QueryEngine.queryPrivate() called:
   
      ├── Generate question embedding:
      │   └─→ OpenAI API
      │       └─→ "What is Shelby hot storage?"
      │           └─→ Returns float[1536] vector
      │
      ├── Search PostgreSQL:
      │   └─→ SELECT * FROM chunks WHERE pack_id = ?
      │       └─→ Load all chunks (~1000-5000)
      │           └─→ Compute cosine similarity
      │               └─→ For each chunk:
      │                   similarity = dot(query_vec, chunk_vec) / (norm * norm)
      │                   └─→ Sort by similarity
      │                       └─→ Take top 5 chunks
      │
      ├── Top 5 chunks now contain:
      │   ├── chunk.text (excerpt from document)
      │   ├── chunk.shelby_blob_id (from docs table)
      │   ├── chunk.sha256 (from docs table)
      │   └── chunk.score (similarity: 0.0-1.0)
      │
      ├── Format context for LLM:
      │   Context = "[1] " + chunk1.text + "\n\n" +
      │             "[2] " + chunk2.text + ...
      │
      └── Call OpenAI GPT-4o-mini:
          └─→ System: "Answer based only on provided context"
              └─→ User: "Context:\n" + contexts + "\n\nQuestion: ..."
                  └─→ Returns answer with [1], [2] references
   
4. RESPONSE
   ↓
   {
     answer: "Shelby hot storage refers to...[1]",
     citations: [
       {
         shelby_blob_id: "0x.../docs.pdf",
         sha256: "abc123...",
         snippet: "Hot storage in Shelby...",
         doc_path: "shelby_docs.txt",
         score: 0.89
       }
     ],
     query_time_ms: 1234
   }
   
5. FRONTEND RENDERS
   ↓
   - Shows answer with formatted text
   - Displays citation cards
   - Each citation has "Verify" button
```

**Time**: 2-5 seconds  
**Cost per query**: ~$0.002-0.005

---

## 🔐 Authentication Flow (Dev & Production)

### **Current: Dev Mode**

```
1. User enters email
   ↓
2. POST /auth/dev-login { email }
   ↓
3. API checks PostgreSQL:
   SELECT * FROM users WHERE email = ?
   ↓
   If not found:
     - Generate UUID
     - INSERT INTO users (user_id, email)
   ↓
4. Set signed cookie:
   res.cookie('uid', user_id, {
     httpOnly: true,
     signed: true,
     maxAge: 30 days
   })
   ↓
5. All future requests include cookie
   ↓
6. Middleware validates:
   req.signedCookies.uid
   ↓
   Check user exists in database
   ↓
   Attach req.userId to request
```

### **Future: NextAuth.js (Production)**

```
1. User clicks "Sign in with Google/GitHub"
   ↓
2. OAuth flow with provider
   ↓
3. NextAuth.js session created
   ↓
4. Session stored in:
   - JWT (encrypted token) OR
   - Database session table
   ↓
5. Every request:
   import { getServerSession } from "next-auth"
   const session = await getServerSession()
   ↓
6. Forward to API with:
   x-user-id: session.user.id
```

---

## 💾 What Data Lives Where

### **PostgreSQL Database** (Primary Data Store)

#### **users table**
```sql
Purpose: Authentication and user management
Size: ~1KB per user × 300 = 300KB
Queries: On every authenticated request
```

#### **source_packs table**
```sql
Purpose: Pack metadata and organization
Size: ~500 bytes per pack
Typical: 5-10 packs per user = 1,500-3,000 packs
Total: ~750KB - 1.5MB

Contains:
- pack_id, title, summary, tags
- visibility (who can see it)
- owner_user_id (who owns it)
- manifest_blob_id (pointer to Shelby)
```

#### **docs table**
```sql
Purpose: File metadata and Shelby references
Size: ~300 bytes per document
Typical: 10 docs per pack × 3000 packs = 30,000 docs
Total: ~9MB

Contains:
- Filename, mime type, size
- SHA256 hash (for verification)
- shelby_blob_id (where to find actual file)
- Relationships: which pack, which user
```

#### **chunks table** (Largest!)
```sql
Purpose: Searchable text segments with embeddings
Size: ~7KB per chunk (1KB text + 6KB vector)
Typical: 50 chunks per doc × 30,000 docs = 1.5M chunks
Total: ~10GB

Contains:
- text (the actual content excerpt)
- embedding (float[1536] vector for similarity search)
- Relationships: which doc, which pack
- Byte positions (for exact citation)
```

**Total PostgreSQL Size**: ~10-15GB for 300 active users  
**Monthly Cost**: $9-15 (db-f1-micro to db-g1-small)

### **Shelby Blockchain** (Content Store)

#### **What Gets Stored**:
```
User files (PDFs, text, etc.)
  ├── Original uploaded content
  ├── Immutable once uploaded
  ├── Accessible via blob_id
  └── Cryptographically verifiable

Manifests (JSON)
  ├── Pack metadata
  ├── File list with hashes
  └── Used for pack reconstruction
```

**Size**: Depends on uploads
- Average: 2-5MB per pack
- 3000 packs × 3MB = ~9GB
- Shelby uses erasure coding (1.6x overhead) = ~14GB actual

**Cost**: 
- Upload: APT gas + ShelbyUSD payment
- Storage: ShelbyUSD per GB per month
- Est: $30-50/month for 15GB

### **Vercel Edge** (Static Assets)

```
Next.js Build Output
  ├── _next/static/* (JS bundles)
  ├── _next/static/css/* (Stylesheets)
  ├── Prerendered HTML
  └── Image optimizations

Size: ~20-50MB
Cost: $0 (included in free tier)
```

---

## 🖥️ Server Architecture (GCP Cloud Run)

### **Container Specs**

```
Container: shelby-rag-api
Base Image: node:20-alpine (65MB)
Final Size: ~300MB (with dependencies)

Resources:
  CPU: 2 vCPU
  Memory: 2 GiB
  Timeout: 60 seconds
  Concurrency: 80 requests per instance
```

### **Scaling Configuration**

```yaml
Scaling:
  min_instances: 1     # Always 1 running (fast response)
  max_instances: 10    # Scale up under load
  
Auto-scaling triggers:
  - CPU > 60%
  - Request queue > 50
  - Response time > 2s
```

### **What Happens in the Container**

```
Container Startup (Cold Start):
  1. Node.js process starts
  2. Load environment variables
  3. Initialize database connection to Cloud SQL
  4. Initialize Shelby SDK with your account
  5. Initialize OpenAI client
  6. Start Express server on port 8080
  7. Ready to serve requests (2-3 seconds)

Per Request:
  1. Receive HTTP request
  2. Validate authentication (cookie/header)
  3. Process (upload/query/verify)
  4. Query PostgreSQL (~10-50ms)
  5. Call external APIs if needed:
     - Shelby upload: 1-5 seconds
     - OpenAI embed: 100-500ms
     - OpenAI LLM: 1-3 seconds
  6. Return response
  
Memory Usage:
  - Idle: ~200MB
  - Processing upload: ~500MB
  - Peak: ~1GB (large file with OCR)
```

### **Why This Works**

- **Auto-scaling**: More users → more containers automatically
- **Load balancing**: GCP distributes requests evenly
- **Health checks**: Unhealthy containers replaced automatically
- **Rolling updates**: Zero-downtime deployments

---

## 🔄 Request Flow (Detailed)

### **Upload Request Journey**

```
1. BROWSER
   User drags 5MB PDF
   ↓
   
2. NEXT.JS (Vercel Edge - San Francisco)
   FormData created
   Sent to: api.your-company.com/packs
   ↓ (50ms to GCP)
   
3. GCP LOAD BALANCER (us-central1)
   Receives request
   Routes to available Cloud Run instance
   ↓ (1ms)
   
4. CLOUD RUN INSTANCE #1 (Container)
   ├─→ Express receives request
   ├─→ Auth middleware: Extract cookie → Query PostgreSQL
   │   (5ms query)
   ├─→ PackManager processes:
   │   ├─→ Compute SHA256 (10ms)
   │   ├─→ Upload to Shelby (2-5 seconds)
   │   │   └─→ Shelby SDK → Aptos transaction → Shelby RPC
   │   ├─→ Extract PDF text (500ms-2s)
   │   │   └─→ pdf-parse library
   │   ├─→ Chunk text (50ms)
   │   ├─→ Generate embeddings (2-5 seconds)
   │   │   └─→ OpenAI API calls (parallel batches)
   │   └─→ Store in PostgreSQL:
   │       ├─→ INSERT docs (5ms)
   │       └─→ INSERT chunks × 45 (50ms)
   ├─→ Create manifest → Upload to Shelby (1s)
   └─→ Return response
   
5. RESPONSE
   ↓ (50ms to Vercel)
   
6. VERCEL EDGE
   ↓ (10ms to browser)
   
7. BROWSER
   Success! Shows pack details
```

**Total Time**: 8-15 seconds for 5MB PDF  
**Database Writes**: ~50 INSERT statements  
**External API Calls**: 2 Shelby uploads + 45 OpenAI embeds

---

## 🔐 Security & Data Protection

### **Data at Rest**

```
PostgreSQL:
  ✅ Encrypted at rest (AES-256)
  ✅ Automated backups (retained 7 days)
  ✅ Point-in-time recovery
  ✅ SSL/TLS connections only

Shelby:
  ✅ On-chain verification
  ✅ Decentralized (no single point of failure)
  ✅ Immutable (can't be altered)
  ✅ Cryptographic proofs

Environment Variables:
  ✅ Stored in GCP Secret Manager
  ✅ Never logged
  ✅ Encrypted in transit and at rest
```

### **Data in Transit**

```
Browser ←→ Vercel:    HTTPS (TLS 1.3)
Vercel ←→ Cloud Run:  HTTPS (TLS 1.3)
Cloud Run ←→ SQL:     Private VPC + SSL
Cloud Run ←→ Shelby:  HTTPS (TLS 1.3)
Cloud Run ←→ OpenAI:  HTTPS (TLS 1.3)
```

### **Access Control**

```
Users can:
  ✅ Create/delete own packs
  ✅ Query own packs
  ✅ Query public packs
  ✅ Verify any citation (public endpoint)
  
Users cannot:
  ✅ Access other users' private packs
  ✅ Delete other users' packs
  ✅ Modify pack ownership
  
Rate Limits:
  - Authenticated: 100 req/min
  - Public query: 30 req/5min per IP
  - Upload: 10 files/min per user
```

---

## 💾 Database Connection Pooling

### **How Cloud Run Connects to Cloud SQL**

```typescript
// Connection Pool Configuration
import { Pool } from 'pg'

const pool = new Pool({
  // Unix socket for Cloud SQL (more efficient than TCP)
  host: '/cloudsql/project:region:instance',
  database: 'shelby_rag',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  
  // Pool settings
  max: 5,                    // Max connections per container
  min: 1,                    // Keep 1 always warm
  idleTimeoutMillis: 30000,  // Close idle after 30s
  connectionTimeoutMillis: 2000,
})

// Reuse connections across requests
export async function query(sql, params) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}
```

**Why This Matters**:
- Each Cloud Run instance: 5 connections
- 10 instances max: 50 total connections
- Cloud SQL can handle 100+ connections easily
- Efficient resource usage

---

## 🧮 Resource Calculations

### **For 300 Active Users**

#### **Concurrent Users**:
```
300 total users
Peak: ~30-50 users simultaneously
Average: ~10-20 concurrent requests
```

#### **Cloud Run Instances Needed**:
```
Each instance handles: 80 concurrent requests
For 50 concurrent: 1-2 instances sufficient
Average: 1 instance
Peak: 2-3 instances

With min_instances=1: Always ready!
```

#### **Database Connections**:
```
2 Cloud Run instances × 5 connections = 10 active
Cloud SQL capacity: 100 connections (plenty of headroom)
```

#### **Request Distribution**:
```
Uploads: 10-20 per day = ~300/month
Queries: 500-1000 per day = ~20,000/month
Verifications: 100-200 per day = ~4,000/month

Total API requests: ~25,000/month
Cost: $2-5 on Cloud Run
```

---

## 🔄 High Availability & Failover

### **What Happens When Things Fail**

#### **Cloud Run Instance Crashes**:
```
1. Health check fails
2. Load balancer stops routing to instance
3. New instance spins up (5-10 seconds)
4. Zero requests dropped (queued)
5. User never notices
```

#### **PostgreSQL Goes Down**:
```
1. Cloud SQL automatic failover (if HA enabled)
2. Standby promoted to primary (30-60 seconds)
3. Requests queued during failover
4. Connection pool reconnects automatically
5. Service resumes
```

#### **Shelby/OpenAI Outage**:
```
1. Uploads fail gracefully
2. Error shown to user
3. Queries to existing data still work
4. Retry mechanism in place
```

#### **Vercel Edge Failure**:
```
1. Request routed to different edge location
2. Automatic failover (milliseconds)
3. User never notices
```

### **Monitoring**

```bash
# Health checks every 10 seconds
GET /health → 200 OK

# If 3 failures:
  → Instance marked unhealthy
  → New instance created
  → Old instance drained and stopped
```

---

## 📊 Complete Tech Stack

### **Frontend Stack** (Vercel)
```
┌─────────────────────────────┐
│  Next.js 15 (App Router)    │
│  ├── React 18               │
│  ├── TypeScript             │
│  ├── TailwindCSS            │
│  ├── React Query (caching)  │
│  └── Lucide Icons           │
└─────────────────────────────┘

Build Output:
  - Server Components (streamed)
  - Client Components (hydrated)
  - Static pages (cached)
  - API routes (serverless functions)
```

### **Backend Stack** (GCP Cloud Run)
```
┌─────────────────────────────┐
│  Express.js API Server      │
│  ├── TypeScript (compiled)  │
│  ├── Multer (file uploads)  │
│  ├── Cookie-parser (auth)   │
│  ├── Rate-limit (security)  │
│  └── CORS (configured)      │
└─────────────────────────────┘

Dependencies:
  - @shelby-protocol/sdk
  - @aptos-labs/ts-sdk
  - openai
  - pdf-parse
  - tesseract.js
  - better-sqlite3 → pg
```

### **Database Stack** (Cloud SQL)
```
┌─────────────────────────────┐
│  PostgreSQL 15              │
│  ├── pgvector (future)      │
│  ├── Connection pooling     │
│  ├── Automated backups      │
│  └── Read replicas (if HA)  │
└─────────────────────────────┘

Storage:
  - Data: 10-20GB
  - Backups: 30GB (7 days retention)
  - WAL logs: 5GB
```

### **External Services**
```
┌─────────────────────────────┐
│  Shelby Protocol            │
│  ├── Aptos blockchain       │
│  ├── Storage providers      │
│  ├── RPC endpoints          │
│  └── Indexer               │
└─────────────────────────────┘

┌─────────────────────────────┐
│  OpenAI                     │
│  ├── Embeddings API         │
│  ├── Chat Completions API   │
│  └── Rate limits: 500 RPM   │
└─────────────────────────────┘
```

---

## 🌐 Network Architecture

### **Request Path with Latency**

```
User in New York
  ↓ (5ms)
Vercel Edge (New York)
  ↓ (40ms)
Cloud Run (us-central1, Iowa)
  ├─→ Cloud SQL (same region) - 2ms
  ├─→ Shelby RPC - 100ms
  └─→ OpenAI API - 200ms
  ↓ (40ms)
Vercel Edge
  ↓ (5ms)
User

Total: ~400ms (fast!)
```

### **Geographic Distribution**

```
Vercel Edges (100+ locations):
  ├── North America (20+)
  ├── Europe (30+)
  ├── Asia (25+)
  ├── South America (10+)
  └── Others (15+)

Cloud Run (1 region):
  └── us-central1 (or us-west for California)

Why this works:
  - Static content served from nearest edge
  - API calls slightly slower but acceptable
  - Can add Cloud Run in multiple regions if needed
```

---

## 🔧 Environment Variables by Service

### **Vercel (Frontend)**
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# Public variables (visible to browser)
# Keep these minimal for security
```

### **Cloud Run (Backend)**
```env
# Database
DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance

# Shelby (from Secret Manager)
SHELBY_API_KEY=AG-...
APTOS_PRIVATE_KEY=ed25519-priv-0x...
APTOS_ACCOUNT_ADDRESS=0x...

# OpenAI (from Secret Manager)
OPENAI_API_KEY=sk-proj-...

# Configuration
EMBEDDINGS_PROVIDER=openai
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
CORS_ORIGIN=https://your-app.vercel.app
SESSION_SECRET=generated_secret
NODE_ENV=production
PORT=8080
```

---

## 📈 Performance Under Load

### **Baseline (1 user)**
- Upload: 10-30 seconds
- Query: 2-5 seconds
- Verify: 1-2 seconds

### **Peak Load (50 concurrent users)**
```
Cloud Run scales to 2-3 instances:

Instance 1: 20 requests
Instance 2: 20 requests
Instance 3: 10 requests

Each instance independent:
  - Own memory
  - Own database connections
  - Own request queue

Performance:
  - Upload: 10-40 seconds (slightly slower)
  - Query: 2-6 seconds (minimal impact)
  - Verify: 1-3 seconds
```

### **Bottlenecks**:
1. **OpenAI Rate Limits**: 500 RPM (requests per minute)
   - Solution: Request rate limiting per user
2. **Shelby Upload Speed**: Network dependent
   - Solution: Queue system for large uploads
3. **PostgreSQL Connections**: 100 max
   - Solution: Connection pooling (already implemented)

---

## 💡 Cost Optimization Tips

### **Reduce OpenAI Costs**:
```typescript
// Cache embeddings
const cachedEmbedding = await redis.get(`emb:${textHash}`)
if (cachedEmbedding) return cachedEmbedding

// Batch embeddings
await openai.embeddings.create({
  input: texts, // Multiple at once
})
```

### **Reduce Cloud Run Costs**:
```bash
# Scale to zero when idle (demo mode)
--min-instances=0

# Use spot pricing (cheaper, but can be interrupted)
--use-spot=true
```

### **Reduce Database Costs**:
```bash
# Start small
--tier=db-f1-micro

# Upgrade only when needed
# Monitor: gcloud sql operations list
```

---

## 🎯 Deployment Timeline

### **Week 1: Preparation**
- [ ] Migrate SQLite → PostgreSQL (I can build adapter)
- [ ] Test with Cloud SQL locally
- [ ] Create Dockerfile
- [ ] Test Docker build

### **Week 2: Deploy & Test**
- [ ] Deploy API to Cloud Run
- [ ] Deploy Web to Vercel
- [ ] Configure secrets
- [ ] End-to-end testing

### **Week 3: Polish**
- [ ] Set up monitoring
- [ ] Configure alerts
- [ ] Load testing
- [ ] Documentation

---

## 🚀 Ready to Deploy?

**I can help you build:**

1. ✅ **PostgreSQL Adapter** - Replace SQLite seamlessly
2. ✅ **Docker Configuration** - Multi-stage, optimized
3. ✅ **Deployment Scripts** - One-command deploy
4. ✅ **CI/CD Pipeline** - Auto-deploy on git push
5. ✅ **Monitoring Setup** - Alerts and dashboards

**Should I start building the production infrastructure now?** 

I'll create:
- PostgreSQL database adapter
- Docker configuration for Cloud Run
- Deployment scripts
- Migration guides

This will make your deployment smooth and professional! 🏗️

