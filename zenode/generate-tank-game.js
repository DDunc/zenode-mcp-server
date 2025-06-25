#!/usr/bin/env node
/**
 * Generate tank battle game files directly using the LLM worker
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// Import the real LLM worker
const RealLLMWorker = (await import('./.zenode/tools/zn-grunts/llm-workers/real-llm-worker.js')).RealLLMWorker;

async function generateTankGame() {
  console.log('🎮 Generating Tank Battle Game Files...');
  
  const outputDir = './tank-battle-game';
  await fs.mkdir(outputDir, { recursive: true });
  
  // Create a worker instance
  const worker = new RealLLMWorker({
    workerId: 'demo',
    model: 'fallback',
    specialization: 'JavaScript/TypeScript/Phaser.js',
    workspaceDir: outputDir
  });
  
  // Set the task prompt
  worker.taskPrompt = 'Create a local multiplayer 2-player tank battle game with Phaser.js. Include WASD vs Arrow key controls, shooting mechanics, destructible terrain, health system, and score tracking.';
  worker.targetTechnologies = ['javascript', 'typescript', 'phaser', 'vite'];
  
  console.log('📋 Running task analysis...');
  const analysis = await worker.analyzeTask();
  
  console.log('💻 Generating game files...');
  const codeResult = await worker.generateCode(analysis);
  
  console.log('🧪 Testing generated code...');
  const testResult = await worker.testCode(codeResult);
  
  console.log('🚀 Deploying game server...');
  await worker.deployCode(codeResult);
  
  console.log('\n✅ Tank Battle Game Generated!');
  console.log(`📁 Files created in: ${outputDir}`);
  console.log(`📊 Generated ${codeResult.files.length} files`);
  console.log(`📈 Total lines: ${worker.linesAdded}`);
  console.log(`🧪 Tests: ${testResult.passed}/${testResult.total} passed`);
  
  // List generated files
  console.log('\n📄 Generated Files:');
  for (const file of codeResult.files) {
    console.log(`  - ${file.path}`);
  }
  
  return outputDir;
}

generateTankGame().catch(console.error);