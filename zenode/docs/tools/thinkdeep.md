# ThinkDeep Tool - Extended Reasoning Partner

**Get a second opinion to augment Claude's own extended thinking**

The `zenode:thinkdeep` tool provides extended reasoning capabilities through zenode's multi-provider architecture. It offers a second perspective to augment Claude's analysis, designed to challenge assumptions, find edge cases, and provide alternative approaches to complex problems.

## Thinking Mode

**Default is `high` (67% of model max) for deep analysis.** Zenode automatically chooses the best model and thinking depth based on complexity:
- `low` for quick validations
- `medium` for standard problems  
- `high` for complex issues (default)
- `max` for extremely complex challenges requiring deepest analysis

## Example Prompt

```bash
# Using :z coordination for comprehensive analysis
:z "coordinate with zenode:thinkdeep and zenode:analyze to think deeper about my authentication design. Use max thinking mode and brainstorm the best architecture."

# Direct zenode usage
zenode:thinkdeep "Extend my analysis of microservices authentication strategy" --model pro --thinking-mode max --focus-areas ["security", "scalability", "maintainability"]
```

## Key Features

- **Multi-provider reasoning** using zenode's Gemini, OpenAI, and OpenRouter models
- **Provides a second opinion** on Claude's analysis with different AI perspectives
- **Challenges assumptions** and identifies edge cases Claude might miss
- **Offers alternative perspectives** through zenode's model diversity
- **Validates architectural decisions** with TypeScript/Node.js focus
- **File reference support**: `"Use zenode:thinkdeep with context from /workspace/api/routes.ts"`
- **Image support**: Analyze architectural diagrams via zenode:seer integration
- **Enhanced critical evaluation**: Multi-stage analysis with different AI models
- **Web search capability**: Integrated with zenode:visit for current documentation
- **Conversation persistence**: Redis-based threading for extended discussions

## Tool Parameters

- `prompt`: Your current thinking/analysis to extend and validate (required)
- `model`: auto|pro|flash|o3|o3-mini|o4-mini|o4-mini-high (default: auto)
- `problem_context`: Additional context about the problem or goal
- `focus_areas`: Array of specific aspects to focus on (architecture, performance, security, etc.)
- `files`: Optional file paths for additional context (absolute `/workspace/` paths)
- `images`: Optional images for visual analysis (delegates to zenode:seer)
- `temperature`: Temperature for creative thinking (0-1, default 0.7)
- `thinking_mode`: minimal|low|medium|high|max (default: high)
- `use_websearch`: Enable web search via zenode:visit (default: true)
- `continuation_id`: Continue previous conversations with Redis threading

## Usage Examples

**Architecture Design:**
```bash
zenode:thinkdeep "Extend my analysis of microservices vs monolith for Node.js API" --model pro --thinking-mode max
```

**With File Context:**
```bash
zenode:thinkdeep "Think deeper about my TypeScript API design" --files ["/workspace/src/api/routes.ts", "/workspace/src/models/user.ts"] --model auto
```

**Visual Analysis (via zenode:seer integration):**
```bash
zenode:thinkdeep "Think deeper about this system architecture diagram - identify potential bottlenecks" --images ["/workspace/docs/architecture.png"] --model pro
```

**Problem Solving:**
```bash
zenode:thinkdeep "Extend analysis of GraphQL vs REST trade-offs for my TypeScript backend" --model o3 --thinking-mode high --focus-areas ["performance", "developer-experience", "scalability"]
```

**Code Review Enhancement:**
```bash
zenode:thinkdeep "Think deeper about security implications of this authentication implementation" --files ["/workspace/src/auth/jwt.ts"] --focus-areas ["security"] --model pro
```

**Coordinated Analysis:**
```bash
:z "coordinate with zenode:thinkdeep, zenode:analyze, and zenode:codereview to comprehensively evaluate this database design pattern"
```

## Zenode-Specific Features

### Multi-Provider Intelligence
Zenode:thinkdeep leverages different AI models for diverse perspectives:
- **Gemini Pro**: Extended thinking modes with up to 1M context
- **OpenAI O3/O4**: Strong logical reasoning capabilities
- **Auto mode**: Intelligent model selection based on task complexity

### Container Integration
Seamless file access with Docker workspace:
```bash
# Auto path conversion: /Users/you/project/src → /workspace/project/src
zenode:thinkdeep "analyze this architecture" --files ["/workspace/project/src/app.ts"]
```

### Redis Conversation Threading
Extended discussions persist across container restarts:
```bash
# Start deep analysis
response1 = zenode:thinkdeep "Initial architecture analysis" --model pro

# Continue complex discussion later
response2 = zenode:thinkdeep "Now extend to consider scaling challenges" --continuation-id {response1.continuation_id}
```

### Tool Coordination
Works seamlessly with other zenode tools:
```bash
# ThinkDeep can suggest follow-up actions
zenode:thinkdeep "Evaluate this API design pattern" --files ["/workspace/src/api"]
# Response might suggest: "Would you like me to coordinate with zenode:codereview for security analysis?"
```

## Enhanced Critical Evaluation Process

Zenode:thinkdeep provides a sophisticated multi-stage analysis:

1. **Primary Model Analysis**: Deep reasoning with specialized thinking capabilities
2. **Alternative Perspective**: Different AI model provides contrasting viewpoint
3. **Synthesis and Validation**: Final integration considering:
   - Node.js/TypeScript best practices
   - Container deployment patterns
   - Modern web development constraints
   - Performance and scalability factors

## Best Practices for Zenode

- **Provide detailed context**: Share current thinking, constraints, and Node.js project specifics
- **Use workspace paths**: Always provide `/workspace/` prefixed paths for file access
- **Leverage auto mode**: Let zenode select optimal models for different analysis phases
- **Coordinate with other tools**: Use `:z` for comprehensive multi-tool analysis
- **Include TypeScript context**: Reference interfaces, types, and modern JavaScript patterns
- **Utilize conversation threading**: Build complex analyses over multiple interactions

## Integration Patterns

### With Code Analysis
```bash
# Step 1: Basic code analysis
zenode:analyze "What's the architecture pattern?" --files ["/workspace/src"] --output-format summary

# Step 2: Deep thinking extension
zenode:thinkdeep "Extend the architecture analysis - what are the scaling implications?" --continuation-id {analysis_id} --thinking-mode high
```

### With Visual Design
```bash
# Step 1: Visual analysis via seer
zenode:seer "Analyze this system diagram" --images ["/workspace/docs/architecture.png"]

# Step 2: Deep architectural thinking
zenode:thinkdeep "Think deeper about the architectural patterns shown in the diagram analysis" --continuation-id {seer_id} --focus-areas ["scalability", "maintainability"]
```

### With Multi-Tool Coordination
```bash
# Complex architectural evaluation
:z "coordinate with zenode:thinkdeep, zenode:analyze, and zenode:codereview to comprehensively evaluate whether to refactor from Express.js to Fastify"
```

## Advanced Usage Patterns

### Performance Optimization Analysis
```bash
zenode:thinkdeep "Extend analysis of Node.js performance bottlenecks in this codebase" \
  --files ["/workspace/src/server.ts", "/workspace/src/middleware"] \
  --focus-areas ["performance", "memory-usage", "async-patterns"] \
  --thinking-mode max
```

### Security Deep Dive
```bash
zenode:thinkdeep "Think deeper about authentication security in this TypeScript implementation" \
  --files ["/workspace/src/auth"] \
  --focus-areas ["security", "jwt-handling", "session-management"] \
  --model pro \
  --use-websearch true
```

### Architecture Decision Records
```bash
zenode:thinkdeep "Extend analysis for ADR: Should we adopt GraphQL Federation?" \
  --problem-context "Microservices architecture with 5 teams" \
  --focus-areas ["developer-experience", "performance", "complexity"] \
  --thinking-mode high
```

## When to Use ThinkDeep vs Other Zenode Tools

- **Use `zenode:thinkdeep`** for: Extending specific analysis, challenging assumptions, architectural decisions, deep reasoning
- **Use `zenode:chat`** for: Open-ended brainstorming, general discussions, quick questions
- **Use `zenode:analyze`** for: Understanding existing code structure without extending analysis
- **Use `zenode:codereview`** for: Finding specific bugs and security issues
- **Use `zenode:debug`** for: Troubleshooting specific errors and issues
- **Use `zenode:seer`** for: Dedicated image and visual content analysis

## Configuration

ThinkDeep respects zenode's configuration:
- Model selection from `src/config.ts`
- Default thinking mode from `DEFAULT_THINKING_MODE_THINKDEEP`
- Temperature defaults by tool category
- Redis conversation persistence settings

For optimal deep thinking, ensure:
- At least one high-capability provider (Gemini Pro, OpenAI O3)
- Redis container running for conversation persistence
- Sufficient container memory for complex reasoning

## Performance Considerations

### Model Selection Strategy
```bash
# For quick validation
zenode:thinkdeep "brief check of this approach" --model flash --thinking-mode low

# For complex architecture decisions
zenode:thinkdeep "comprehensive evaluation needed" --model pro --thinking-mode max

# Auto mode adapts automatically
zenode:thinkdeep "evaluate this design pattern" --model auto  # Zenode chooses optimal model
```

### Resource Management
- **High thinking modes** use more tokens and time
- **Container memory** may need adjustment for max mode
- **Redis persistence** enables resuming complex analyses
- **Multi-provider fallback** ensures availability

The zenode:thinkdeep tool represents a significant advancement in AI-powered reasoning, combining multiple AI perspectives with zenode's robust TypeScript architecture and container-based deployment.