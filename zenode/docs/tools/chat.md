# Chat Tool - General Development Chat & Collaborative Thinking

**Your thinking partner - bounce ideas, get second opinions, brainstorm collaboratively**

The `zenode:chat` tool is your collaborative thinking partner for development conversations. It's designed to help you brainstorm, validate ideas, get second opinions, and explore alternatives in a conversational format using the zenode Node.js architecture.

## Thinking Mode

**Default is `medium` (33% of model max).** Use `low` for quick questions to save tokens, or `high` for complex discussions when thoroughness matters. Zenode supports extended thinking modes with models like Gemini Pro.

## Example Prompt

```bash
# Using :z coordination for comprehensive analysis
:z "coordinate with zenode:chat, zenode:thinkdeep, and zenode:analyze to pick the best approach for Redis vs Memcached session storage. Analyze the project context and provide a thorough comparison."

# Direct zenode usage
zenode:chat "I need expert opinions on Redis vs Memcached for session storage in my Node.js app. Consider performance, persistence, and scalability factors." --model pro --thinking-mode high
```

## Key Features

- **Collaborative thinking partner** powered by zenode's multi-provider architecture
- **Get second opinions** from different AI models (Gemini, OpenAI, OpenRouter)
- **Brainstorm solutions** with zenode's conversation threading and Redis persistence
- **Validate your checklists** and implementation plans with context retention
- **General development questions** with Node.js/TypeScript focus
- **Technology comparisons** using zenode's model auto-selection
- **Architecture and design discussions** with zenode tool coordination
- **File reference support**: `"Use zenode:chat with context from /workspace/algorithm.js to explain this implementation"`
- **Image support**: Include screenshots, diagrams, UI mockups via zenode:seer integration
- **Dynamic collaboration**: Can coordinate with other zenode tools during conversation
- **Web search capability**: Integrated with zenode:visit for current documentation and best practices
- **Conversation persistence**: Redis-based threading survives container restarts

## Tool Parameters

- `prompt`: Your question or discussion topic (required)
- `model`: auto|pro|flash|o3|o3-mini|o4-mini|o4-mini-high|openai/gpt-4o (default: auto)
- `files`: Optional files for context (absolute `/workspace/` paths)
- `images`: Optional images for visual context (delegates to zenode:seer)
- `temperature`: Response creativity (0-1, default 0.5)
- `thinking_mode`: minimal|low|medium|high|max (default: medium, varies by model)
- `use_websearch`: Enable web search via zenode:visit (default: true)
- `continuation_id`: Continue previous conversations with Redis threading

## Usage Examples

**Basic Development Chat:**
```bash
zenode:chat "What's the best approach for user authentication in my TypeScript React app?" --model auto
```

**Technology Comparison:**
```bash
zenode:chat "Compare PostgreSQL vs MongoDB for my e-commerce platform. Consider TypeScript integration and scalability." --model pro --thinking-mode high
```

**Architecture Discussion:**
```bash
zenode:chat "Discuss microservices vs monolith architecture for my Node.js project. Factor in Docker deployment and team size." --model flash --use-websearch true
```

**File Context Analysis:**
```bash
zenode:chat "Analyze the current authentication implementation and suggest improvements" --files ["/workspace/src/auth/auth.service.ts"] --model pro
```

**Visual Analysis (delegates to zenode:seer):**
```bash
zenode:chat "Review this UI mockup for usability issues" --images ["/workspace/designs/mockup.png"] --model auto
```

**Coordinated Analysis:**
```bash
:z "coordinate with zenode:chat, zenode:analyze, and zenode:thinkdeep to evaluate this API design pattern"
```

## Zenode-Specific Features

### Container Path Handling
Zenode automatically transforms file paths for Docker container access:
```bash
# Input: /Users/you/project/src/app.ts
# Transformed: /workspace/project/src/app.ts
zenode:chat "Review this code" --files ["/workspace/project/src/app.ts"]
```

### Multi-Provider Intelligence
Zenode's auto mode intelligently selects models based on task complexity:
- **Simple questions**: Fast models (flash, o4-mini)
- **Complex analysis**: Deep reasoning models (pro, o3)
- **Visual content**: Automatically delegates to vision models

### Redis Conversation Threading
Conversations persist across container restarts:
```bash
# Start conversation
response1 = zenode:chat "Explain TypeScript generics" --model pro

# Continue later (even after restart)
response2 = zenode:chat "Now show me advanced generic patterns" --continuation-id {response1.continuation_id}
```

### Tool Coordination
Chat can seamlessly work with other zenode tools:
```bash
# Chat can suggest follow-up actions
zenode:chat "I need to refactor this component for better performance" --files ["/workspace/src/Component.tsx"]
# Response might suggest: "Would you like me to coordinate with zenode:codereview and zenode:refactor for a comprehensive analysis?"
```

## Best Practices for Zenode

- **Use workspace paths**: Always provide `/workspace/` prefixed paths for file access
- **Leverage auto mode**: Let zenode select the optimal model for your task
- **Combine with other tools**: Use `:z` coordination for comprehensive analysis
- **Utilize conversation threading**: Build complex discussions over multiple interactions
- **Include relevant context**: Provide TypeScript/Node.js project files for better advice
- **Coordinate with zenode:visit**: Request current best practices and documentation searches

## Integration Patterns

### With File Analysis
```bash
# Step 1: Analyze codebase structure
zenode:analyze "What's the overall architecture?" --files ["/workspace/src"] --output-format summary

# Step 2: Discuss improvements
zenode:chat "Based on the analysis, how can we improve the architecture for better testability?" --continuation-id {analysis_id}
```

### With Visual Design
```bash
# Step 1: Visual analysis
zenode:seer "Analyze this UI design for accessibility issues" --images ["/workspace/designs/ui.png"]

# Step 2: Discussion and iteration
zenode:chat "How can we implement the accessibility improvements suggested in the design analysis?" --continuation-id {seer_id}
```

### With Deep Thinking
```bash
# Use :z for multi-tool coordination
:z "coordinate with zenode:chat and zenode:thinkdeep to evaluate whether to migrate from Express.js to Fastify for our API"
```

## When to Use Chat vs Other Zenode Tools

- **Use `zenode:chat`** for: Open-ended discussions, brainstorming, technology comparisons, getting second opinions
- **Use `zenode:thinkdeep`** for: Extending specific analysis, challenging assumptions, deeper reasoning on complex problems
- **Use `zenode:analyze`** for: Understanding existing code structure and patterns in detail
- **Use `zenode:debug`** for: Specific error diagnosis and troubleshooting issues
- **Use `zenode:codereview`** for: Comprehensive code quality and security analysis
- **Use `zenode:seer`** for: Dedicated image and visual content analysis

## Configuration

The chat tool respects zenode's configuration:
- Model selection from `src/config.ts`
- Temperature defaults by tool category
- Redis conversation persistence settings
- Docker container workspace mounting

For optimal performance, ensure your zenode environment has:
- At least one AI provider configured (Gemini, OpenAI, or OpenRouter)
- Redis container running for conversation persistence
- Proper workspace volume mounting for file access

## Troubleshooting

**Common Issues:**
- **File not found**: Ensure paths use `/workspace/` prefix
- **Model not available**: Check API keys in zenode `.env` file
- **Conversation lost**: Verify Redis container is running
- **Image analysis fails**: Ensure zenode:seer is properly configured

**Debug Commands:**
```bash
# Check zenode status
zenode:version

# Test file access
zenode:gopher --action file_exists --path "/workspace/your/file.ts"

# Verify container health
docker-compose logs zenode-server --tail=20
```