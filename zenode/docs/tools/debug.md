# Debug Tool - Expert Debugging & Root Cause Analysis

**High-capacity debugging for complex Node.js/TypeScript issues**

The `zenode:debug` tool provides expert debugging capabilities through zenode's multi-provider architecture with up to 1M token capacity. It specializes in finding root causes, tracing errors, and diagnosing complex issues in containerized environments with comprehensive context analysis.

## Thinking Mode

**Default is `medium` (33% of model max).** Use `high` for tricky bugs (investment in finding root cause) or `low` for simple errors (save tokens). Zenode's extended reasoning models provide deep analysis capabilities.

## Example Prompts

**Basic Usage:**
```bash
# Simple error debugging
zenode:debug "API returns 400 errors randomly" --error-context "TypeError: Cannot read property 'id' of undefined" --model auto

# Using :z coordination for comprehensive debugging
:z "coordinate with zenode:debug and zenode:analyze to investigate this TypeScript compilation error and its root cause"
```

## Key Features

- **High-capacity analysis** with up to 1M token context for large log files
- **Multi-provider debugging** leveraging Gemini, OpenAI, and OpenRouter models  
- **Container-native debugging** with Docker environment awareness
- **TypeScript/Node.js expertise** for modern JavaScript ecosystem issues
- **Comprehensive context support**: Stack traces, logs, runtime information
- **Visual debugging**: Error screenshots, console output, stack traces via zenode:seer
- **Conversation threading** with Redis persistence for extended debugging sessions
- **Web search integration** via zenode:visit for current solutions and documentation
- **Large file support**: Full log files, memory dumps, diagnostic outputs
- **Environment analysis**: Docker, Node.js versions, package dependencies

## Tool Parameters

- `prompt`: Error message, symptoms, or issue description (required)
- `model`: auto|pro|flash|o3|o3-mini|o4-mini|o4-mini-high (default: auto)
- `error_context`: Stack trace, logs, or additional error context
- `files`: Files or directories related to the issue (absolute `/workspace/` paths)
- `runtime_info`: Environment, Node.js version, Docker info, package versions
- `previous_attempts`: What debugging approaches have been tried already
- `temperature`: Temperature for analysis accuracy (0-1, default 0.2)
- `thinking_mode`: minimal|low|medium|high|max (default: medium)
- `use_websearch`: Enable web search for solutions via zenode:visit (default: true)
- `continuation_id`: Continue debugging sessions with Redis threading

## Usage Examples

**Basic Error Debugging:**
```bash
zenode:debug "TypeError: Cannot read property 'map' of undefined in React component" \
  --error-context "Stack trace: at UserList.render (UserList.tsx:45)" \
  --files ["/workspace/src/components/UserList.tsx"] \
  --model auto
```

**Node.js Server Issues:**
```bash
zenode:debug "Express server crashes randomly under load" \
  --error-context "Error: EMFILE: too many open files" \
  --files ["/workspace/src/server.ts", "/workspace/package.json"] \
  --runtime-info "Node.js 18.17.0, Docker container, 2GB RAM limit" \
  --model pro
```

**TypeScript Compilation Issues:**
```bash
zenode:debug "TypeScript compilation fails with generic constraints" \
  --error-context "TS2344: Type 'string' does not satisfy the constraint 'keyof T'" \
  --files ["/workspace/src/types/api.ts", "/workspace/tsconfig.json"] \
  --model o3
```

**Database Connection Problems:**
```bash
zenode:debug "Prisma database connection timeouts in production" \
  --error-context "Error: P1001: Can't reach database server" \
  --files ["/workspace/src/db/prisma.ts", "/workspace/docker-compose.yml"] \
  --runtime-info "Docker containers, PostgreSQL 14, Redis cache" \
  --previous-attempts "Increased connection pool size, checked network connectivity" \
  --model pro \
  --thinking-mode high
```

**Container Environment Issues:**
```bash
zenode:debug "Application works locally but fails in Docker container" \
  --files ["/workspace/Dockerfile", "/workspace/src/app.ts"] \
  --runtime-info "Node.js 18 Alpine, multi-stage build" \
  --error-context "Module not found errors at runtime" \
  --model auto
```

**Memory Leaks and Performance:**
```bash
zenode:debug "Node.js process memory usage grows continuously" \
  --error-context "Heap used: 2.1GB, RSS: 2.3GB, increasing over time" \
  --files ["/workspace/src/services", "/workspace/src/middleware"] \
  --runtime-info "Node.js 18.17.0, PM2 cluster mode, 4 instances" \
  --model pro \
  --thinking-mode max
```

**Build and Deployment Issues:**
```bash
zenode:debug "Webpack build fails in CI/CD but works locally" \
  --error-context "Module build failed: TypeError: Cannot read property 'charAt' of undefined" \
  --files ["/workspace/webpack.config.js", "/workspace/src"] \
  --runtime-info "GitHub Actions, Node.js 18, npm 9.8.1" \
  --previous-attempts "Cleared node_modules, updated dependencies" \
  --model o3
```

## Zenode-Specific Features

### Container-Aware Debugging
Zenode:debug understands Docker environments:
- **Container file path mapping**: Automatic `/workspace/` path translation
- **Docker environment analysis**: Layer caching, multi-stage builds, volume mounts
- **Service communication**: Inter-container networking, Redis connections
- **Resource constraints**: Memory limits, CPU limits, disk space

### TypeScript/Node.js Expertise
Specialized knowledge of modern JavaScript ecosystems:
- **TypeScript compilation**: Generic constraints, strict null checks, module resolution
- **Node.js runtime**: Event loop, async/await patterns, memory management
- **Package management**: npm, yarn, pnpm dependency resolution issues
- **Build tooling**: webpack, Vite, TypeScript compiler, ESM/CommonJS interop

### High-Capacity Analysis
Handle large diagnostic files efficiently:
```bash
# Include large log files, full stack traces, memory dumps
zenode:debug "Intermittent service crashes" \
  --error-context "$(cat /workspace/logs/error.log)" \
  --files ["/workspace/src/services"] \
  --runtime-info "Docker stats, system metrics" \
  --model pro
```

### Multi-Provider Intelligence
Different models excel at different debugging aspects:
- **Gemini Pro**: Complex system interactions with extended thinking
- **OpenAI O3**: Logical error analysis and algorithmic debugging
- **Auto mode**: Intelligent selection based on error complexity

### Redis Conversation Threading
Extended debugging sessions:
```bash
# Start debugging session
debug1 = zenode:debug "initial error analysis" --files ["/workspace/src"]

# Continue with deeper investigation
debug2 = zenode:debug "analyze the database connection issue specifically" \
  --continuation-id {debug1.continuation_id} \
  --focus-on "connection pooling and timeouts"
```

## Advanced Debugging Patterns

### Microservices Debugging
```bash
zenode:debug "Service A cannot communicate with Service B" \
  --files ["/workspace/services/a", "/workspace/services/b", "/workspace/docker-compose.yml"] \
  --error-context "Connection refused errors in logs" \
  --runtime-info "Docker Compose network, service discovery" \
  --model pro \
  --thinking-mode high
```

### Performance Profiling
```bash
zenode:debug "API response times degrading under load" \
  --error-context "Response times: 50ms -> 5000ms over 1 hour" \
  --files ["/workspace/src/api", "/workspace/src/middleware"] \
  --runtime-info "Node.js profiler output, memory snapshots" \
  --previous-attempts "Added caching, optimized queries" \
  --model pro \
  --use-websearch true
```

### Security Issue Investigation
```bash
zenode:debug "Potential security vulnerability in authentication" \
  --error-context "JWT tokens appear to be accepted after expiration" \
  --files ["/workspace/src/auth", "/workspace/src/middleware/jwt.ts"] \
  --runtime-info "Express.js, jsonwebtoken library v9.0.0" \
  --model o3 \
  --thinking-mode high
```

### Build System Debugging
```bash
zenode:debug "Monorepo build fails with circular dependency errors" \
  --error-context "Error: Circular dependency detected between packages" \
  --files ["/workspace/packages", "/workspace/turbo.json"] \
  --runtime-info "Turborepo, TypeScript project references" \
  --model auto
```

## Integration with Other Zenode Tools

### Comprehensive Issue Analysis
```bash
# Step 1: Code analysis for context
zenode:analyze "understand the architecture around this error" --files ["/workspace/src"]

# Step 2: Debug the specific issue
zenode:debug "investigate the runtime error" --continuation-id {analysis_id} --error-context "stack trace"

# Step 3: Deep thinking on solutions
zenode:thinkdeep "analyze debugging findings and propose solutions" --continuation-id {debug_id}
```

### Multi-Tool Coordination
```bash
:z "coordinate with zenode:debug, zenode:analyze, and zenode:codereview to investigate this production issue and ensure the fix doesn't introduce new problems"
```

### Visual Error Analysis
```bash
# Use zenode:seer for visual debugging
zenode:seer "analyze this error dialog screenshot" --images ["/workspace/screenshots/error.png"]

# Then debug the underlying code
zenode:debug "investigate the error shown in the screenshot" \
  --continuation-id {seer_id} \
  --files ["/workspace/src/error-handling"]
```

## Best Practices for Zenode

### Comprehensive Context
- **Include all relevant files**: Source code, configuration, logs
- **Provide runtime information**: Node.js version, Docker setup, environment variables
- **Share error context**: Full stack traces, console output, error logs
- **Document previous attempts**: What has been tried and failed

### Efficient Debugging
- **Use workspace paths**: Always provide `/workspace/` prefixed paths
- **Start with auto mode**: Let zenode choose optimal models for error types
- **Leverage high-capacity models**: Include large log files and diagnostic data
- **Continue conversations**: Build comprehensive debugging over multiple interactions

### Container Optimization
- **Include Docker files**: Dockerfile, docker-compose.yml for environment context
- **Check volume mounts**: Ensure files are accessible in `/workspace/`
- **Monitor resource usage**: Include memory, CPU usage in runtime info
- **Verify network connectivity**: Test inter-service communication

## Output Format

Debug analysis includes:
- **Root Cause Analysis**: Detailed explanation of underlying issues
- **Step-by-Step Resolution**: Specific actions to fix the problem
- **Prevention Strategies**: How to avoid similar issues in the future
- **TypeScript/Node.js Insights**: Framework-specific recommendations
- **Container Considerations**: Docker and deployment-specific guidance
- **Testing Approaches**: How to verify the fix works correctly

## When to Use Debug vs Other Zenode Tools

- **Use `zenode:debug`** for: Runtime errors, crashes, performance issues, deployment problems
- **Use `zenode:analyze`** for: Understanding code structure without specific errors
- **Use `zenode:codereview`** for: Finding potential bugs before they occur
- **Use `zenode:thinkdeep`** for: Extending debugging analysis with deeper reasoning
- **Use `zenode:seer`** for: Visual debugging with error screenshots

## Configuration

The debug tool leverages zenode's configuration:
- High-capacity models for large diagnostic files
- Container workspace mapping for Docker environments
- Redis conversation persistence for extended debugging sessions
- Multi-provider fallback for optimal debugging quality

For effective debugging, ensure:
- At least one high-capacity provider (Gemini Pro with 1M context)
- Proper workspace volume mounting for log access
- Container health monitoring and logging enabled

The zenode:debug tool provides enterprise-grade debugging capabilities with deep understanding of modern TypeScript/Node.js applications and containerized deployment environments.