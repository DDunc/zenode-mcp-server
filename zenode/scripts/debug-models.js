#!/usr/bin/env node

// Debug script to check what models are available
import { modelProviderRegistry } from './dist/providers/registry.js';

async function debugModels() {
  console.log('🔍 Debugging model registry...');
  
  try {
    
    console.log('\n📋 Available Models:');
    const models = modelProviderRegistry.getAllModels();
    console.log('Total models:', models.length);
    models.forEach(model => console.log(`  - ${model}`));
    
    console.log('\n🔍 Testing specific models:');
    const testModels = ['openai/gpt-4o', 'gpt-4o', 'vision', 'sonnet', 'auto'];
    
    for (const model of testModels) {
      const provider = await modelProviderRegistry.getProviderForModel(model);
      console.log(`  ${model}: ${provider ? '✅ ' + provider.friendlyName : '❌ No provider'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugModels().then(() => process.exit(0)).catch(console.error);