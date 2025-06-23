/**
 * Vitest Setup File
 * 
 * Philosophy: Test against real services, not mocks.
 * We want to ensure our provider list stays current with what's actually available.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: '.env.test' });
// Fall back to regular .env if .env.test doesn't exist
dotenv.config();

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || 'warn';

// Global test configuration
beforeAll(() => {
  console.log('🧪 Starting Vitest Test Suite');
  console.log('📡 Testing against REAL providers (not mocks)');
  
  // Check which providers are configured
  const providers = {
    OpenAI: !!process.env.OPENAI_API_KEY,
    OpenRouter: !!process.env.OPENROUTER_API_KEY,
    Gemini: !!process.env.GEMINI_API_KEY,
    Custom: !!process.env.CUSTOM_API_URL,
  };
  
  console.log('🔌 Available Providers:', 
    Object.entries(providers)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name)
      .join(', ') || 'None'
  );
  
  // Warn if no providers are configured
  if (!Object.values(providers).some(v => v)) {
    console.warn('⚠️  No API providers configured! Tests requiring models will fail.');
    console.warn('💡 Set at least one of: OPENAI_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY');
  }
});

beforeEach(() => {
  // Clear any module caches to ensure fresh state
  vi.clearAllTimers();
});

afterAll(() => {
  console.log('✅ Test suite completed');
});

// Extend test timeout for integration tests that hit real APIs
if (process.env.TEST_TYPE === 'integration' || process.env.TEST_REAL_PROVIDERS === 'true') {
  console.log('⏱️  Extended timeout enabled for integration tests');
}

// Helper to check if we're in "real provider" mode
export const isRealProviderMode = (): boolean => {
  return process.env.TEST_REAL_PROVIDERS === 'true' || 
         process.env.NODE_ENV === 'test-integration';
};

// Helper to skip tests if no providers are available
export const skipIfNoProviders = () => {
  const hasProvider = !!(
    process.env.OPENAI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.CUSTOM_API_URL
  );
  
  if (!hasProvider) {
    console.warn('⏭️  Skipping test - no providers configured');
    return true;
  }
  return false;
};