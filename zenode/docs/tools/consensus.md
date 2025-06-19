# Consensus Tool - Multi-Model Perspective Gathering

**Gather diverse perspectives from multiple AI models on technical proposals, plans, and ideas**

The `zenode:consensus` tool orchestrates multiple AI models to provide diverse perspectives on complex decisions. Unlike the Python implementation, zenode:consensus leverages zenode's multi-provider architecture for true AI collaboration with enhanced model coordination and stance steering.

## Key Features

- **Multi-model orchestration** across Gemini, OpenAI, and OpenRouter providers
- **Stance assignment system** (for/against/neutral) for structured debates
- **Custom stance prompts** for precise analysis direction
- **True provider diversity** leveraging zenode's architecture
- **Conversation threading** with Redis persistence
- **Container-native file access** via `/workspace/` paths
- **Instance limits** to prevent overwhelming the system
- **TypeScript type safety** for configuration validation

## Tool Parameters

- `prompt`: Description of what to get consensus on (required)
- `models`: Array of model configurations with stance assignment (required)
- `files`: Optional files for additional context (absolute `/workspace/` paths)
- `images`: Optional images for visual context (delegates to zenode:seer)
- `focus_areas`: Specific aspects to focus on (e.g., 'performance', 'security', 'user experience')
- `temperature`: Temperature for responses (0-1, default 0.2 for consistency)
- `thinking_mode`: Thinking depth for capable models (minimal|low|medium|high|max)
- `use_websearch`: Enable web search for documentation (default: true)
- `continuation_id`: Continue previous consensus discussions

## Model Configuration

Each model in the `models` array can specify:
- `model`: Model name (e.g., 'o3', 'flash', 'pro')
- `stance`: 'for'|'support'|'favor' vs 'against'|'oppose'|'critical' vs 'neutral' (default: 'neutral')
- `stance_prompt`: Custom instructions for this model's analysis approach

### Stance Types

**Supportive Stances:**
- `for`: Generally supportive perspective
- `support`: Emphasizes benefits and opportunities  
- `favor`: Advocates for the proposal

**Critical Stances:**
- `against`: Generally critical perspective
- `oppose`: Emphasizes risks and challenges
- `critical`: Skeptical analysis approach

**Neutral Stance:**
- `neutral`: Balanced, objective analysis (default)

## Usage Examples

### Basic Multi-Model Consensus
```bash
zenode:consensus "Should we migrate from Express.js to Fastify for our API?" \
  --models '[
    {"model": "pro", "stance": "neutral"},
    {"model": "o3", "stance": "neutral"},
    {"model": "flash", "stance": "neutral"}
  ]'
```

### Structured Debate Format
```bash
zenode:consensus "Adopt GraphQL for our frontend data layer" \
  --models '[
    {"model": "pro", "stance": "for", "stance_prompt": "Focus on developer experience benefits and modern API patterns"},
    {"model": "o3", "stance": "against", "stance_prompt": "Emphasize complexity, learning curve, and potential performance impacts"},
    {"model": "flash", "stance": "neutral", "stance_prompt": "Provide balanced analysis of trade-offs"}
  ]'
```

### Architecture Decision with Context
```bash
zenode:consensus "Choose between microservices and modular monolith architecture" \
  --files ["/workspace/src/app.ts", "/workspace/package.json"] \
  --models '[
    {"model": "pro", "stance": "for", "stance_prompt": "Advocate for microservices focusing on scalability and team autonomy"},
    {"model": "o3", "stance": "against", "stance_prompt": "Argue for modular monolith emphasizing simplicity and maintainability"}
  ]' \
  --focus-areas ["scalability", "team-size", "complexity", "deployment"]
```

### Technology Evaluation
```bash
zenode:consensus "Evaluate adopting Deno vs continuing with Node.js" \
  --models '[
    {"model": "pro", "stance": "support"},
    {"model": "o3", "stance": "critical"},
    {"model": "flash", "stance": "neutral"}
  ]' \
  --focus-areas ["performance", "ecosystem", "migration-effort"]
```

### Visual Design Consensus
```bash
zenode:consensus "Choose between these two UI design approaches" \
  --images ["/workspace/designs/option-a.png", "/workspace/designs/option-b.png"] \
  --models '[
    {"model": "pro", "stance": "for", "stance_prompt": "Advocate for option A focusing on user experience"},
    {"model": "o3", "stance": "for", "stance_prompt": "Advocate for option B focusing on technical implementation"},
    {"model": "flash", "stance": "neutral", "stance_prompt": "Compare both options objectively"}
  ]' \
  --focus-areas ["usability", "implementation-complexity", "accessibility"]
```

## Advanced Configuration Examples

### Custom Stance Prompts
```bash
zenode:consensus "Implement server-side rendering for our React app" \
  --models '[
    {
      "model": "pro", 
      "stance": "for",
      "stance_prompt": "You are a performance optimization expert. Focus on SEO benefits, initial load times, and user experience improvements that SSR provides."
    },
    {
      "model": "o3",
      "stance": "against", 
      "stance_prompt": "You are a development productivity specialist. Emphasize the complexity, build pipeline changes, and development overhead that SSR introduces."
    },
    {
      "model": "flash",
      "stance": "neutral",
      "stance_prompt": "You are a technical architect. Provide balanced analysis considering both benefits and costs, with specific focus on our team size and technical constraints."
    }
  ]' \
  --files ["/workspace/src/app.tsx", "/workspace/next.config.js"]
```

### Multi-Provider Diversity
```bash
# Leverage different AI providers for true diversity
zenode:consensus "Choose database technology for new microservice" \
  --models '[
    {"model": "gemini-2.5-pro-preview-06-05", "stance": "for", "stance_prompt": "Advocate for PostgreSQL focusing on ACID compliance and relational benefits"},
    {"model": "openai/o3", "stance": "for", "stance_prompt": "Advocate for MongoDB focusing on flexible schema and development speed"},
    {"model": "anthropic/claude-3-sonnet", "stance": "neutral", "stance_prompt": "Compare both options with focus on long-term maintainability"}
  ]' \
  --focus-areas ["scalability", "consistency", "developer-experience"]
```

## Zenode-Specific Features

### True Multi-Provider Architecture
Unlike single-provider limitations, zenode:consensus can orchestrate:
- **Gemini models**: Deep reasoning with extended thinking
- **OpenAI models**: Strong logical analysis and systematic evaluation  
- **OpenRouter models**: Access to diverse AI architectures
- **Automatic fallback**: If one provider fails, others continue

### Container Integration
Seamless file and image access:
```bash
# Auto path conversion for context files
zenode:consensus "API design decision" \
  --files ["/workspace/src/api/routes.ts"] \
  --models '[{"model": "pro", "stance": "neutral"}]'

# Image analysis integration via zenode:seer
zenode:consensus "UI framework choice" \
  --images ["/workspace/mockups/react.png", "/workspace/mockups/vue.png"] \
  --models '[{"model": "auto", "stance": "neutral"}]'
```

### Redis Conversation Threading
Extended consensus discussions:
```bash
# Initial consensus
consensus1 = zenode:consensus "Initial architecture evaluation" --models '[...]'

# Follow-up detailed analysis
consensus2 = zenode:consensus "Now dive deeper into the security implications" \
  --continuation-id {consensus1.continuation_id} \
  --models '[{"model": "pro", "stance": "critical", "stance_prompt": "Focus on security vulnerabilities"}]'
```

### TypeScript Configuration Validation
Zenode validates model configurations at runtime:
```typescript
// Invalid configurations are caught early
interface ModelConfig {
  model: string;
  stance?: 'for' | 'support' | 'favor' | 'against' | 'oppose' | 'critical' | 'neutral';
  stance_prompt?: string;
}
```

## Instance Limits and Management

Zenode prevents system overload with intelligent limits:
- **Maximum 2 instances** per model+stance combination
- **Total model limit** based on available providers
- **Resource-aware scheduling** to prevent API rate limits
- **Graceful degradation** when limits are reached

```bash
# This configuration respects limits
zenode:consensus "complex decision" \
  --models '[
    {"model": "pro", "stance": "for"},
    {"model": "pro", "stance": "against"},  # 2 pro instances OK
    {"model": "o3", "stance": "neutral"}
  ]'
```

## Best Practices

### Effective Stance Assignment
- **Use neutral as default** for objective analysis
- **Create structured debates** with for/against pairs
- **Write specific stance prompts** for targeted insights
- **Consider domain expertise** in stance assignments

### Model Selection Strategy
```bash
# For technical decisions
--models '[
  {"model": "o3", "stance": "neutral"},      # Logical analysis
  {"model": "pro", "stance": "neutral"},     # Deep reasoning
  {"model": "flash", "stance": "neutral"}    # Quick insights
]'

# For design decisions
--models '[
  {"model": "pro", "stance": "for"},         # Advocate perspective
  {"model": "o3", "stance": "against"},      # Critical analysis
  {"model": "auto", "stance": "neutral"}     # Balanced view
]'
```

### Context Optimization
- **Provide relevant files** for technical context
- **Include images** for visual decisions
- **Set clear focus areas** to guide analysis
- **Use continuation** for complex multi-stage decisions

## Integration Patterns

### With Other Zenode Tools
```bash
# Step 1: Analyze current state
zenode:analyze "Current architecture analysis" --files ["/workspace/src"]

# Step 2: Get consensus on improvements  
zenode:consensus "Based on the analysis, should we refactor to microservices?" \
  --continuation-id {analysis_id} \
  --models '[{"model": "pro", "stance": "for"}, {"model": "o3", "stance": "against"}]'

# Step 3: Deep thinking on the decision
zenode:thinkdeep "Extend the consensus analysis with implementation planning" \
  --continuation-id {consensus_id}
```

### Decision Documentation
```bash
# Comprehensive decision record
:z "coordinate with zenode:consensus, zenode:analyze, and zenode:thinkdeep to create a complete architecture decision record for database technology choice"
```

## Output Format

Zenode:consensus provides structured output:
```json
{
  "decision_topic": "Migration to TypeScript",
  "models_consulted": [
    {"model": "pro", "stance": "for", "perspective": "..."},
    {"model": "o3", "stance": "against", "perspective": "..."},
    {"model": "flash", "stance": "neutral", "perspective": "..."}
  ],
  "synthesis": "Balanced recommendation considering all perspectives",
  "key_factors": ["development_speed", "type_safety", "learning_curve"],
  "recommendation": "Gradual migration with training plan",
  "next_steps": ["Pilot project", "Team training", "Migration timeline"]
}
```

## When to Use Consensus vs Other Tools

- **Use `zenode:consensus`** for: Complex decisions, architecture choices, technology evaluations, getting multiple perspectives
- **Use `zenode:chat`** for: Single-perspective discussions and brainstorming
- **Use `zenode:thinkdeep`** for: Deep analysis from one AI model
- **Use `zenode:analyze`** for: Understanding existing code without decision-making
- **Use `zenode:codereview`** for: Code quality and security assessment

## Configuration

Consensus respects zenode's configuration:
- Provider availability determines model options
- Redis connection for conversation threading
- Container workspace for file access
- Temperature and thinking mode defaults

The zenode:consensus tool represents a breakthrough in AI-assisted decision making, providing genuine multi-perspective analysis through zenode's advanced multi-provider architecture.