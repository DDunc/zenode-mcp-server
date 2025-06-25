#!/usr/bin/env node

// Smoke test for auto-directory traversal functionality
// Tests the new file discovery utilities in the deployed Docker container

console.log('🧪 Running smoke tests for auto-directory traversal...\n');

async function testFileDiscovery() {
  try {
    console.log('1. Testing basic file discovery import...');
    const { resolveFilePaths, getProjectRoot } = await import('./dist/utils/file-discovery.js');
    console.log('✅ File discovery module imported successfully\n');

    console.log('2. Testing project root detection...');
    const projectRoot = await getProjectRoot();
    console.log(`✅ Project root detected: ${projectRoot}\n`);

    console.log('3. Testing auto-discovery (no files provided)...');
    const autoResult = await resolveFilePaths(undefined, 'analyze');
    console.log(`✅ Auto-discovery result:
   - Files found: ${autoResult.files.length}
   - Summary: ${autoResult.summary}
   - Used default path: ${autoResult.usedDefaultPath}\n`);

    console.log('4. Testing directory traversal...');
    const dirResult = await resolveFilePaths(['/app/src/utils'], 'analyze');
    console.log(`✅ Directory traversal result:
   - Files found: ${dirResult.files.length}
   - Summary: ${dirResult.summary}
   - Used default path: ${dirResult.usedDefaultPath}\n`);

    console.log('5. Testing tool-specific configuration...');
    const codeReviewResult = await resolveFilePaths(['/app/src/tools'], 'codereview');
    console.log(`✅ Code review configuration result:
   - Files found: ${codeReviewResult.files.length}
   - Summary: ${codeReviewResult.summary}\n`);

    console.log('🎉 All smoke tests PASSED! Auto-directory traversal is working correctly.');
    return true;

  } catch (error) {
    console.error('❌ Smoke test FAILED:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testFileDiscovery().then(success => {
  process.exit(success ? 0 : 1);
});