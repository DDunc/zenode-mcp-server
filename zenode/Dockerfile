# Zenode MCP Server Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache tini

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies without running scripts
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/systemprompts ./systemprompts
COPY --from=builder /app/conf ./conf

# Copy configuration files if they exist
COPY --from=builder /app/zenode-config.json* ./
COPY --from=builder /app/zenode.config.* ./
COPY --from=builder /app/bootstrap-config.json ./

# Create non-root user
RUN addgroup -g 1001 -S zenode && \
    adduser -S zenode -u 1001 -G zenode && \
    chown -R zenode:zenode /app

# Create log directory
RUN mkdir -p /tmp && chown zenode:zenode /tmp

USER zenode

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Run the server
CMD ["node", "dist/index.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1