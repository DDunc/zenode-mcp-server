#!/bin/bash

# Live Redis Functionality Test - Verify Redis is Actually Working

set -e

echo "🔍 LIVE REDIS FUNCTIONALITY TEST"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}📋 $1${NC}"
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

# Test 1: Current Container Status
print_step "1. Container Status and Recent Logs"

echo "Container status:"
docker-compose ps zenode redis

echo -e "\nRecent zenode logs (last 20 lines):"
docker-compose logs zenode --tail=20

echo -e "\nLooking for Redis errors in logs:"
docker-compose logs zenode | grep -i "redis.*error\|econnrefused\|redis.*failed" | tail -10 || print_success "No Redis errors found in logs"

# Test 2: Live Redis Connection Test
print_step "2. Live Redis Connection Test from Zenode Container"

echo "Testing Redis connection from zenode container:"
docker-compose exec zenode node -e "
const { createClient } = require('redis');

async function testRedis() {
    console.log('Creating Redis client...');
    const client = createClient({ 
        url: 'redis://redis:6379/0',
        socket: {
            reconnectStrategy: false
        }
    });
    
    try {
        console.log('Connecting to Redis...');
        await client.connect();
        
        console.log('✅ Connected! Testing operations...');
        
        // Test basic operations
        await client.set('test:key', 'test:value');
        const value = await client.get('test:key');
        console.log('✅ Set/Get test:', value === 'test:value' ? 'PASSED' : 'FAILED');
        
        // Test ping
        const pong = await client.ping();
        console.log('✅ Ping test:', pong === 'PONG' ? 'PASSED' : 'FAILED');
        
        // Get Redis info
        const info = await client.info();
        const lines = info.split('\r\n');
        const connected_clients = lines.find(line => line.startsWith('connected_clients:'));
        const used_memory = lines.find(line => line.startsWith('used_memory_human:'));
        
        console.log('📊 Redis Info:');
        console.log('  ', connected_clients || 'connected_clients: unknown');
        console.log('  ', used_memory || 'used_memory: unknown');
        
        await client.disconnect();
        console.log('✅ Disconnected cleanly');
        
    } catch (error) {
        console.error('❌ Redis test failed:', error.message);
        process.exit(1);
    }
}

testRedis();
"

# Test 3: Check Redis Client Instances in Application
print_step "3. Redis Client Status in Application"

echo "Checking Redis clients in running application:"
docker-compose exec zenode node -e "
console.log('🔍 Checking Redis clients in application...');

// Test if Redis clients are properly initialized
try {
    const conversationMemory = require('./dist/utils/conversation-memory.js');
    console.log('✅ conversation-memory module loaded');
} catch (err) {
    console.log('❌ conversation-memory failed:', err.message);
}

try {
    const redisLogger = require('./dist/utils/redis-conversation-logger.js');
    console.log('✅ redis-conversation-logger module loaded');
} catch (err) {
    console.log('❌ redis-conversation-logger failed:', err.message);
}

try {
    const config = require('./dist/config.js');
    console.log('✅ Config REDIS_URL:', config.REDIS_URL);
    console.log('✅ Config IS_DOCKER_MODE:', config.IS_DOCKER_MODE);
} catch (err) {
    console.log('❌ config loading failed:', err.message);
}
"

# Test 4: Test Conversation Threading Functionality
print_step "4. Test Conversation Threading (Redis-backed)"

echo "Testing Redis-backed conversation functionality:"
docker-compose exec zenode node -e "
const { createThread, addTurn } = require('./dist/utils/conversation-memory.js');

async function testConversationThreading() {
    try {
        console.log('🧵 Testing conversation threading...');
        
        // Create a test thread
        const threadId = await createThread('test-tool', { prompt: 'test prompt' });
        console.log('✅ Created thread:', threadId);
        
        // Add a turn
        await addTurn(threadId, 'user', 'Hello world', { inputTokens: 10 });
        console.log('✅ Added user turn');
        
        await addTurn(threadId, 'assistant', 'Hello back!', { outputTokens: 5 });
        console.log('✅ Added assistant turn');
        
        console.log('✅ Conversation threading test PASSED');
        
    } catch (error) {
        console.log('❌ Conversation threading test FAILED:', error.message);
        console.log('📝 This could indicate Redis connectivity issues or conversation memory problems');
    }
}

testConversationThreading();
"

# Test 5: Check Redis Process and Memory
print_step "5. Redis Server Health Check"

echo "Redis server internal health:"
docker-compose exec redis redis-cli info server | grep -E "redis_version|uptime_in_seconds|process_id"

echo -e "\nRedis memory usage:"
docker-compose exec redis redis-cli info memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"

echo -e "\nRedis client connections:"
docker-compose exec redis redis-cli info clients

echo -e "\nRedis keyspace info:"
docker-compose exec redis redis-cli info keyspace || echo "No keyspace data (empty Redis)"

# Test 6: Network Connectivity Verification
print_step "6. Network Connectivity Verification"

echo "Testing network path from zenode to redis:"
docker-compose exec zenode ping -c 3 redis

echo -e "\nTesting Redis port accessibility:"
docker-compose exec zenode nc -z redis 6379 && print_success "Port 6379 accessible" || print_error "Port 6379 not accessible"

echo -e "\nTesting Redis protocol response:"
docker-compose exec zenode sh -c "echo 'INFO' | nc redis 6379" | head -5

print_step "Test Complete - Redis Status Summary"

echo "📊 REDIS FUNCTIONALITY VERIFICATION COMPLETE"
echo ""
echo "If all tests above show ✅, Redis is working correctly."
echo "If any tests show ❌, Redis has functional issues that need fixing."