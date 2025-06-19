# TestGen Tool - Comprehensive Test Generation

**Creates thorough test suites with edge case coverage and framework-specific patterns**

The `zenode:testgen` tool generates comprehensive test suites by analyzing code paths, identifying realistic failure modes, and creating tests that follow project conventions. With intelligent pattern detection and multi-framework support, it produces maintainable tests that cover real-world scenarios and edge cases.

## Key Features

- **Multi-agent workflow** analyzing code paths and identifying realistic failure modes
- **Framework-specific generation** following project testing conventions automatically
- **Pattern following capability** when existing test examples are provided
- **Dynamic token allocation** (25% for test examples, 75% for target code)
- **Intelligent test selection** prioritizing smallest, most focused example tests
- **Edge case identification** with systematic boundary condition discovery
- **Container-native operations** optimized for zenode's Docker environment
- **Cross-language support** for TypeScript, Python, Java, Go, Swift, and more
- **Integration test generation** covering component interactions and system boundaries

## Tool Parameters

### Required Parameters
- `files`: Code files/directories to generate tests for (must be absolute `/workspace/` paths)
- `prompt`: Testing objectives, scope, and specific focus areas

### Enhancement Parameters
- `test_examples`: Existing test files/directories for pattern reference (absolute paths)
- `thinking_mode`: minimal|low|medium|high|max (default: medium)
- `model`: AI model for test generation (auto|pro|flash|o3|o3-mini|o4-mini|o4-mini-high)
- `continuation_id`: Continue previous test generation discussions

## Usage Examples

### Method-Specific Test Generation
```bash
# Generate comprehensive tests for authentication method
zenode:testgen "Generate thorough tests for User.authenticate() method covering success scenarios, authentication failures, input validation, and security edge cases" --files ["/workspace/src/auth/User.ts"] --model pro --thinking-mode high

# Test specific business logic with edge cases
zenode:testgen "Create tests for calculateShippingCost() function focusing on edge cases like invalid addresses, weight limits, and international shipping rules" --files ["/workspace/src/shipping/calculator.ts"] --model o3
```

### Class-Level Test Suite Generation
```bash
# Comprehensive class testing with integration aspects
zenode:testgen "Generate complete test suite for PaymentProcessor class including unit tests for individual methods and integration tests for payment flow" --files ["/workspace/src/payment/PaymentProcessor.ts"] --model pro --thinking-mode max

# Service layer testing with dependency management
zenode:testgen "Create tests for UserService class focusing on database interactions, caching behavior, and error handling" --files ["/workspace/src/services/UserService.ts"] --test-examples ["/workspace/tests/services/AuthService.test.ts"] --model o3
```

### Framework Pattern Following
```bash
# Follow existing Jest patterns
zenode:testgen "Generate tests for notification system following our established Jest testing patterns and mock strategies" --files ["/workspace/src/notifications"] --test-examples ["/workspace/tests/unit/auth", "/workspace/tests/integration/user"] --model pro

# Python pytest pattern adoption
zenode:testgen "Create pytest tests for data processing pipeline following existing test structure and fixture patterns" --files ["/workspace/python/data_processor.py"] --test-examples ["/workspace/tests/unit"] --model o3 --thinking-mode high
```

### UI Component Testing
```bash
# React component testing with user interactions
zenode:testgen "Generate React Testing Library tests for LoginForm component covering user input validation, form submission, error states, and accessibility" --files ["/workspace/src/components/LoginForm.tsx"] --test-examples ["/workspace/tests/components"] --model pro

# Vue component testing with Vitest
zenode:testgen "Create Vitest tests for ProductCard component testing props, events, computed properties, and visual states" --files ["/workspace/src/components/ProductCard.vue"] --model o3
```

### API Endpoint Testing
```bash
# Express.js API testing
zenode:testgen "Generate comprehensive tests for REST API endpoints in user router covering authentication, validation, error responses, and edge cases" --files ["/workspace/src/routes/users.ts"] --test-examples ["/workspace/tests/api"] --model pro --thinking-mode high

# GraphQL resolver testing
zenode:testgen "Create tests for GraphQL resolvers focusing on query validation, authorization, data fetching, and error handling" --files ["/workspace/src/graphql/resolvers"] --model o3
```

### Algorithm and Utility Testing
```bash
# Complex algorithm testing
zenode:testgen "Generate exhaustive tests for sorting algorithm including performance characteristics, edge cases with empty arrays, single elements, already sorted data, and reverse sorted data" --files ["/workspace/src/utils/advanced-sort.ts"] --model o3 --thinking-mode max

# Utility function testing
zenode:testgen "Create tests for validation utilities covering all supported input types, boundary conditions, and malformed input scenarios" --files ["/workspace/src/utils/validators.ts"] --model pro
```

## Zenode-Specific Features

### Container-Native Test Generation
The testgen tool operates within zenode's Docker environment:
- **Workspace path awareness**: All file paths use `/workspace/` prefix for container access
- **Volume-mounted test files**: Access to existing tests via Docker volume mounts
- **Build context integration**: Considers Docker build patterns and test execution environment
- **Test runner compatibility**: Generates tests compatible with containerized test execution

### TypeScript/Node.js Optimization
Specialized test generation for modern JavaScript ecosystems:
- **Jest/Vitest integration**: Automatic framework detection and appropriate test syntax
- **TypeScript type testing**: Tests for type safety, interface compliance, and generic constraints
- **ESM/CommonJS patterns**: Module system-aware import/export testing
- **Node.js async patterns**: Comprehensive async/await and Promise testing

### Framework Detection and Adaptation
```bash
# Automatic framework detection based on project structure

# Jest (package.json contains jest)
zenode:testgen "create tests" --files ["/workspace/src/component.ts"]
# Generates: describe/it blocks with Jest matchers

# Vitest (vite.config.js present)
zenode:testgen "create tests" --files ["/workspace/src/utils.ts"] 
# Generates: Vitest-specific syntax and utilities

# Pytest (Python files, pytest in requirements)
zenode:testgen "create tests" --files ["/workspace/python/processor.py"]
# Generates: pytest fixtures and parametrized tests

# Go testing (*.go files)
zenode:testgen "create tests" --files ["/workspace/go/handler.go"]
# Generates: Go testing package conventions
```

### Multi-Language Test Generation
```bash
# TypeScript with comprehensive type testing
zenode:testgen "generate tests with type safety validation" --files ["/workspace/src/types/User.ts"] --model pro

# Python with pytest fixtures and parametrization
zenode:testgen "create pytest tests with fixtures for data processing" --files ["/workspace/python/analyzer.py"] --model o3

# Java with JUnit 5 and Mockito
zenode:testgen "generate JUnit tests for service layer" --files ["/workspace/src/main/java/UserService.java"] --model pro

# Go with table-driven tests
zenode:testgen "create Go tests with table-driven approach" --files ["/workspace/go/calculator.go"] --model o3
```

## Advanced Test Generation Patterns

### Integration Test Creation
```bash
# Database integration testing
zenode:testgen "Generate integration tests for user repository including database transactions, connection handling, and data consistency" --files ["/workspace/src/repositories/UserRepository.ts"] --test-examples ["/workspace/tests/integration"] --model pro --thinking-mode high

# API integration testing  
zenode:testgen "Create end-to-end API tests covering authentication flow, data persistence, and error scenarios" --files ["/workspace/src/api"] --model o3 --thinking-mode max

# Microservice integration testing
zenode:testgen "Generate tests for service communication including message queues, HTTP calls, and failure recovery" --files ["/workspace/src/services/OrderService.ts"] --model pro
```

### Performance and Load Testing
```bash
# Performance benchmarking tests
zenode:testgen "Create performance tests for search algorithm measuring execution time and memory usage with various dataset sizes" --files ["/workspace/src/search/SearchEngine.ts"] --model o3 --thinking-mode high

# Concurrency testing
zenode:testgen "Generate tests for concurrent user access scenarios including race conditions and resource locking" --files ["/workspace/src/cache/CacheManager.ts"] --model pro
```

### Security-Focused Testing
```bash
# Security vulnerability testing
zenode:testgen "Create security-focused tests for authentication system covering injection attacks, privilege escalation, and session security" --files ["/workspace/src/auth"] --model o3 --thinking-mode max --test-examples ["/workspace/tests/security"]

# Input validation security tests
zenode:testgen "Generate tests for input sanitization focusing on XSS prevention, SQL injection, and malformed data handling" --files ["/workspace/src/validators"] --model pro
```

### Error Handling and Resilience Testing
```bash
# Comprehensive error scenario testing
zenode:testgen "Create tests for error handling covering network failures, timeout scenarios, invalid responses, and recovery mechanisms" --files ["/workspace/src/http/HttpClient.ts"] --model pro --thinking-mode high

# System resilience testing
zenode:testgen "Generate tests for system failure scenarios including database outages, service unavailability, and circuit breaker behavior" --files ["/workspace/src/resilience"] --model o3 --thinking-mode max
```

## Test Quality and Coverage Analysis

### Generated Test Categories

**Unit Tests:**
```typescript
// Example generated unit test structure
describe('UserAuthentication', () => {
  describe('validateCredentials', () => {
    it('should return true for valid email and password', async () => {
      // Test implementation with realistic data
    });
    
    it('should reject invalid email formats', async () => {
      // Comprehensive email validation testing
    });
    
    it('should handle password complexity requirements', async () => {
      // Edge cases for password validation
    });
  });
});
```

**Integration Tests:**
```typescript
// Example integration test structure
describe('PaymentProcessingIntegration', () => {
  beforeEach(async () => {
    // Database setup and test data preparation
  });
  
  it('should process payment end-to-end', async () => {
    // Complete payment flow testing
  });
  
  it('should handle payment provider failures gracefully', async () => {
    // External service failure simulation
  });
});
```

**Edge Case Tests:**
```typescript
// Example edge case coverage
describe('EdgeCases', () => {
  it('should handle empty input arrays', () => {
    // Boundary condition testing
  });
  
  it('should process maximum allowed data size', () => {
    // Upper limit testing
  });
  
  it('should gracefully handle malformed JSON', () => {
    // Invalid input resilience
  });
});
```

### Pattern Following Intelligence
When test examples are provided, the tool analyzes:
- **Naming conventions**: Consistent test naming patterns
- **Assertion styles**: Project-specific matcher preferences
- **Setup/teardown patterns**: Database seeding, mock configuration
- **Test data organization**: Fixture management and test data strategies

### Realistic Test Data Generation
```typescript
// Generated test data that represents real scenarios
const testUsers = [
  {
    email: 'user@example.com',
    password: 'SecurePass123!',
    profile: { firstName: 'John', lastName: 'Doe' }
  },
  // Additional realistic test cases...
];
```

## Cross-Tool Integration Workflows

### TestGen → CodeReview → PreCommit
```bash
# Step 1: Generate comprehensive tests
zenode:testgen "create tests for payment processing with edge cases" --files ["/workspace/src/payment"] --model pro --continuation-id {session_id}

# Step 2: Review generated tests for quality
zenode:codereview "review generated tests for completeness and maintainability" --files ["/workspace/tests/payment"] --continuation-id {session_id}

# Step 3: Validate before committing
zenode:precommit "/workspace" "added comprehensive payment processing tests" --continuation-id {session_id}
```

### Analysis → TestGen → Implementation
```bash
# Step 1: Analyze existing code for test gaps
zenode:analyze "identify untested code paths in user service" --files ["/workspace/src/UserService.ts"] --continuation-id {session_id}

# Step 2: Generate targeted tests for gaps
zenode:testgen "create tests for identified untested code paths focusing on error handling and edge cases" --files ["/workspace/src/UserService.ts"] --continuation-id {session_id}

# Step 3: Implement missing functionality if tests reveal issues
# Implementation based on test requirements
```

### Refactor → TestGen → Validation
```bash
# Step 1: Refactor code for better structure
zenode:refactor "decompose large UserController class" --files ["/workspace/src/UserController.ts"] --refactor-type decompose --continuation-id {session_id}

# Step 2: Generate tests for refactored components
zenode:testgen "create tests for newly decomposed user service components" --files ["/workspace/src/user"] --continuation-id {session_id}

# Step 3: Validate refactoring maintains functionality
zenode:precommit "/workspace" "refactored user controller with comprehensive tests" --continuation-id {session_id}
```

## Best Practices for Zenode

### Effective Test Scope Definition
```bash
# ✅ GOOD: Specific scope with clear objectives
zenode:testgen "Generate tests for User.authenticate() method focusing on password validation, account lockout after failed attempts, and two-factor authentication scenarios" --files ["/workspace/src/auth/User.ts"]

# ❌ BAD: Vague, overly broad scope
zenode:testgen "test everything in the auth folder"
```

### Strategic Pattern Reference
```bash
# Use existing high-quality tests as patterns
zenode:testgen "create tests following our established patterns" --files ["/workspace/src/new-feature"] --test-examples ["/workspace/tests/user/UserService.test.ts", "/workspace/tests/integration/auth.test.ts"]

# Reference entire test directories for comprehensive patterns
zenode:testgen "generate tests using project conventions" --files ["/workspace/src/payment"] --test-examples ["/workspace/tests/unit", "/workspace/tests/integration"]
```

### Container Environment Testing
```bash
# Consider containerized test execution
zenode:testgen "create tests that work in Docker environment with proper database connections and environment variables" --files ["/workspace/src/db"] --model pro

# Test generation for CI/CD pipeline compatibility
zenode:testgen "generate tests compatible with GitHub Actions and Docker test runners" --files ["/workspace/src/api"] --model o3
```

### Model Selection for Test Complexity
```bash
# Simple utility function testing
zenode:testgen "basic validation tests" --files ["/workspace/src/utils/helpers.ts"] --model flash --thinking-mode low

# Complex business logic testing
zenode:testgen "comprehensive payment processing tests" --files ["/workspace/src/payment"] --model pro --thinking-mode high

# Critical system component testing
zenode:testgen "exhaustive authentication system tests" --files ["/workspace/src/auth"] --model o3 --thinking-mode max
```

## Framework-Specific Features

### Jest/Vitest Integration
```bash
# Automatic Jest/Vitest detection and syntax generation
zenode:testgen "create React component tests" --files ["/workspace/src/components/Button.tsx"]
# Generates: describe/it blocks, React Testing Library utilities

# Mock generation for external dependencies
zenode:testgen "test service with mocked dependencies" --files ["/workspace/src/ApiService.ts"]
# Generates: jest.mock() declarations and mock implementations
```

### Python pytest Integration
```bash
# Pytest fixture and parametrization
zenode:testgen "create pytest tests with fixtures" --files ["/workspace/python/data_processor.py"]
# Generates: @pytest.fixture, @pytest.mark.parametrize

# Python async testing
zenode:testgen "test async Python functions" --files ["/workspace/python/async_handler.py"]
# Generates: pytest-asyncio compatible tests
```

### Go Testing Integration
```bash
# Table-driven test generation
zenode:testgen "create Go tests with table-driven approach" --files ["/workspace/go/calculator.go"]
# Generates: struct-based test cases with subtests

# Benchmark test generation
zenode:testgen "create Go benchmark tests" --files ["/workspace/go/sort.go"]
# Generates: BenchmarkFunction tests with proper b.N usage
```

## Quality Assurance Features

### Comprehensive Coverage Analysis
The tool generates tests that cover:
- **Happy path scenarios**: Normal operation with valid inputs
- **Error conditions**: Exception handling and failure scenarios
- **Edge cases**: Boundary conditions and unusual inputs
- **Integration points**: Component interactions and external dependencies

### Maintainable Test Code
Generated tests feature:
- **Clear, descriptive test names** that explain what's being tested
- **Well-organized test structure** with logical grouping
- **Appropriate setup/teardown** without excessive boilerplate
- **Realistic test data** that represents actual usage patterns

### Performance Considerations
- **Efficient test execution**: Minimal setup overhead
- **Proper resource cleanup**: Prevent test interference
- **Optimized mocking**: Reduce external dependencies
- **Parallel test compatibility**: Safe concurrent execution

## When to Use TestGen vs Other Zenode Tools

- **Use `zenode:testgen`** for: Creating comprehensive test suites, filling coverage gaps, testing new features
- **Use `zenode:debug`** for: Investigating specific test failures or runtime issues
- **Use `zenode:codereview`** for: Reviewing existing test quality and coverage
- **Use `zenode:analyze`** for: Understanding existing test structure without generating new tests
- **Use `zenode:precommit`** for: Validating test changes before committing

## Error Prevention and Test Quality

The zenode:testgen tool ensures high-quality test generation by:
- **Analyzing actual code paths** rather than generating generic tests
- **Understanding realistic failure modes** from similar codebases
- **Following project conventions** when examples are provided
- **Generating maintainable code** that won't become technical debt
- **Creating tests that actually catch bugs** rather than just improving coverage metrics

The zenode:testgen tool transforms test creation from a tedious manual process into an intelligent, comprehensive, and maintainable testing strategy that enhances code quality and development velocity.