/**
 * Error Similarity Detection System
 * Implements Levenshtein distance comparison with 80% threshold
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  // Create matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity percentage (0-100)
 */
export function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 100;
  if (str1.length === 0 && str2.length === 0) return 100;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const maxLength = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.max(0, Math.min(100, similarity));
}

/**
 * Normalize error message for comparison
 */
export function normalizeErrorMessage(error) {
  if (typeof error !== 'string') {
    error = String(error);
  }
  
  return error
    .toLowerCase()
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/[^\w\s]/g, '')                 // Remove punctuation
    .replace(/\b\d+\b/g, 'NUM')              // Replace numbers with NUM
    .replace(/\bline \d+/g, 'line NUM')      // Normalize line numbers
    .replace(/\bcolumn \d+/g, 'column NUM')  // Normalize column numbers
    .replace(/\bat \S+/g, 'at FILE')         // Normalize file paths
    .trim();
}

/**
 * Error classification system
 */
export class ErrorClassifier {
  constructor() {
    this.knownErrors = new Map();
    this.similarityThreshold = 80; // 80% similarity threshold
  }

  /**
   * Add a known error with its solution
   */
  addKnownError(errorMessage, solution, category = 'general') {
    const normalized = normalizeErrorMessage(errorMessage);
    this.knownErrors.set(normalized, {
      original: errorMessage,
      solution,
      category,
      occurrences: 1,
      lastSeen: Date.now()
    });
  }

  /**
   * Find similar error and suggested fix
   */
  findSimilarError(errorMessage) {
    const normalized = normalizeErrorMessage(errorMessage);
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const [knownError, errorData] of this.knownErrors) {
      const similarity = calculateSimilarity(normalized, knownError);
      
      if (similarity >= this.similarityThreshold && similarity > bestSimilarity) {
        bestMatch = {
          similarity,
          error: errorData,
          normalized: knownError
        };
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
  }

  /**
   * Learn from new error
   */
  learnFromError(errorMessage, solution = null) {
    const existing = this.findSimilarError(errorMessage);
    
    if (existing) {
      // Update existing error
      existing.error.occurrences++;
      existing.error.lastSeen = Date.now();
      if (solution) {
        existing.error.solution = solution;
      }
    } else if (solution) {
      // Add new error
      this.addKnownError(errorMessage, solution);
    }
  }

  /**
   * Get all errors in category
   */
  getErrorsByCategory(category) {
    const errors = [];
    for (const [normalized, errorData] of this.knownErrors) {
      if (errorData.category === category) {
        errors.push({ normalized, ...errorData });
      }
    }
    return errors;
  }

  /**
   * Export knowledge base
   */
  exportKnowledgeBase() {
    return {
      threshold: this.similarityThreshold,
      errors: Array.from(this.knownErrors.entries()).map(([normalized, data]) => ({
        normalized,
        ...data
      })),
      exported: Date.now()
    };
  }

  /**
   * Import knowledge base
   */
  importKnowledgeBase(data) {
    if (data.threshold) {
      this.similarityThreshold = data.threshold;
    }
    
    if (data.errors) {
      this.knownErrors.clear();
      for (const error of data.errors) {
        this.knownErrors.set(error.normalized, {
          original: error.original,
          solution: error.solution,
          category: error.category,
          occurrences: error.occurrences,
          lastSeen: error.lastSeen
        });
      }
    }
  }
}

/**
 * Pre-populate with common errors and fixes
 */
export function createDefaultErrorClassifier() {
  const classifier = new ErrorClassifier();
  
  // Phaser-specific errors
  classifier.addKnownError(
    "Cannot resolve module 'phaser'",
    "npm install phaser",
    "dependency"
  );
  
  classifier.addKnownError(
    "Phaser is not defined",
    "Add: import Phaser from 'phaser'",
    "import"
  );
  
  classifier.addKnownError(
    "Cannot read property 'Scene' of undefined",
    "Ensure Phaser is properly imported: import Phaser from 'phaser'",
    "import"
  );
  
  // Module errors
  classifier.addKnownError(
    "SyntaxError: Unexpected token 'export'",
    "Add 'type': 'module' to package.json",
    "module"
  );
  
  classifier.addKnownError(
    "ReferenceError: require is not defined",
    "Use ES6 imports instead of require()",
    "module"
  );
  
  // Scene method errors
  classifier.addKnownError(
    "this.preload is not a function",
    "Ensure class extends Phaser.Scene",
    "scene"
  );
  
  classifier.addKnownError(
    "Missing required method: preload",
    "Add preload() method to scene class",
    "scene"
  );
  
  classifier.addKnownError(
    "Missing required method: create",
    "Add create() method to scene class",
    "scene"
  );
  
  classifier.addKnownError(
    "Missing required method: update",
    "Add update() method to scene class",
    "scene"
  );
  
  // Syntax errors
  classifier.addKnownError(
    "SyntaxError: Unexpected token",
    "Check for missing semicolons, brackets, or quotes",
    "syntax"
  );
  
  classifier.addKnownError(
    "SyntaxError: Unexpected end of input",
    "Check for unclosed brackets or braces",
    "syntax"
  );
  
  // CDN errors
  classifier.addKnownError(
    "Failed to load external script",
    "Replace CDN script tags with npm packages",
    "cdn"
  );
  
  classifier.addKnownError(
    "Network error loading CDN resource",
    "Use local npm package instead of CDN",
    "cdn"
  );
  
  return classifier;
}

/**
 * Error similarity validator for testing
 */
export function validateErrorSimilarity() {
  const tests = [
    {
      error1: "Cannot resolve module 'phaser'",
      error2: "Cannot resolve module phaser",
      expectedSimilarity: 95
    },
    {
      error1: "ReferenceError: Phaser is not defined at line 10",
      error2: "ReferenceError: Phaser is not defined at line 25",
      expectedSimilarity: 90
    },
    {
      error1: "SyntaxError: Unexpected token 'export'",
      error2: "SyntaxError: Unexpected token import",
      expectedSimilarity: 75
    }
  ];
  
  console.log('🧪 Testing error similarity detection...');
  
  for (const test of tests) {
    const similarity = calculateSimilarity(
      normalizeErrorMessage(test.error1),
      normalizeErrorMessage(test.error2)
    );
    
    const passed = Math.abs(similarity - test.expectedSimilarity) <= 10;
    console.log(`${passed ? '✅' : '❌'} ${test.error1} vs ${test.error2}: ${similarity.toFixed(1)}%`);
  }
  
  return tests;
}