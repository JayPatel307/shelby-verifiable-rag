# Multi-stage Dockerfile for Cloud Run deployment
# Optimized for fast builds and small image size

# ============================================
# Stage 1: Base with pnpm
# ============================================
FROM node:20-alpine AS base
RUN npm install -g pnpm@8.15.0
WORKDIR /app

# ============================================
# Stage 2: Install all dependencies
# ============================================
FROM base AS deps
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all packages (needed for workspace)
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/shelby-client/package.json ./packages/shelby-client/
COPY packages/embeddings/package.json ./packages/embeddings/
COPY packages/text-processing/package.json ./packages/text-processing/
COPY packages/core/package.json ./packages/core/

# Copy API package.json
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 3: Build TypeScript
# ============================================
FROM deps AS builder
WORKDIR /app

# Copy source code
COPY packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# ============================================
# Stage 4: Production dependencies only
# ============================================
FROM base AS prod-deps
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/shelby-client/package.json ./packages/shelby-client/
COPY packages/embeddings/package.json ./packages/embeddings/
COPY packages/text-processing/package.json ./packages/text-processing/
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# ============================================
# Stage 5: Final production image
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./

# Copy built packages (source, not dist - tsx will use these)
COPY --from=prod-deps /app/packages ./packages
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy built API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules

# Create directory for SQLite (if used)
RUN mkdir -p /app/data && chown -R node:node /app

# Use non-root user for security
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Expose port
EXPOSE 8080

# Start server
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]

