# Analyze Tool - Smart File Analysis

**General-purpose code understanding and exploration**

The `zenode:analyze` tool provides comprehensive code analysis and understanding capabilities through zenode's TypeScript architecture. It helps you explore codebases, understand architecture, and identify patterns across files and directories with container-native file access.

## Thinking Mode

**Default is `medium` (33% of model max).** Use `high` for architecture analysis (comprehensive insights worth the cost) or `low` for quick file overviews (save tokens). Zenode automatically adapts thinking depth based on model capabilities.

## Example Prompts

**Basic Usage:**
```bash
zenode:analyze "Understand how this TypeScript application works" --files ["/workspace/src/app.ts"] --model auto

# Using :z coordination for comprehensive analysis
:z "coordinate with zenode:analyze and zenode:thinkdeep to analyze the architecture of this Node.js project"
```

## Key Features

- **Analyzes single files or entire directories** with intelligent TypeScript/JavaScript filtering
- **Supports specialized analysis types**: architecture, performance, security, quality, general
- **Container-native file access** through zenode's `/workspace/` path mapping
- **Pattern identification**: Design patterns, anti-patterns, refactoring opportunities
- **Large codebase support**: Handle massive codebases with 1M token context models
- **Cross-file relationship mapping**: Understand dependencies and imports
- **Architecture visualization**: Describe Node.js/TypeScript system structure
- **Image support**: Analyze diagrams via zenode:seer integration
- **Web search capability**: Enhanced with zenode:visit for current best practices
- **Multi-provider intelligence**: Leverages Gemini, OpenAI, and OpenRouter models

## Tool Parameters

- `files`: Files or directories to analyze (required, absolute `/workspace/` paths)
- `prompt`: What to analyze or look for (required)
- `model`: auto|pro|flash|o3|o3-mini|o4-mini|o4-mini-high (default: auto)
- `analysis_type`: architecture|performance|security|quality|general (default: general)
- `output_format`: summary|detailed|actionable (default: detailed)
- `temperature`: Temperature for analysis (0-1, default 0.2)
- `thinking_mode`: minimal|low|medium|high|max (default: medium)
- `use_websearch`: Enable web search via zenode:visit (default: true)
- `continuation_id`: Continue previous analysis sessions with Redis threading

## Analysis Types

**General Analysis (default):**
- TypeScript/JavaScript code structure and organization
- Key components and their responsibilities
- Data flow and control flow
- Design patterns and architectural decisions
- Import/export dependency analysis

**Architecture Analysis:**
- System-level design and component relationships
- Module dependencies and coupling analysis
- Separation of concerns and layering
- Scalability and maintainability considerations
- Container and deployment architecture

**Performance Analysis:**
- Potential bottlenecks and optimization opportunities
- Algorithmic complexity assessment
- Memory usage patterns in Node.js
- Async/await patterns and Promise handling
- Database and I/O interaction efficiency

**Security Analysis:**
- Security patterns and potential vulnerabilities
- Input validation and sanitization
- Authentication and authorization mechanisms
- Environment variable and secret handling
- TypeScript type safety contributions

**Quality Analysis:**
- Code quality metrics and maintainability
- Testing coverage and patterns (Jest, Vitest)
- Documentation completeness
- TypeScript best practices adherence
- Modern JavaScript/Node.js patterns

## Usage Examples

**Single File Analysis:**
```bash
zenode:analyze "Understand the authentication flow in this controller" --files ["/workspace/src/auth/auth.controller.ts"] --model auto
```

**Directory Architecture Analysis:**
```bash
zenode:analyze "Analyze the overall architecture and identify main components" --files ["/workspace/src"] --analysis-type architecture --model pro
```

**Performance-Focused Analysis:**
```bash
zenode:analyze "Identify performance bottlenecks, especially async patterns" --files ["/workspace/src/api"] --analysis-type performance --model o3
```

**Security Assessment:**
```bash
zenode:analyze "Analyze authentication and authorization patterns for security issues" --files ["/workspace/src/auth"] --analysis-type security --model pro --thinking-mode high
```

**Package and Dependencies Analysis:**
```bash
zenode:analyze "Analyze project dependencies and package structure" --files ["/workspace/package.json", "/workspace/src"] --analysis-type quality
```

**Multi-Directory Analysis:**
```bash
zenode:analyze "Compare frontend and backend architectures" --files ["/workspace/frontend/src", "/workspace/backend/src"] --analysis-type architecture --output-format actionable
```

**Visual + Code Analysis:**
```bash
# Use zenode:seer for diagram analysis, then analyze code
zenode:seer "Analyze this system architecture diagram" --images ["/workspace/docs/architecture.png"]
# Then: zenode:analyze "Compare code with architectural diagram" --files ["/workspace/src"] --continuation-id {seer_id}
```

## Zenode-Specific Features

### Container File Access
Seamless analysis of containerized projects:
```bash
# Auto path conversion
zenode:analyze "analyze this project" --files ["/workspace/my-app/src"]

# Multiple directories
zenode:analyze "compare these modules" --files ["/workspace/frontend", "/workspace/backend"]
```

### TypeScript-First Analysis
Specialized understanding of modern JavaScript/TypeScript patterns:
- **Type inference analysis**: How TypeScript types flow through the system
- **Modern async patterns**: async/await, Promise handling, stream processing
- **Module system**: ESM imports, CommonJS compatibility
- **Build tooling**: webpack, Vite, TypeScript compilation targets

### Multi-Provider Intelligence
Different models excel at different analysis types:
- **Gemini Pro**: Architecture and system design with extended thinking
- **OpenAI O3**: Logical code flow and algorithmic analysis
- **Auto mode**: Intelligent selection based on analysis complexity

### Integration with Zenode Ecosystem
```bash
# Coordinate with other tools
:z "coordinate with zenode:analyze, zenode:codereview, and zenode:thinkdeep to comprehensively evaluate this codebase"

# Follow up analysis with code review
zenode:analyze "understand the architecture" --files ["/workspace/src"]
# Then: zenode:codereview --files ["/workspace/src"] --continuation-id {analysis_id}
```

## Advanced Usage Patterns

### Microservices Architecture Analysis
```bash
zenode:analyze "Analyze microservices architecture and service boundaries" \
  --files ["/workspace/services"] \
  --analysis-type architecture \
  --output-format actionable \
  --thinking-mode high
```

### Migration Assessment
```bash
zenode:analyze "Assess migration from JavaScript to TypeScript" \
  --files ["/workspace/src"] \
  --analysis-type quality \
  --model pro \
  --use-websearch true
```

### Monorepo Analysis
```bash
zenode:analyze "Analyze monorepo structure and inter-package dependencies" \
  --files ["/workspace/packages", "/workspace/apps"] \
  --analysis-type architecture \
  --output-format detailed
```

### API Design Analysis
```bash
zenode:analyze "Analyze REST API design patterns and consistency" \
  --files ["/workspace/src/routes", "/workspace/src/controllers"] \
  --analysis-type architecture \
  --focus-areas ["api-design", "consistency", "error-handling"]
```

### Testing Strategy Analysis
```bash
zenode:analyze "Evaluate testing strategy and coverage patterns" \
  --files ["/workspace/src", "/workspace/tests"] \
  --analysis-type quality \
  --output-format actionable
```

## Output Formats

### Summary Format
Concise overview highlighting key findings:
```bash
zenode:analyze "quick overview of this codebase" --files ["/workspace/src"] --output-format summary
```

### Detailed Format (Default)
Comprehensive analysis with examples and explanations:
```bash
zenode:analyze "thorough architecture analysis" --files ["/workspace/src"] --output-format detailed
```

### Actionable Format
Specific recommendations and next steps:
```bash
zenode:analyze "what should I improve in this code?" --files ["/workspace/src"] --output-format actionable
```

## Best Practices for Zenode

### Efficient Analysis
- **Use workspace paths**: Always provide `/workspace/` prefixed paths
- **Start with directories**: Analyze `/workspace/src` before drilling into specific files
- **Leverage auto mode**: Let zenode choose optimal models for different analysis phases
- **Use appropriate output formats**: Summary for overviews, actionable for improvements

### Performance Optimization
- **Filter file types**: Focus on `.ts`, `.js`, `.tsx`, `.jsx` for code analysis
- **Use thinking modes wisely**: Low for quick scans, high for deep architecture analysis
- **Batch related analyses**: Analyze related directories together for context

### Integration Patterns
```bash
# Progressive analysis workflow
# 1. High-level architecture
zenode:analyze "overall architecture" --files ["/workspace/src"] --analysis-type architecture --output-format summary

# 2. Deep dive into specific areas
zenode:analyze "detailed authentication analysis" --files ["/workspace/src/auth"] --analysis-type security --thinking-mode high

# 3. Code review for quality
zenode:codereview --files ["/workspace/src/auth"] --continuation-id {analysis_id}
```

## When to Use Analyze vs Other Zenode Tools

- **Use `zenode:analyze`** for: Understanding code structure, exploring unfamiliar codebases, architecture assessment
- **Use `zenode:codereview`** for: Finding bugs, security issues, code quality problems
- **Use `zenode:debug`** for: Troubleshooting specific errors and runtime issues
- **Use `zenode:thinkdeep`** for: Extending analysis with deeper reasoning
- **Use `zenode:seer`** for: Visual diagram and image analysis
- **Use `zenode:chat`** for: Open-ended discussions about code

## Configuration

The analyze tool leverages zenode's configuration:
- Model selection from `src/config.ts` with TypeScript-aware defaults
- Container workspace mapping for seamless file access
- Redis conversation persistence for extended analysis sessions
- Multi-provider fallback for optimal analysis quality

For best results, ensure:
- At least one high-capacity provider (Gemini Pro with 1M context)
- Proper workspace volume mounting in Docker
- TypeScript/Node.js project structure recognition

The zenode:analyze tool provides enterprise-grade code analysis capabilities with the performance and reliability of zenode's modern TypeScript architecture.