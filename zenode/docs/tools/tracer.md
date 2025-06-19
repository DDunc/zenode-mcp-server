# Tracer Tool - Static Code Analysis Prompt Generator

**Creates detailed analysis prompts for call-flow mapping and dependency tracing**

The `zenode:tracer` tool is a specialized prompt-generation tool that creates structured analysis requests for comprehensive static code analysis. Rather than consuming tokens on analysis, this tool generates focused prompts that Claude can use with zenode's file access capabilities to efficiently trace execution flows and map dependencies within TypeScript/Node.js codebases.

## Two Analysis Modes

**`precision` Mode**: For methods/functions
- Traces execution flow, call chains, and usage patterns
- Detailed branching analysis and side effects
- Shows when and how functions are called throughout the system
- Perfect for debugging and understanding function behavior

**`dependencies` Mode**: For classes/modules/protocols  
- Maps bidirectional dependencies and structural relationships
- Identifies coupling and architectural dependencies
- Shows how components interact and depend on each other
- Perfect for refactoring and architecture analysis

## Key Features

- **Generates comprehensive analysis prompts** instead of performing analysis directly
- **Token-efficient approach** - creates instructions rather than consuming analysis tokens
- **Container-aware formatting** with `/workspace/` path support
- **TypeScript/Node.js focused** with modern JavaScript pattern recognition
- **Structured output instructions** for consistent call-flow graph generation
- **Supports any programming language** with automatic convention detection
- **Image support**: Visual analysis via zenode:seer integration for diagrams
- **Integration ready**: Output designed for use with other zenode tools

## Tool Parameters

- `prompt`: Detailed description of what to trace and WHY you need this analysis (required)
- `trace_mode`: precision|dependencies (required)
- `images`: Optional images of system architecture diagrams, flow charts (absolute `/workspace/` paths)

## Usage Examples

**TypeScript Method Execution Tracing:**
```bash
zenode:tracer "I need to understand how UserAuthService.authenticate method is called throughout the system and what side effects it has, as I'm debugging authentication timeout issues" --trace-mode precision
```

**React Component Dependency Mapping:**
```bash
zenode:tracer "Map all dependencies for the PaymentForm component to understand its relationships with other components and services" --trace-mode dependencies
```

**Node.js API Endpoint Analysis:**
```bash
zenode:tracer "Trace the execution flow of the POST /api/orders endpoint to understand the complete order processing pipeline" --trace-mode precision
```

**Module Architecture Analysis:**
```bash
zenode:tracer "Analyze the dependencies of the @shared/auth module to understand coupling with other packages in this monorepo" --trace-mode dependencies
```

**With Visual Context:**
```bash
zenode:tracer "Generate analysis prompt for the authentication flow using this sequence diagram" --trace-mode precision --images ["/workspace/docs/auth-flow.png"]
```

**Database Layer Tracing:**
```bash
zenode:tracer "Understand how the UserRepository.findByEmail method flows through the application and what database queries it generates" --trace-mode precision
```

## Precision Mode Output

When using `precision` mode for methods/functions, the tool generates prompts that help Claude create:

**Call Chain Analysis:**
- Method definition location with TypeScript signatures
- All locations where method is invoked
- Direct and indirect callers with import traces
- Call hierarchy and dependency depth
- Async/await pattern usage

**Execution Flow Mapping:**
- Step-by-step execution path through TypeScript code
- Conditional branching and control flow
- Promise chains and async operations
- Side effects and state mutations
- Return value usage patterns

**TypeScript-Specific Analysis:**
- Generic type parameter flow
- Interface and type constraint checking
- Module boundary crossings
- Error handling patterns (try/catch, Promise rejection)

## Dependencies Mode Output

When using `dependencies` mode for classes/modules/protocols, the tool generates prompts for:

**Structural Relationship Mapping:**
- Import/export relationships
- TypeScript interface implementations
- Class inheritance and composition
- Dependency injection patterns

**Bidirectional Dependency Analysis:**
- What the target depends on (outgoing)
- What depends on the target (incoming)
- Circular dependency detection
- Module coupling assessment

**Architecture Impact Assessment:**
- Component isolation analysis
- Service boundary evaluation
- Refactoring impact analysis
- Breaking change assessment

## Zenode-Specific Features

### Container-Native Analysis
The tracer tool generates prompts optimized for zenode's container environment:
- **Workspace path awareness**: Generates instructions for `/workspace/` file access
- **Container tool integration**: Instructions compatible with zenode:gopher file discovery
- **Docker build context**: Considers multi-stage builds and file accessibility

### TypeScript/Node.js Optimization
Specialized instructions for modern JavaScript ecosystems:
- **ESM vs CommonJS**: Module system-aware analysis instructions
- **TypeScript compilation**: Considers build output and source maps
- **Package.json analysis**: Dependency tree and script analysis
- **Monorepo patterns**: Workspace and package boundary analysis

### Integration with Zenode Ecosystem
```bash
# Step 1: Generate analysis prompt
tracer_prompt = zenode:tracer "analyze payment processing flow" --trace-mode precision

# Step 2: Use prompt with file discovery
zenode:gopher --action glob_search --path "/workspace" --pattern "**/payment/**/*.ts"

# Step 3: Execute analysis with discovered files
zenode:analyze "{tracer_prompt}" --files [discovered_files] --model pro

# Step 4: Deep thinking on findings
zenode:thinkdeep "extend the analysis with architectural recommendations" --continuation-id {analysis_id}
```

## Generated Output Format

The tracer tool creates structured prompts that guide Claude to produce:

### For Precision Mode
```
CALL FLOW DIAGRAM - Vertical Indented Style

[UserService::authenticate] (file: /workspace/src/services/user.service.ts, line: 45)
↓
[JWTHelper::verifyToken] (file: /workspace/src/utils/jwt.helper.ts, line: 23)
  ↓
  [TokenValidator::isValid] (file: /workspace/src/auth/validator.ts, line: 67) ? if token_not_expired
  ↓
  [DatabaseService::findUser] (file: /workspace/src/db/database.service.ts, line: 123)
    ↓
    [UserRepository::getById] (file: /workspace/src/repositories/user.repo.ts, line: 89)

SIDE EFFECTS:
- [database] User last_login timestamp updated (user.repo.ts:95)
- [cache] User session cached in Redis (auth.service.ts:156)
- [logging] Authentication attempt logged (logger.middleware.ts:78)
```

### For Dependencies Mode
```
DEPENDENCY FLOW DIAGRAM - Bidirectional Arrow Style

AuthMiddleware::validateRequest ←────┐
PaymentController::processPayment ←──┤
UserController::getProfile ←─────────┤
                                     │
                        [USER_SERVICE]
                                     │
                                     ├────→ DatabaseService::query
                                     ├────→ CacheService::get
                                     └────→ LoggerService::info

TYPE RELATIONSHIPS:
IUserService ──implements──→ [USER_SERVICE] ──uses──→ IUserRepository
UserDTO ──uses──→ [USER_SERVICE] ──uses──→ DatabaseConfig
```

## Advanced Usage Patterns

### Microservices Communication Analysis
```bash
zenode:tracer "Analyze how the OrderService communicates with PaymentService and InventoryService during order processing, including error handling and rollback scenarios" --trace-mode precision
```

### State Management Flow
```bash
zenode:tracer "Map the data flow through our Redux store when a user action triggers a payment process, including async actions and side effects" --trace-mode precision
```

### API Gateway Routing
```bash
zenode:tracer "Trace the request routing through our Express.js middleware stack for authenticated API endpoints" --trace-mode precision
```

### Package Dependency Audit
```bash
zenode:tracer "Map all dependencies of our @company/shared-utils package to assess the impact of upgrading its external dependencies" --trace-mode dependencies
```

## Best Practices for Zenode

### Effective Prompt Generation
- **Be specific about context**: Include the problem you're trying to solve
- **Mention TypeScript patterns**: Generics, interfaces, async patterns
- **Include architecture context**: Microservices, monolith, module structure
- **Specify analysis depth**: Surface-level vs deep dependency analysis

### Integration Workflows
```bash
# Comprehensive analysis workflow
# 1. Generate focused prompt
zenode:tracer "detailed prompt for auth flow analysis" --trace-mode precision

# 2. Discover relevant files
zenode:gopher --action smart_search --path "/workspace" --query "authentication and authorization"

# 3. Execute analysis
zenode:analyze "{generated_prompt}" --files ["/workspace/src/auth"] --model pro

# 4. Review findings
zenode:codereview "review the analyzed authentication flow for security issues" --files ["/workspace/src/auth"]
```

### Container Optimization
- **Use workspace paths** in generated instructions
- **Consider build outputs** for analysis scope
- **Include configuration files** (tsconfig.json, package.json)
- **Account for monorepo structure** in path references

## When to Use Tracer vs Other Zenode Tools

- **Use `zenode:tracer`** for: Generating structured analysis prompts, preparing complex code analysis tasks
- **Use `zenode:analyze`** for: Direct code analysis with existing context
- **Use `zenode:debug`** for: Runtime error investigation and troubleshooting
- **Use `zenode:thinkdeep`** for: Extending analysis with deeper architectural reasoning
- **Use `zenode:gopher`** for: File discovery before using tracer-generated prompts

## Output Integration

The tracer tool's output is designed to be used with:
- **Claude's direct analysis**: Copy the generated prompt and use with relevant files
- **Zenode:analyze**: Feed the structured prompt as analysis instructions
- **Documentation**: Use the formatting guidelines for architecture documentation
- **Code reviews**: Include in review templates for consistent analysis

The zenode:tracer tool provides a token-efficient approach to comprehensive code analysis, leveraging zenode's container architecture and TypeScript expertise to generate precise analysis instructions for complex codebases.