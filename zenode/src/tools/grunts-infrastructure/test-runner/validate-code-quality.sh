#!/bin/bash
# Code Quality Validator - Comprehensive ESLint, TypeScript, testing validation

set -e

WORKER_ID=$1
WORKSPACE_PATH="/tmp/grunt-${WORKER_ID}"
RESULTS_PATH="/tmp/grunt-${WORKER_ID}/test-results"

if [ -z "$WORKER_ID" ]; then
    echo "❌ Usage: $0 <worker_id>"
    exit 1
fi

mkdir -p "$RESULTS_PATH"

echo "🔍 Starting code quality validation for worker $WORKER_ID"
echo "📁 Workspace: $WORKSPACE_PATH"
echo "📊 Results: $RESULTS_PATH"

# Function to log results with timestamp
log_result() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$RESULTS_PATH/quality.log"
}

# Initialize scores
ESLINT_SCORE=0
TYPESCRIPT_SCORE=0
UNIT_SCORE=0
COMPLEXITY_SCORE=0
SECURITY_SCORE=0
COVERAGE_SCORE=0

# Check if workspace exists
if [ ! -d "$WORKSPACE_PATH" ]; then
    echo "❌ Workspace directory not found: $WORKSPACE_PATH"
    log_result "ERROR: Workspace not found"
    exit 1
fi

cd "$WORKSPACE_PATH"

# 1. ESLint validation
echo "🔍 Running ESLint..."
if command -v eslint >/dev/null 2>&1 || [ -f "node_modules/.bin/eslint" ]; then
    if npm run lint > "$RESULTS_PATH/eslint.log" 2>&1; then
        ESLINT_SCORE=10
        log_result "ESLint: PASS (Score: $ESLINT_SCORE)"
    else
        ESLINT_ERRORS=$(grep -c "error" "$RESULTS_PATH/eslint.log" 2>/dev/null || echo 0)
        ESLINT_WARNINGS=$(grep -c "warning" "$RESULTS_PATH/eslint.log" 2>/dev/null || echo 0)
        ESLINT_SCORE=$((10 - ESLINT_ERRORS - (ESLINT_WARNINGS / 2)))
        ESLINT_SCORE=$([ $ESLINT_SCORE -lt 0 ] && echo 0 || echo $ESLINT_SCORE)
        log_result "ESLint: FAIL (Errors: $ESLINT_ERRORS, Warnings: $ESLINT_WARNINGS, Score: $ESLINT_SCORE)"
    fi
else
    # Try basic syntax check with node
    echo "⚠️  ESLint not available, running basic syntax check..."
    SYNTAX_ERRORS=0
    for jsfile in $(find . -name "*.js" -o -name "*.mjs" 2>/dev/null | head -20); do
        if ! node -c "$jsfile" >/dev/null 2>&1; then
            SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
        fi
    done
    
    if [ $SYNTAX_ERRORS -eq 0 ]; then
        ESLINT_SCORE=7  # Reduced score for basic check
        log_result "Syntax Check: PASS (Score: $ESLINT_SCORE)"
    else
        ESLINT_SCORE=2
        log_result "Syntax Check: FAIL ($SYNTAX_ERRORS errors, Score: $ESLINT_SCORE)"
    fi
fi

# 2. TypeScript compilation
echo "🔧 Checking TypeScript compilation..."
if [ -f "tsconfig.json" ] && (command -v tsc >/dev/null 2>&1 || [ -f "node_modules/.bin/tsc" ]); then
    if npm run build > "$RESULTS_PATH/typescript.log" 2>&1 || npx tsc --noEmit > "$RESULTS_PATH/typescript.log" 2>&1; then
        TYPESCRIPT_SCORE=10
        log_result "TypeScript: PASS (Score: $TYPESCRIPT_SCORE)"
    else
        TS_ERRORS=$(grep -c "error TS" "$RESULTS_PATH/typescript.log" 2>/dev/null || echo 0)
        TYPESCRIPT_SCORE=$((10 - TS_ERRORS))
        TYPESCRIPT_SCORE=$([ $TYPESCRIPT_SCORE -lt 0 ] && echo 0 || echo $TYPESCRIPT_SCORE)
        log_result "TypeScript: FAIL (Errors: $TS_ERRORS, Score: $TYPESCRIPT_SCORE)"
    fi
else
    TYPESCRIPT_SCORE=5  # Neutral score if no TypeScript
    log_result "TypeScript: N/A (No TypeScript config found, Score: $TYPESCRIPT_SCORE)"
fi

# 3. Unit test execution
echo "🧪 Running unit tests..."
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    if npm test > "$RESULTS_PATH/unit-tests.log" 2>&1; then
        # Parse test results
        PASSING_TESTS=$(grep -o "[0-9]\+ passing" "$RESULTS_PATH/unit-tests.log" 2>/dev/null | head -1 | cut -d' ' -f1 || echo 0)
        FAILING_TESTS=$(grep -o "[0-9]\+ failing" "$RESULTS_PATH/unit-tests.log" 2>/dev/null | head -1 | cut -d' ' -f1 || echo 0)
        
        # Alternative patterns for different test frameworks
        if [ "$PASSING_TESTS" = "0" ] && [ "$FAILING_TESTS" = "0" ]; then
            TOTAL_TESTS=$(grep -o "Tests: *[0-9]\+" "$RESULTS_PATH/unit-tests.log" 2>/dev/null | head -1 | grep -o "[0-9]\+" || echo 0)
            FAILED_TESTS=$(grep -o "failed: *[0-9]\+" "$RESULTS_PATH/unit-tests.log" 2>/dev/null | head -1 | grep -o "[0-9]\+" || echo 0)
            PASSING_TESTS=$((TOTAL_TESTS - FAILED_TESTS))
            FAILING_TESTS=$FAILED_TESTS
        fi
        
        TOTAL_TESTS=$((PASSING_TESTS + FAILING_TESTS))
        
        if [ $TOTAL_TESTS -gt 0 ]; then
            UNIT_SCORE=$(( (PASSING_TESTS * 10) / TOTAL_TESTS ))
        else
            UNIT_SCORE=5  # Some credit for having test infrastructure
        fi
        
        log_result "Unit Tests: $PASSING_TESTS/$TOTAL_TESTS passing (Score: $UNIT_SCORE)"
    else
        UNIT_SCORE=0
        log_result "Unit Tests: FAILED TO RUN (Score: $UNIT_SCORE)"
    fi
else
    # Check for test files existence
    TEST_FILES=$(find . -name "*test*" -o -name "*spec*" 2>/dev/null | wc -l)
    if [ $TEST_FILES -gt 0 ]; then
        UNIT_SCORE=3  # Some credit for having test files
        log_result "Unit Tests: Test files found but no npm test script (Score: $UNIT_SCORE)"
    else
        UNIT_SCORE=0
        log_result "Unit Tests: No test infrastructure found (Score: $UNIT_SCORE)"
    fi
fi

# 4. Code complexity analysis
echo "📊 Analyzing code complexity..."
if command -v complexity-report >/dev/null 2>&1; then
    npx complexity-report --format json src/ > "$RESULTS_PATH/complexity.json" 2>/dev/null || echo '{"maintainability": 50}' > "$RESULTS_PATH/complexity.json"
else
    # Simple line-based complexity estimate
    TOTAL_LINES=$(find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo 500)
    FUNCTION_COUNT=$(grep -r "function\|=>" . --include="*.js" --include="*.ts" 2>/dev/null | wc -l || echo 10)
    
    if [ $FUNCTION_COUNT -gt 0 ]; then
        AVG_LINES_PER_FUNCTION=$((TOTAL_LINES / FUNCTION_COUNT))
        if [ $AVG_LINES_PER_FUNCTION -lt 20 ]; then
            MAINTAINABILITY=80
        elif [ $AVG_LINES_PER_FUNCTION -lt 50 ]; then
            MAINTAINABILITY=60
        else
            MAINTAINABILITY=40
        fi
    else
        MAINTAINABILITY=50
    fi
    
    echo "{\"maintainability\": $MAINTAINABILITY}" > "$RESULTS_PATH/complexity.json"
fi

# Extract maintainability score
if command -v jq >/dev/null 2>&1; then
    MAINTAINABILITY=$(cat "$RESULTS_PATH/complexity.json" | jq -r '.maintainability // 50')
else
    MAINTAINABILITY=$(grep -o '"maintainability":[0-9]\+' "$RESULTS_PATH/complexity.json" 2>/dev/null | cut -d':' -f2 || echo 50)
fi

COMPLEXITY_SCORE=$(echo "scale=0; $MAINTAINABILITY / 10" | bc 2>/dev/null || echo $((MAINTAINABILITY / 10)))
COMPLEXITY_SCORE=$([ $COMPLEXITY_SCORE -gt 10 ] && echo 10 || echo $COMPLEXITY_SCORE)

log_result "Complexity: Maintainability $MAINTAINABILITY (Score: $COMPLEXITY_SCORE)"

# 5. Security audit
echo "🔒 Running security audit..."
if [ -f "package.json" ] && command -v npm >/dev/null 2>&1; then
    if npm audit --audit-level=moderate > "$RESULTS_PATH/security.log" 2>&1; then
        SECURITY_SCORE=10
        log_result "Security: PASS (Score: $SECURITY_SCORE)"
    else
        HIGH_VULNS=$(grep -c "high" "$RESULTS_PATH/security.log" 2>/dev/null || echo 0)
        MODERATE_VULNS=$(grep -c "moderate" "$RESULTS_PATH/security.log" 2>/dev/null || echo 0)
        SECURITY_ISSUES=$((HIGH_VULNS * 2 + MODERATE_VULNS))
        SECURITY_SCORE=$((10 - SECURITY_ISSUES))
        SECURITY_SCORE=$([ $SECURITY_SCORE -lt 0 ] && echo 0 || echo $SECURITY_SCORE)
        log_result "Security: $SECURITY_ISSUES vulnerabilities found (High: $HIGH_VULNS, Moderate: $MODERATE_VULNS, Score: $SECURITY_SCORE)"
    fi
else
    # Basic security check - look for common issues
    SECURITY_ISSUES=0
    if grep -r "eval\|innerHTML\|document.write" . --include="*.js" --include="*.html" >/dev/null 2>&1; then
        SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
    fi
    if grep -r "http://" . --include="*.js" --include="*.html" >/dev/null 2>&1; then
        SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
    fi
    
    SECURITY_SCORE=$((10 - SECURITY_ISSUES * 3))
    SECURITY_SCORE=$([ $SECURITY_SCORE -lt 0 ] && echo 0 || echo $SECURITY_SCORE)
    log_result "Security: Basic check found $SECURITY_ISSUES potential issues (Score: $SECURITY_SCORE)"
fi

# 6. Code coverage (if available)
echo "📈 Measuring code coverage..."
if [ -f "package.json" ] && grep -q "coverage" package.json; then
    npm run test:coverage > "$RESULTS_PATH/coverage.log" 2>&1 || npm run coverage > "$RESULTS_PATH/coverage.log" 2>&1 || true
    
    COVERAGE_PERCENT=$(grep -o "All files.*[0-9]\+\%" "$RESULTS_PATH/coverage.log" 2>/dev/null | tail -1 | grep -o "[0-9]\+\%" | tr -d '%' || echo 0)
    
    if [ "$COVERAGE_PERCENT" = "0" ]; then
        # Try alternative coverage patterns
        COVERAGE_PERCENT=$(grep -o "[0-9]\+\% Statements" "$RESULTS_PATH/coverage.log" 2>/dev/null | head -1 | grep -o "[0-9]\+" || echo 0)
    fi
    
    COVERAGE_SCORE=$(echo "scale=0; $COVERAGE_PERCENT / 10" | bc 2>/dev/null || echo $((COVERAGE_PERCENT / 10)))
    COVERAGE_SCORE=$([ $COVERAGE_SCORE -gt 10 ] && echo 10 || echo $COVERAGE_SCORE)
    
    log_result "Coverage: $COVERAGE_PERCENT% (Score: $COVERAGE_SCORE)"
else
    COVERAGE_SCORE=5  # Neutral score if no coverage
    log_result "Coverage: N/A (No coverage script found, Score: $COVERAGE_SCORE)"
fi

# Calculate total score
TOTAL_SCORE=$((ESLINT_SCORE + TYPESCRIPT_SCORE + UNIT_SCORE + COMPLEXITY_SCORE + SECURITY_SCORE + COVERAGE_SCORE))
MAX_SCORE=60
PERCENTAGE=$(echo "scale=2; ($TOTAL_SCORE * 100) / $MAX_SCORE" | bc 2>/dev/null || echo $(( (TOTAL_SCORE * 100) / MAX_SCORE )))

echo ""
echo "📊 Quality Assessment Complete for Worker $WORKER_ID"
echo "================================================="
echo "   ESLint/Syntax: $ESLINT_SCORE/10"
echo "   TypeScript:    $TYPESCRIPT_SCORE/10"
echo "   Unit Tests:    $UNIT_SCORE/10"
echo "   Complexity:    $COMPLEXITY_SCORE/10"
echo "   Security:      $SECURITY_SCORE/10"
echo "   Coverage:      $COVERAGE_SCORE/10"
echo "================================================="
echo "   TOTAL:         $TOTAL_SCORE/$MAX_SCORE ($PERCENTAGE%)"
echo ""

# Save final score as JSON
cat > "$RESULTS_PATH/final-score.json" << EOF
{
  "workerId": "$WORKER_ID",
  "scores": {
    "eslint": $ESLINT_SCORE,
    "typescript": $TYPESCRIPT_SCORE,
    "unitTests": $UNIT_SCORE,
    "complexity": $COMPLEXITY_SCORE,
    "security": $SECURITY_SCORE,
    "coverage": $COVERAGE_SCORE,
    "total": $TOTAL_SCORE,
    "maxScore": $MAX_SCORE,
    "percentage": $PERCENTAGE
  },
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "details": {
    "workspace": "$WORKSPACE_PATH",
    "hasPackageJson": $([ -f "package.json" ] && echo "true" || echo "false"),
    "hasTypeScript": $([ -f "tsconfig.json" ] && echo "true" || echo "false"),
    "hasTests": $([ $(find . -name "*test*" -o -name "*spec*" 2>/dev/null | wc -l) -gt 0 ] && echo "true" || echo "false")
  }
}
EOF

log_result "Final Score: $TOTAL_SCORE/$MAX_SCORE ($PERCENTAGE%)"

echo "✅ Code quality validation complete"
echo "📄 Results saved to: $RESULTS_PATH/final-score.json"

exit 0