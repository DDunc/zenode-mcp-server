# Refactor Tool - Intelligent Code Refactoring

**Comprehensive refactoring analysis with intelligent decomposition and modernization strategies**

The `zenode:refactor` tool provides sophisticated code refactoring recommendations with precise line-number references and executable implementation plans. It uses a progressive priority system that addresses critical structural issues before cosmetic improvements, ensuring maximum impact and maintainability gains.

## Key Features

- **Intelligent prioritization** - Refuses low-priority work if critical decomposition is needed first
- **Top-down decomposition strategy** - Analyzes file → class → function levels systematically  
- **Four specialized refactor types** with context-aware thresholds
- **Precise line-number references** for direct implementation by Claude
- **Language-specific guidance** for TypeScript, Python, Java, Go, Swift, and more
- **Style guide integration** using existing project patterns as references
- **Conservative dependency analysis** to prevent breaking changes
- **Multi-file analysis** with cross-file relationship understanding
- **Container-native operations** optimized for zenode's Docker environment

## Progressive Priority System

### 1. Decompose (CRITICAL PRIORITY)
**AUTOMATIC decomposition** (blocks all other refactoring):
- Files >15,000 LOC, Classes >3,000 LOC, Functions >500 LOC

**EVALUATE decomposition** (intelligent assessment):
- Files >5,000 LOC, Classes >1,000 LOC, Functions >150 LOC
- Only recommends if genuinely improves maintainability
- Respects legitimate complexity (algorithms, state machines, generated code)

### 2. CodeSmells (Applied after decomposition)
- Long methods, complex conditionals, duplicate code
- Magic numbers, poor naming, violation of SOLID principles

### 3. Modernize (Applied after decomposition) 
- Update to modern language features (async/await, optional chaining)
- Leverage new syntax and standard library improvements

### 4. Organization (Applied after decomposition)
- Improve logical grouping and separation of concerns
- Better module structure and dependency organization

## Tool Parameters

### Required Parameters
- `files`: Code files/directories to analyze (must be absolute `/workspace/` paths)
- `prompt`: Refactoring goals, context, and specific focus areas
- `refactor_type`: codesmells|decompose|modernize|organization

### Enhancement Parameters
- `focus_areas`: Specific priorities (performance, readability, maintainability, security)
- `style_guide_examples`: Reference files showing target patterns (absolute paths)
- `thinking_mode`: minimal|low|medium|high|max (default: medium)
- `continuation_id`: Continue previous refactoring discussions

## Usage Examples

### Critical Decomposition Analysis
```bash
# Large legacy file requiring structural breakdown
zenode:refactor "Decompose UserService.ts - it's become unwieldy with authentication, profile, and session management all mixed together" --files ["/workspace/src/services/UserService.ts"] --refactor-type decompose --model pro --thinking-mode high

# Massive class needing separation of concerns
zenode:refactor "Break down PaymentController.java - handles validation, processing, notifications, and logging in one class" --files ["/workspace/src/controllers/PaymentController.java"] --refactor-type decompose --model o3 --thinking-mode max
```

### Code Smell Detection and Remediation
```bash
# Identify anti-patterns in authentication module
zenode:refactor "Find and fix code smells in authentication system focusing on security and maintainability" --files ["/workspace/src/auth"] --refactor-type codesmells --focus-areas ["security", "maintainability"] --model pro

# Comprehensive code quality analysis
zenode:refactor "Detect code smells across payment processing module with focus on error handling and validation patterns" --files ["/workspace/src/payment"] --refactor-type codesmells --focus-areas ["readability", "performance"] --model o3
```

### Modernization with Style Consistency
```bash
# Modernize legacy JavaScript to TypeScript patterns
zenode:refactor "Modernize legacy user management code to use modern TypeScript features following our established patterns" --files ["/workspace/src/legacy/user-mgmt.js"] --refactor-type modernize --style-guide-examples ["/workspace/src/modern/UserService.ts", "/workspace/src/modern/BaseService.ts"] --model pro

# Update Python code to modern features
zenode:refactor "Modernize data processing pipeline to use modern Python features like dataclasses, type hints, and async/await" --files ["/workspace/python/data_processor.py"] --refactor-type modernize --focus-areas ["performance", "type-safety"] --model o3
```

### Organizational Structure Improvement
```bash
# Reorganize utility modules for better coherence
zenode:refactor "Improve organization of utility functions - currently scattered across multiple files with unclear boundaries" --files ["/workspace/src/utils"] --refactor-type organization --focus-areas ["maintainability", "discoverability"] --model pro

# Restructure API routing for clarity
zenode:refactor "Reorganize API routes for better logical grouping and RESTful design adherence" --files ["/workspace/src/routes"] --refactor-type organization --style-guide-examples ["/workspace/docs/api-patterns.md"] --model o3
```

### Multi-File Refactoring with Dependencies
```bash
# Comprehensive module refactoring considering dependencies
zenode:refactor "Refactor user authentication module considering its dependencies on session, crypto, and database services" --files ["/workspace/src/auth", "/workspace/src/session", "/workspace/src/crypto", "/workspace/src/db"] --refactor-type organization --model pro --thinking-mode high
```

## Zenode-Specific Features

### Container-Native File Access
The refactor tool operates within zenode's Docker environment:
- **Workspace path awareness**: All file paths must use `/workspace/` prefix
- **Volume-mounted analysis**: Access to project files via Docker volume mounts
- **Cross-container coordination**: Integration with other zenode tools for implementation
- **Build context awareness**: Considers Docker build patterns and file accessibility

### TypeScript/Node.js Optimization
Specialized guidance for modern JavaScript ecosystems:
- **ESM vs CommonJS**: Module system-specific refactoring recommendations
- **TypeScript best practices**: Advanced type usage, utility types, strict mode
- **Node.js patterns**: Async/await, streams, error handling, performance optimization
- **Package ecosystem**: npm/yarn workspace patterns, dependency management

### Language-Specific Intelligence
```bash
# TypeScript-specific modernization
zenode:refactor "modernize to use strict TypeScript" --files ["/workspace/src"] --refactor-type modernize
# Focus: strict type checking, utility types, const assertions, template literal types

# Python-specific decomposition  
zenode:refactor "decompose data processing module" --files ["/workspace/python"] --refactor-type decompose
# Focus: modules, classes, functions, decorators for cross-cutting concerns

# Java-specific organization
zenode:refactor "reorganize service layer" --files ["/workspace/src/main/java"] --refactor-type organization  
# Focus: packages, interfaces, composition over inheritance, dependency injection
```

### Cross-Tool Integration Patterns
```bash
# Refactor → Code Review → Test Generation workflow
# Step 1: Identify refactoring opportunities
zenode:refactor "analyze payment service for improvements" --files ["/workspace/src/payment"] --refactor-type codesmells --continuation-id {session_id}

# Step 2: Review proposed changes for safety
zenode:codereview "review proposed refactoring changes for breaking impacts" --files ["/workspace/src/payment"] --continuation-id {session_id}

# Step 3: Generate tests for refactored code
zenode:testgen "create tests for refactored payment service components" --files ["/workspace/src/payment"] --continuation-id {session_id}

# Step 4: Validate complete refactoring
zenode:precommit "/workspace" "completed payment service refactoring with tests" --continuation-id {session_id}
```

## Advanced Refactoring Strategies

### Adaptive Threshold Analysis
```bash
# Context-aware decomposition for different code types

# Algorithm implementation (higher tolerance)
zenode:refactor "evaluate sorting algorithm for decomposition" --files ["/workspace/src/algorithms/QuickSort.ts"] --refactor-type decompose --focus-areas ["readability"]

# Business logic (standard thresholds)
zenode:refactor "decompose user registration workflow" --files ["/workspace/src/auth/Registration.ts"] --refactor-type decompose --focus-areas ["maintainability"]

# Generated code (very high tolerance)
zenode:refactor "review auto-generated API client" --files ["/workspace/src/generated/api-client.ts"] --refactor-type codesmells --focus-areas ["performance"]
```

### Legacy System Refactoring
```bash
# Gentle refactoring for stable legacy code
zenode:refactor "carefully modernize legacy payment processor without breaking stability" --files ["/workspace/legacy/payment-core.js"] --refactor-type modernize --thinking-mode max --focus-areas ["stability", "incremental-improvement"]

# Legacy to modern migration strategy
zenode:refactor "create migration plan for legacy user system to modern TypeScript" --files ["/workspace/legacy/user.js", "/workspace/src/modern/UserService.ts"] --refactor-type organization --style-guide-examples ["/workspace/src/modern"] --model pro
```

### Performance-Focused Refactoring
```bash
# Optimize critical path code
zenode:refactor "optimize data processing pipeline for performance without sacrificing readability" --files ["/workspace/src/data/processor.ts"] --refactor-type modernize --focus-areas ["performance", "memory-efficiency"] --model o3

# Database query optimization
zenode:refactor "improve database service organization and query efficiency" --files ["/workspace/src/db"] --refactor-type organization --focus-areas ["performance", "maintainability"] --model pro
```

### Security-Focused Refactoring
```bash
# Security-aware code smell detection
zenode:refactor "identify security issues in authentication handling" --files ["/workspace/src/auth"] --refactor-type codesmells --focus-areas ["security", "input-validation"] --model o3 --thinking-mode high

# Secure decomposition of sensitive code
zenode:refactor "decompose crypto service with security boundary considerations" --files ["/workspace/src/crypto/CryptoService.ts"] --refactor-type decompose --focus-areas ["security", "isolation"] --model pro
```

## Implementation Workflow

### Automatic Implementation Directive
The refactor tool includes mandatory implementation steps:
```markdown
MANDATORY NEXT STEPS:
1. INFORM USER by displaying a brief summary of required refactorings
2. CREATE A CHECKLIST of each refactoring to keep a record of what is to change, how and why
3. IMPLEMENT each refactoring opportunity immediately - think carefully about each change as you implement
4. CREATE new files as needed where decomposition is suggested
5. MODIFY existing files to apply improvements as needed
6. UPDATE all imports, references, and dependencies as needed
7. VERIFY each change works before moving to the next
```

### Progressive Implementation Strategy
```bash
# Phase 1: Critical decomposition
zenode:refactor "decompose oversized service classes" --refactor-type decompose

# Phase 2: Address code smells
zenode:refactor "fix code smells in newly decomposed services" --refactor-type codesmells

# Phase 3: Modernize implementations
zenode:refactor "modernize refactored services" --refactor-type modernize

# Phase 4: Optimize organization
zenode:refactor "finalize organization of refactored modules" --refactor-type organization
```

### Change Validation Workflow
```bash
# After refactoring implementation
# Step 1: Validate changes don't break functionality
zenode:precommit "/workspace" "completed service decomposition refactoring"

# Step 2: Run comprehensive tests
# npm test or equivalent testing command

# Step 3: Performance validation if needed
# npm run benchmark or equivalent performance tests
```

## Output Analysis and Implementation

### Decomposition Recommendations
```markdown
## DECOMPOSITION ANALYSIS

### File: UserService.ts (8,543 LOC - CRITICAL)
**Priority**: IMMEDIATE - Blocks other improvements

**Recommended Split**:
- `UserAuthService.ts` (lines 1-2,100): Authentication logic
- `UserProfileService.ts` (lines 2,101-4,200): Profile management
- `UserSessionService.ts` (lines 4,201-6,300): Session handling
- `UserValidation.ts` (lines 6,301-8,543): Input validation

**Dependencies to Update**:
- Import statements in 23 files
- Type exports in `types/user.ts`
- Test files in `tests/user/`

**Implementation Order**:
1. Extract validation logic first (lowest risk)
2. Extract session management (medium dependencies)
3. Extract profile management (higher integration)
4. Extract authentication (highest impact)
```

### Code Smell Identification
```markdown
## CODE SMELL ANALYSIS

### Long Method: processPayment() (lines 145-320)
**Severity**: HIGH
**Impact**: Difficult testing, complex debugging

**Refactoring****: Split into:
- `validatePaymentData()` (lines 145-180)
- `processPaymentProvider()` (lines 181-250)
- `updatePaymentRecord()` (lines 251-290)
- `sendPaymentNotification()` (lines 291-320)

### Magic Numbers (lines 45, 67, 123, 89)
**Severity**: MEDIUM
**Fix**: Extract to configuration constants

### Duplicate Code Blocks
**Locations**: lines 234-248, 567-581, 789-803
**Fix**: Extract to shared utility function
```

### Modernization Opportunities
```markdown
## MODERNIZATION ANALYSIS

### TypeScript Improvements
- Replace `any` types with proper interfaces (12 occurrences)
- Add strict null checks for optional parameters
- Use utility types for better type safety

### Node.js Pattern Updates
- Replace callbacks with async/await (5 functions)
- Use optional chaining for deep property access
- Implement proper error handling with Result patterns

### Performance Enhancements
- Replace array.forEach with for...of for performance
- Use Map instead of object for frequent lookups
- Implement connection pooling for database operations
```

## Best Practices for Zenode

### Effective File Path Management
```bash
# ✅ GOOD: Complete workspace paths
zenode:refactor "modernize auth service" --files ["/workspace/src/auth/AuthService.ts", "/workspace/src/auth/types.ts"]

# ❌ BAD: Relative or incomplete paths  
zenode:refactor "modernize auth" --files ["./AuthService.ts"]
```

### Strategic Refactoring Sequencing
```bash
# 1. Start with decomposition for large files
zenode:refactor "decompose first" --refactor-type decompose

# 2. Address code smells in smaller components
zenode:refactor "fix smells" --refactor-type codesmells

# 3. Modernize clean, well-structured code
zenode:refactor "modernize patterns" --refactor-type modernize

# 4. Optimize final organization
zenode:refactor "finalize structure" --refactor-type organization
```

### Context-Rich Analysis
```bash
# Provide comprehensive context for better recommendations
zenode:refactor "Refactor user management system that handles authentication, profile management, and session tracking. The system is critical for production and needs to maintain backward compatibility while improving testability and maintainability. Current issues include complex interdependencies and difficulty adding new authentication providers." --files ["/workspace/src/user"] --refactor-type decompose --focus-areas ["testability", "maintainability", "backward-compatibility"]
```

### Style Guide Integration
```bash
# Use existing well-structured code as patterns
zenode:refactor "modernize payment processing following established service patterns" --files ["/workspace/src/payment"] --refactor-type modernize --style-guide-examples ["/workspace/src/user/UserService.ts", "/workspace/src/notification/NotificationService.ts"]
```

## Error Prevention and Safety

### Breaking Change Analysis
The tool analyzes dependencies before recommending splits:
- **Public API impact assessment**
- **Import/export relationship mapping**
- **Test file dependency tracking**
- **Configuration and build file considerations**

### Gradual Migration Strategies
- **Backward compatibility preservation**
- **Incremental refactoring phases**
- **Feature flag integration for major changes**
- **Rollback planning for critical components**

### Container Environment Considerations
- **Docker build optimization** after refactoring
- **Volume mount impact** on file organization
- **Environment variable** configuration updates
- **Service dependency** management in containerized environments

## When to Use Refactor vs Other Zenode Tools

- **Use `zenode:refactor`** for: Structural improvements, code organization, modernization, decomposition
- **Use `zenode:codereview`** for: Finding bugs, security issues, immediate quality problems
- **Use `zenode:analyze`** for: Understanding code structure without making change recommendations
- **Use `zenode:debug`** for: Solving specific runtime issues rather than structural improvements
- **Use `zenode:precommit`** for: Validating refactored code before committing changes

The zenode:refactor tool provides intelligent, priority-driven code improvement strategies that enhance maintainability, performance, and developer productivity while operating safely within zenode's containerized development environment.