/**
 * Test Orchestrator - Coordinates all testing components for comprehensive validation
 */
import { BrowserValidator, BrowserTestResult } from './browser-validator.js';
import { ApiValidator, ApiTestResult } from './api-validator.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../../../src/utils/logger.js';

export interface ComprehensiveTestResult {
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
  executionTime: number;
}

export interface ComparativeAnalysis {
  timestamp: string;
  totalWorkers: number;
  rankings: Array<{
    rank: number;
    workerId: string;
    scores: ComprehensiveTestResult['scores'];
    percentile: number;
  }>;
  categoryWinners: {
    codeQuality: ComprehensiveTestResult;
    performance: ComprehensiveTestResult;
    browser: ComprehensiveTestResult;
    api: ComprehensiveTestResult;
  };
  averageScores: ComprehensiveTestResult['scores'];
  summary: {
    bestOverall: string;
    worstOverall: string;
    mostConsistent: string;
    speediest: string;
  };
}

export class TestOrchestrator {
  private browserValidator: BrowserValidator;
  private apiValidator: ApiValidator;
  private results: Map<string, ComprehensiveTestResult> = new Map();
  private startTime: number;

  constructor() {
    this.browserValidator = new BrowserValidator();
    this.apiValidator = new ApiValidator();
    this.startTime = Date.now();
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Test Orchestrator');
    await this.browserValidator.initialize();
    logger.info('✅ Test Orchestrator ready');
  }

  async runComprehensiveTests(workerIds: string[]): Promise<Map<string, ComprehensiveTestResult>> {
    logger.info(`🧪 Starting comprehensive testing for ${workerIds.length} workers`);
    this.startTime = Date.now();

    // Filter out workers that don't have workspaces
    const validWorkers = await this.validateWorkerWorkspaces(workerIds);
    
    if (validWorkers.length === 0) {
      logger.warn('⚠️  No valid worker workspaces found');
      return this.results;
    }

    logger.info(`📁 Testing ${validWorkers.length} workers with valid workspaces`);

    // Start API servers for all valid workers
    try {
      await this.apiValidator.startTestServers(validWorkers);
    } catch (error) {
      logger.error('Failed to start API test servers:', error);
    }

    // Run tests for each worker (with limited parallelism to avoid overwhelming system)
    const batchSize = 3; // Test 3 workers at a time
    for (let i = 0; i < validWorkers.length; i += batchSize) {
      const batch = validWorkers.slice(i, i + batchSize);
      const batchPromises = batch.map(workerId => this.testWorker(workerId));
      await Promise.allSettled(batchPromises);
    }

    // Generate comparative analysis
    if (this.results.size > 0) {
      await this.generateComparativeAnalysis();
    }

    const totalTime = Date.now() - this.startTime;
    logger.info(`✅ Comprehensive testing complete in ${Math.round(totalTime / 1000)}s`);

    return this.results;
  }

  private async validateWorkerWorkspaces(workerIds: string[]): Promise<string[]> {
    const validWorkers: string[] = [];
    
    for (const workerId of workerIds) {
      const workspacePath = `/tmp/grunt-${workerId}`;
      try {
        await fs.access(workspacePath);
        // Check if there's at least some code in the workspace
        const files = await fs.readdir(workspacePath);
        if (files.length > 0) {
          validWorkers.push(workerId);
          logger.info(`✅ Worker ${workerId} has valid workspace`);
        } else {
          logger.warn(`⚠️  Worker ${workerId} workspace is empty`);
        }
      } catch (error) {
        logger.warn(`⚠️  Worker ${workerId} workspace not found at ${workspacePath}`);
      }
    }
    
    return validWorkers;
  }

  private async testWorker(workerId: string): Promise<void> {
    const workerStartTime = Date.now();
    logger.info(`🔍 Testing worker ${workerId}`);

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
      errors: [],
      executionTime: 0
    };

    try {
      // Run all test categories with error isolation
      const testPromises = [
        this.runCodeQualityTests(workerId, result).catch(error => {
          result.errors.push(`Code quality tests failed: ${error.message}`);
          logger.error(`Code quality test error for worker ${workerId}:`, error);
        }),
        this.runPerformanceTests(workerId, result).catch(error => {
          result.errors.push(`Performance tests failed: ${error.message}`);
          logger.error(`Performance test error for worker ${workerId}:`, error);
        }),
        this.runBrowserTests(workerId, result).catch(error => {
          result.errors.push(`Browser tests failed: ${error.message}`);
          logger.error(`Browser test error for worker ${workerId}:`, error);
        }),
        this.runApiTests(workerId, result).catch(error => {
          result.errors.push(`API tests failed: ${error.message}`);
          logger.error(`API test error for worker ${workerId}:`, error);
        })
      ];

      await Promise.allSettled(testPromises);

      // Calculate overall score (weighted average)
      const weights = { codeQuality: 0.3, performance: 0.25, browser: 0.25, api: 0.2 };
      result.scores.overall = Math.round(
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
  }

  private async runCodeQualityTests(workerId: string, result: ComprehensiveTestResult): Promise<void> {
    return new Promise<void>((resolve) => {
      logger.debug(`📋 Running code quality tests for worker ${workerId}`);
      
      const scriptPath = join(process.cwd(), 'validate-code-quality.sh');
      const process = spawn('bash', [scriptPath, workerId], {
        cwd: join(__dirname),
        stdio: 'pipe'
      });

      let output = '';
      process.stdout?.on('data', (data) => output += data.toString());
      process.stderr?.on('data', (data) => output += data.toString());

      process.on('close', async (code) => {
        try {
          const resultsPath = `/tmp/grunt-${workerId}/test-results/final-score.json`;
          const scoreData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
          
          result.scores.codeQuality = Math.round(scoreData.scores.percentage);
          result.details.codeQuality = scoreData;
          
          logger.debug(`✅ Code quality for worker ${workerId}: ${result.scores.codeQuality}/100`);
        } catch (error) {
          result.errors.push(`Code quality test parsing failed: ${error.message}`);
          result.scores.codeQuality = 0;
          logger.warn(`⚠️  Failed to parse code quality results for worker ${workerId}:`, error);
        }
        resolve();
      });

      process.on('error', (error) => {
        result.errors.push(`Code quality test execution failed: ${error.message}`);
        result.scores.codeQuality = 0;
        logger.warn(`⚠️  Code quality test execution failed for worker ${workerId}:`, error);
        resolve();
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          result.errors.push('Code quality tests timed out');
          result.scores.codeQuality = 0;
          resolve();
        }
      }, 120000);
    });
  }

  private async runPerformanceTests(workerId: string, result: ComprehensiveTestResult): Promise<void> {
    return new Promise<void>((resolve) => {
      logger.debug(`🚀 Running performance tests for worker ${workerId}`);
      
      const scriptPath = join(process.cwd(), 'performance-benchmark.sh');
      const process = spawn('bash', [scriptPath, workerId], {
        cwd: join(__dirname),
        stdio: 'pipe'
      });

      process.on('close', async () => {
        try {
          const resultsPath = `/tmp/grunt-${workerId}/test-results/performance-score.json`;
          const performanceData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
          
          result.scores.performance = Math.round(performanceData.performanceScore);
          result.details.performance = performanceData;
          
          logger.debug(`✅ Performance for worker ${workerId}: ${result.scores.performance}/100`);
        } catch (error) {
          result.errors.push(`Performance test parsing failed: ${error.message}`);
          result.scores.performance = 0;
          logger.warn(`⚠️  Failed to parse performance results for worker ${workerId}:`, error);
        }
        resolve();
      });

      process.on('error', (error) => {
        result.errors.push(`Performance test execution failed: ${error.message}`);
        result.scores.performance = 0;
        logger.warn(`⚠️  Performance test execution failed for worker ${workerId}:`, error);
        resolve();
      });

      // Timeout after 3 minutes
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          result.errors.push('Performance tests timed out');
          result.scores.performance = 0;
          resolve();
        }
      }, 180000);
    });
  }

  private async runBrowserTests(workerId: string, result: ComprehensiveTestResult): Promise<void> {
    try {
      logger.debug(`🌐 Running browser tests for worker ${workerId}`);
      
      const browserResult = await this.browserValidator.validateWebComponent(workerId, 'index.html');
      
      const totalTests = browserResult.passed + browserResult.failed;
      result.scores.browser = totalTests > 0 ? Math.round((browserResult.passed / totalTests) * 100) : 0;
      result.details.browser = browserResult;
      
      logger.debug(`✅ Browser tests for worker ${workerId}: ${result.scores.browser}/100`);
      
    } catch (error) {
      result.errors.push(`Browser tests failed: ${error.message}`);
      result.scores.browser = 0;
      logger.warn(`⚠️  Browser tests failed for worker ${workerId}:`, error);
    }
  }

  private async runApiTests(workerId: string, result: ComprehensiveTestResult): Promise<void> {
    try {
      logger.debug(`🔌 Running API tests for worker ${workerId}`);
      
      const apiResult = await this.apiValidator.validateApi(workerId);
      
      const totalTests = apiResult.passed + apiResult.failed;
      result.scores.api = totalTests > 0 ? Math.round((apiResult.passed / totalTests) * 100) : 0;
      result.details.api = apiResult;
      
      logger.debug(`✅ API tests for worker ${workerId}: ${result.scores.api}/100`);
      
    } catch (error) {
      result.errors.push(`API tests failed: ${error.message}`);
      result.scores.api = 0;
      logger.warn(`⚠️  API tests failed for worker ${workerId}:`, error);
    }
  }

  private async generateComparativeAnalysis(): Promise<void> {
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

    // Calculate consistency (lowest standard deviation in scores)
    const mostConsistent = allResults.reduce((prev, curr) => {
      const prevStdDev = this.calculateStandardDeviation([
        prev.scores.codeQuality, prev.scores.performance, prev.scores.browser, prev.scores.api
      ]);
      const currStdDev = this.calculateStandardDeviation([
        curr.scores.codeQuality, curr.scores.performance, curr.scores.browser, curr.scores.api
      ]);
      return prevStdDev < currStdDev ? prev : curr;
    });

    // Find speediest (lowest execution time)
    const speediest = allResults.reduce((prev, curr) => 
      prev.executionTime < curr.executionTime ? prev : curr);

    const analysis: ComparativeAnalysis = {
      timestamp: new Date().toISOString(),
      totalWorkers: allResults.length,
      rankings: rankedWorkers,
      categoryWinners,
      averageScores,
      summary: {
        bestOverall: rankedWorkers[0].workerId,
        worstOverall: rankedWorkers[rankedWorkers.length - 1].workerId,
        mostConsistent: mostConsistent.workerId,
        speediest: speediest.workerId
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

    logger.info('📊 Comparative analysis complete');
    logger.info(`🏆 Overall winner: Worker ${rankedWorkers[0].workerId} (${rankedWorkers[0].scores.overall}/100)`);
    logger.info(`📈 Category winners: Quality=${categoryWinners.codeQuality.workerId}, Performance=${categoryWinners.performance.workerId}, Browser=${categoryWinners.browser.workerId}, API=${categoryWinners.api.workerId}`);
    logger.info(`⚡ Speediest: Worker ${speediest.workerId} (${Math.round(speediest.executionTime / 1000)}s)`);
    logger.info(`🎯 Most consistent: Worker ${mostConsistent.workerId}`);
    logger.info(`📄 Results saved to: ${analysisPath}`);
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  getResults(): Map<string, ComprehensiveTestResult> {
    return this.results;
  }

  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up Test Orchestrator');
    
    await Promise.allSettled([
      this.browserValidator.cleanup(),
      this.apiValidator.cleanup()
    ]);
    
    logger.info('✅ Test Orchestrator cleanup complete');
  }
}