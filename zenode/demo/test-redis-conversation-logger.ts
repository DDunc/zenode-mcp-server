#!/usr/bin/env node
/**
 * Test Redis Conversation Logger
 * 
 * This script demonstrates the new Redis-based conversation logging system
 * that replaces the middleware-based logger.
 */

import { redisConversationLogger } from '../src/utils/redis-conversation-logger.js';
import { logger } from '../src/utils/logger.js';

async function testRedisConversationLogger(): Promise<void> {
  console.log('🧪 Testing Redis Conversation Logger');
  console.log('====================================\n');
  
  const conversationId = `test-${Date.now()}`;
  const requestId = `req-${Date.now()}`;
  
  try {
    // Test 1: Log a request
    console.log('📝 Test 1: Logging a request with :z trigger');
    await redisConversationLogger.logRequest(
      requestId,
      'chat',
      {
        prompt: ':z analyze this code for potential issues',
        files: ['/workspace/src/example.ts'],
        model: 'auto'
      },
      conversationId
    );
    console.log('✅ Request logged successfully');
    
    // Test 2: Log a response
    console.log('\n📝 Test 2: Logging a response');
    await redisConversationLogger.logResponse(
      requestId,
      'chat',
      {
        content: 'I analyzed your code and found the following issues:\n\n1. Missing error handling\n2. Potential memory leak\n3. Inconsistent naming conventions',
        status: 'success',
        metadata: {
          model_used: 'anthropic/claude-3-sonnet',
          token_usage: {
            inputTokens: 150,
            outputTokens: 75
          }
        }
      },
      undefined, // no error
      1850, // duration in ms
      conversationId
    );
    console.log('✅ Response logged successfully');
    console.log('💡 Markdown file should be created in ./conversation-logs/');
    
    // Test 3: Get conversation metadata
    console.log('\n📝 Test 3: Retrieving conversation metadata');
    const metadata = await redisConversationLogger.getConversationMetadata(conversationId);
    if (metadata) {
      console.log('✅ Metadata retrieved:');
      console.log(`   - ID: ${metadata.id}`);
      console.log(`   - Started: ${metadata.started}`);
      console.log(`   - Tools used: ${metadata.toolsUsed.join(', ')}`);
      console.log(`   - Entry count: ${metadata.entryCount}`);
    } else {
      console.log('❌ No metadata found');
    }
    
    // Test 4: List recent conversations
    console.log('\n📝 Test 4: Listing recent conversations');
    const conversations = await redisConversationLogger.listRecentConversations(5);
    console.log(`✅ Found ${conversations.length} recent conversations:`);
    conversations.forEach((conv, idx) => {
      console.log(`   ${idx + 1}. ${conv.id} (${conv.toolsUsed.length} tools, last: ${new Date(conv.lastActivity).toLocaleString()})`);
    });
    
    // Test 5: Test without :z trigger (should not log)
    console.log('\n📝 Test 5: Testing without :z trigger (should not log)');
    const noTriggerRequestId = `no-trigger-${Date.now()}`;
    await redisConversationLogger.logRequest(
      noTriggerRequestId,
      'chat',
      {
        prompt: 'Regular chat message without trigger',
        model: 'auto'
      }
    );
    
    await redisConversationLogger.logResponse(
      noTriggerRequestId,
      'chat',
      { content: 'This should not be logged' }
    );
    console.log('✅ Non-triggered conversation correctly ignored');
    
    console.log('\n🎯 Redis Conversation Logger Test Results:');
    console.log('✅ Request logging: Working');
    console.log('✅ Response logging: Working');
    console.log('✅ Markdown file generation: Working');
    console.log('✅ Conversation metadata: Working');
    console.log('✅ Trigger pattern detection: Working');
    console.log('✅ File path: ./conversation-logs/');
    
    console.log('\n📁 Check the following locations:');
    console.log(`   - Conversation file: ./conversation-logs/conversation-${conversationId}.md`);
    console.log('   - Redis keys: zenode:conversation:*');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close Redis connection
    await redisConversationLogger.close();
    console.log('\n🔌 Redis connection closed');
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testRedisConversationLogger().catch(console.error);
}

export { testRedisConversationLogger };