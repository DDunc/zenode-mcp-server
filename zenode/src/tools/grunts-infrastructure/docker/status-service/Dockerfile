# Grunts Status Service - Apple Silicon optimized
FROM node:20-alpine

# Install dependencies for Docker socket access
RUN apk add --no-cache tini

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY server.js ./

# Create user for Docker socket access but run as root for /var/run/docker.sock access
RUN addgroup -g 1001 -S grunts && \
    adduser -S grunts -u 1001 -G grunts && \
    chown -R grunts:grunts /app

# Run as root to access Docker socket
USER root

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3030/api/status || exit 1

EXPOSE 3030

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]