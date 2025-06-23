#!/bin/bash

# Redis Debugging Script for Zenode MCP Server
# This script performs comprehensive Redis connectivity debugging

set -e

echo "🔍 REDIS DEBUGGING SESSION - $(date)"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}📋 STEP: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Container Status Check
print_step "Container Status and Network Verification"

echo "Checking container status:"
docker-compose ps

echo -e "\nChecking Redis container logs:"
docker-compose logs redis --tail=5

echo -e "\nChecking Zenode container logs for Redis patterns:"
docker-compose logs zenode --tail=10 | grep -i redis || echo "No Redis logs found"

# Step 2: Network Connectivity Tests
print_step "Network Connectivity Tests"

echo "Testing DNS resolution from zenode to redis:"
if docker-compose exec zenode nslookup redis; then
    print_success "DNS resolution works"
else
    print_error "DNS resolution failed"
fi

echo -e "\nTesting TCP connectivity:"
if docker-compose exec zenode nc -z redis 6379; then
    print_success "TCP connectivity works"
else
    print_error "TCP connectivity failed"
fi

echo -e "\nTesting Redis protocol:"
REDIS_RESPONSE=$(docker-compose exec zenode sh -c "echo 'ping' | nc redis 6379" 2>/dev/null || echo "FAILED")
if [[ "$REDIS_RESPONSE" == *"PONG"* ]]; then
    print_success "Redis protocol works: $REDIS_RESPONSE"
else
    print_error "Redis protocol failed: $REDIS_RESPONSE"
fi

# Step 3: Environment Variables Check
print_step "Environment Variables Verification"

echo "Environment variables in zenode container:"
docker-compose exec zenode env | grep -E "(REDIS|DISABLE)" || echo "No Redis/Disable vars found"

echo -e "\nNode.js process environment check:"
docker-compose exec zenode node -e "
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('DISABLE_ALL_REDIS:', process.env.DISABLE_ALL_REDIS);
console.log('DISABLE_REDIS_CONVERSATION_MEMORY:', process.env.DISABLE_REDIS_CONVERSATION_MEMORY);
"

# Step 4: Direct Redis Client Test
print_step "Direct Redis Client Connection Test"

echo "Testing direct Node.js Redis connection:"
docker-compose exec zenode node -e "
const { createClient } = require('redis');
console.log('Creating Redis client with URL:', process.env.REDIS_URL);

const client = createClient({ 
    url: process.env.REDIS_URL,
    socket: {
        reconnectStrategy: false
    }
});

client.on('error', (err) => {
    console.error('❌ Redis client error:', err.message);
    process.exit(1);
});

client.on('connect', () => {
    console.log('🔗 Redis client connected');
});

client.on('ready', () => {
    console.log('✅ Redis client ready');
    client.disconnect().then(() => {
        console.log('🔌 Redis client disconnected cleanly');
        process.exit(0);
    });
});

console.log('Attempting to connect...');
client.connect().catch((err) => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.error('❌ Connection timeout');
    process.exit(1);
}, 10000);
"

# Step 5: Application Code Analysis
print_step "Analyzing Application Redis Usage"

echo "Searching for Redis client creation in compiled code:"
docker-compose exec zenode find dist -name "*.js" -exec grep -l "createClient" {} \; || echo "No createClient found in dist"

echo -e "\nChecking for Redis imports in compiled code:"
docker-compose exec zenode find dist -name "*.js" -exec grep -l "require.*redis" {} \; || echo "No Redis requires found in dist"

echo -e "\nChecking environment variable usage in compiled code:"
docker-compose exec zenode find dist -name "*.js" -exec grep -l "DISABLE.*REDIS" {} \; || echo "No DISABLE_REDIS found in dist"

# Step 6: Runtime Redis Client Detection
print_step "Runtime Redis Client Detection"

echo "Creating runtime Redis detector script:"
docker-compose exec zenode node -e "
console.log('🔍 Scanning for Redis client instantiation...');

// Override createClient to detect calls
const redis = require('redis');
const originalCreateClient = redis.createClient;

let clientCount = 0;
redis.createClient = function(...args) {
    clientCount++;
    console.log(\`🚨 Redis client #\${clientCount} created with args:\`, args);
    console.log('📍 Stack trace:');
    console.trace();
    
    const client = originalCreateClient.apply(this, args);
    
    client.on('error', (err) => {
        console.log(\`❌ Client #\${clientCount} error:\`, err.message);
    });
    
    client.on('connect', () => {
        console.log(\`🔗 Client #\${clientCount} connected\`);
    });
    
    return client;
};

console.log('✅ Redis monitoring installed. Loading application...');

// Load the main application modules to trigger Redis client creation
try {
    require('./dist/utils/conversation-memory.js');
    console.log('📦 Loaded conversation-memory.js');
} catch (err) {
    console.log('❌ Failed to load conversation-memory.js:', err.message);
}

try {
    require('./dist/utils/redis-conversation-logger.js');
    console.log('📦 Loaded redis-conversation-logger.js');
} catch (err) {
    console.log('❌ Failed to load redis-conversation-logger.js:', err.message);
}

try {
    require('./dist/tools/threads.js');
    console.log('📦 Loaded threads.js');
} catch (err) {
    console.log('❌ Failed to load threads.js:', err.message);
}

setTimeout(() => {
    console.log(\`\n📊 SUMMARY: \${clientCount} Redis clients were created\`);
    process.exit(0);
}, 5000);
"

print_step "Analysis Complete"
echo "🏁 Redis debugging session completed at $(date)"