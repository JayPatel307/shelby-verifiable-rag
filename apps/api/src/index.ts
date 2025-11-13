/**
 * API Server - Express application
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { requireUser, devLogin } from './middleware/auth';
import {
  createPack,
  getPack,
  updateVisibility,
  discoverPacks,
  listMyPacks,
} from './routes/packs';
import { queryPrivate, queryPublic } from './routes/query';
import { verifyBlob } from './routes/verify';

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(config.session.secret));

// Multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileBytes,
    files: config.upload.maxFilesPerPack,
  },
});

// Rate limiting for public endpoints
const publicQueryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requests per window per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth
app.post('/auth/dev-login', devLogin);

// Packs
app.post('/packs', requireUser, upload.any(), createPack);
app.get('/packs/:id', getPack);
app.get('/packs', requireUser, listMyPacks);
app.patch('/packs/:id/visibility', requireUser, updateVisibility);

// Discovery
app.get('/discover', discoverPacks);

// Query
app.post('/query', requireUser, queryPrivate);
app.post('/public_query', publicQueryLimiter, queryPublic);

// Verification
app.get('/verify/:blob_id', verifyBlob);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
const port = config.port;
app.listen(port, () => {
  console.log(`\n✅ API server running on http://localhost:${port}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS origin: ${config.cors.origin}`);
  console.log(`\n📚 API Endpoints:`);
  console.log(`   POST   /auth/dev-login         - Dev login`);
  console.log(`   POST   /packs                  - Create pack`);
  console.log(`   GET    /packs                  - List my packs`);
  console.log(`   GET    /packs/:id              - Get pack details`);
  console.log(`   PATCH  /packs/:id/visibility   - Update visibility`);
  console.log(`   GET    /discover               - List public packs`);
  console.log(`   POST   /query                  - Query (private)`);
  console.log(`   POST   /public_query           - Query (public)`);
  console.log(`   GET    /verify/:blob_id        - Verify blob`);
  console.log(`\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

