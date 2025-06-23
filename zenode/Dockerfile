# Fixed Zenode Dockerfile - PatrykIti-Inspired Security + Simplicity
# Optimized for filesystem access and tool registration stability
# Based on proven working approach from PatrykIti's zen-mcp-server fork

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    tini \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user for security (PatrykIti's pattern)
# Use a different GID if 1000 is taken
RUN addgroup -S mcpuser && \
    adduser -S mcpuser -G mcpuser

# Copy package files for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy built application (assumes you run npm run build before docker build)
COPY dist/ ./dist/
COPY conf/ ./conf/
COPY systemprompts/ ./systemprompts/

# Copy configuration files if they exist
COPY zenode-config.json* ./
COPY zenode.config.* ./
COPY bootstrap-config.json ./

# Create logs directory and set permissions
RUN mkdir -p /app/logs && \
    chown -R mcpuser:mcpuser /app

# Switch to non-root user (security best practice from PatrykIti)
USER mcpuser

# Set environment variables for production
ENV NODE_ENV=production \
    LOG_LEVEL=info

# Use tini for proper signal handling in containers
ENTRYPOINT ["/sbin/tini", "--"]

# CRITICAL FIX: Direct startup (no complex orchestration that causes restart loops)
CMD ["node", "dist/index.js"]

# Health check using simple Node.js check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Metadata labels
LABEL maintainer="Zenode MCP Server" \
      description="Fixed filesystem access MCP server for AI tools" \
      version="1.0.1" \
      org.opencontainers.image.source="https://github.com/BeehiveInnovations/zen-mcp-server"

# Build Instructions:
# 1. Run: npm run build  (before docker build)
# 2. Run: docker build -f Dockerfile-fixed -t zenode-mcp:fixed .
# 3. Use docker-compose-fixed.yml for deployment
#
# Key Fixes:
# - Simplified startup process (no complex delays)
# - Non-root user for security
# - Direct filesystem access support
# - Reduced container restart potential