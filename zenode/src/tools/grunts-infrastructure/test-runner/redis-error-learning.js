/**
 * Redis-Based Error Learning System for ZN-Grunts
 * Hybrid approach: Redis for session data + files for persistence
 * Addresses concurrency, performance, and scalability issues
 */

import { createClient } from 'redis';
import { promises as fs } from 'fs';
import { join } from 'path';
import { calculateSimilarity, normalizeErrorMessage } from './error-similarity.js';

/**
 * Redis-based error learning system with hybrid persistence
 */
export class RedisErrorLearningSystem {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl || 'redis://localhost:6379';
    this.sessionTTL = options.sessionTTL || 14400; // 4 hours in seconds
    this.keyPrefix = options.keyPrefix || 'grunts:errors';
    this.persistenceFile = options.persistenceFile || '/tmp/grunts-persistent-knowledge.json';
    this.minSimilarity = options.minSimilarity || 80;
    this.maxSessionErrors = options.maxSessionErrors || 1000;
    
    this.redisClient = null;
    this.sessionId = null;
    this.initialized = false;
  }

  /**
   * Initialize Redis connection and session
   */
  async initialize(sessionId = null) {
    if (this.initialized && this.sessionId === sessionId) return;
    
    try {
      // Create Redis client
      this.redisClient = createClient({ url: this.redisUrl });
      this.redisClient.on('error', (err) => console.error('Redis Client Error:', err));
      await this.redisClient.connect();
      
      // Set session ID
      this.sessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Load persistent knowledge into Redis for this session
      await this.loadPersistentKnowledge();
      
      console.log(`🔴 Redis Error Learning initialized - Session: ${this.sessionId}`);
      console.log(`   TTL: ${this.sessionTTL}s, Similarity: ${this.minSimilarity}%`);
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Redis Error Learning:', error.message);
      throw error;
    }
  }

  /**
   * Capture error from worker execution (fast Redis operation)
   */
  async captureWorkerError(workerId, error, context = {}) {
    await this.initialize();
    
    const errorId = this.generateErrorId();
    const timestamp = Date.now();
    const normalized = normalizeErrorMessage(error.message || error);
    
    const errorRecord = {
      id: errorId,
      workerId,
      timestamp,
      error: {
        message: error.message || error,
        stack: error.stack,
        type: error.constructor?.name || 'Error'
      },
      context: {
        task: context.task,
        attempt: context.attempt || 1,
        phase: context.phase || 'unknown',
        files: context.files || []
      },
      normalized,
      resolved: false,
      solution: null
    };
    
    // Store in Redis with session TTL
    const errorKey = `${this.keyPrefix}:${this.sessionId}:errors:${errorId}`;
    await this.redisClient.setEx(errorKey, this.sessionTTL, JSON.stringify(errorRecord));
    
    // Add to session error list
    const sessionKey = `${this.keyPrefix}:${this.sessionId}:error_list`;
    await this.redisClient.lPush(sessionKey, errorId);
    await this.redisClient.expire(sessionKey, this.sessionTTL);
    
    // Add normalized error for similarity searching
    const normalizedKey = `${this.keyPrefix}:${this.sessionId}:normalized`;
    await this.redisClient.hSet(normalizedKey, errorId, normalized);
    await this.redisClient.expire(normalizedKey, this.sessionTTL);
    
    // Check for similar errors (fast Redis operation)
    const similarError = await this.findSimilarErrorFast(normalized);
    if (similarError) {
      console.log(`🔍 Found similar error (${similarError.similarity.toFixed(1)}%): ${similarError.solution?.description || 'No solution'}`);
      
      // Store similarity reference
      const similarityKey = `${this.keyPrefix}:${this.sessionId}:similarity:${errorId}`;
      await this.redisClient.setEx(similarityKey, this.sessionTTL, JSON.stringify(similarError));
    }
    
    return { errorId, similarError };
  }

  /**
   * Record successful error resolution (fast Redis operation)
   */
  async recordSuccessfulFix(errorId, solution, workerId) {
    await this.initialize();
    
    const errorKey = `${this.keyPrefix}:${this.sessionId}:errors:${errorId}`;
    const errorData = await this.redisClient.get(errorKey);
    
    if (!errorData) {
      console.warn(`⚠️ Error record ${errorId} not found in Redis`);
      return;
    }
    
    const errorRecord = JSON.parse(errorData);
    
    // Update error record with solution
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
    
    // Save updated record
    await this.redisClient.setEx(errorKey, this.sessionTTL, JSON.stringify(errorRecord));
    
    // Add to solved errors list
    const solvedKey = `${this.keyPrefix}:${this.sessionId}:solved`;
    await this.redisClient.hSet(solvedKey, errorId, JSON.stringify({
      normalized: errorRecord.normalized,
      solution: errorRecord.solution,
      timestamp: Date.now()
    }));
    await this.redisClient.expire(solvedKey, this.sessionTTL);
    
    console.log(`✅ Recorded solution for error ${errorId}: ${solution.description}`);
    
    return errorRecord;
  }

  /**
   * Fast similarity search using Redis operations
   */
  async findSimilarErrorFast(normalizedError) {
    await this.initialize();
    
    // First check current session solved errors
    const solvedKey = `${this.keyPrefix}:${this.sessionId}:solved`;
    const solvedErrors = await this.redisClient.hGetAll(solvedKey);
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    // Check session errors
    for (const [errorId, solvedData] of Object.entries(solvedErrors)) {
      const solved = JSON.parse(solvedData);
      const similarity = calculateSimilarity(normalizedError, solved.normalized);
      
      if (similarity >= this.minSimilarity && similarity > bestSimilarity) {
        bestMatch = {
          id: errorId,
          similarity,
          solution: solved.solution,
          source: 'session'
        };
        bestSimilarity = similarity;
      }
    }
    
    // Check persistent knowledge (loaded at session start)
    const persistentKey = `${this.keyPrefix}:${this.sessionId}:persistent`;
    const persistentErrors = await this.redisClient.hGetAll(persistentKey);
    
    for (const [knowledgeId, knowledgeData] of Object.entries(persistentErrors)) {
      const knowledge = JSON.parse(knowledgeData);
      const similarity = calculateSimilarity(normalizedError, knowledge.normalized);
      
      if (similarity >= this.minSimilarity && similarity > bestSimilarity) {
        bestMatch = {
          id: knowledgeId,
          similarity,
          solution: knowledge.solution,
          source: 'persistent'
        };
        bestSimilarity = similarity;
      }
    }
    
    return bestMatch;
  }

  /**
   * Get suggested fix for new error (Redis-powered)
   */
  async getSuggestedFix(error, context = {}) {
    await this.initialize();
    
    const normalized = normalizeErrorMessage(error);
    const similarError = await this.findSimilarErrorFast(normalized);
    
    if (similarError) {
      const suggestion = {
        confidence: (similarError.similarity / 100) * (similarError.solution.confidence || 0.8),
        description: similarError.solution.description,
        type: similarError.solution.type,
        code: similarError.solution.code,
        source: similarError.source,
        matchSimilarity: similarError.similarity,
        sessionData: similarError.source === 'session'
      };
      
      console.log(`💡 Redis suggested fix (${suggestion.confidence.toFixed(2)} confidence): ${suggestion.description}`);
      return suggestion;
    }
    
    return null;
  }

  /**
   * Analyze current session patterns (Redis analytics)
   */
  async analyzeSessionPatterns() {
    await this.initialize();
    
    const sessionKey = `${this.keyPrefix}:${this.sessionId}:error_list`;
    const errorIds = await this.redisClient.lRange(sessionKey, 0, -1);
    
    const analysis = {
      sessionId: this.sessionId,
      totalErrors: errorIds.length,
      resolvedErrors: 0,
      categories: {},
      topErrors: [],
      avgResolutionTime: 0,
      realTimeLearning: 0
    };
    
    const solvedKey = `${this.keyPrefix}:${this.sessionId}:solved`;
    const solvedCount = await this.redisClient.hLen(solvedKey);
    analysis.resolvedErrors = solvedCount;
    analysis.resolutionRate = errorIds.length > 0 ? (solvedCount / errorIds.length) * 100 : 0;
    
    // Count errors by category (fast parallel Redis operations)
    const errorKeys = errorIds.map(id => `${this.keyPrefix}:${this.sessionId}:errors:${id}`);
    if (errorKeys.length > 0) {
      const errorData = await this.redisClient.mGet(errorKeys);
      
      for (const data of errorData) {
        if (data) {
          const error = JSON.parse(data);
          const category = this.categorizeError(error.error.message);
          analysis.categories[category] = (analysis.categories[category] || 0) + 1;
        }
      }
    }
    
    // Real-time learning rate (errors resolved within session)
    analysis.realTimeLearning = analysis.resolvedErrors;
    
    return analysis;
  }

  /**
   * Load persistent knowledge into Redis for current session
   */
  async loadPersistentKnowledge() {
    try {
      const data = await fs.readFile(this.persistenceFile, 'utf8');
      const persistent = JSON.parse(data);
      
      if (persistent.knowledgeBase && persistent.knowledgeBase.length > 0) {
        const persistentKey = `${this.keyPrefix}:${this.sessionId}:persistent`;
        
        // Load proven patterns into Redis for fast access
        const pipeline = this.redisClient.multi();
        
        for (const entry of persistent.knowledgeBase) {
          if (entry.successRate >= 0.7 && entry.occurrences >= 2) { // Only load proven patterns
            pipeline.hSet(persistentKey, entry.id, JSON.stringify({
              normalized: entry.normalizedError,
              solution: entry.solution,
              occurrences: entry.occurrences,
              successRate: entry.successRate
            }));
          }
        }
        
        pipeline.expire(persistentKey, this.sessionTTL);
        await pipeline.exec();
        
        const loadedCount = await this.redisClient.hLen(persistentKey);
        console.log(`📚 Loaded ${loadedCount} persistent patterns into Redis`);
      }
    } catch (error) {
      console.log(`ℹ️ No persistent knowledge file found (${this.persistenceFile})`);
    }
  }

  /**
   * Save session learnings to persistent storage (end of session)
   */
  async saveToPersistentStorage() {
    await this.initialize();
    
    try {
      // Get all solved errors from current session
      const solvedKey = `${this.keyPrefix}:${this.sessionId}:solved`;
      const sessionSolved = await this.redisClient.hGetAll(solvedKey);
      
      if (Object.keys(sessionSolved).length === 0) {
        console.log(`ℹ️ No new learnings to persist from session ${this.sessionId}`);
        return 0;
      }
      
      // Load existing persistent data
      let persistentData = { knowledgeBase: [] };
      try {
        const existing = await fs.readFile(this.persistenceFile, 'utf8');
        persistentData = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist or is invalid - start fresh
      }
      
      let newEntries = 0;
      
      // Add session learnings to persistent storage
      for (const [errorId, solvedData] of Object.entries(sessionSolved)) {
        const solved = JSON.parse(solvedData);
        
        // Check if we already have this pattern
        const existing = persistentData.knowledgeBase.find(entry => 
          calculateSimilarity(entry.normalizedError, solved.normalized) >= 95
        );
        
        if (existing) {
          // Update existing pattern
          existing.occurrences++;
          existing.lastSeen = Date.now();
          if (solved.solution.confidence > existing.solution.confidence) {
            existing.solution = solved.solution;
          }
        } else {
          // Add new pattern
          persistentData.knowledgeBase.push({
            id: `persistent_${Date.now()}_${newEntries}`,
            normalizedError: solved.normalized,
            solution: solved.solution,
            occurrences: 1,
            successRate: 1.0,
            lastSeen: Date.now(),
            category: this.categorizeError(solved.solution.description),
            sessionOrigin: this.sessionId
          });
          newEntries++;
        }
      }
      
      // Cleanup old entries (keep only last 500 most recent/frequent)
      persistentData.knowledgeBase = persistentData.knowledgeBase
        .sort((a, b) => (b.lastSeen * b.occurrences) - (a.lastSeen * a.occurrences))
        .slice(0, 500);
      
      // Save back to file
      persistentData.lastUpdated = Date.now();
      persistentData.version = '1.0';
      
      await fs.writeFile(this.persistenceFile, JSON.stringify(persistentData, null, 2));
      
      console.log(`💾 Saved ${newEntries} new patterns to persistent storage`);
      return newEntries;
      
    } catch (error) {
      console.error(`❌ Failed to save to persistent storage: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clean up session data from Redis
   */
  async cleanupSession(sessionId = null) {
    await this.initialize();
    
    const targetSession = sessionId || this.sessionId;
    const pattern = `${this.keyPrefix}:${targetSession}:*`;
    
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        console.log(`🧹 Cleaned up ${keys.length} Redis keys for session ${targetSession}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup session ${targetSession}: ${error.message}`);
    }
  }

  /**
   * Get real-time session statistics
   */
  async getSessionStats() {
    await this.initialize();
    
    const sessionKey = `${this.keyPrefix}:${this.sessionId}:error_list`;
    const solvedKey = `${this.keyPrefix}:${this.sessionId}:solved`;
    const persistentKey = `${this.keyPrefix}:${this.sessionId}:persistent`;
    
    const [totalErrors, solvedErrors, persistentEntries] = await Promise.all([
      this.redisClient.lLen(sessionKey),
      this.redisClient.hLen(solvedKey),
      this.redisClient.hLen(persistentKey)
    ]);
    
    return {
      sessionId: this.sessionId,
      totalErrors,
      solvedErrors,
      persistentEntries,
      resolutionRate: totalErrors > 0 ? Math.round((solvedErrors / totalErrors) * 100) : 0,
      learningEnabled: true
    };
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
   * Helper: Generate unique error ID
   */
  generateErrorId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.initialized = false;
      console.log(`🔴 Redis Error Learning connection closed`);
    }
  }
}

/**
 * Global Redis instance for ZN-Grunts
 */
export const globalRedisErrorLearning = new RedisErrorLearningSystem();

/**
 * Integration helper for existing test runner
 */
export async function integrateRedisWithTestRunner(testRunner, sessionId = null) {
  // Initialize Redis error learning
  await globalRedisErrorLearning.initialize(sessionId);
  
  // Wrap the error handling in the test runner
  const originalRunSingleCoreTest = testRunner.runSingleCoreTest;
  
  testRunner.runSingleCoreTest = async function(test, workspacePath, context = {}) {
    const result = await originalRunSingleCoreTest.call(this, test, workspacePath, context);
    
    // Capture errors for learning (fast Redis operations)
    if (result.errors && result.errors.length > 0) {
      for (const error of result.errors) {
        const { errorId, similarError } = await globalRedisErrorLearning.captureWorkerError(
          context.workerId || 'unknown',
          { message: error },
          {
            task: test.id,
            phase: 'core-test',
            files: [workspacePath]
          }
        );
        
        // If we have a similar error suggestion, use it
        if (similarError && !context.autoFix === false) {
          const suggestion = await globalRedisErrorLearning.getSuggestedFix(error);
          if (suggestion && suggestion.confidence > 0.7) {
            result.fixes.push(`🔴 Redis suggested: ${suggestion.description}`);
          }
        }
        
        // If we applied fixes, record them as successful solutions
        if (result.fixes && result.fixes.length > 0) {
          const bestFix = result.fixes.find(fix => fix.includes('Auto-fixed')) || result.fixes[0];
          await globalRedisErrorLearning.recordSuccessfulFix(
            errorId,
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
  
  return globalRedisErrorLearning;
}