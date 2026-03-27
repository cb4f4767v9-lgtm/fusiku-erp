# FUSIKU ERP Backend - Multi-stage Node 20 Alpine build
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and Prisma schema
COPY . .

# Generate Prisma client and build TypeScript
RUN npx prisma generate && npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files for production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install prisma && npm cache clean --force

# Copy Prisma schema and generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Copy built output
COPY --from=builder /app/dist ./dist

# Create uploads directory and entrypoint (try migrate deploy, fallback to db push if no migrations)
RUN mkdir -p uploads && chown -R nodejs:nodejs uploads && \
    echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'npx prisma migrate deploy || npx prisma db push' >> /entrypoint.sh && \
    echo 'exec "$@"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

USER nodejs

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
