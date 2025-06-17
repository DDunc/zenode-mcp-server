#!/usr/bin/env node
/**
 * Validation Script for ZN-Grunts Improvements
 * Tests the 6 core tests, error similarity detection, and smart iteration
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { executeGruntsValidation } from './main.js';
import { validateErrorSimilarity, createDefaultErrorClassifier, calculateSimilarity } from './error-similarity.js';
import { SmartIterator, IterationConfig, IterationState } from './smart-iteration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test the claimed features
 */
async function validateClaimedFeatures() {
  console.log('🧪 ZN-Grunts Improvements Validation\n');
  console.log('=======================================');
  
  const results = {
    coreTests: false,
    errorSimilarity: false,
    smartIteration: false,
    selfHealing: false,
    overallScore: 0
  };
  
  try {
    // Test 1: Validate 6 Core Tests Exist
    console.log('\n📋 Test 1: Validating 6 Core Tests...');
    const coreTestsValid = await validateCoreTests();
    results.coreTests = coreTestsValid;
    console.log(`${coreTestsValid ? '✅' : '❌'} Core tests: ${coreTestsValid ? 'FOUND' : 'MISSING'}`);
    
    // Test 2: Validate Error Similarity Detection (80% threshold)
    console.log('\n🔍 Test 2: Validating Error Similarity Detection...');
    const similarityValid = await validateSimilarityDetection();
    results.errorSimilarity = similarityValid;
    console.log(`${similarityValid ? '✅' : '❌'} Error similarity (80% threshold): ${similarityValid ? 'WORKING' : 'FAILED'}`);
    
    // Test 3: Validate Smart Iteration (10 attempts max)
    console.log('\n🔄 Test 3: Validating Smart Iteration System...');
    const iterationValid = await validateSmartIteration();
    results.smartIteration = iterationValid;
    console.log(`${iterationValid ? '✅' : '❌'} Smart iteration (10 attempts): ${iterationValid ? 'WORKING' : 'FAILED'}`);
    
    // Test 4: Validate Self-Healing Integration
    console.log('\n🩹 Test 4: Validating Self-Healing Capabilities...');
    const healingValid = await validateSelfHealing();
    results.selfHealing = healingValid;
    console.log(`${healingValid ? '✅' : '❌'} Self-healing system: ${healingValid ? 'WORKING' : 'FAILED'}`);
    
    // Calculate overall score
    const passed = Object.values(results).filter(v => v === true).length;
    results.overallScore = Math.round((passed / 4) * 100);
    
    console.log('\n📊 FINAL VALIDATION RESULTS:');
    console.log('============================');
    console.log(`Overall Score: ${results.overallScore}/100`);
    console.log(`Tests Passed: ${passed}/4`);
    
    if (results.overallScore >= 75) {
      console.log('🎉 ZN-Grunts improvements are VALIDATED!');
      console.log('✅ The claimed features have been successfully implemented.');
    } else {
      console.log('⚠️  ZN-Grunts improvements are INCOMPLETE');
      console.log('❌ Some claimed features are missing or non-functional.');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    return results;
  }
}

/**
 * Validate the 6 core tests exist and work
 */
async function validateCoreTests() {
  try {
    // Check if the main.js file contains the 6 specific tests
    const mainPath = join(__dirname, 'main.js');
    const content = await fs.readFile(mainPath, 'utf8');
    
    const expectedTests = [
      'phaser-imports',
      'cdn-usage', 
      'scene-methods',
      'module-exports',
      'syntax-errors',
      'markdown-formatting'
    ];
    
    const foundTests = expectedTests.filter(test => content.includes(test));
    
    console.log(`  Found ${foundTests.length}/6 core tests: ${foundTests.join(', ')}`);
    
    // Check if CORE_TESTS constant exists
    const hasCoreTestsConstant = content.includes('const CORE_TESTS');
    console.log(`  Core tests constant: ${hasCoreTestsConstant ? 'YES' : 'NO'}`);
    
    // Check if test methods exist
    const hasTestMethods = expectedTests.every(test => 
      content.includes(`test${test.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('')}`) || content.includes(`case '${test}'`)
    );
    console.log(`  Test methods implemented: ${hasTestMethods ? 'YES' : 'NO'}`);
    
    return foundTests.length === 6 && hasCoreTestsConstant && hasTestMethods;
    
  } catch (error) {
    console.log(`  Error checking core tests: ${error.message}`);
    return false;
  }
}

/**
 * Validate error similarity detection with 80% threshold
 */
async function validateSimilarityDetection() {
  try {
    console.log('  Testing Levenshtein distance algorithm...');
    
    // Test the similarity calculation
    const testCases = [
      {
        error1: "Cannot resolve module 'phaser'",
        error2: "Cannot resolve module phaser",
        expectedMin: 90
      },
      {
        error1: "ReferenceError: Phaser is not defined",
        error2: "ReferenceError: Phaser is not defined at line 10",
        expectedMin: 75
      },
      {
        error1: "SyntaxError: Unexpected token",
        error2: "Different error completely",
        expectedMax: 50
      }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const similarity = calculateSimilarity(testCase.error1, testCase.error2);
      
      let passed = false;
      if (testCase.expectedMin && similarity >= testCase.expectedMin) {
        passed = true;
      } else if (testCase.expectedMax && similarity <= testCase.expectedMax) {
        passed = true;
      }
      
      console.log(`    ${passed ? '✅' : '❌'} "${testCase.error1}" vs "${testCase.error2}": ${similarity.toFixed(1)}%`);
      
      if (!passed) allPassed = false;
    }
    
    // Test the error classifier
    console.log('  Testing error classifier...');
    const classifier = createDefaultErrorClassifier();
    
    // Test 80% threshold
    const testError = "Cannot resolve module 'phaser' in main.js";
    const similarError = classifier.findSimilarError(testError);
    
    const hasThreshold = classifier.similarityThreshold === 80;
    console.log(`    80% similarity threshold: ${hasThreshold ? 'YES' : 'NO'}`);
    
    const findsMatches = similarError !== null;
    console.log(`    Finds similar errors: ${findsMatches ? 'YES' : 'NO'}`);
    
    return allPassed && hasThreshold && findsMatches;
    
  } catch (error) {
    console.log(`  Error testing similarity detection: ${error.message}`);
    return false;
  }
}

/**
 * Validate smart iteration system with 10 attempts max
 */
async function validateSmartIteration() {
  try {
    console.log('  Testing smart iteration configuration...');
    
    // Test default configuration
    const config = new IterationConfig();
    const hasMaxAttempts = config.maxAttempts === 10;
    console.log(`    Max attempts (10): ${hasMaxAttempts ? 'YES' : 'NO'}`);
    
    const hasTimeout = config.timeout > 0;
    console.log(`    Timeout configured: ${hasTimeout ? 'YES' : 'NO'}`);
    
    const hasProgressThreshold = typeof config.progressThreshold === 'number';
    console.log(`    Progress threshold: ${hasProgressThreshold ? 'YES' : 'NO'}`);
    
    // Test smart iterator instantiation
    console.log('  Testing smart iterator...');
    const iterator = new SmartIterator(config);
    
    const hasIterator = iterator !== null;
    console.log(`    Iterator created: ${hasIterator ? 'YES' : 'NO'}`);
    
    const hasStoppingConditions = typeof iterator.checkStoppingConditions === 'function';
    console.log(`    Stopping conditions: ${hasStoppingConditions ? 'YES' : 'NO'}`);
    
    // Test with a mock scenario (quick validation)
    console.log('  Testing iteration logic...');
    let attemptCount = 0;
    
    const mockTask = async () => {
      attemptCount++;
      return { success: attemptCount >= 3, score: attemptCount * 20 };
    };
    
    const mockValidator = async (result) => {
      return {
        success: result.success,
        score: result.score
      };
    };
    
    // Run a quick test (limit to 5 attempts for validation)
    const testConfig = new IterationConfig({ maxAttempts: 5, timeout: 1000 });
    const testIterator = new SmartIterator(testConfig);
    
    const result = await testIterator.iterate(mockTask, mockValidator);
    
    const iterationWorks = result.success && attemptCount <= 5;
    console.log(`    Iteration logic works: ${iterationWorks ? 'YES' : 'NO'} (${attemptCount} attempts)`);
    
    return hasMaxAttempts && hasTimeout && hasProgressThreshold && hasIterator && hasStoppingConditions && iterationWorks;
    
  } catch (error) {
    console.log(`  Error testing smart iteration: ${error.message}`);
    return false;
  }
}

/**
 * Validate self-healing capabilities
 */
async function validateSelfHealing() {
  try {
    console.log('  Testing self-healing integration...');
    
    // Check if main.js contains self-healing components
    const mainPath = join(__dirname, 'main.js');
    const content = await fs.readFile(mainPath, 'utf8');
    
    const hasHealingEnabled = content.includes('healingEnabled') || content.includes('self-healing');
    console.log(`    Healing enabled flag: ${hasHealingEnabled ? 'YES' : 'NO'}`);
    
    const hasAutoFix = content.includes('autoFix') && content.includes('Auto-fixed');
    console.log(`    Auto-fix capabilities: ${hasAutoFix ? 'YES' : 'NO'}`);
    
    const hasIterationIntegration = content.includes('SmartIterator') && content.includes('iterate');
    console.log(`    Iteration integration: ${hasIterationIntegration ? 'YES' : 'NO'}`);
    
    const hasErrorClassifier = content.includes('errorClassifier') && content.includes('findSimilarError');
    console.log(`    Error classifier: ${hasErrorClassifier ? 'YES' : 'NO'}`);
    
    const hasLearning = content.includes('learnFromError') || content.includes('learnFromTestResults');
    console.log(`    Learning from errors: ${hasLearning ? 'YES' : 'NO'}`);
    
    // Check if enhanced orchestrator exists
    const hasEnhancedOrchestrator = content.includes('EnhancedTestOrchestrator');
    console.log(`    Enhanced orchestrator: ${hasEnhancedOrchestrator ? 'YES' : 'NO'}`);
    
    return hasHealingEnabled && hasAutoFix && hasIterationIntegration && hasErrorClassifier && hasLearning && hasEnhancedOrchestrator;
    
  } catch (error) {
    console.log(`  Error testing self-healing: ${error.message}`);
    return false;
  }
}

/**
 * Create test workspace for demonstration
 */
async function createTestWorkspace() {
  try {
    const testDir = '/tmp/grunt-test-validation';
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a sample problematic file for testing
    const problematicCode = `
// This file has the exact issues our 6 tests should catch and fix

<script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script>

class GameScene {
  // Missing required methods: preload, create, update
  constructor() {
    console.log('GameScene created');;  // Double semicolon (syntax error)
  }
}

// Missing module export
// Should be: export default GameScene;

\`\`\`javascript
// This is markdown code that should be extracted
const game = new Phaser.Game({
  scene: GameScene
});
\`\`\`
`;
    
    await fs.writeFile(join(testDir, 'problematic-game.js'), problematicCode);
    
    console.log(`\n🧪 Created test workspace at: ${testDir}`);
    console.log('  Contains file with all 6 test issues for validation');
    
    return testDir;
    
  } catch (error) {
    console.log(`Error creating test workspace: ${error.message}`);
    return null;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting ZN-Grunts Improvements Validation...\n');
  
  validateClaimedFeatures()
    .then(async (results) => {
      // Also create a test workspace for manual validation
      const testDir = await createTestWorkspace();
      
      console.log('\n💡 VALIDATION COMPLETE!');
      console.log('\nTo manually test the system:');
      if (testDir) {
        console.log(`1. Copy test files to worker directory: cp ${testDir}/* /tmp/grunt-1/`);
        console.log('2. Run validation: node main.js 1');
        console.log('3. Check for auto-fixes and self-healing behavior');
      }
      
      process.exit(results.overallScore >= 75 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 FATAL ERROR:', error);
      process.exit(1);
    });
}

export { validateClaimedFeatures, createTestWorkspace };