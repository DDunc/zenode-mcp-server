# LLM Container for Grunts Distributed Coding
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    python3 \
    py3-pip \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy worker script and dependencies
COPY package.json ./
COPY grunt-worker.js ./
COPY task-executor.js ./
COPY zenode-client.js ./

# Copy real LLM worker and its dependencies
COPY real-llm-worker.js ./real-llm-worker.js
COPY optimized-redis-learning.js ./optimized-redis-learning.js
COPY error-similarity.js ./error-similarity.js

# Copy zenode source for provider access
COPY src/ ./src/

# Install Node.js dependencies
RUN npm install

# Create workspace directory
RUN mkdir -p /workspace

# Set environment variables
ENV NODE_ENV=production
ENV WORKSPACE_PATH=/workspace

# Build args from docker-compose
ARG MODEL=qwen2.5-coder:14b
ARG SPECIALIZATION=javascript-typescript

ENV MODEL_NAME=${MODEL}
ENV SPECIALIZATION_TYPE=${SPECIALIZATION}

# Create non-root user for security
RUN addgroup -g 1001 -S grunt && \
    adduser -S grunt -u 1001 -G grunt

# Change ownership of workspace
RUN chown -R grunt:grunt /workspace /app

# Switch to non-root user
USER grunt

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port for worker communication
EXPOSE 3000

# Start the real LLM worker (with task-aware generation)
CMD ["node", "real-llm-worker.js"]