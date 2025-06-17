#!/usr/bin/env node
/**
 * Simple Test Runner - Basic validation without heavy dependencies
 */
import { spawn } from 'child_process';
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
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Mock Implementation ${workerId}</h1><div data-testid="component-ready">Ready!</div></body></html>');
  } else if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', worker: '${workerId}' }));
  } else if (req.method === 'GET' && parsedUrl.pathname === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ api: 'healthy', worker: '${workerId}' }));
  } else if (req.method === 'POST' && parsedUrl.pathname === '/api/data') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200);
      res.end(JSON.stringify({ received: JSON.parse(body || '{}'), worker: '${workerId}' }));
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found', worker: '${workerId}' }));
  }
});

const port = process.env.PORT || ${3031 + parseInt(workerId)};
server.listen(port, () => {
  console.log(\`Mock server started on port \${port} for worker ${workerId}\`);
});
`;

  const mockPackageJson = `{
  "name": "mock-implementation-${workerId}",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "echo 'Test suite: 5 passing'",
    "lint": "echo 'Linting: 0 errors, 2 warnings'",
    "build": "echo 'Build successful'"
  }
}`;

  // Write mock files
  await fs.writeFile(path.join(workspacePath, 'server.js'), mockServerJs);
  await fs.writeFile(path.join(workspacePath, 'package.json'), mockPackageJson);
  
  console.log(`✅ Created mock worker ${workerId} at ${workspacePath}`);
}

async function runCodeQualityTest(workerId) {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'validate-code-quality.sh');
    const process = spawn('bash', [scriptPath, workerId], {
      stdio: 'pipe'
    });

    let output = '';
    process.stdout?.on('data', (data) => output += data.toString());
    process.stderr?.on('data', (data) => output += data.toString());

    process.on('close', async (code) => {
      try {
        const resultsPath = `/tmp/grunt-${workerId}/test-results/final-score.json`;
        const scoreData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
        resolve({
          workerId,
          codeQuality: Math.round(scoreData.scores.percentage),
          details: scoreData,
          success: true
        });
      } catch (error) {
        resolve({
          workerId,
          codeQuality: 0,
          error: error.message,
          success: false
        });
      }
    });

    process.on('error', (error) => {
      resolve({
        workerId,
        codeQuality: 0,
        error: error.message,
        success: false
      });
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGTERM');
        resolve({
          workerId,
          codeQuality: 0,
          error: 'Code quality tests timed out',
          success: false
        });
      }
    }, 120000);
  });
}

async function runPerformanceTest(workerId) {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'performance-benchmark.sh');
    const process = spawn('bash', [scriptPath, workerId], {
      stdio: 'pipe'
    });

    process.on('close', async () => {
      try {
        const resultsPath = `/tmp/grunt-${workerId}/test-results/performance-score.json`;
        const performanceData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
        resolve({
          workerId,
          performance: Math.round(performanceData.performanceScore),
          details: performanceData,
          success: true
        });
      } catch (error) {
        resolve({
          workerId,
          performance: 0,
          error: error.message,
          success: false
        });
      }
    });

    process.on('error', (error) => {
      resolve({
        workerId,
        performance: 0,
        error: error.message,
        success: false
      });
    });

    // Timeout after 3 minutes
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGTERM');
        resolve({
          workerId,
          performance: 0,
          error: 'Performance tests timed out',
          success: false
        });
      }
    }, 180000);
  });
}

async function testApiEndpoint(workerId, endpoint) {
  const port = 3031 + parseInt(workerId);
  const url = `http://localhost:${port}${endpoint}`;
  
  try {
    const response = await fetch(url, { 
      timeout: 5000,
      headers: { 'User-Agent': 'grunts-simple-validator' }
    });
    
    return {
      endpoint,
      status: response.status,
      success: response.status < 500,
      responseTime: Date.now()
    };
  } catch (error) {
    return {
      endpoint,
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function runSimpleApiTest(workerId) {
  const endpoints = ['/', '/health', '/api/health'];
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testApiEndpoint(workerId, endpoint);
    results.push(result);
  }
  
  const successful = results.filter(r => r.success).length;
  const score = Math.round((successful / results.length) * 100);
  
  return {
    workerId,
    api: score,
    endpoints: results,
    success: true
  };
}

async function startMockServer(workerId) {
  return new Promise((resolve) => {
    const workspacePath = `/tmp/grunt-${workerId}`;
    const serverProcess = spawn('node', ['server.js'], {
      cwd: workspacePath,
      env: { ...process.env, PORT: (3031 + parseInt(workerId)).toString() },
      stdio: 'pipe'
    });

    // Wait a moment for server to start
    setTimeout(() => {
      resolve(serverProcess);
    }, 2000);
  });
}

async function runSimpleValidation() {
  console.log('🧪 Simple Grunts Validation Test');
  console.log('================================');
  
  const workerIds = ['1', '2'];
  const results = new Map();
  const serverProcesses = [];
  
  try {
    // Create mock workers
    console.log('📁 Creating mock worker implementations...');
    for (const workerId of workerIds) {
      await createMockWorker(workerId);
    }
    
    // Start mock servers
    console.log('🚀 Starting mock servers...');
    for (const workerId of workerIds) {
      const process = await startMockServer(workerId);
      serverProcesses.push(process);
    }
    
    // Run tests for each worker
    for (const workerId of workerIds) {
      console.log(`\\n🔍 Testing worker ${workerId}...`);
      
      const [qualityResult, performanceResult, apiResult] = await Promise.allSettled([
        runCodeQualityTest(workerId),
        runPerformanceTest(workerId),
        runSimpleApiTest(workerId)
      ]);
      
      const quality = qualityResult.status === 'fulfilled' ? qualityResult.value : { codeQuality: 0, success: false };
      const performance = performanceResult.status === 'fulfilled' ? performanceResult.value : { performance: 0, success: false };
      const api = apiResult.status === 'fulfilled' ? apiResult.value : { api: 0, success: false };
      
      const overall = Math.round((quality.codeQuality + performance.performance + api.api) / 3);
      
      results.set(workerId, {
        workerId,
        scores: {
          codeQuality: quality.codeQuality,
          performance: performance.performance,
          api: api.api,
          overall
        },
        success: quality.success && performance.success && api.success
      });
    }
    
    // Display results
    console.log('\\n📊 VALIDATION RESULTS:');
    console.log('======================');
    
    const sortedResults = Array.from(results.values()).sort((a, b) => b.scores.overall - a.scores.overall);
    
    sortedResults.forEach((result, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
      console.log(`${medal} #${rank} Worker ${result.workerId}: ${result.scores.overall}/100`);
      console.log(`     Quality: ${result.scores.codeQuality} | Performance: ${result.scores.performance} | API: ${result.scores.api}`);
      console.log(`     Status: ${result.success ? '✅ Success' : '⚠️  Partial'}`);
    });
    
    // Save results
    const analysisPath = '/tmp/grunts-simple-analysis.json';
    await fs.writeFile(analysisPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalWorkers: results.size,
      rankings: sortedResults,
      winner: sortedResults[0]?.workerId
    }, null, 2));
    
    console.log(`\\n✅ Simple validation completed successfully!`);
    console.log(`📄 Results saved to ${analysisPath}`);
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
  } finally {
    // Cleanup servers
    console.log('\\n🧹 Cleaning up servers...');
    serverProcesses.forEach(process => {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Process might already be dead
      }
    });
  }
}

// Run the validation
runSimpleValidation().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});