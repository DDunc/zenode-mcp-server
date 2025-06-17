/**
 * Smart Iteration System
 * Implements intelligent stopping logic with up to 10 attempts
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createDefaultErrorClassifier } from './error-similarity.js';

/**
 * Smart iteration result states
 */
export const IterationState = {
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  MAX_ATTEMPTS: 'max_attempts',
  CRITICAL_ERROR: 'critical_error',
  NO_PROGRESS: 'no_progress'
};

/**
 * Smart iteration configuration
 */
export class IterationConfig {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 10;
    this.timeout = options.timeout || 300000; // 5 minutes per attempt
    this.progressThreshold = options.progressThreshold || 0.1; // 10% improvement required
    this.criticalErrorThreshold = options.criticalErrorThreshold || 3;
    this.backoffMultiplier = options.backoffMultiplier || 1.5;
    this.initialDelay = options.initialDelay || 1000; // 1 second
  }
}

/**
 * Attempt result tracking
 */
export class AttemptResult {
  constructor(attempt, success = false) {
    this.attempt = attempt;
    this.success = success;
    this.timestamp = Date.now();
    this.errors = [];
    this.warnings = [];
    this.fixes = [];
    this.score = 0;
    this.improvement = 0;
    this.duration = 0;
    this.state = IterationState.FAILED;
  }

  addError(error, severity = 'medium') {
    this.errors.push({
      message: error,
      severity,
      timestamp: Date.now()
    });
  }

  addFix(fix, confidence = 0.5) {
    this.fixes.push({
      description: fix,
      confidence,
      timestamp: Date.now()
    });
  }

  calculateImprovement(previousScore) {
    if (previousScore === 0) return this.score;
    this.improvement = this.score - previousScore;
    return this.improvement;
  }
}

/**
 * Smart iteration orchestrator
 */
export class SmartIterator {
  constructor(config = new IterationConfig()) {
    this.config = config;
    this.attempts = [];
    this.errorClassifier = createDefaultErrorClassifier();
    this.startTime = null;
    this.lastSuccessfulScore = 0;
    this.progressStalls = 0;
    this.criticalErrors = 0;
  }

  /**
   * Execute smart iteration process
   */
  async iterate(taskFunction, validator, context = {}) {
    this.startTime = Date.now();
    console.log(`🔄 Starting smart iteration (max ${this.config.maxAttempts} attempts)`);

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const result = await this.executeAttempt(attempt, taskFunction, validator, context);
      this.attempts.push(result);

      // Check stopping conditions
      const stopCondition = this.checkStoppingConditions(result);
      if (stopCondition !== null) {
        console.log(`🛑 Stopping iteration: ${stopCondition}`);
        return this.createFinalResult(stopCondition);
      }

      // Calculate delay for next attempt
      if (attempt < this.config.maxAttempts) {
        const delay = this.calculateBackoffDelay(attempt);
        console.log(`⏳ Waiting ${Math.round(delay / 1000)}s before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return this.createFinalResult(IterationState.MAX_ATTEMPTS);
  }

  /**
   * Execute a single attempt
   */
  async executeAttempt(attempt, taskFunction, validator, context) {
    const attemptStartTime = Date.now();
    const result = new AttemptResult(attempt);

    console.log(`\n🚀 Attempt ${attempt}/${this.config.maxAttempts}`);

    try {
      // Apply fixes from previous attempts
      if (attempt > 1) {
        await this.applyPreviousFixes(context);
      }

      // Execute the task with timeout
      const taskPromise = this.executeWithTimeout(
        () => taskFunction(context, this.getContextFromPreviousAttempts()),
        this.config.timeout
      );

      const taskResult = await taskPromise;

      // Validate the result
      const validationResult = await validator(taskResult, context);
      
      result.score = validationResult.score || 0;
      result.success = validationResult.success || false;
      result.state = result.success ? IterationState.SUCCESS : IterationState.FAILED;

      // Analyze errors and generate fixes
      if (validationResult.errors && validationResult.errors.length > 0) {
        for (const error of validationResult.errors) {
          result.addError(error.message, error.severity);
          
          // Look for similar errors and suggest fixes
          const similarError = this.errorClassifier.findSimilarError(error.message);
          if (similarError) {
            result.addFix(
              `Similar error detected (${similarError.similarity.toFixed(1)}% match): ${similarError.error.solution}`,
              similarError.similarity / 100
            );
          } else {
            // Generate generic fix based on error type
            const genericFix = this.generateGenericFix(error.message);
            if (genericFix) {
              result.addFix(genericFix, 0.3);
            }
          }
        }
      }

      // Calculate improvement
      const previousScore = attempt > 1 ? this.attempts[attempt - 2].score : 0;
      result.calculateImprovement(previousScore);

      // Update progress tracking
      this.updateProgressTracking(result);

      console.log(`📊 Attempt ${attempt} result: ${result.success ? '✅' : '❌'} Score: ${result.score} (${result.improvement >= 0 ? '+' : ''}${result.improvement})`);

    } catch (error) {
      result.addError(`Execution failed: ${error.message}`, 'critical');
      result.state = IterationState.CRITICAL_ERROR;
      this.criticalErrors++;
      
      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
    }

    result.duration = Date.now() - attemptStartTime;
    return result;
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Check stopping conditions
   */
  checkStoppingConditions(result) {
    // Success condition
    if (result.success && result.score >= 80) {
      return IterationState.SUCCESS;
    }

    // Critical error threshold
    if (this.criticalErrors >= this.config.criticalErrorThreshold) {
      return IterationState.CRITICAL_ERROR;
    }

    // No progress condition (3 consecutive attempts without improvement)
    if (this.progressStalls >= 3) {
      return IterationState.NO_PROGRESS;
    }

    // Overall timeout
    const totalTime = Date.now() - this.startTime;
    if (totalTime >= (this.config.timeout * this.config.maxAttempts)) {
      return IterationState.TIMEOUT;
    }

    return null; // Continue iterating
  }

  /**
   * Update progress tracking
   */
  updateProgressTracking(result) {
    if (result.improvement >= this.config.progressThreshold) {
      this.progressStalls = 0;
      this.lastSuccessfulScore = result.score;
    } else {
      this.progressStalls++;
    }

    // Learn from this attempt
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        const bestFix = result.fixes
          .filter(fix => fix.confidence > 0.5)
          .sort((a, b) => b.confidence - a.confidence)[0];
        
        if (bestFix) {
          this.errorClassifier.learnFromError(error.message, bestFix.description);
        }
      }
    }
  }

  /**
   * Apply fixes from previous attempts
   */
  async applyPreviousFixes(context) {
    const allFixes = this.attempts
      .flatMap(attempt => attempt.fixes)
      .filter(fix => fix.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Apply top 5 most confident fixes

    console.log(`🔧 Applying ${allFixes.length} fixes from previous attempts`);

    for (const fix of allFixes) {
      try {
        await this.applyFix(fix, context);
      } catch (error) {
        console.log(`⚠️ Fix application failed: ${error.message}`);
      }
    }
  }

  /**
   * Apply a specific fix
   */
  async applyFix(fix, context) {
    // Parse fix description and apply appropriate action
    const fixText = fix.description.toLowerCase();

    if (fixText.includes('npm install')) {
      const packageMatch = fixText.match(/npm install ([^\s]+)/);
      if (packageMatch) {
        await this.runCommand(`npm install ${packageMatch[1]}`, context.workdir);
      }
    } else if (fixText.includes('add import')) {
      const importMatch = fixText.match(/import ([^']*) from ['"]([^'"]*)['"]/);
      if (importMatch && context.mainFile) {
        await this.addImportToFile(context.mainFile, importMatch[0]);
      }
    } else if (fixText.includes('add method')) {
      const methodMatch = fixText.match(/add (\w+)\(\) method/);
      if (methodMatch && context.mainFile) {
        await this.addMethodToFile(context.mainFile, methodMatch[1]);
      }
    } else if (fixText.includes('type: module')) {
      if (context.packageJsonPath) {
        await this.addModuleTypeToPackageJson(context.packageJsonPath);
      }
    }
  }

  /**
   * Generate generic fix based on error pattern
   */
  generateGenericFix(errorMessage) {
    const error = errorMessage.toLowerCase();

    if (error.includes('cannot resolve module')) {
      const moduleMatch = error.match(/cannot resolve module ['"]([^'"]*)['"]/);
      if (moduleMatch) {
        return `npm install ${moduleMatch[1]}`;
      }
    }

    if (error.includes('is not defined')) {
      const varMatch = error.match(/(\w+) is not defined/);
      if (varMatch) {
        return `Add import for ${varMatch[1]} or define the variable`;
      }
    }

    if (error.includes('unexpected token')) {
      return 'Check syntax for missing semicolons, brackets, or quotes';
    }

    if (error.includes('missing required method')) {
      const methodMatch = error.match(/missing required method[:\s]*(\w+)/);
      if (methodMatch) {
        return `Add ${methodMatch[1]}() method to class`;
      }
    }

    return null;
  }

  /**
   * Get context from previous attempts
   */
  getContextFromPreviousAttempts() {
    return {
      attemptCount: this.attempts.length,
      lastScore: this.attempts.length > 0 ? this.attempts[this.attempts.length - 1].score : 0,
      commonErrors: this.getCommonErrors(),
      bestFixes: this.getBestFixes()
    };
  }

  /**
   * Get most common errors across attempts
   */
  getCommonErrors() {
    const errorCounts = new Map();
    
    for (const attempt of this.attempts) {
      for (const error of attempt.errors) {
        const normalized = error.message.toLowerCase();
        errorCounts.set(normalized, (errorCounts.get(normalized) || 0) + 1);
      }
    }
    
    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  /**
   * Get best fixes across attempts
   */
  getBestFixes() {
    return this.attempts
      .flatMap(attempt => attempt.fixes)
      .filter(fix => fix.confidence > 0.7)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(attempt) {
    return Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
      30000 // Max 30 seconds
    );
  }

  /**
   * Create final result summary
   */
  createFinalResult(finalState) {
    const totalDuration = Date.now() - this.startTime;
    const bestAttempt = this.attempts
      .filter(a => a.success || a.score > 0)
      .sort((a, b) => b.score - a.score)[0] || this.attempts[this.attempts.length - 1];

    return {
      state: finalState,
      success: finalState === IterationState.SUCCESS,
      totalAttempts: this.attempts.length,
      totalDuration,
      bestScore: bestAttempt?.score || 0,
      finalScore: this.attempts[this.attempts.length - 1]?.score || 0,
      progressStalls: this.progressStalls,
      criticalErrors: this.criticalErrors,
      attempts: this.attempts,
      summary: this.generateSummary(finalState, bestAttempt)
    };
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(finalState, bestAttempt) {
    const messages = [];
    
    switch (finalState) {
      case IterationState.SUCCESS:
        messages.push(`✅ Success achieved after ${this.attempts.length} attempts!`);
        messages.push(`🏆 Final score: ${bestAttempt.score}/100`);
        break;
        
      case IterationState.MAX_ATTEMPTS:
        messages.push(`⏱️ Reached maximum attempts (${this.config.maxAttempts})`);
        messages.push(`📈 Best score achieved: ${bestAttempt?.score || 0}/100`);
        break;
        
      case IterationState.NO_PROGRESS:
        messages.push(`🔄 No progress detected for 3 consecutive attempts`);
        messages.push(`📊 Final score: ${bestAttempt?.score || 0}/100`);
        break;
        
      case IterationState.CRITICAL_ERROR:
        messages.push(`❌ Too many critical errors (${this.criticalErrors})`);
        messages.push(`🚨 System stability compromised`);
        break;
        
      case IterationState.TIMEOUT:
        messages.push(`⏰ Overall timeout reached`);
        messages.push(`⚡ Last score: ${bestAttempt?.score || 0}/100`);
        break;
        
      default:
        messages.push(`🏁 Iteration completed with state: ${finalState}`);
    }
    
    // Add improvement tracking
    if (this.attempts.length > 1) {
      const totalImprovement = (bestAttempt?.score || 0) - (this.attempts[0]?.score || 0);
      messages.push(`📈 Total improvement: ${totalImprovement >= 0 ? '+' : ''}${totalImprovement} points`);
    }
    
    return messages.join('\n');
  }

  /**
   * Helper: Run shell command
   */
  async runCommand(command, workdir) {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { cwd: workdir, stdio: 'pipe' });
      
      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${command}`));
        }
      });
      
      child.on('error', reject);
    });
  }

  /**
   * Helper: Add import to file
   */
  async addImportToFile(filePath, importStatement) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Find existing imports or insert at top
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ') || lines[i].startsWith('const ') || lines[i].startsWith('require(')) {
          insertIndex = i + 1;
        } else if (lines[i].trim() === '' && insertIndex > 0) {
          break;
        }
      }
      
      lines.splice(insertIndex, 0, importStatement);
      await fs.writeFile(filePath, lines.join('\n'));
    } catch (error) {
      throw new Error(`Failed to add import: ${error.message}`);
    }
  }

  /**
   * Helper: Add method to file
   */
  async addMethodToFile(filePath, methodName) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Simple method templates
      const methodTemplates = {
        preload: `  preload() {\n    // Load game assets here\n  }`,
        create: `  create() {\n    // Initialize game objects here\n  }`,
        update: `  update() {\n    // Game loop logic here\n  }`
      };
      
      if (methodTemplates[methodName]) {
        // Find class definition and add method
        const classMatch = content.match(/class\s+\w+\s*{/);
        if (classMatch) {
          const insertIndex = content.indexOf('{', classMatch.index) + 1;
          const newContent = 
            content.slice(0, insertIndex) + 
            '\n' + methodTemplates[methodName] + '\n' +
            content.slice(insertIndex);
          
          await fs.writeFile(filePath, newContent);
        }
      }
    } catch (error) {
      throw new Error(`Failed to add method: ${error.message}`);
    }
  }

  /**
   * Helper: Add module type to package.json
   */
  async addModuleTypeToPackageJson(packageJsonPath) {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      packageJson.type = 'module';
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    } catch (error) {
      throw new Error(`Failed to update package.json: ${error.message}`);
    }
  }
}

/**
 * Convenience function for simple iteration
 */
export async function smartIterate(taskFunction, validator, options = {}) {
  const config = new IterationConfig(options);
  const iterator = new SmartIterator(config);
  return await iterator.iterate(taskFunction, validator, options.context || {});
}