# Test Runner Environment - Apple Silicon optimized
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash \
    curl \
    jq

WORKDIR /app

# Install global test tools
RUN npm install -g \
    jest \
    vitest \
    cypress \
    playwright \
    eslint \
    typescript \
    ts-node

# Create test environment structure
RUN mkdir -p /workspace /results /tests

# Copy test runner script
COPY test-runner.js ./
COPY package.json ./

# Install dependencies
RUN npm ci

# Create non-root user
RUN addgroup -g 1001 -S tester && \
    adduser -S tester -u 1001 -G tester && \
    chown -R tester:tester /app /workspace /results

USER tester

EXPOSE 8080

CMD ["node", "test-runner.js"]