# CodeReview Tool - Professional Code Review

**Comprehensive code analysis with prioritized feedback**

The `zenode:codereview` tool provides professional code review capabilities through zenode's multi-provider architecture. It offers actionable feedback, severity-based issue prioritization, and support for various review types from quick style checks to comprehensive security audits with container-native file access.

## Thinking Mode

**Default is `medium` (33% of model max).** Use `high` for security-critical code (worth the extra tokens) or `low` for quick style checks (saves tokens). Zenode automatically adapts thinking depth based on model capabilities.

## Model Recommendation

This tool particularly benefits from zenode's high-context models (Gemini Pro, OpenAI O3) due to their large context windows, which allow comprehensive analysis of large TypeScript/Node.js codebases. Zenode's multi-provider architecture provides significant value for comprehensive code review.

## Example Prompts

```bash
# Basic security review
zenode:codereview "Review authentication system for security vulnerabilities" --files ["/workspace/src/auth"] --review-type security --model pro

# Using :z coordination for comprehensive review
:z "coordinate with zenode:codereview and zenode:analyze to perform comprehensive code quality assessment of this TypeScript project"
```

## Pro Tip: Multiple Parallel Reviews

**You can orchestrate multiple parallel reviews with different models:**

```bash
:z "coordinate with zenode:codereview using different models - one for critical security issues and one for performance optimizations, then synthesize findings"
```

## Key Features

- **Issues prioritized by severity** (🔴 CRITICAL → 🟢 LOW)
- **Supports specialized reviews**: security, performance, quick, full
- **TypeScript/Node.js expertise**: Tailored for modern JavaScript ecosystems
- **Container-native file access**: Seamless integration with Docker workspace
- **Coding standards enforcement**: ESLint, Prettier, TypeScript compiler checks
- **Severity filtering**: Focus on critical issues for quick wins
- **Multi-file analysis**: Comprehensive review of entire directories or monorepos
- **Actionable feedback**: Specific recommendations with line numbers and code examples
- **Security vulnerability scanning**: Modern web security patterns and anti-patterns
- **Redis conversation threading**: Continue reviews across container restarts
- **Web search integration**: Current best practices via zenode:visit

## Tool Parameters

- `files`: List of file paths or directories to review (required, absolute `/workspace/` paths)
- `prompt`: User's summary of code purpose, expected behavior, constraints, and review objectives (required)
- `model`: auto|pro|flash|o3|o3-mini|o4-mini|o4-mini-high (default: auto)
- `review_type`: full|security|performance|quick (default: full)
- `focus_on`: Specific aspects to focus on (e.g., "security vulnerabilities", "async patterns")
- `standards`: Coding standards to enforce (e.g., "ESLint", "TypeScript strict", "Airbnb Style")
- `severity_filter`: critical|high|medium|all (default: all)
- `temperature`: Temperature for consistency (0-1, default 0.2)
- `thinking_mode`: minimal|low|medium|high|max (default: medium)
- `use_websearch`: Enable web search for best practices via zenode:visit (default: true)
- `continuation_id`: Continue previous review discussions with Redis threading

## Review Types

**Full Review (default):**
- Comprehensive analysis including bugs, security, performance, maintainability
- TypeScript type safety evaluation
- Modern JavaScript/Node.js patterns assessment
- Best for new features or significant code changes

**Security Review:**
- Focused on security vulnerabilities and attack vectors
- JWT handling, authentication, authorization patterns
- Input validation, SQL injection, XSS prevention
- Environment variable and secret management
- Best for authentication, authorization, data handling code

**Performance Review:**
- Analyzes performance bottlenecks and optimization opportunities
- Memory usage, algorithmic complexity, async/await patterns
- Database query optimization, caching strategies
- Bundle size and import analysis
- Best for performance-critical code paths

**Quick Review:**
- Fast style and basic issue check
- TypeScript compilation errors and warnings
- Lower token usage for rapid feedback
- Best for code formatting and simple validation

## Severity Levels

Issues are categorized and prioritized:

- **🔴 CRITICAL**: Security vulnerabilities, crashes, data corruption, type safety violations
- **🟠 HIGH**: Logic errors, performance issues, reliability problems, async/await misuse
- **🟡 MEDIUM**: Code smells, maintainability issues, minor bugs, unused imports
- **🟢 LOW**: Style issues, documentation, minor improvements, formatting

## Usage Examples

**Basic Security Review:**
```bash
zenode:codereview "Review JWT authentication implementation for security vulnerabilities" --files ["/workspace/src/auth"] --review-type security --model pro
```

**TypeScript Performance Review:**
```bash
zenode:codereview "Analyze API layer for performance bottlenecks and async patterns" --files ["/workspace/src/api"] --review-type performance --model o3 --focus-on "database queries and caching"
```

**Quick Style Check:**
```bash
zenode:codereview "Quick review for TypeScript compilation and style issues" --files ["/workspace/src/utils"] --review-type quick --severity-filter high --model flash
```

**Standards Enforcement:**
```bash
zenode:codereview "Enforce ESLint and TypeScript strict mode compliance" --files ["/workspace/src"] --standards "ESLint Airbnb, TypeScript strict mode" --model auto
```

**Full Stack Review:**
```bash
zenode:codereview "Comprehensive review of full-stack TypeScript application" --files ["/workspace/frontend/src", "/workspace/backend/src"] --review-type full --model pro --thinking-mode high
```

**Monorepo Package Review:**
```bash
zenode:codereview "Review shared package for API consistency and exports" --files ["/workspace/packages/shared"] --focus-on "public API design and type definitions" --model auto
```

## Zenode-Specific Features

### Container File Access
Seamless analysis of containerized projects:
```bash
# Auto path conversion for workspace access
zenode:codereview "review authentication" --files ["/workspace/src/auth"]

# Multiple directories and packages
zenode:codereview "review monorepo structure" --files ["/workspace/packages", "/workspace/apps"]
```

### TypeScript-First Analysis
Specialized understanding of modern TypeScript patterns:
- **Type safety evaluation**: Generic constraints, strict null checks, discriminated unions
- **Modern async patterns**: async/await, Promise handling, stream processing
- **Import/export analysis**: Barrel exports, circular dependencies, tree shaking
- **Build tooling**: webpack, Vite, TypeScript compiler options

### Multi-Provider Intelligence
Different models excel at different review aspects:
- **Gemini Pro**: Architectural patterns and system design with extended thinking
- **OpenAI O3**: Logical code flow and algorithmic correctness
- **Auto mode**: Intelligent selection based on codebase complexity

### Redis Conversation Threading
Extended review discussions:
```bash
# Initial review
review1 = zenode:codereview "security audit" --files ["/workspace/src/auth"]

# Follow-up focused review
review2 = zenode:codereview "deeper analysis of JWT implementation" --continuation-id {review1.continuation_id} --focus-on "token refresh and expiration"
```

### Web Search Integration
Current best practices via zenode:visit:
- Security vulnerability databases
- Framework-specific security guides
- Performance optimization techniques
- Modern TypeScript patterns

## Advanced Usage Patterns

### Microservices Security Audit
```bash
zenode:codereview "Security audit of microservices authentication layer" \
  --files ["/workspace/services/auth", "/workspace/shared/middleware"] \
  --review-type security \
  --focus-on "JWT handling, service-to-service auth, rate limiting" \
  --model pro \
  --thinking-mode high
```

### Performance Optimization Review
```bash
zenode:codereview "Performance review focusing on database and caching patterns" \
  --files ["/workspace/src/api", "/workspace/src/db"] \
  --review-type performance \
  --focus-on "N+1 queries, connection pooling, Redis caching" \
  --severity-filter high \
  --model o3
```

### Pre-deployment Quality Gate
```bash
zenode:codereview "Pre-deployment quality check for critical path" \
  --files ["/workspace/src/payment", "/workspace/src/orders"] \
  --review-type full \
  --severity-filter critical \
  --standards "TypeScript strict, ESLint recommended" \
  --model auto
```

### API Design Review
```bash
zenode:codereview "REST API design and implementation review" \
  --files ["/workspace/src/routes", "/workspace/src/controllers"] \
  --focus-on "API consistency, error handling, input validation" \
  --review-type full \
  --model pro
```

### Migration Safety Review
```bash
zenode:codereview "Review JavaScript to TypeScript migration for type safety" \
  --files ["/workspace/src/legacy", "/workspace/src/migrated"] \
  --focus-on "type definitions, null safety, any usage" \
  --review-type full \
  --use-websearch true
```

## Integration with Other Zenode Tools

### Comprehensive Quality Assessment
```bash
# Step 1: Architecture analysis
zenode:analyze "overall architecture" --files ["/workspace/src"] --analysis-type architecture

# Step 2: Code review for quality
zenode:codereview "quality and security review" --files ["/workspace/src"] --continuation-id {analysis_id} --review-type full

# Step 3: Deep thinking on improvements
zenode:thinkdeep "prioritize review findings and create improvement roadmap" --continuation-id {review_id}
```

### Multi-Tool Coordination
```bash
:z "coordinate with zenode:codereview, zenode:analyze, and zenode:precommit to ensure this pull request is ready for production deployment"
```

## Best Practices for Zenode

### Efficient Reviews
- **Use workspace paths**: Always provide `/workspace/` prefixed paths
- **Start with focused reviews**: Security or performance first, then comprehensive
- **Leverage auto mode**: Let zenode choose optimal models for different review types
- **Use appropriate severity filters**: Critical for quick wins, all for thorough review

### TypeScript Optimization
- **Include tsconfig.json**: Helps understand compiler settings and strictness
- **Review type definitions**: Focus on public APIs and shared interfaces
- **Check async patterns**: Ensure proper Promise handling and error management
- **Validate modern patterns**: Generic constraints, utility types, template literals

### Performance Tips
- **Filter file types**: Focus on `.ts`, `.tsx`, `.js`, `.jsx` for code review
- **Use thinking modes wisely**: Low for style checks, high for security audits
- **Batch related files**: Review related modules together for context
- **Continue conversations**: Build comprehensive reviews over multiple interactions

## Output Format

Reviews include:
- **Executive Summary**: Overview of code quality and main concerns
- **Detailed Findings**: Specific issues with severity levels, line numbers, and recommendations
- **TypeScript Insights**: Type safety evaluation and modern pattern usage
- **Security Considerations**: Framework-specific security recommendations
- **Performance Analysis**: Bottlenecks and optimization opportunities
- **Quick Wins**: Easy-to-implement improvements with high impact
- **Long-term Improvements**: Structural changes for better maintainability

## When to Use CodeReview vs Other Zenode Tools

- **Use `zenode:codereview`** for: Finding bugs, security issues, performance problems, code quality assessment
- **Use `zenode:analyze`** for: Understanding code structure without finding issues
- **Use `zenode:debug`** for: Diagnosing specific runtime errors or exceptions
- **Use `zenode:thinkdeep`** for: Extending review analysis with deeper reasoning
- **Use `zenode:precommit`** for: Git-based change validation before commits
- **Use `zenode:testgen`** for: Generating tests for reviewed code

## Configuration

The codereview tool leverages zenode's configuration:
- Model selection with TypeScript-aware defaults
- Container workspace mapping for seamless file access  
- Redis conversation persistence for extended review sessions
- Multi-provider fallback for optimal review quality

For comprehensive reviews, ensure:
- At least one high-capacity provider (Gemini Pro with 1M context)
- Proper workspace volume mounting in Docker
- TypeScript/Node.js project structure recognition

The zenode:codereview tool provides enterprise-grade code analysis capabilities with the performance and reliability of zenode's modern TypeScript architecture.