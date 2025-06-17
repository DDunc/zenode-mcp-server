#!/usr/bin/env node
/**
 * ZN-Grunts Enhanced Test Runner with Self-Healing Capabilities
 * Implements the 6 core tests with error similarity detection and smart iteration
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createDefaultErrorClassifier, calculateSimilarity, normalizeErrorMessage } from './error-similarity.js';
import { SmartIterator, IterationConfig, IterationState } from './smart-iteration.js';
import { ErrorLearningSystem, globalErrorLearning, integrateWithTestRunner } from './error-learning-system.js';

// Simple logger
const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg, error) => console.error(`❌ ${msg}`, error?.message || error || ''),
  debug: (msg) => process.env.LOG_LEVEL === 'debug' && console.log(`🔍 ${msg}`)
};

/**
 * Core test definitions - The 6 specific tests that were claimed
 */
const CORE_TESTS = [
  {
    id: 'phaser-imports',
    name: 'Phaser Import Validation',
    description: 'Validates Phaser.js imports and module resolution',
    pattern: /import.*[Pp]haser|require.*[Pp]haser/g,
    cdnPattern: /<script[^>]*phaser[^>]*>/gi,
    autoFix: true
  },
  {
    id: 'cdn-usage',
    name: 'CDN Usage Detection', 
    description: 'Detects and validates CDN usage patterns',
    pattern: /<script[^>]*src=['"]https?:\/\/[^'"]*cdn[^'"]*['"][^>]*>/gi,
    issues: ['jsdelivr', 'unpkg', 'cdnjs'],
    autoFix: true
  },
  {
    id: 'scene-methods',
    name: 'Scene Method Validation',
    description: 'Validates required scene methods (preload, create, update)',
    requiredMethods: ['preload', 'create', 'update'],
    pattern: /(preload|create|update)\s*\([^)]*\)\s*\{/g,
    autoFix: true
  },
  {
    id: 'module-exports',
    name: 'Module Export Validation',
    description: 'Validates ES6 module export patterns',
    pattern: /export\s+(default\s+)?class|export\s*\{[^}]*\}/g,
    commonjsPattern: /module\.exports\s*=/g,
    autoFix: true
  },
  {
    id: 'syntax-errors',
    name: 'Syntax Error Detection',
    description: 'Detects common JavaScript syntax errors',
    patterns: [
      /\;\;+/g,  // Double semicolons
      /\{\s*\}/g,  // Empty blocks  
      /undefined\s*\(/g,  // Undefined function calls
    ],
    autoFix: true
  },
  {
    id: 'markdown-formatting',
    name: 'Markdown Code Block Extraction',
    description: 'Extracts and validates JavaScript from markdown blocks',
    pattern: /```(?:javascript|js|typescript|ts)\s*([\s\S]*?)```/gi,
    cleanupPattern: /^```[a-z]*\s*\n|\n```$/gm,
    autoFix: true
  }
];

class EnhancedTestOrchestrator {
  constructor() {
    this.results = new Map();
    this.serverProcesses = [];
    this.errorClassifier = createDefaultErrorClassifier();
    this.smartIterators = new Map();
    this.healingEnabled = true;
    this.maxHealingAttempts = 10;
    this.similarityThreshold = 80; // 80% threshold as claimed
    this.errorLearning = null; // Will be initialized on first use
    this.learningIntegrated = false;
  }

  /**
   * Initialize error learning integration
   */
  async initializeErrorLearning() {
    if (!this.learningIntegrated) {
      this.errorLearning = await integrateWithTestRunner(this);
      this.learningIntegrated = true;
      logger.info('🧠 Error learning system integrated');
    }
  }

  async validateWorkerWorkspaces(workerIds) {
    const validWorkers = [];
    
    for (const workerId of workerIds) {
      const workspacePath = `/tmp/grunt-${workerId}`;
      try {
        await fs.access(workspacePath);
        const files = await fs.readdir(workspacePath);
        if (files.length > 0) {
          validWorkers.push(workerId);
          logger.info(`Worker ${workerId} has valid workspace`);
        } else {
          logger.warn(`Worker ${workerId} workspace is empty`);
        }
      } catch (error) {
        logger.warn(`Worker ${workerId} workspace not found at ${workspacePath}`);
      }
    }
    
    return validWorkers;
  }

  async startMockServers(workerIds) {
    logger.info('🚀 Starting mock servers for testing...');
    
    for (const workerId of workerIds) {
      try {
        const workspacePath = `/tmp/grunt-${workerId}`;
        const port = 3031 + parseInt(workerId);
        
        // Check for server files
        const possibleFiles = ['server.js', 'index.js', 'app.js', 'main.js'];
        let serverFile = null;
        
        for (const file of possibleFiles) {
          try {
            await fs.access(path.join(workspacePath, file));
            serverFile = file;
            break;
          } catch (error) {
            // File doesn't exist
          }
        }
        
        if (serverFile) {
          const serverProcess = spawn('node', [serverFile], {
            cwd: workspacePath,
            env: { ...process.env, PORT: port.toString() },
            stdio: 'pipe',
            detached: false
          });
          
          serverProcess.stdout?.on('data', (data) => {
            logger.debug(`Worker ${workerId} stdout: ${data.toString().trim()}`);
          });
          
          serverProcess.stderr?.on('data', (data) => {
            logger.debug(`Worker ${workerId} stderr: ${data.toString().trim()}`);
          });
          
          this.serverProcesses.push({ workerId, process: serverProcess, port });
          logger.info(`Started server for worker ${workerId} on port ${port}`);
          
          // Give server time to start
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error(`Failed to start server for worker ${workerId}:`, error);
      }
    }
  }

  async runCodeQualityTest(workerId) {
    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), 'validate-code-quality.sh');
      const process = spawn('bash', [scriptPath, workerId], {
        stdio: 'pipe'
      });

      process.on('close', async (code) => {
        try {
          const resultsPath = `/tmp/grunt-${workerId}/test-results/final-score.json`;
          const scoreData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
          resolve({
            codeQuality: Math.round(scoreData.scores.percentage),
            details: scoreData,
            success: true
          });
        } catch (error) {
          resolve({
            codeQuality: 0,
            error: error.message,
            success: false
          });
        }
      });

      process.on('error', (error) => {
        resolve({
          codeQuality: 0,
          error: error.message,
          success: false
        });
      });

      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          resolve({
            codeQuality: 0,
            error: 'Code quality tests timed out',
            success: false
          });
        }
      }, 120000);
    });
  }

  async runPerformanceTest(workerId) {
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
            performance: Math.round(performanceData.performanceScore),
            details: performanceData,
            success: true
          });
        } catch (error) {
          resolve({
            performance: 0,
            error: error.message,
            success: false
          });
        }
      });

      process.on('error', (error) => {
        resolve({
          performance: 0,
          error: error.message,
          success: false
        });
      });

      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          resolve({
            performance: 0,
            error: 'Performance tests timed out',
            success: false
          });
        }
      }, 180000);
    });
  }

  async testApiEndpoint(workerId, endpoint) {
    const port = 3031 + parseInt(workerId);
    const url = `http://localhost:${port}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'grunts-validator' }
      });
      
      clearTimeout(timeoutId);
      
      return {
        endpoint,
        status: response.status,
        success: response.status >= 200 && response.status < 500,
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

  async runApiTests(workerId) {
    const endpoints = ['/', '/health', '/api/health', '/api/data'];
    const results = [];
    
    for (const endpoint of endpoints) {
      const result = await this.testApiEndpoint(workerId, endpoint);
      results.push(result);
    }
    
    const successful = results.filter(r => r.success).length;
    const score = Math.round((successful / results.length) * 100);
    
    return {
      api: score,
      endpoints: results,
      success: true
    };
  }

  async runBrowserTests(workerId) {
    // Simplified browser test - just check if page loads
    const port = 3031 + parseInt(workerId);
    const url = `http://localhost:${port}/`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'grunts-browser-validator' }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const content = await response.text();
        const hasBasicStructure = content.includes('<html') || content.includes('<body');
        const hasTestId = content.includes('data-testid') || content.includes('component-ready');
        
        const score = hasBasicStructure ? (hasTestId ? 100 : 75) : 25;
        
        return {
          browser: score,
          hasStructure: hasBasicStructure,
          hasTestId: hasTestId,
          success: true
        };
      } else {
        return {
          browser: 0,
          error: `HTTP ${response.status}`,
          success: false
        };
      }
    } catch (error) {
      return {
        browser: 0,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Run the 6 core tests with self-healing capabilities
   */
  async runCoreTestsWithHealing(workerId) {
    const workspacePath = `/tmp/grunt-${workerId}`;
    const coreResults = new Map();
    
    logger.info(`🧪 Running 6 core tests for worker ${workerId} with self-healing...`);
    
    for (const test of CORE_TESTS) {
      logger.info(`  🔍 ${test.name}...`);
      
      if (this.healingEnabled) {
        // Run with smart iteration and self-healing
        const iterator = new SmartIterator(new IterationConfig({
          maxAttempts: this.maxHealingAttempts,
          timeout: 60000, // 1 minute per attempt
          progressThreshold: 0.2
        }));
        
        const healingResult = await iterator.iterate(
          (context) => this.runSingleCoreTest(test, workspacePath, context),
          (result) => this.validateCoreTestResult(result, test),
          { workerId, workspacePath, test }
        );
        
        coreResults.set(test.id, {
          ...healingResult,
          testName: test.name,
          autoFixed: healingResult.success && healingResult.totalAttempts > 1
        });
        
      } else {
        // Run without healing
        const result = await this.runSingleCoreTest(test, workspacePath);
        const validation = await this.validateCoreTestResult(result, test);
        
        coreResults.set(test.id, {
          state: validation.success ? IterationState.SUCCESS : IterationState.FAILED,
          success: validation.success,
          finalScore: validation.score || 0,
          totalAttempts: 1,
          testName: test.name,
          autoFixed: false,
          errors: result.errors || []
        });
      }
    }
    
    return coreResults;
  }

  /**
   * Run a single core test
   */
  async runSingleCoreTest(test, workspacePath, context = {}) {
    const result = {
      testId: test.id,
      passed: false,
      errors: [],
      warnings: [],
      fixes: [],
      score: 0
    };
    
    try {
      switch (test.id) {
        case 'phaser-imports':
          await this.testPhaserImports(test, workspacePath, result, context);
          break;
        case 'cdn-usage':
          await this.testCdnUsage(test, workspacePath, result, context);
          break;
        case 'scene-methods':
          await this.testSceneMethods(test, workspacePath, result, context);
          break;
        case 'module-exports':
          await this.testModuleExports(test, workspacePath, result, context);
          break;
        case 'syntax-errors':
          await this.testSyntaxErrors(test, workspacePath, result, context);
          break;
        case 'markdown-formatting':
          await this.testMarkdownFormatting(test, workspacePath, result, context);
          break;
      }
      
      // Calculate score based on errors/warnings
      result.score = Math.max(0, 100 - (result.errors.length * 25) - (result.warnings.length * 10));
      result.passed = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push(`Test execution failed: ${error.message}`);
      result.score = 0;
    }
    
    return result;
  }

  /**
   * Test 1: Phaser Import Validation with auto-fixing
   */
  async testPhaserImports(test, workspacePath, result, context) {
    const files = await this.findJavaScriptFiles(workspacePath);
    let phaserFound = false;
    let cdnUsage = false;
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      
      // Check for proper imports
      const importMatches = content.match(test.pattern);
      if (importMatches) {
        phaserFound = true;
        result.fixes.push(`✅ Phaser import found: ${importMatches[0]}`);
      }
      
      // Check for CDN usage (problematic)
      const cdnMatches = content.match(test.cdnPattern);
      if (cdnMatches) {
        cdnUsage = true;
        result.errors.push(`CDN script tag detected: ${cdnMatches[0].substring(0, 50)}...`);
        
        // Auto-fix: Replace CDN with import
        if (context.autoFix !== false) {
          const fixedContent = content.replace(test.cdnPattern, '');
          const importLine = "import Phaser from 'phaser';\n";
          const newContent = importLine + fixedContent;
          
          await fs.writeFile(file, newContent);
          result.fixes.push('🔧 Auto-fixed: Replaced CDN with ES6 import');
          phaserFound = true;
          cdnUsage = false;
        }
      }
    }
    
    if (!phaserFound && !cdnUsage) {
      result.errors.push('No Phaser imports found in JavaScript files');
      
      // Auto-fix: Add import to main file
      if (context.autoFix !== false && files.length > 0) {
        const mainFile = this.findMainFile(files) || files[0];
        const content = await fs.readFile(mainFile, 'utf8');
        const newContent = "import Phaser from 'phaser';\n" + content;
        
        await fs.writeFile(mainFile, newContent);
        result.fixes.push('🔧 Auto-fixed: Added Phaser import to main file');
      }
    }
  }

  /**
   * Test 2: CDN Usage Detection with auto-fixing
   */
  async testCdnUsage(test, workspacePath, result, context) {
    const htmlFiles = await this.findFiles(workspacePath, ['.html']);
    const jsFiles = await this.findJavaScriptFiles(workspacePath);
    
    for (const file of [...htmlFiles, ...jsFiles]) {
      const content = await fs.readFile(file, 'utf8');
      const cdnMatches = content.match(test.pattern);
      
      if (cdnMatches) {
        for (const match of cdnMatches) {
          result.warnings.push(`CDN usage detected: ${match.substring(0, 80)}...`);
          
          // Check for problematic CDNs
          for (const issue of test.issues) {
            if (match.toLowerCase().includes(issue)) {
              result.errors.push(`Problematic CDN detected: ${issue}`);
              
              // Auto-fix: Comment out CDN and suggest npm alternative
              if (context.autoFix !== false) {
                const fixedContent = content.replace(match, `<!-- ${match} -->\n<!-- TODO: Replace with npm package -->`);
                await fs.writeFile(file, fixedContent);
                result.fixes.push(`🔧 Auto-fixed: Commented out ${issue} CDN`);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Test 3: Scene Method Validation with auto-fixing
   */
  async testSceneMethods(test, workspacePath, result, context) {
    const files = await this.findJavaScriptFiles(workspacePath);
    const foundMethods = new Set();
    let sceneClassFile = null;
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      
      // Look for scene class
      if (content.includes('extends Phaser.Scene') || content.includes('Phaser.Class')) {
        sceneClassFile = file;
      }
      
      const methodMatches = content.match(test.pattern);
      if (methodMatches) {
        for (const match of methodMatches) {
          const methodName = match.match(/(preload|create|update)/)[1];
          foundMethods.add(methodName);
        }
      }
    }
    
    // Check for missing methods
    for (const requiredMethod of test.requiredMethods) {
      if (!foundMethods.has(requiredMethod)) {
        result.errors.push(`Missing required scene method: ${requiredMethod}`);
        
        // Auto-fix: Add missing method
        if (context.autoFix !== false && sceneClassFile) {
          await this.addMethodToSceneClass(sceneClassFile, requiredMethod);
          result.fixes.push(`🔧 Auto-fixed: Added ${requiredMethod}() method`);
          foundMethods.add(requiredMethod);
        }
      }
    }
    
    if (foundMethods.size > 0) {
      result.fixes.push(`✅ Found scene methods: ${Array.from(foundMethods).join(', ')}`);
    }
  }

  /**
   * Test 4: Module Export Validation with auto-fixing  
   */
  async testModuleExports(test, workspacePath, result, context) {
    const files = await this.findJavaScriptFiles(workspacePath);
    let es6Exports = false;
    let commonjsExports = false;
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      
      const es6Matches = content.match(test.pattern);
      if (es6Matches) {
        es6Exports = true;
        result.fixes.push(`✅ ES6 exports found: ${es6Matches[0]}`);
      }
      
      const commonjsMatches = content.match(test.commonjsPattern);
      if (commonjsMatches) {
        commonjsExports = true;
        result.warnings.push('CommonJS exports detected - consider ES6 modules');
        
        // Auto-fix: Convert to ES6 if package.json allows
        if (context.autoFix !== false) {
          const packageJsonPath = path.join(workspacePath, 'package.json');
          try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            if (packageJson.type === 'module') {
              // Convert module.exports to export
              const fixedContent = content.replace(test.commonjsPattern, 'export default ');
              await fs.writeFile(file, fixedContent);
              result.fixes.push('🔧 Auto-fixed: Converted CommonJS to ES6 export');
            }
          } catch (error) {
            // package.json not found or invalid
          }
        }
      }
    }
    
    if (!es6Exports && !commonjsExports) {
      result.errors.push('No module exports found');
      
      // Auto-fix: Add export to main class/function
      if (context.autoFix !== false && files.length > 0) {
        const mainFile = this.findMainFile(files) || files[0];
        const content = await fs.readFile(mainFile, 'utf8');
        
        // Look for class or function to export
        const classMatch = content.match(/class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          const exportLine = `\nexport default ${className};\n`;
          await fs.writeFile(mainFile, content + exportLine);
          result.fixes.push(`🔧 Auto-fixed: Added export for ${className}`);
        }
      }
    }
  }

  /**
   * Test 5: Syntax Error Detection with auto-fixing
   */
  async testSyntaxErrors(test, workspacePath, result, context) {
    const files = await this.findJavaScriptFiles(workspacePath);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      let fixedContent = content;
      let hadFixes = false;
      
      for (let i = 0; i < test.patterns.length; i++) {
        const pattern = test.patterns[i];
        const matches = content.match(pattern);
        
        if (matches) {
          for (const match of matches) {
            const lineNumber = this.findLineNumber(content, match);
            
            switch (i) {
              case 0: // Double semicolons
                result.errors.push(`Double semicolons detected at line ${lineNumber}`);
                if (context.autoFix !== false) {
                  fixedContent = fixedContent.replace(/;;+/g, ';');
                  hadFixes = true;
                }
                break;
              case 1: // Empty blocks
                result.warnings.push(`Empty code block at line ${lineNumber}`);
                break;
              case 2: // Undefined function calls
                result.errors.push(`Undefined function call at line ${lineNumber}`);
                break;
            }
          }
        }
      }
      
      // Apply fixes
      if (hadFixes) {
        await fs.writeFile(file, fixedContent);
        result.fixes.push('🔧 Auto-fixed: Removed double semicolons');
      }
      
      // Run Node.js syntax check
      try {
        await this.runNodeSyntaxCheck(file, result, context);
      } catch (error) {
        result.warnings.push('Could not run Node.js syntax validation');
      }
    }
  }

  /**
   * Test 6: Markdown Code Block Extraction with auto-fixing
   */
  async testMarkdownFormatting(test, workspacePath, result, context) {
    const mdFiles = await this.findFiles(workspacePath, ['.md', '.markdown']);
    const jsFiles = await this.findJavaScriptFiles(workspacePath);
    let codeBlocksFound = 0;
    let extractedCode = '';
    
    for (const file of mdFiles) {
      const content = await fs.readFile(file, 'utf8');
      const codeBlocks = content.match(test.pattern);
      
      if (codeBlocks) {
        codeBlocksFound += codeBlocks.length;
        
        for (const block of codeBlocks) {
          const jsCode = block.replace(test.cleanupPattern, '').trim();
          
          if (jsCode.length > 0) {
            extractedCode += jsCode + '\n\n';
            
            // Validate extracted JS
            if (this.isValidJavaScript(jsCode)) {
              result.fixes.push(`✅ Valid JS extracted: ${jsCode.substring(0, 50)}...`);
              
              // Auto-fix: Extract to separate JS file
              if (context.autoFix !== false && jsFiles.length === 0) {
                const jsFileName = path.join(workspacePath, 'extracted-code.js');
                await fs.writeFile(jsFileName, extractedCode);
                result.fixes.push('🔧 Auto-fixed: Extracted JS code to file');
              }
            } else {
              result.warnings.push('Extracted code may have syntax issues');
            }
          }
        }
      }
    }
    
    if (codeBlocksFound === 0) {
      result.warnings.push('No markdown code blocks found');
    } else {
      result.fixes.push(`✅ Processed ${codeBlocksFound} code blocks`);
    }
  }

  async testWorker(workerId) {
    const workerStartTime = Date.now();
    logger.info(`🔍 Testing worker ${workerId} with enhanced validation...`);

    const result = {
      workerId,
      timestamp: new Date(),
      scores: {
        coreTests: 0,
        codeQuality: 0,
        performance: 0,
        browser: 0,
        api: 0,
        overall: 0
      },
      details: {
        coreTests: null,
        autoFixes: 0,
        similarityMatches: 0
      },
      errors: [],
      executionTime: 0
    };

    try {
      // FIRST: Run the 6 core tests with self-healing
      logger.info(`🧪 Running enhanced core tests with self-healing...`);
      const coreTestResults = await this.runCoreTestsWithHealing(workerId);
      
      // Calculate core test score
      const coreScores = Array.from(coreTestResults.values()).map(r => r.finalScore || 0);
      result.scores.coreTests = Math.round(coreScores.reduce((sum, score) => sum + score, 0) / coreScores.length);
      result.details.coreTests = coreTestResults;
      result.details.autoFixes = Array.from(coreTestResults.values()).filter(r => r.autoFixed).length;
      
      logger.info(`📊 Core tests completed: ${result.scores.coreTests}/100 (${result.details.autoFixes} auto-fixes applied)`);

      // Run all test categories
      const [qualityResult, performanceResult, browserResult, apiResult] = await Promise.allSettled([
        this.runCodeQualityTest(workerId),
        this.runPerformanceTest(workerId),
        this.runBrowserTests(workerId),
        this.runApiTests(workerId)
      ]);

      // Process results
      if (qualityResult.status === 'fulfilled') {
        Object.assign(result.scores, { codeQuality: qualityResult.value.codeQuality });
        result.details.codeQuality = qualityResult.value.details;
      } else {
        result.errors.push(`Code quality: ${qualityResult.reason?.message || 'Failed'}`);
      }

      if (performanceResult.status === 'fulfilled') {
        Object.assign(result.scores, { performance: performanceResult.value.performance });
        result.details.performance = performanceResult.value.details;
      } else {
        result.errors.push(`Performance: ${performanceResult.reason?.message || 'Failed'}`);
      }

      if (browserResult.status === 'fulfilled') {
        Object.assign(result.scores, { browser: browserResult.value.browser });
        result.details.browser = browserResult.value;
      } else {
        result.errors.push(`Browser: ${browserResult.reason?.message || 'Failed'}`);
      }

      if (apiResult.status === 'fulfilled') {
        Object.assign(result.scores, { api: apiResult.value.api });
        result.details.api = apiResult.value;
      } else {
        result.errors.push(`API: ${apiResult.reason?.message || 'Failed'}`);
      }

      // Calculate weighted overall score (including core tests)
      const weights = { coreTests: 0.3, codeQuality: 0.25, performance: 0.2, browser: 0.15, api: 0.1 };
      result.scores.overall = Math.round(
        (result.scores.coreTests * weights.coreTests) +
        (result.scores.codeQuality * weights.codeQuality) +
        (result.scores.performance * weights.performance) +
        (result.scores.browser * weights.browser) +
        (result.scores.api * weights.api)
      );

      result.executionTime = Date.now() - workerStartTime;

      logger.info(`✅ Worker ${workerId} testing complete - Overall: ${result.scores.overall}/100 (${Math.round(result.executionTime / 1000)}s)`);

    } catch (error) {
      result.errors.push(`Worker testing failed: ${error.message}`);
      result.executionTime = Date.now() - workerStartTime;
      logger.error(`❌ Worker ${workerId} testing failed:`, error);
    }

    this.results.set(workerId, result);
    return result;
  }

  async runComprehensiveTests(workerIds) {
    logger.info(`🧪 Starting comprehensive testing for ${workerIds.length} workers`);

    // Validate workspaces
    const validWorkers = await this.validateWorkerWorkspaces(workerIds);
    
    if (validWorkers.length === 0) {
      logger.warn('⚠️  No valid worker workspaces found');
      return this.results;
    }

    // Start servers
    await this.startMockServers(validWorkers);

    // Test workers in batches
    const batchSize = 2;
    for (let i = 0; i < validWorkers.length; i += batchSize) {
      const batch = validWorkers.slice(i, i + batchSize);
      const batchPromises = batch.map(workerId => this.testWorker(workerId));
      await Promise.allSettled(batchPromises);
    }

    // Generate analysis
    if (this.results.size > 0) {
      await this.generateComparativeAnalysis();
    }

    return this.results;
  }

  async generateComparativeAnalysis() {
    const allResults = Array.from(this.results.values());
    
    if (allResults.length === 0) {
      logger.warn('⚠️  No results to analyze');
      return;
    }

    logger.info('📊 Generating comparative analysis');
    
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

    // Calculate averages
    const averageScores = {
      codeQuality: Math.round(allResults.reduce((sum, r) => sum + r.scores.codeQuality, 0) / allResults.length),
      performance: Math.round(allResults.reduce((sum, r) => sum + r.scores.performance, 0) / allResults.length),
      browser: Math.round(allResults.reduce((sum, r) => sum + r.scores.browser, 0) / allResults.length),
      api: Math.round(allResults.reduce((sum, r) => sum + r.scores.api, 0) / allResults.length),
      overall: Math.round(allResults.reduce((sum, r) => sum + r.scores.overall, 0) / allResults.length)
    };

    const analysis = {
      timestamp: new Date().toISOString(),
      totalWorkers: allResults.length,
      rankings: rankedWorkers,
      categoryWinners: {
        codeQuality: categoryWinners.codeQuality.workerId,
        performance: categoryWinners.performance.workerId,
        browser: categoryWinners.browser.workerId,
        api: categoryWinners.api.workerId
      },
      averageScores,
      summary: {
        bestOverall: rankedWorkers[0].workerId,
        worstOverall: rankedWorkers[rankedWorkers.length - 1].workerId
      }
    };

    // Save analysis
    const analysisPath = '/tmp/grunts-comparative-analysis.json';
    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2));

    // Save detailed results
    const detailedResultsPath = '/tmp/grunts-detailed-results.json';
    const detailedResults = Array.from(this.results.entries()).map(([workerId, result]) => ({
      workerId,
      ...result
    }));
    await fs.writeFile(detailedResultsPath, JSON.stringify(detailedResults, null, 2));

    logger.info(`🏆 Overall winner: Worker ${rankedWorkers[0].workerId} (${rankedWorkers[0].scores.overall}/100)`);
    logger.info(`📄 Results saved to: ${analysisPath}`);
  }

  async cleanup() {
    logger.info('🧹 Cleaning up test servers');
    
    this.serverProcesses.forEach(({ workerId, process }) => {
      try {
        process.kill('SIGTERM');
        logger.debug(`Stopped server for worker ${workerId}`);
      } catch (error) {
        logger.warn(`Error stopping server for worker ${workerId}:`, error);
      }
    });
    
    this.serverProcesses = [];
  }

  /**
   * Validation function for core test results
   */
  async validateCoreTestResult(result, test) {
    return {
      success: result.passed && result.errors.length === 0,
      score: result.score,
      errors: result.errors,
      warnings: result.warnings,
      fixes: result.fixes
    };
  }

  /**
   * Helper: Find JavaScript files in directory
   */
  async findJavaScriptFiles(dirPath) {
    return await this.findFiles(dirPath, ['.js', '.ts', '.jsx', '.tsx']);
  }

  /**
   * Helper: Find files by extensions
   */
  async findFiles(dirPath, extensions) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findFiles(fullPath, extensions);
          files.push(...subFiles);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is inaccessible
    }
    
    return files;
  }

  /**
   * Helper: Find main file in list
   */
  findMainFile(files) {
    const candidates = ['main.js', 'index.js', 'app.js', 'game.js'];
    
    for (const candidate of candidates) {
      const found = files.find(file => path.basename(file) === candidate);
      if (found) return found;
    }
    
    return null;
  }

  /**
   * Helper: Find line number of match in content
   */
  findLineNumber(content, match) {
    const index = content.indexOf(match);
    if (index === -1) return null;
    
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Helper: Add method to scene class
   */
  async addMethodToSceneClass(filePath, methodName) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      const methodTemplates = {
        preload: `  preload() {\n    // Load game assets here\n    // this.load.image('key', 'path/to/image.png');\n  }`,
        create: `  create() {\n    // Initialize game objects here\n    // this.add.image(400, 300, 'key');\n  }`,
        update: `  update() {\n    // Game loop logic here\n    // Called once per frame\n  }`
      };
      
      if (methodTemplates[methodName]) {
        // Find class definition and add method
        const classMatch = content.match(/class\s+\w+.*?{/);
        if (classMatch) {
          const insertIndex = content.indexOf('{', classMatch.index) + 1;
          const newContent = 
            content.slice(0, insertIndex) + 
            '\n' + methodTemplates[methodName] + '\n' +
            content.slice(insertIndex);
          
          await fs.writeFile(filePath, newContent);
          return true;
        }
      }
    } catch (error) {
      throw new Error(`Failed to add method ${methodName}: ${error.message}`);
    }
    
    return false;
  }

  /**
   * Helper: Run Node.js syntax check
   */
  async runNodeSyntaxCheck(filePath, result, context) {
    return new Promise((resolve) => {
      const checkProcess = spawn('node', ['--check', filePath], {
        stdio: 'pipe'
      });

      let stderr = '';
      checkProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code !== 0 && stderr) {
          result.errors.push(`Syntax error: ${stderr.trim()}`);
          
          // Auto-fix common syntax issues
          if (context.autoFix !== false) {
            if (stderr.includes('Unexpected token')) {
              result.fixes.push('🔧 Syntax error detected - manual review needed');
            }
          }
        }
        resolve();
      });

      checkProcess.on('error', () => {
        result.warnings.push('Could not run Node.js syntax check');
        resolve();
      });

      setTimeout(() => {
        if (!checkProcess.killed) {
          checkProcess.kill('SIGTERM');
          resolve();
        }
      }, 10000);
    });
  }

  /**
   * Helper: Basic JavaScript validation
   */
  isValidJavaScript(code) {
    // Basic heuristics for valid JS
    const hasValidStructure = /\{|\}|\(|\)|;|const |let |var |function|=>/.test(code);
    const hasBalancedBraces = this.hasBalancedBraces(code);
    
    return hasValidStructure && hasBalancedBraces;
  }

  /**
   * Helper: Check balanced braces
   */
  hasBalancedBraces(code) {
    const stack = [];
    const pairs = { '(': ')', '{': '}', '[': ']' };
    
    for (const char of code) {
      if (pairs[char]) {
        stack.push(char);
      } else if (Object.values(pairs).includes(char)) {
        const last = stack.pop();
        if (!last || pairs[last] !== char) {
          return false;
        }
      }
    }
    
    return stack.length === 0;
  }

  /**
   * Error similarity detection
   */
  findSimilarErrors(newError) {
    const normalizedError = normalizeErrorMessage(newError);
    const similarErrors = [];
    
    // Check against known errors in classifier
    const similarError = this.errorClassifier.findSimilarError(newError);
    if (similarError && similarError.similarity >= this.similarityThreshold) {
      similarErrors.push({
        similarity: similarError.similarity,
        solution: similarError.error.solution,
        category: similarError.error.category
      });
    }
    
    return similarErrors;
  }

  /**
   * Learn from test results
   */
  async learnFromTestResults(testResults) {
    for (const [testId, result] of testResults) {
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          // Find successful fixes for this error
          const successfulFixes = result.fixes || [];
          if (successfulFixes.length > 0) {
            this.errorClassifier.learnFromError(error, successfulFixes[0]);
          }
        }
      }
    }
  }
}

export async function executeGruntsValidation(workerIds) {
  const orchestrator = new EnhancedTestOrchestrator();
  
  try {
    logger.info('🚀 Initializing Grunts test validation system');
    console.log(`📋 Starting comprehensive validation for ${workerIds.length} LLM implementations`);
    
    const results = await orchestrator.runComprehensiveTests(workerIds);
    
    if (results.size === 0) {
      logger.warn('⚠️  No test results generated');
      console.log('❌ No valid implementations found to test');
      return new Map();
    }
    
    logger.info('✅ All tests completed successfully');
    console.log(`✅ Validation complete! Tested ${results.size} implementations`);
    
    // Display summary
    const resultArray = Array.from(results.values());
    const sorted = resultArray.sort((a, b) => b.scores.overall - a.scores.overall);
    
    console.log('\\n🏆 RESULTS SUMMARY:');
    console.log('==================');
    
    sorted.forEach((result, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
      console.log(`${medal} #${rank} Worker ${result.workerId}: ${result.scores.overall}/100`);
      console.log(`     Quality: ${result.scores.codeQuality} | Performance: ${result.scores.performance} | Browser: ${result.scores.browser} | API: ${result.scores.api}`);
    });
    
    console.log('\\n📊 Detailed results saved to /tmp/grunts-comparative-analysis.json');
    
    return results;
    
  } catch (error) {
    logger.error('Grunts validation failed:', error);
    console.error('❌ Validation failed:', error.message);
    throw error;
  } finally {
    await orchestrator.cleanup();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Grunts Test Validation System

Usage:
  node main.js [options] [worker_ids...]

Options:
  --help, -h          Show this help message
  --worker <id>       Test specific worker ID
  --all               Test all available workers (default)
  --verbose           Enable verbose logging

Examples:
  node main.js --worker 1        # Test worker 1 only
  node main.js 1 2 3            # Test workers 1, 2, and 3
  node main.js --all            # Test all available workers
  node main.js --verbose        # Enable verbose output
    `);
    process.exit(0);
  }
  
  // Parse arguments
  let workerIds = [];
  let verbose = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--verbose') {
      verbose = true;
    } else if (arg === '--worker') {
      const workerId = args[i + 1];
      if (workerId) {
        workerIds.push(workerId);
        i++; // Skip next argument
      }
    } else if (arg === '--all') {
      // Find all available workers
      try {
        const tmpDirs = await fs.readdir('/tmp');
        workerIds = tmpDirs
          .filter(dir => dir.startsWith('grunt-'))
          .map(dir => dir.replace('grunt-', ''))
          .filter(id => /^\d+$/.test(id));
      } catch (error) {
        console.error('❌ Failed to find worker directories:', error.message);
        process.exit(1);
      }
    } else if (/^\d+$/.test(arg)) {
      // Numeric argument is a worker ID
      workerIds.push(arg);
    }
  }
  
  // Default to finding all workers if none specified
  if (workerIds.length === 0) {
    try {
      const tmpDirs = await fs.readdir('/tmp');
      workerIds = tmpDirs
        .filter(dir => dir.startsWith('grunt-'))
        .map(dir => dir.replace('grunt-', ''))
        .filter(id => /^\d+$/.test(id));
        
      if (workerIds.length === 0) {
        console.log('ℹ️  No worker directories found. Make sure grunts has been run first.');
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Failed to scan for worker directories:', error.message);
      process.exit(1);
    }
  }
  
  if (verbose) {
    process.env.LOG_LEVEL = 'debug';
  }
  
  console.log(`🎯 Target workers: ${workerIds.join(', ')}`);
  
  try {
    await executeGruntsValidation(workerIds);
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run as CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}