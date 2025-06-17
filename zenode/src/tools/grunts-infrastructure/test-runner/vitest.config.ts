/**
 * Vitest Configuration for Grunts Test Validation
 */
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
      exclude: ['node_modules/', 'test/', 'dist/', '**/*.d.ts']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test')
    }
  }
});