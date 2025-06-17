/**
 * Global test setup for Grunts validation
 */
import { beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Global test configuration
beforeAll(async () => {
  console.log('🧪 Setting up Grunts test environment');
  
  // Ensure results directory exists
  const resultsDir = path.join(process.cwd(), 'results');
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.GRUNTS_TEST_MODE = 'true';
  
  console.log('✅ Test environment ready');
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment');
  // Cleanup code here if needed
});

// Global test utilities
declare global {
  var testUtils: {
    waitForServer: (port: number, timeout?: number) => Promise<boolean>;
    createTempDir: (prefix: string) => Promise<string>;
    cleanupTempDir: (dir: string) => Promise<void>;
  };
}

globalThis.testUtils = {
  async waitForServer(port: number, timeout = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) return true;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return false;
  },
  
  async createTempDir(prefix: string): Promise<string> {
    const tmpDir = path.join('/tmp', `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    return tmpDir;
  },
  
  async cleanupTempDir(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp dir ${dir}:`, error);
    }
  }
};