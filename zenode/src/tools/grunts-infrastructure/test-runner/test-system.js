#!/usr/bin/env node
/**
 * Test System Verification - Quick test to verify our test validation system works
 */
import { TestOrchestrator } from './test-orchestrator.js';
import { promises as fs } from 'fs';
import path from 'path';

async function createMockWorker(workerId) {
  const workspacePath = `/tmp/grunt-${workerId}`;
  const resultsPath = path.join(workspacePath, 'test-results');
  
  // Create workspace and results directories
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.mkdir(resultsPath, { recursive: true });
  
  // Create a simple mock implementation
  const mockServerJs = `
const express = require('express');
const app = express();
const port = process.env.PORT || ${3031 + parseInt(workerId)};

app.use(express.json());

app.get('/', (req, res) => {
  res.send('<html><body><h1>Mock Implementation ${workerId}</h1><div data-testid="component-ready">Ready!</div></body></html>');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', worker: '${workerId}' });
});

app.get('/api/health', (req, res) => {
  res.json({ api: 'healthy', worker: '${workerId}' });
});

app.post('/api/data', (req, res) => {
  res.json({ received: req.body, worker: '${workerId}' });
});

app.listen(port, () => {
  console.log(\`Mock server \${port} started for worker ${workerId}\`);
});
`;

  const mockPackageJson = `{
  "name": "mock-implementation-${workerId}",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "echo 'Mock tests passing'",
    "lint": "echo 'Mock lint passing'"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}`;

  // Write mock files
  await fs.writeFile(path.join(workspacePath, 'server.js'), mockServerJs);
  await fs.writeFile(path.join(workspacePath, 'package.json'), mockPackageJson);
  
  console.log(`✅ Created mock worker ${workerId} at ${workspacePath}`);
}

async function runSystemTest() {
  console.log('🧪 Testing Grunts Validation System');
  console.log('===================================');
  
  try {
    // Create mock workers
    console.log('📁 Creating mock worker implementations...');
    await createMockWorker('1');
    await createMockWorker('2');
    
    // Initialize test orchestrator
    console.log('🚀 Initializing Test Orchestrator...');
    const orchestrator = new TestOrchestrator();
    await orchestrator.initialize();
    
    // Run comprehensive tests
    console.log('🔍 Running comprehensive validation...');
    const results = await orchestrator.runComprehensiveTests(['1', '2']);
    
    // Display results
    console.log('\\n📊 TEST RESULTS:');
    console.log('================');
    
    if (results.size === 0) {
      console.log('❌ No results generated');
    } else {
      for (const [workerId, result] of results) {
        console.log(`\\n🤖 Worker ${workerId}:`);
        console.log(`   Overall Score: ${result.scores.overall}/100`);
        console.log(`   Code Quality: ${result.scores.codeQuality}/100`);
        console.log(`   Performance:  ${result.scores.performance}/100`);
        console.log(`   Browser:      ${result.scores.browser}/100`);
        console.log(`   API:          ${result.scores.api}/100`);
        console.log(`   Execution:    ${Math.round(result.executionTime / 1000)}s`);
        if (result.errors.length > 0) {
          console.log(`   Errors:       ${result.errors.length}`);
        }
      }
    }
    
    // Cleanup
    await orchestrator.cleanup();
    
    console.log('\\n✅ System test completed successfully!');
    console.log('📄 Check /tmp/grunts-comparative-analysis.json for detailed results');
    
  } catch (error) {
    console.error('❌ System test failed:', error);
    process.exit(1);
  }
}

// Run the test
runSystemTest().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});