# Test Validator Grunts Plan - Comprehensive Testing Infrastructure

## Overview

This document provides meticulous implementation details for the testing infrastructure that validates LLM-generated code in the distributed grunts competitive coding environment. The system combines vitest for unit testing, puppeteer for browser automation, Node.js testing libraries, and bash scripts to create a comprehensive validation pipeline.

## Testing Architecture

### 1. Core Testing Components

#### A. Vitest Test Framework
```typescript
// test-runner/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    maxConcurrency: 6, // One per LLM container
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './results/vitest-results.json',
      html: './results/vitest-report.html'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['node_modules/', 'test/', 'dist/']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test')
    }
  }
});
```

#### B. Puppeteer Browser Testing
```typescript
// test-runner/browser-validator.ts
import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../utils/logger.js';

export class BrowserValidator {
  private browser: Browser | null = null;
  private testResults: Map<string, TestResult> = new Map();

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
  }

  async validateWebComponent(workerId: string, componentPath: string): Promise<TestResult> {
    if (!this.browser) throw new Error('Browser not initialized');
    
    const page = await this.browser.newPage();
    const testResult: TestResult = {
      workerId,
      componentPath,
      passed: 0,
      failed: 0,
      errors: [],
      performance: {},
      accessibility: {},
      timestamp: new Date()
    };

    try {
      // Set viewport for responsive testing
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate to component
      await page.goto(`http://localhost:${3031 + parseInt(workerId)}/${componentPath}`);
      
      // Wait for component to load
      await page.waitForSelector('[data-testid="component-ready"]', { timeout: 10000 });
      
      // Run component functionality tests
      await this.runComponentTests(page, testResult);
      
      // Run performance tests
      await this.runPerformanceTests(page, testResult);
      
      // Run accessibility tests
      await this.runAccessibilityTests(page, testResult);
      
      // Test responsive behavior
      await this.runResponsiveTests(page, testResult);
      
    } catch (error) {
      testResult.errors.push(`Browser test failed: ${error.message}`);
      testResult.failed++;
    } finally {
      await page.close();
    }

    this.testResults.set(workerId, testResult);
    return testResult;
  }

  private async runComponentTests(page: Page, result: TestResult) {
    const tests = [
      { name: 'Component renders', selector: '[data-testid="component-ready"]' },
      { name: 'Interactive elements work', action: 'click', selector: 'button' },
      { name: 'Form validation', action: 'form-test', selector: 'form' },
      { name: 'API integration', action: 'api-test', selector: '[data-testid="api-result"]' }
    ];

    for (const test of tests) {
      try {
        switch (test.action) {
          case 'click':
            await page.click(test.selector);
            await page.waitForTimeout(500);
            break;
          case 'form-test':
            await this.testFormValidation(page);
            break;
          case 'api-test':
            await this.testApiIntegration(page);
            break;
          default:
            await page.waitForSelector(test.selector, { timeout: 5000 });
        }
        result.passed++;
      } catch (error) {
        result.failed++;
        result.errors.push(`${test.name}: ${error.message}`);
      }
    }
  }

  private async runPerformanceTests(page: Page, result: TestResult) {
    // Measure Core Web Vitals
    const performanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics = {};
          
          entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              metrics.lcp = entry.startTime;
            }
            if (entry.entryType === 'first-input') {
              metrics.fid = entry.processingStart - entry.startTime;
            }
          });
          
          resolve(metrics);
        }).observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
        
        // Timeout after 5 seconds
        setTimeout(() => resolve({}), 5000);
      });
    });

    result.performance = performanceMetrics;
    
    // Score based on performance
    if (performanceMetrics.lcp && performanceMetrics.lcp < 2500) result.passed++;
    else result.failed++;
  }

  private async runAccessibilityTests(page: Page, result: TestResult) {
    // Check for basic accessibility requirements
    const a11yChecks = await page.evaluate(() => {
      const checks = {
        hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
        hasAltText: Array.from(document.querySelectorAll('img')).every(img => img.alt),
        hasLabels: Array.from(document.querySelectorAll('input')).every(input => 
          input.labels?.length > 0 || input.getAttribute('aria-label')
        ),
        hasSkipLinks: document.querySelector('a[href="#main"], a[href="#content"]') !== null,
        colorContrast: true // Simplified - would use actual contrast checking
      };
      return checks;
    });

    result.accessibility = a11yChecks;
    
    // Score accessibility
    Object.values(a11yChecks).forEach(passed => {
      if (passed) result.passed++;
      else result.failed++;
    });
  }

  private async runResponsiveTests(page: Page, result: TestResult) {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];

    for (const viewport of viewports) {
      try {
        await page.setViewport(viewport);
        await page.waitForTimeout(1000);
        
        // Check if layout is responsive
        const isResponsive = await page.evaluate(() => {
          return !document.querySelector('[style*="overflow-x"]') &&
                 window.innerWidth === document.documentElement.scrollWidth;
        });

        if (isResponsive) result.passed++;
        else {
          result.failed++;
          result.errors.push(`Responsive test failed for ${viewport.name}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Viewport test error (${viewport.name}): ${error.message}`);
      }
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

### 2. Node.js Test Libraries Integration

#### A. Jest Test Runner for API Testing
```typescript
// test-runner/api-validator.ts
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';
import { spawn, ChildProcess } from 'child_process';

export class ApiValidator {
  private servers: Map<string, ChildProcess> = new Map();
  private baseUrls: Map<string, string> = new Map();

  async startTestServers(workerIds: string[]) {
    for (const workerId of workerIds) {
      const port = 3031 + parseInt(workerId);
      this.baseUrls.set(workerId, `http://localhost:${port}`);
      
      // Start the LLM-generated server
      const serverProcess = spawn('node', ['./workspace/server.js'], {
        cwd: `/tmp/grunt-${workerId}`,
        env: { ...process.env, PORT: port.toString() },
        stdio: 'pipe'
      });

      this.servers.set(workerId, serverProcess);
      
      // Wait for server to be ready
      await this.waitForServer(workerId, port);
    }
  }

  private async waitForServer(workerId: string, port: number, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error(`Server ${workerId} failed to start on port ${port}`);
  }

  async validateApi(workerId: string): Promise<ApiTestResult> {
    const baseUrl = this.baseUrls.get(workerId);
    if (!baseUrl) throw new Error(`No server found for worker ${workerId}`);

    const result: ApiTestResult = {
      workerId,
      endpoints: [],
      performance: {},
      errors: [],
      passed: 0,
      failed: 0
    };

    // Test common endpoints
    const endpoints = [
      { method: 'GET', path: '/', expectedStatus: 200 },
      { method: 'GET', path: '/api/health', expectedStatus: 200 },
      { method: 'POST', path: '/api/data', expectedStatus: [200, 201] },
      { method: 'GET', path: '/api/users', expectedStatus: 200 },
      { method: 'POST', path: '/api/auth/login', expectedStatus: [200, 401] }
    ];

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await this.makeRequest(baseUrl, endpoint);
        const responseTime = Date.now() - startTime;

        const endpointResult = {
          ...endpoint,
          actualStatus: response.status,
          responseTime,
          passed: this.checkStatus(response.status, endpoint.expectedStatus)
        };

        result.endpoints.push(endpointResult);
        
        if (endpointResult.passed) {
          result.passed++;
        } else {
          result.failed++;
          result.errors.push(`${endpoint.method} ${endpoint.path}: Expected ${endpoint.expectedStatus}, got ${response.status}`);
        }

        // Track performance
        result.performance[`${endpoint.method}_${endpoint.path}`] = responseTime;

      } catch (error) {
        result.failed++;
        result.errors.push(`${endpoint.method} ${endpoint.path}: ${error.message}`);
        result.endpoints.push({
          ...endpoint,
          actualStatus: 0,
          responseTime: 0,
          passed: false
        });
      }
    }

    return result;
  }

  private async makeRequest(baseUrl: string, endpoint: any) {
    const url = `${baseUrl}${endpoint.path}`;
    const options: any = { method: endpoint.method };

    if (endpoint.method === 'POST') {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify({ test: 'data' });
    }

    return await fetch(url, options);
  }

  private checkStatus(actual: number, expected: number | number[]): boolean {
    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }
    return actual === expected;
  }

  async cleanup() {
    for (const [workerId, process] of this.servers) {
      process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    }
    this.servers.clear();
    this.baseUrls.clear();
  }
}
```

### 3. Bash Script Validators

#### A. Code Quality Validator
```bash
#!/bin/bash
# test-runner/validate-code-quality.sh

set -e

WORKER_ID=$1
WORKSPACE_PATH="/tmp/grunt-${WORKER_ID}"
RESULTS_PATH="/tmp/grunt-${WORKER_ID}/test-results"

mkdir -p "$RESULTS_PATH"

echo "🔍 Starting code quality validation for worker $WORKER_ID"

# Function to log results
log_result() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$RESULTS_PATH/quality.log"
}

# 1. ESLint validation
echo "Running ESLint..."
cd "$WORKSPACE_PATH"
if npm run lint > "$RESULTS_PATH/eslint.log" 2>&1; then
    ESLINT_SCORE=10
    log_result "ESLint: PASS (Score: $ESLINT_SCORE)"
else
    ESLINT_ERRORS=$(grep -c "error" "$RESULTS_PATH/eslint.log" || echo 0)
    ESLINT_WARNINGS=$(grep -c "warning" "$RESULTS_PATH/eslint.log" || echo 0)
    ESLINT_SCORE=$((10 - ESLINT_ERRORS - (ESLINT_WARNINGS / 2)))
    ESLINT_SCORE=$([ $ESLINT_SCORE -lt 0 ] && echo 0 || echo $ESLINT_SCORE)
    log_result "ESLint: FAIL (Errors: $ESLINT_ERRORS, Warnings: $ESLINT_WARNINGS, Score: $ESLINT_SCORE)"
fi

# 2. TypeScript compilation
echo "Checking TypeScript compilation..."
if npm run build > "$RESULTS_PATH/typescript.log" 2>&1; then
    TYPESCRIPT_SCORE=10
    log_result "TypeScript: PASS (Score: $TYPESCRIPT_SCORE)"
else
    TS_ERRORS=$(grep -c "error TS" "$RESULTS_PATH/typescript.log" || echo 0)
    TYPESCRIPT_SCORE=$((10 - TS_ERRORS))
    TYPESCRIPT_SCORE=$([ $TYPESCRIPT_SCORE -lt 0 ] && echo 0 || echo $TYPESCRIPT_SCORE)
    log_result "TypeScript: FAIL (Errors: $TS_ERRORS, Score: $TYPESCRIPT_SCORE)"
fi

# 3. Unit test execution
echo "Running unit tests..."
if npm test > "$RESULTS_PATH/unit-tests.log" 2>&1; then
    PASSING_TESTS=$(grep -o "[0-9]\+ passing" "$RESULTS_PATH/unit-tests.log" | cut -d' ' -f1 || echo 0)
    FAILING_TESTS=$(grep -o "[0-9]\+ failing" "$RESULTS_PATH/unit-tests.log" | cut -d' ' -f1 || echo 0)
    TOTAL_TESTS=$((PASSING_TESTS + FAILING_TESTS))
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        UNIT_SCORE=$(( (PASSING_TESTS * 10) / TOTAL_TESTS ))
    else
        UNIT_SCORE=0
    fi
    
    log_result "Unit Tests: $PASSING_TESTS/$TOTAL_TESTS passing (Score: $UNIT_SCORE)"
else
    UNIT_SCORE=0
    log_result "Unit Tests: FAILED TO RUN (Score: $UNIT_SCORE)"
fi

# 4. Code complexity analysis
echo "Analyzing code complexity..."
npx complexity-report --format json src/ > "$RESULTS_PATH/complexity.json" 2>/dev/null || echo '{"maintainability": 50}' > "$RESULTS_PATH/complexity.json"

MAINTAINABILITY=$(cat "$RESULTS_PATH/complexity.json" | jq -r '.maintainability // 50')
COMPLEXITY_SCORE=$(echo "scale=0; $MAINTAINABILITY / 10" | bc)
COMPLEXITY_SCORE=$([ $COMPLEXITY_SCORE -gt 10 ] && echo 10 || echo $COMPLEXITY_SCORE)

log_result "Complexity: Maintainability $MAINTAINABILITY (Score: $COMPLEXITY_SCORE)"

# 5. Security audit
echo "Running security audit..."
if npm audit --audit-level=moderate > "$RESULTS_PATH/security.log" 2>&1; then
    SECURITY_SCORE=10
    log_result "Security: PASS (Score: $SECURITY_SCORE)"
else
    SECURITY_ISSUES=$(grep -c "found [0-9]\+ vulnerabilities" "$RESULTS_PATH/security.log" || echo 0)
    SECURITY_SCORE=$((10 - SECURITY_ISSUES))
    SECURITY_SCORE=$([ $SECURITY_SCORE -lt 0 ] && echo 0 || echo $SECURITY_SCORE)
    log_result "Security: $SECURITY_ISSUES vulnerabilities found (Score: $SECURITY_SCORE)"
fi

# 6. Code coverage
echo "Measuring code coverage..."
npm run test:coverage > "$RESULTS_PATH/coverage.log" 2>&1 || true

COVERAGE_PERCENT=$(grep -o "All files.*[0-9]\+\%" "$RESULTS_PATH/coverage.log" | tail -1 | grep -o "[0-9]\+\%" | tr -d '%' || echo 0)
COVERAGE_SCORE=$(echo "scale=0; $COVERAGE_PERCENT / 10" | bc 2>/dev/null || echo 0)
COVERAGE_SCORE=$([ $COVERAGE_SCORE -gt 10 ] && echo 10 || echo $COVERAGE_SCORE)

log_result "Coverage: $COVERAGE_PERCENT% (Score: $COVERAGE_SCORE)"

# Calculate total score
TOTAL_SCORE=$((ESLINT_SCORE + TYPESCRIPT_SCORE + UNIT_SCORE + COMPLEXITY_SCORE + SECURITY_SCORE + COVERAGE_SCORE))
MAX_SCORE=60

echo "📊 Quality Assessment Complete for Worker $WORKER_ID"
echo "   ESLint: $ESLINT_SCORE/10"
echo "   TypeScript: $TYPESCRIPT_SCORE/10"
echo "   Unit Tests: $UNIT_SCORE/10"
echo "   Complexity: $COMPLEXITY_SCORE/10"
echo "   Security: $SECURITY_SCORE/10"
echo "   Coverage: $COVERAGE_SCORE/10"
echo "   TOTAL: $TOTAL_SCORE/$MAX_SCORE"

# Save final score
echo "{
  \"workerId\": \"$WORKER_ID\",
  \"scores\": {
    \"eslint\": $ESLINT_SCORE,
    \"typescript\": $TYPESCRIPT_SCORE,
    \"unitTests\": $UNIT_SCORE,
    \"complexity\": $COMPLEXITY_SCORE,
    \"security\": $SECURITY_SCORE,
    \"coverage\": $COVERAGE_SCORE,
    \"total\": $TOTAL_SCORE,
    \"maxScore\": $MAX_SCORE,
    \"percentage\": $(echo "scale=2; ($TOTAL_SCORE * 100) / $MAX_SCORE" | bc)
  },
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}" > "$RESULTS_PATH/final-score.json"

log_result "Final Score: $TOTAL_SCORE/$MAX_SCORE ($(echo "scale=1; ($TOTAL_SCORE * 100) / $MAX_SCORE" | bc)%)"

exit 0
```

#### B. Performance Benchmark Script
```bash
#!/bin/bash
# test-runner/performance-benchmark.sh

WORKER_ID=$1
PORT=$((3031 + WORKER_ID))
RESULTS_PATH="/tmp/grunt-${WORKER_ID}/test-results"

echo "🚀 Running performance benchmarks for worker $WORKER_ID on port $PORT"

# 1. Load testing with Artillery
echo "Load testing with Artillery..."
cat > "$RESULTS_PATH/artillery-config.yaml" << EOF
config:
  target: "http://localhost:$PORT"
  phases:
    - duration: 60
      arrivalRate: 10
  processor: "./artillery-processor.js"

scenarios:
  - name: "API Load Test"
    weight: 50
    flow:
      - get:
          url: "/"
      - get:
          url: "/api/health"
      - post:
          url: "/api/data"
          json:
            test: "load-test-data"
            timestamp: "{{ \$timestamp }}"

  - name: "Static Assets"
    weight: 30
    flow:
      - get:
          url: "/static/js/main.js"
      - get:
          url: "/static/css/main.css"

  - name: "Heavy Operations"
    weight: 20
    flow:
      - post:
          url: "/api/heavy-computation"
          json:
            iterations: 1000
EOF

# Create Artillery processor
cat > "$RESULTS_PATH/artillery-processor.js" << 'EOF'
module.exports = {
  generateTimestamp: function() {
    return Date.now();
  }
};
EOF

npx artillery run "$RESULTS_PATH/artillery-config.yaml" --output "$RESULTS_PATH/artillery-report.json" > "$RESULTS_PATH/artillery.log" 2>&1

# 2. Memory usage monitoring
echo "Monitoring memory usage..."
NODE_PID=$(pgrep -f "node.*server.js.*$PORT" || echo "")

if [ -n "$NODE_PID" ]; then
    # Monitor for 60 seconds
    for i in {1..60}; do
        ps -p $NODE_PID -o pid,ppid,pcpu,pmem,rss,vsz --no-headers >> "$RESULTS_PATH/memory-usage.log" 2>/dev/null || break
        sleep 1
    done
    
    # Calculate memory statistics
    AVG_MEMORY=$(awk '{sum+=$5; count++} END {print (count > 0) ? sum/count : 0}' "$RESULTS_PATH/memory-usage.log")
    MAX_MEMORY=$(awk 'BEGIN{max=0} {if($5>max) max=$5} END{print max}' "$RESULTS_PATH/memory-usage.log")
    
    echo "Average Memory: ${AVG_MEMORY}KB, Peak Memory: ${MAX_MEMORY}KB" >> "$RESULTS_PATH/performance-summary.log"
else
    echo "Could not find Node.js process for monitoring" >> "$RESULTS_PATH/performance-summary.log"
fi

# 3. Response time testing
echo "Testing response times..."
cat > "$RESULTS_PATH/response-time-test.js" << EOF
const http = require('http');

const testEndpoints = [
  { path: '/', method: 'GET' },
  { path: '/api/health', method: 'GET' },
  { path: '/api/data', method: 'POST', data: '{"test": "response-time"}' }
];

const results = [];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const options = {
      hostname: 'localhost',
      port: $PORT,
      path: endpoint.path,
      method: endpoint.method,
      headers: endpoint.method === 'POST' ? {'Content-Type': 'application/json'} : {}
    };

    const req = http.request(options, (res) => {
      res.on('data', () => {}); // Consume response
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          endpoint: endpoint.path,
          method: endpoint.method,
          statusCode: res.statusCode,
          responseTime: responseTime
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        endpoint: endpoint.path,
        method: endpoint.method,
        statusCode: 0,
        responseTime: -1,
        error: error.message
      });
    });

    if (endpoint.data) {
      req.write(endpoint.data);
    }
    req.end();
  });
}

async function runTests() {
  console.log('Starting response time tests...');
  
  for (const endpoint of testEndpoints) {
    const iterations = 10;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await testEndpoint(endpoint);
      if (result.responseTime > 0) {
        times.push(result.responseTime);
      }
    }
    
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      results.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        avgResponseTime: avg,
        minResponseTime: min,
        maxResponseTime: max,
        samples: times.length
      });
    }
  }
  
  console.log(JSON.stringify(results, null, 2));
}

runTests().catch(console.error);
EOF

node "$RESULTS_PATH/response-time-test.js" > "$RESULTS_PATH/response-times.json" 2>&1

# 4. Generate performance score
echo "Calculating performance score..."
cat > "$RESULTS_PATH/calculate-score.js" << 'EOF'
const fs = require('fs');

try {
  // Load Artillery results
  const artilleryData = JSON.parse(fs.readFileSync('./artillery-report.json', 'utf8'));
  const responseData = JSON.parse(fs.readFileSync('./response-times.json', 'utf8'));
  
  // Calculate scores
  let performanceScore = 100;
  
  // Artillery metrics
  const p95ResponseTime = artilleryData.aggregate?.p95 || 1000;
  const errorRate = (artilleryData.aggregate?.errors || 0) / (artilleryData.aggregate?.requestsCompleted || 1);
  
  // Deduct points for high response times (target: <200ms)
  if (p95ResponseTime > 200) {
    performanceScore -= Math.min(30, (p95ResponseTime - 200) / 10);
  }
  
  // Deduct points for errors (target: <1%)
  if (errorRate > 0.01) {
    performanceScore -= Math.min(25, errorRate * 1000);
  }
  
  // Response time penalties
  responseData.forEach(endpoint => {
    if (endpoint.avgResponseTime > 100) {
      performanceScore -= Math.min(10, (endpoint.avgResponseTime - 100) / 20);
    }
  });
  
  // Memory usage (if available)
  try {
    const memoryLog = fs.readFileSync('./memory-usage.log', 'utf8');
    const memoryLines = memoryLog.split('\n').filter(line => line.trim());
    if (memoryLines.length > 0) {
      const avgMemory = memoryLines.reduce((sum, line) => {
        const memory = parseInt(line.split(/\s+/)[4] || 0);
        return sum + memory;
      }, 0) / memoryLines.length;
      
      // Deduct points for high memory usage (target: <100MB)
      if (avgMemory > 100000) {
        performanceScore -= Math.min(20, (avgMemory - 100000) / 10000);
      }
    }
  } catch (e) {}
  
  performanceScore = Math.max(0, Math.round(performanceScore));
  
  const result = {
    workerId: process.env.WORKER_ID || 'unknown',
    performanceScore,
    metrics: {
      p95ResponseTime,
      errorRate: errorRate * 100,
      averageResponseTimes: responseData
    },
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('./performance-score.json', JSON.stringify(result, null, 2));
  console.log(`Performance Score: ${performanceScore}/100`);
  
} catch (error) {
  console.error('Error calculating performance score:', error);
  process.exit(1);
}
EOF

cd "$RESULTS_PATH"
WORKER_ID=$WORKER_ID node calculate-score.js

echo "✅ Performance benchmarking complete for worker $WORKER_ID"
```

### 4. Integration Test Orchestrator

#### A. Master Test Controller
```typescript
// test-runner/test-orchestrator.ts
import { BrowserValidator } from './browser-validator.js';
import { ApiValidator } from './api-validator.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

export class TestOrchestrator {
  private browserValidator: BrowserValidator;
  private apiValidator: ApiValidator;
  private results: Map<string, ComprehensiveTestResult> = new Map();

  constructor() {
    this.browserValidator = new BrowserValidator();
    this.apiValidator = new ApiValidator();
  }

  async initialize() {
    await this.browserValidator.initialize();
  }

  async runComprehensiveTests(workerIds: string[]): Promise<Map<string, ComprehensiveTestResult>> {
    console.log(`🧪 Starting comprehensive testing for ${workerIds.length} workers`);

    // Start API validators
    await this.apiValidator.startTestServers(workerIds);

    // Run tests for each worker in parallel
    const testPromises = workerIds.map(workerId => this.testWorker(workerId));
    await Promise.allSettled(testPromises);

    // Generate comparative analysis
    await this.generateComparativeAnalysis();

    return this.results;
  }

  private async testWorker(workerId: string): Promise<void> {
    console.log(`🔍 Testing worker ${workerId}`);

    const result: ComprehensiveTestResult = {
      workerId,
      timestamp: new Date(),
      scores: {
        codeQuality: 0,
        performance: 0,
        browser: 0,
        api: 0,
        overall: 0
      },
      details: {
        codeQuality: null,
        performance: null,
        browser: null,
        api: null
      },
      errors: []
    };

    try {
      // 1. Code Quality Tests (Bash)
      console.log(`  📋 Running code quality tests for worker ${workerId}`);
      await this.runCodeQualityTests(workerId, result);

      // 2. Performance Tests (Bash)
      console.log(`  🚀 Running performance tests for worker ${workerId}`);
      await this.runPerformanceTests(workerId, result);

      // 3. Browser Tests (Puppeteer)
      console.log(`  🌐 Running browser tests for worker ${workerId}`);
      await this.runBrowserTests(workerId, result);

      // 4. API Tests (Node.js)
      console.log(`  🔌 Running API tests for worker ${workerId}`);
      await this.runApiTests(workerId, result);

      // Calculate overall score
      result.scores.overall = Math.round(
        (result.scores.codeQuality + result.scores.performance + 
         result.scores.browser + result.scores.api) / 4
      );

      console.log(`✅ Worker ${workerId} testing complete - Overall score: ${result.scores.overall}/100`);

    } catch (error) {
      result.errors.push(`Testing failed: ${error.message}`);
      console.error(`❌ Worker ${workerId} testing failed:`, error);
    }

    this.results.set(workerId, result);
  }

  private async runCodeQualityTests(workerId: string, result: ComprehensiveTestResult) {
    return new Promise<void>((resolve, reject) => {
      const process = spawn('bash', ['./test-runner/validate-code-quality.sh', workerId], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => output += data.toString());
      process.stderr.on('data', (data) => output += data.toString());

      process.on('close', async (code) => {
        try {
          const resultsPath = `/tmp/grunt-${workerId}/test-results/final-score.json`;
          const scoreData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
          
          result.scores.codeQuality = scoreData.scores.percentage;
          result.details.codeQuality = scoreData;
          
          resolve();
        } catch (error) {
          result.errors.push(`Code quality test parsing failed: ${error.message}`);
          resolve(); // Don't fail entire test suite
        }
      });

      process.on('error', (error) => {
        result.errors.push(`Code quality test execution failed: ${error.message}`);
        resolve();
      });
    });
  }

  private async runPerformanceTests(workerId: string, result: ComprehensiveTestResult) {
    return new Promise<void>((resolve) => {
      const process = spawn('bash', ['./test-runner/performance-benchmark.sh', workerId], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      process.on('close', async () => {
        try {
          const resultsPath = `/tmp/grunt-${workerId}/test-results/performance-score.json`;
          const performanceData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
          
          result.scores.performance = performanceData.performanceScore;
          result.details.performance = performanceData;
        } catch (error) {
          result.errors.push(`Performance test parsing failed: ${error.message}`);
        }
        resolve();
      });

      process.on('error', (error) => {
        result.errors.push(`Performance test execution failed: ${error.message}`);
        resolve();
      });
    });
  }

  private async runBrowserTests(workerId: string, result: ComprehensiveTestResult) {
    try {
      const browserResult = await this.browserValidator.validateWebComponent(workerId, 'index.html');
      
      const totalTests = browserResult.passed + browserResult.failed;
      result.scores.browser = totalTests > 0 ? Math.round((browserResult.passed / totalTests) * 100) : 0;
      result.details.browser = browserResult;
      
    } catch (error) {
      result.errors.push(`Browser tests failed: ${error.message}`);
      result.scores.browser = 0;
    }
  }

  private async runApiTests(workerId: string, result: ComprehensiveTestResult) {
    try {
      const apiResult = await this.apiValidator.validateApi(workerId);
      
      const totalTests = apiResult.passed + apiResult.failed;
      result.scores.api = totalTests > 0 ? Math.round((apiResult.passed / totalTests) * 100) : 0;
      result.details.api = apiResult;
      
    } catch (error) {
      result.errors.push(`API tests failed: ${error.message}`);
      result.scores.api = 0;
    }
  }

  private async generateComparativeAnalysis() {
    const allResults = Array.from(this.results.values());
    
    // Rank workers by overall score
    const rankedWorkers = allResults
      .sort((a, b) => b.scores.overall - a.scores.overall)
      .map((result, index) => ({
        rank: index + 1,
        workerId: result.workerId,
        scores: result.scores,
        percentile: Math.round(((allResults.length - index) / allResults.length) * 100)
      }));

    // Calculate category winners
    const categoryWinners = {
      codeQuality: allResults.reduce((prev, curr) => 
        prev.scores.codeQuality > curr.scores.codeQuality ? prev : curr),
      performance: allResults.reduce((prev, curr) => 
        prev.scores.performance > curr.scores.performance ? prev : curr),
      browser: allResults.reduce((prev, curr) => 
        prev.scores.browser > curr.scores.browser ? prev : curr),
      api: allResults.reduce((prev, curr) => 
        prev.scores.api > curr.scores.api ? prev : curr)
    };

    const analysis = {
      timestamp: new Date().toISOString(),
      totalWorkers: allResults.length,
      rankings: rankedWorkers,
      categoryWinners,
      averageScores: {
        codeQuality: Math.round(allResults.reduce((sum, r) => sum + r.scores.codeQuality, 0) / allResults.length),
        performance: Math.round(allResults.reduce((sum, r) => sum + r.scores.performance, 0) / allResults.length),
        browser: Math.round(allResults.reduce((sum, r) => sum + r.scores.browser, 0) / allResults.length),
        api: Math.round(allResults.reduce((sum, r) => sum + r.scores.api, 0) / allResults.length),
        overall: Math.round(allResults.reduce((sum, r) => sum + r.scores.overall, 0) / allResults.length)
      }
    };

    await fs.writeFile(
      '/tmp/grunts-comparative-analysis.json',
      JSON.stringify(analysis, null, 2)
    );

    console.log('📊 Comparative analysis generated');
    console.log(`🏆 Overall winner: Worker ${rankedWorkers[0].workerId} (${rankedWorkers[0].scores.overall}/100)`);
  }

  async cleanup() {
    await this.browserValidator.cleanup();
    await this.apiValidator.cleanup();
  }
}

// Type definitions
interface TestResult {
  workerId: string;
  passed: number;
  failed: number;
  errors: string[];
  timestamp: Date;
}

interface BrowserTestResult extends TestResult {
  componentPath: string;
  performance: any;
  accessibility: any;
}

interface ApiTestResult extends TestResult {
  endpoints: any[];
  performance: any;
}

interface ComprehensiveTestResult {
  workerId: string;
  timestamp: Date;
  scores: {
    codeQuality: number;
    performance: number;
    browser: number;
    api: number;
    overall: number;
  };
  details: {
    codeQuality: any;
    performance: any;
    browser: BrowserTestResult | null;
    api: ApiTestResult | null;
  };
  errors: string[];
}
```

### 5. Test Execution Pipeline

#### A. Main Test Runner
```typescript
// test-runner/main.ts
import { TestOrchestrator } from './test-orchestrator.js';
import { logger } from '../utils/logger.js';

export async function executeGruntsValidation(workerIds: string[]): Promise<Map<string, any>> {
  const orchestrator = new TestOrchestrator();
  
  try {
    console.log('🚀 Initializing Grunts test validation system');
    await orchestrator.initialize();
    
    console.log(`📋 Testing ${workerIds.length} LLM implementations`);
    const results = await orchestrator.runComprehensiveTests(workerIds);
    
    console.log('✅ All tests completed successfully');
    return results;
    
  } catch (error) {
    logger.error('Grunts validation failed:', error);
    throw error;
  } finally {
    await orchestrator.cleanup();
  }
}

// Export for use in grunts tool
export { TestOrchestrator };
```

### 6. Results Integration

The test validation system integrates with the main grunts tool through the assessment pipeline:

```typescript
// Integration point in grunts.ts assessAndIntegrateResults method
const testResults = await executeGruntsValidation(Object.keys(this.status.containers));
```

## Implementation Schedule

### Phase 1: Core Framework (Week 1)
1. Set up vitest configuration and test structure
2. Implement basic BrowserValidator with Puppeteer
3. Create fundamental bash validation scripts
4. Build TestOrchestrator foundation

### Phase 2: Comprehensive Testing (Week 2)
1. Complete ApiValidator with Node.js testing libraries
2. Implement performance benchmarking scripts
3. Add code quality validation pipeline
4. Create comparative analysis system

### Phase 3: Integration & Optimization (Week 3)
1. Integrate with grunts tool assessment pipeline
2. Add real-time test result streaming
3. Optimize test execution performance
4. Add detailed error reporting and debugging

### Phase 4: Production Ready (Week 4)
1. Add comprehensive error handling and recovery
2. Implement test result caching and persistence
3. Create test execution monitoring and alerts
4. Final testing and documentation

This comprehensive test validation plan provides meticulous implementation details for validating LLM-generated code in the distributed grunts competitive coding environment, ensuring reliable assessment of code quality, performance, browser compatibility, and API functionality.