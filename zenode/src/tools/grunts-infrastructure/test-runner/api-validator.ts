/**
 * API Validator - Node.js testing for REST endpoints and server functionality
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../../src/utils/logger.js';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface ApiEndpointResult {
  method: string;
  path: string;
  expectedStatus: number | number[];
  actualStatus: number;
  responseTime: number;
  passed: boolean;
  error?: string;
}

export interface ApiTestResult {
  workerId: string;
  endpoints: ApiEndpointResult[];
  performance: Record<string, number>;
  errors: string[];
  passed: number;
  failed: number;
  serverHealth: {
    started: boolean;
    responding: boolean;
    port: number;
  };
  timestamp: Date;
}

export class ApiValidator {
  private servers: Map<string, ChildProcess> = new Map();
  private baseUrls: Map<string, string> = new Map();
  private serverHealth: Map<string, boolean> = new Map();

  async startTestServers(workerIds: string[]): Promise<void> {
    logger.info(`🚀 Starting test servers for ${workerIds.length} workers`);
    
    const startPromises = workerIds.map(workerId => this.startWorkerServer(workerId));
    await Promise.allSettled(startPromises);
    
    logger.info(`✅ Server startup complete. ${this.servers.size}/${workerIds.length} servers started successfully`);
  }

  private async startWorkerServer(workerId: string): Promise<void> {
    const port = 3031 + parseInt(workerId);
    const workspacePath = `/tmp/grunt-${workerId}`;
    
    this.baseUrls.set(workerId, `http://localhost:${port}`);
    
    try {
      // Check if workspace exists
      await fs.access(workspacePath);
      
      // Look for server entry point
      const possibleEntryPoints = ['server.js', 'index.js', 'app.js', 'main.js'];
      let serverFile = null;
      
      for (const file of possibleEntryPoints) {
        try {
          await fs.access(path.join(workspacePath, file));
          serverFile = file;
          break;
        } catch (error) {
          // File doesn't exist, try next
        }
      }
      
      if (!serverFile) {
        // Check package.json for start script
        try {
          const packageJson = JSON.parse(await fs.readFile(path.join(workspacePath, 'package.json'), 'utf8'));
          if (packageJson.scripts?.start) {
            // Use npm start
            serverFile = 'npm-start';
          } else if (packageJson.main) {
            serverFile = packageJson.main;
          }
        } catch (error) {
          logger.warn(`No package.json found for worker ${workerId}`);
        }
      }
      
      if (!serverFile) {
        throw new Error(`No server entry point found in ${workspacePath}`);
      }
      
      logger.info(`Starting server for worker ${workerId} on port ${port} using ${serverFile}`);
      
      // Start the server process
      let serverProcess: ChildProcess;
      
      if (serverFile === 'npm-start') {
        serverProcess = spawn('npm', ['start'], {
          cwd: workspacePath,
          env: { 
            ...process.env, 
            PORT: port.toString(),
            NODE_ENV: 'production'
          },
          stdio: 'pipe',
          detached: false
        });
      } else {
        serverProcess = spawn('node', [serverFile], {
          cwd: workspacePath,
          env: { 
            ...process.env, 
            PORT: port.toString(),
            NODE_ENV: 'production'
          },
          stdio: 'pipe',
          detached: false
        });
      }
      
      // Handle server output
      serverProcess.stdout?.on('data', (data) => {
        logger.debug(`Worker ${workerId} stdout: ${data.toString().trim()}`);
      });
      
      serverProcess.stderr?.on('data', (data) => {
        logger.debug(`Worker ${workerId} stderr: ${data.toString().trim()}`);
      });
      
      serverProcess.on('error', (error) => {
        logger.error(`Server process error for worker ${workerId}:`, error);
        this.serverHealth.set(workerId, false);
      });
      
      serverProcess.on('exit', (code, signal) => {
        logger.info(`Server for worker ${workerId} exited with code ${code}, signal ${signal}`);
        this.serverHealth.set(workerId, false);
      });
      
      this.servers.set(workerId, serverProcess);
      
      // Wait for server to be ready
      const isReady = await this.waitForServer(workerId, port);
      this.serverHealth.set(workerId, isReady);
      
      if (isReady) {
        logger.info(`✅ Server for worker ${workerId} is ready on port ${port}`);
      } else {
        logger.warn(`⚠️  Server for worker ${workerId} failed to start properly on port ${port}`);
      }
      
    } catch (error) {
      logger.error(`Failed to start server for worker ${workerId}:`, error);
      this.serverHealth.set(workerId, false);
    }
  }

  private async waitForServer(workerId: string, port: number, maxAttempts = 30): Promise<boolean> {
    const baseUrl = `http://localhost:${port}`;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Try health endpoint first, then root
        const healthResponse = await fetch(`${baseUrl}/health`, { 
          timeout: 2000,
          headers: { 'User-Agent': 'grunts-api-validator' }
        });
        
        if (healthResponse.ok) {
          return true;
        }
        
        // Fallback to root endpoint
        const rootResponse = await fetch(`${baseUrl}/`, { 
          timeout: 2000,
          headers: { 'User-Agent': 'grunts-api-validator' }
        });
        
        if (rootResponse.status < 500) { // Accept any non-server-error response
          return true;
        }
        
      } catch (error) {
        // Server not ready yet, wait and retry
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return false;
  }

  async validateApi(workerId: string): Promise<ApiTestResult> {
    const baseUrl = this.baseUrls.get(workerId);
    const isHealthy = this.serverHealth.get(workerId) || false;
    
    if (!baseUrl) {
      throw new Error(`No server configured for worker ${workerId}`);
    }
    
    logger.info(`🔌 Validating API for worker ${workerId} at ${baseUrl}`);
    
    const result: ApiTestResult = {
      workerId,
      endpoints: [],
      performance: {},
      errors: [],
      passed: 0,
      failed: 0,
      serverHealth: {
        started: this.servers.has(workerId),
        responding: isHealthy,
        port: 3031 + parseInt(workerId)
      },
      timestamp: new Date()
    };

    if (!isHealthy) {
      result.errors.push('Server is not responding');
      result.failed++;
      return result;
    }

    // Define comprehensive endpoint tests
    const endpoints = [
      { method: 'GET', path: '/', expectedStatus: [200, 404], description: 'Root endpoint' },
      { method: 'GET', path: '/health', expectedStatus: [200, 404], description: 'Health check' },
      { method: 'GET', path: '/api/health', expectedStatus: [200, 404], description: 'API health check' },
      { method: 'POST', path: '/api/data', expectedStatus: [200, 201, 404, 405], description: 'Data endpoint', data: { test: 'api-validation', timestamp: Date.now() } },
      { method: 'GET', path: '/api/users', expectedStatus: [200, 404, 401], description: 'Users endpoint' },
      { method: 'GET', path: '/api/status', expectedStatus: [200, 404], description: 'Status endpoint' },
      { method: 'POST', path: '/api/auth/login', expectedStatus: [200, 400, 401, 404, 405], description: 'Login endpoint', data: { username: 'test', password: 'test' } },
      { method: 'GET', path: '/static/js/main.js', expectedStatus: [200, 404], description: 'Static JS file' },
      { method: 'GET', path: '/static/css/main.css', expectedStatus: [200, 404], description: 'Static CSS file' },
      { method: 'GET', path: '/favicon.ico', expectedStatus: [200, 404], description: 'Favicon' }
    ];

    // Test each endpoint
    for (const endpoint of endpoints) {
      try {
        const endpointResult = await this.testEndpoint(baseUrl, endpoint);
        result.endpoints.push(endpointResult);
        
        if (endpointResult.passed) {
          result.passed++;
        } else {
          result.failed++;
          if (endpointResult.error) {
            result.errors.push(`${endpoint.method} ${endpoint.path}: ${endpointResult.error}`);
          }
        }

        // Track performance metrics
        const metricKey = `${endpoint.method}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        result.performance[metricKey] = endpointResult.responseTime;

      } catch (error) {
        const failedResult: ApiEndpointResult = {
          ...endpoint,
          actualStatus: 0,
          responseTime: 0,
          passed: false,
          error: error.message
        };
        
        result.endpoints.push(failedResult);
        result.failed++;
        result.errors.push(`${endpoint.method} ${endpoint.path}: ${error.message}`);
      }
    }

    // Additional API health tests
    await this.runHealthTests(baseUrl, result);

    logger.info(`✅ API validation complete for worker ${workerId} - ${result.passed} passed, ${result.failed} failed`);
    
    return result;
  }

  private async testEndpoint(baseUrl: string, endpoint: any): Promise<ApiEndpointResult> {
    const url = `${baseUrl}${endpoint.path}`;
    const startTime = Date.now();
    
    const options: any = { 
      method: endpoint.method,
      timeout: 15000,
      headers: {
        'User-Agent': 'grunts-api-validator',
        'Accept': '*/*'
      }
    };

    if (endpoint.method === 'POST' && endpoint.data) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(endpoint.data);
    }

    try {
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;
      
      const result: ApiEndpointResult = {
        method: endpoint.method,
        path: endpoint.path,
        expectedStatus: endpoint.expectedStatus,
        actualStatus: response.status,
        responseTime,
        passed: this.checkStatus(response.status, endpoint.expectedStatus)
      };

      if (!result.passed) {
        result.error = `Expected status ${Array.isArray(endpoint.expectedStatus) ? endpoint.expectedStatus.join(' or ') : endpoint.expectedStatus}, got ${response.status}`;
      }

      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        method: endpoint.method,
        path: endpoint.path,
        expectedStatus: endpoint.expectedStatus,
        actualStatus: 0,
        responseTime,
        passed: false,
        error: error.message
      };
    }
  }

  private checkStatus(actual: number, expected: number | number[]): boolean {
    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }
    return actual === expected;
  }

  private async runHealthTests(baseUrl: string, result: ApiTestResult): Promise<void> {
    // Test server responsiveness under load
    try {
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests).fill(null).map(async () => {
        const startTime = Date.now();
        try {
          const response = await fetch(`${baseUrl}/`, { timeout: 5000 });
          return Date.now() - startTime;
        } catch (error) {
          return -1;
        }
      });

      const responseTimes = await Promise.all(requests);
      const successfulRequests = responseTimes.filter(time => time > 0);
      
      if (successfulRequests.length >= concurrentRequests * 0.8) { // 80% success rate
        result.passed++;
        result.performance['concurrent_load_test'] = successfulRequests.reduce((a, b) => a + b, 0) / successfulRequests.length;
      } else {
        result.failed++;
        result.errors.push(`Concurrent load test failed: ${successfulRequests.length}/${concurrentRequests} requests successful`);
      }

    } catch (error) {
      result.failed++;
      result.errors.push(`Health test error: ${error.message}`);
    }

    // Test server persistence (is it still running?)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const response = await fetch(`${baseUrl}/`, { timeout: 3000 });
      if (response.status < 500) {
        result.passed++;
      } else {
        result.failed++;
        result.errors.push('Server persistence test failed: server returned error status');
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Server persistence test failed: ${error.message}`);
    }
  }

  getServerHealth(): Map<string, boolean> {
    return this.serverHealth;
  }

  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up API validator servers');
    
    const cleanupPromises = Array.from(this.servers.entries()).map(async ([workerId, process]) => {
      try {
        // Graceful shutdown first
        process.kill('SIGTERM');
        
        // Wait up to 5 seconds for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Force kill if still running
        if (!process.killed) {
          process.kill('SIGKILL');
        }
        
        logger.info(`Server for worker ${workerId} stopped`);
      } catch (error) {
        logger.warn(`Error stopping server for worker ${workerId}:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
    
    this.servers.clear();
    this.baseUrls.clear();
    this.serverHealth.clear();
    
    logger.info('✅ API validator cleanup complete');
  }
}