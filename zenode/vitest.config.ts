import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}', 'src/**/__tests__/**/*.{js,ts}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'src/tools/grunts-infrastructure/**'
    ],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/tools/grunts-infrastructure/**',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});