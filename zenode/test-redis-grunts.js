#!/usr/bin/env node
/**
 * Test grunts tool with working Redis connection
 */

import { GruntsTool } from './dist/tools/grunts.js';

async function testGruntsWithRedis() {
  console.log('🎯 Testing Grunts Tool with Redis Connection');
  console.log('============================================');
  
  const grunts = new GruntsTool();
  
  try {
    console.log('🚀 Starting quick grunts test...');
    
    const result = await grunts.execute({
      prompt: 'Create a simple calculator web app with HTML, CSS and JavaScript',
      tier: 'ultralight',
      max_execution_time: 60, // 1 minute test
      target_technologies: ['html', 'css', 'javascript']
    });
    
    console.log('\n✅ GRUNTS TEST RESULTS:');
    console.log('========================');
    console.log(`Status: ${result.status}`);
    console.log(`Type: ${result.type}`);
    
    if (result.metadata) {
      console.log('\n📊 Metadata:');
      console.log(`- Workspace: ${result.metadata.workspace}`);
      console.log(`- Containers: ${result.metadata.containers_deployed}`);
      console.log(`- Execution Time: ${result.metadata.execution_time}ms`);
      
      if (result.metadata.status_url) {
        console.log(`- Status Dashboard: ${result.metadata.status_url}`);
      }
    }
    
    console.log('\n📄 Output Preview:');
    console.log(result.content.substring(0, 300) + '...');
    
    console.log('\n🎉 SUCCESS! Redis + Grunts integration working!');
    
  } catch (error) {
    console.error('\n❌ GRUNTS + REDIS TEST FAILED:');
    console.error(`Error: ${error.message}`);
    
    if (error.message.includes('Redis') || error.message.includes('redis')) {
      console.log('\n🔧 Redis connection issue detected');
    }
  }
}

testGruntsWithRedis().catch(console.error);