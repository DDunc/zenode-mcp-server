/**
 * Dynamic Error Learning System for ZN-Grunts
 * Captures real errors from worker executions and builds knowledge base
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createDefaultErrorClassifier, normalizeErrorMessage, calculateSimilarity } from './error-similarity.js';

/**
 * Error learning and knowledge base system
 */
export class ErrorLearningSystem {
  constructor(options = {}) {
    this.knowledgeBasePath = options.knowledgeBasePath || '/tmp/grunts-error-knowledge.json';
    this.executionLogPath = options.executionLogPath || '/tmp/grunts-execution-log.json';
    this.minSimilarity = options.minSimilarity || 80;
    this.maxKnowledgeEntries = options.maxKnowledgeEntries || 1000;
    
    this.knowledgeBase = new Map();
    this.executionHistory = [];
    this.errorClassifier = createDefaultErrorClassifier();
    
    this.initialized = false;
  }

  /**
   * Initialize the learning system
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Load existing knowledge base
      await this.loadKnowledgeBase();
      
      // Load execution history
      await this.loadExecutionHistory();
      
      console.log(`🧠 Error Learning System initialized`);
      console.log(`   Knowledge base: ${this.knowledgeBase.size} entries`);
      console.log(`   Execution history: ${this.executionHistory.length} records`);
      
      this.initialized = true;
    } catch (error) {
      console.warn(`⚠️ Failed to initialize error learning system: ${error.message}`);
      this.initialized = true; // Continue with empty state
    }
  }

  /**
   * Capture error from worker execution
   */
  async captureWorkerError(workerId, error, context = {}) {
    await this.initialize();
    
    const errorRecord = {
      id: this.generateErrorId(),
      workerId,
      timestamp: Date.now(),
      error: {
        message: error.message || error,
        stack: error.stack,
        type: error.constructor?.name || 'Error'
      },
      context: {
        task: context.task,
        attempt: context.attempt || 1,
        phase: context.phase || 'unknown',
        files: context.files || [],
        environment: context.environment || {}
      },
      normalized: normalizeErrorMessage(error.message || error),
      resolved: false,
      solution: null,
      similarity: null
    };
    
    // Check for similar errors in knowledge base
    const similarError = await this.findSimilarError(errorRecord.normalized);
    if (similarError) {
      errorRecord.similarity = {
        matchId: similarError.id,
        score: similarError.similarity,
        suggestedSolution: similarError.solution
      };
      
      console.log(`🔍 Found similar error (${similarError.similarity.toFixed(1)}%): ${similarError.solution?.description || 'No solution'}`);
    }
    
    this.executionHistory.push(errorRecord);
    
    // Save to persistent storage
    await this.saveExecutionHistory();
    
    return errorRecord;
  }

  /**
   * Record successful error resolution
   */
  async recordSuccessfulFix(errorId, solution, workerId) {
    await this.initialize();
    
    const errorRecord = this.executionHistory.find(record => record.id === errorId);
    if (!errorRecord) {
      console.warn(`⚠️ Error record ${errorId} not found`);
      return;
    }
    
    // Update the error record
    errorRecord.resolved = true;
    errorRecord.solution = {
      description: solution.description,
      type: solution.type || 'auto-fix',
      code: solution.code,
      confidence: solution.confidence || 0.8,
      appliedAt: Date.now(),
      workerId,
      attempts: solution.attempts || 1
    };
    
    // Add to knowledge base
    const knowledgeEntry = {
      id: this.generateKnowledgeId(),
      normalizedError: errorRecord.normalized,
      originalError: errorRecord.error.message,
      solution: errorRecord.solution,
      occurrences: 1,
      successRate: 1.0,
      lastSeen: Date.now(),
      category: this.categorizeError(errorRecord.error.message),
      contexts: [errorRecord.context]
    };
    
    // Check if we already have a similar entry
    const existingEntry = await this.findExistingKnowledgeEntry(errorRecord.normalized);
    if (existingEntry) {
      // Update existing entry
      existingEntry.occurrences++;
      existingEntry.lastSeen = Date.now();
      existingEntry.contexts.push(errorRecord.context);
      
      // Update success rate if this solution is better
      if (solution.confidence > existingEntry.solution.confidence) {
        existingEntry.solution = errorRecord.solution;
      }
      
      console.log(`📚 Updated knowledge entry: ${existingEntry.id} (${existingEntry.occurrences} occurrences)`);
    } else {
      // Add new entry
      this.knowledgeBase.set(knowledgeEntry.id, knowledgeEntry);
      console.log(`📚 Added new knowledge entry: ${knowledgeEntry.id}`);
    }
    
    // Update error classifier
    this.errorClassifier.learnFromError(errorRecord.error.message, solution.description);
    
    // Save updates
    await this.saveKnowledgeBase();
    await this.saveExecutionHistory();
    
    return knowledgeEntry;
  }

  /**
   * Find similar error in knowledge base
   */
  async findSimilarError(normalizedError) {
    await this.initialize();
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [id, entry] of this.knowledgeBase) {
      const similarity = calculateSimilarity(normalizedError, entry.normalizedError);
      
      if (similarity >= this.minSimilarity && similarity > bestSimilarity) {
        bestMatch = {
          id,
          entry,
          similarity,
          solution: entry.solution
        };
        bestSimilarity = similarity;
      }
    }
    
    return bestMatch;
  }

  /**
   * Get suggested fix for new error
   */
  async getSuggestedFix(error, context = {}) {
    await this.initialize();
    
    const normalized = normalizeErrorMessage(error);
    const similarError = await this.findSimilarError(normalized);
    
    if (similarError) {
      const suggestion = {
        confidence: (similarError.similarity / 100) * similarError.entry.solution.confidence,
        description: similarError.entry.solution.description,
        type: similarError.entry.solution.type,
        code: similarError.entry.solution.code,
        source: 'learned',
        matchSimilarity: similarError.similarity,
        occurrences: similarError.entry.occurrences,
        successRate: similarError.entry.successRate
      };
      
      console.log(`💡 Suggested fix (${suggestion.confidence.toFixed(2)} confidence): ${suggestion.description}`);
      return suggestion;
    }
    
    // Fallback to pre-populated classifier
    const classifierMatch = this.errorClassifier.findSimilarError(error);
    if (classifierMatch) {
      return {
        confidence: classifierMatch.similarity / 100,
        description: classifierMatch.error.solution,
        type: 'pre-populated',
        source: 'classifier',
        matchSimilarity: classifierMatch.similarity
      };
    }
    
    return null;
  }

  /**
   * Analyze error patterns and trends
   */
  async analyzeErrorPatterns() {
    await this.initialize();
    
    const analysis = {
      totalErrors: this.executionHistory.length,
      resolvedErrors: this.executionHistory.filter(e => e.resolved).length,
      knowledgeEntries: this.knowledgeBase.size,
      categories: {},
      topErrors: [],
      learningRate: 0,
      avgResolutionTime: 0
    };
    
    // Calculate resolution rate
    analysis.resolutionRate = analysis.totalErrors > 0 ? 
      (analysis.resolvedErrors / analysis.totalErrors) * 100 : 0;
    
    // Categorize errors
    for (const record of this.executionHistory) {
      const category = this.categorizeError(record.error.message);
      analysis.categories[category] = (analysis.categories[category] || 0) + 1;
    }
    
    // Top errors by frequency
    const errorCounts = new Map();
    for (const [id, entry] of this.knowledgeBase) {
      errorCounts.set(entry.normalizedError, entry.occurrences);
    }
    
    analysis.topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error: error.substring(0, 80), count }));
    
    // Learning rate (new entries per execution)
    const recentExecutions = this.executionHistory.filter(e => 
      Date.now() - e.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );
    analysis.learningRate = recentExecutions.length > 0 ? 
      analysis.knowledgeEntries / recentExecutions.length : 0;
    
    return analysis;
  }

  /**
   * Export knowledge base for sharing
   */
  async exportKnowledgeBase() {
    await this.initialize();
    
    const exportData = {
      metadata: {
        exportedAt: Date.now(),
        version: '1.0',
        entries: this.knowledgeBase.size,
        generator: 'zn-grunts-error-learning'
      },
      knowledgeBase: Array.from(this.knowledgeBase.entries()).map(([id, entry]) => ({
        id,
        ...entry
      })),
      statistics: await this.analyzeErrorPatterns()
    };
    
    return exportData;
  }

  /**
   * Import knowledge base from another system
   */
  async importKnowledgeBase(exportData) {
    await this.initialize();
    
    if (!exportData.knowledgeBase) {
      throw new Error('Invalid export data format');
    }
    
    let importedCount = 0;
    
    for (const entry of exportData.knowledgeBase) {
      const existing = await this.findExistingKnowledgeEntry(entry.normalizedError);
      
      if (!existing) {
        this.knowledgeBase.set(entry.id, {
          id: entry.id,
          normalizedError: entry.normalizedError,
          originalError: entry.originalError,
          solution: entry.solution,
          occurrences: entry.occurrences,
          successRate: entry.successRate,
          lastSeen: entry.lastSeen,
          category: entry.category,
          contexts: entry.contexts || []
        });
        importedCount++;
      }
    }
    
    await this.saveKnowledgeBase();
    
    console.log(`📦 Imported ${importedCount} knowledge entries`);
    return importedCount;
  }

  /**
   * Helper: Categorize error type
   */
  categorizeError(errorMessage) {
    const error = errorMessage.toLowerCase();
    
    if (error.includes('cannot resolve') || error.includes('module not found')) {
      return 'dependency';
    } else if (error.includes('syntax') || error.includes('unexpected token')) {
      return 'syntax';
    } else if (error.includes('phaser')) {
      return 'phaser';
    } else if (error.includes('import') || error.includes('export')) {
      return 'module';
    } else if (error.includes('undefined') || error.includes('not defined')) {
      return 'reference';
    } else if (error.includes('cdn') || error.includes('script')) {
      return 'cdn';
    } else {
      return 'other';
    }
  }

  /**
   * Helper: Find existing knowledge entry
   */
  async findExistingKnowledgeEntry(normalizedError) {
    for (const [id, entry] of this.knowledgeBase) {
      const similarity = calculateSimilarity(normalizedError, entry.normalizedError);
      if (similarity >= 95) { // Very high similarity threshold for duplicates
        return entry;
      }
    }
    return null;
  }

  /**
   * Helper: Generate unique error ID
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Generate unique knowledge ID
   */
  generateKnowledgeId() {
    return `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load knowledge base from storage
   */
  async loadKnowledgeBase() {
    try {
      const data = await fs.readFile(this.knowledgeBasePath, 'utf8');
      const parsed = JSON.parse(data);
      
      if (parsed.knowledgeBase) {
        this.knowledgeBase = new Map(parsed.knowledgeBase);
      }
    } catch (error) {
      // File doesn't exist or is invalid - start with empty base
      this.knowledgeBase = new Map();
    }
  }

  /**
   * Save knowledge base to storage
   */
  async saveKnowledgeBase() {
    try {
      const data = {
        version: '1.0',
        lastUpdated: Date.now(),
        knowledgeBase: Array.from(this.knowledgeBase.entries())
      };
      
      await fs.writeFile(this.knowledgeBasePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn(`⚠️ Failed to save knowledge base: ${error.message}`);
    }
  }

  /**
   * Load execution history from storage
   */
  async loadExecutionHistory() {
    try {
      const data = await fs.readFile(this.executionLogPath, 'utf8');
      const parsed = JSON.parse(data);
      
      if (Array.isArray(parsed.history)) {
        this.executionHistory = parsed.history;
      }
    } catch (error) {
      // File doesn't exist or is invalid - start with empty history
      this.executionHistory = [];
    }
  }

  /**
   * Save execution history to storage
   */
  async saveExecutionHistory() {
    try {
      // Keep only last 1000 entries to prevent unlimited growth
      const recentHistory = this.executionHistory.slice(-1000);
      
      const data = {
        version: '1.0',
        lastUpdated: Date.now(),
        history: recentHistory
      };
      
      await fs.writeFile(this.executionLogPath, JSON.stringify(data, null, 2));
      this.executionHistory = recentHistory;
    } catch (error) {
      console.warn(`⚠️ Failed to save execution history: ${error.message}`);
    }
  }

  /**
   * Clean up old entries
   */
  async cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    await this.initialize();
    
    const cutoff = Date.now() - maxAge;
    let cleanedCount = 0;
    
    // Clean knowledge base
    for (const [id, entry] of this.knowledgeBase) {
      if (entry.lastSeen < cutoff && entry.occurrences < 2) {
        this.knowledgeBase.delete(id);
        cleanedCount++;
      }
    }
    
    // Clean execution history
    const originalLength = this.executionHistory.length;
    this.executionHistory = this.executionHistory.filter(record => 
      record.timestamp > cutoff
    );
    cleanedCount += originalLength - this.executionHistory.length;
    
    if (cleanedCount > 0) {
      await this.saveKnowledgeBase();
      await this.saveExecutionHistory();
      console.log(`🧹 Cleaned up ${cleanedCount} old entries`);
    }
    
    return cleanedCount;
  }
}

/**
 * Global instance for sharing across the system
 */
export const globalErrorLearning = new ErrorLearningSystem();

/**
 * Integration helper for existing test runner
 */
export async function integrateWithTestRunner(testRunner) {
  // Initialize the learning system
  await globalErrorLearning.initialize();
  
  // Wrap the error handling in the test runner
  const originalRunSingleCoreTest = testRunner.runSingleCoreTest;
  
  testRunner.runSingleCoreTest = async function(test, workspacePath, context = {}) {
    const result = await originalRunSingleCoreTest.call(this, test, workspacePath, context);
    
    // Capture errors for learning
    if (result.errors && result.errors.length > 0) {
      for (const error of result.errors) {
        const errorRecord = await globalErrorLearning.captureWorkerError(
          context.workerId || 'unknown',
          { message: error },
          {
            task: test.id,
            phase: 'core-test',
            files: [workspacePath]
          }
        );
        
        // If we applied fixes, record them as successful solutions
        if (result.fixes && result.fixes.length > 0) {
          const bestFix = result.fixes[0]; // Use first fix as primary solution
          await globalErrorLearning.recordSuccessfulFix(
            errorRecord.id,
            {
              description: bestFix,
              type: 'auto-fix',
              confidence: 0.8
            },
            context.workerId || 'unknown'
          );
        }
      }
    }
    
    return result;
  };
  
  return globalErrorLearning;
}