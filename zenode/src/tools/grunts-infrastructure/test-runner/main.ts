/**
 * Main Test Runner - Entry point for Grunts validation system
 */
import { TestOrchestrator } from './test-orchestrator.js';
import { logger } from '../../../src/utils/logger.js';
import { promises as fs } from 'fs';

export async function executeGruntsValidation(workerIds: string[]): Promise<Map<string, any>> {
  const orchestrator = new TestOrchestrator();
  
  try {
    logger.info('🚀 Initializing Grunts test validation system');
    console.log(`📋 Starting comprehensive validation for ${workerIds.length} LLM implementations`);
    
    await orchestrator.initialize();
    
    logger.info(`📋 Testing ${workerIds.length} LLM implementations`);
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
    
    console.log('\n🏆 RESULTS SUMMARY:');
    console.log('==================');
    
    sorted.forEach((result, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
      console.log(`${medal} #${rank} Worker ${result.workerId}: ${result.scores.overall}/100`);
      console.log(`     Quality: ${result.scores.codeQuality} | Performance: ${result.scores.performance} | Browser: ${result.scores.browser} | API: ${result.scores.api}`);
    });
    
    console.log('\n📊 Detailed results saved to /tmp/grunts-comparative-analysis.json');
    
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
  let workerIds: string[] = [];
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

// Export for use in grunts tool
export { TestOrchestrator };

// Run as CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}