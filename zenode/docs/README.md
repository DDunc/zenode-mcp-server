# Zenode Documentation

**Complete documentation for the Zenode MCP Server - Node.js/TypeScript port of Zen MCP**

This documentation covers zenode's unique features, Docker-based architecture, and enhanced tool ecosystem. All documentation is adapted for zenode's Node.js/TypeScript implementation and container-native approach.

## Quick Navigation

### 🚀 Getting Started
- **[Configuration Guide](configuration.md)** - Complete environment setup and API configuration
- **[Troubleshooting](troubleshooting.md)** - Docker, Redis, and container-specific issue resolution
- **[Adding Providers](adding_providers.md)** - Implementing new AI model providers in TypeScript

### 🛠️ Core Tools Documentation

**Essential Tools:**
- **[Chat Tool](tools/chat.md)** - Collaborative thinking and brainstorming with multi-provider intelligence
- **[Analyze Tool](tools/analyze.md)** - Smart code analysis with TypeScript/Node.js focus
- **[ThinkDeep Tool](tools/thinkdeep.md)** - Extended reasoning with multi-model perspectives
- **[Consensus Tool](tools/consensus.md)** - Multi-model decision making with stance steering

### 🔮 Zenode-Specific Tools

**Unique to Zenode:**
- **[Seer Tool](plus/seer.md)** - Dedicated vision and image analysis with automatic model selection
- **[Gopher Tool](plus/gopher.md)** - Local file access bridge for containerized operations

## Zenode vs Python Zen Differences

### Architecture Advantages

**Docker-Native:**
- Container-based deployment with Redis persistence
- Workspace file mapping (`/workspace/` paths)
- Production-ready scaling and orchestration

**TypeScript Benefits:**
- Type-safe configuration and tool parameters
- Modern async/await patterns throughout
- Enhanced error handling and validation

**Multi-Provider Intelligence:**
- True provider diversity (Gemini + OpenAI + OpenRouter simultaneously)
- Automatic model selection based on task complexity
- Graceful fallback between providers

### Enhanced Tool Capabilities

**Vision and Image Analysis:**
- `zenode:seer` - Dedicated vision tool with automatic model selection
- Support for 20MB images via OpenRouter/OpenAI
- Integration with `zenode:visit` for reverse image search

**File System Operations:**
- `zenode:gopher` - Container-safe file access and discovery
- Automatic path translation for Docker environment
- Smart file discovery and content search

**Advanced Coordination:**
- `:z` command for multi-tool orchestration
- Cross-tool conversation threading with Redis
- Enhanced consensus with stance assignment

## Usage Patterns

### Basic Tool Usage
```bash
# Simple analysis
zenode:analyze "understand this codebase" --files ["/workspace/src"] --model auto

# Image analysis  
zenode:seer "analyze this UI design" --images ["/workspace/design.png"] --analysis-type professional

# Multi-perspective decision making
zenode:consensus "choose framework" --models '[{"model": "pro", "stance": "for"}, {"model": "o3", "stance": "against"}]'
```

### Advanced Coordination
```bash
# Multi-tool orchestration
:z "coordinate with zenode:analyze, zenode:thinkdeep, and zenode:codereview to comprehensively evaluate this architecture"

# Extended analysis workflow
zenode:analyze "architecture overview" --files ["/workspace/src"] --output-format summary
# Continue with: zenode:thinkdeep --continuation-id {analysis_id}
```

### Container Integration
```bash
# Workspace file access
zenode:gopher --action file_exists --path "/workspace/src/app.ts"

# File discovery
zenode:gopher --action glob_search --path "/workspace" --pattern "**/*.ts" --limit 20

# Path verification
zenode:gopher --action list_directory --path "/workspace/src"
```

## Configuration Overview

### Essential Environment Variables
```env
# Core Configuration
DEFAULT_MODEL=auto
NODE_ENV=production
REDIS_URL=redis://redis:6379/0

# AI Providers (at least one required)
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key

# Vision Configuration
DEFAULT_VISION_MODEL=openai/gpt-4o
```

### Docker Setup
```bash
# Start zenode server
cd zenode/
docker-compose up -d

# Verify setup
zenode:version
zenode:chat "test message" --model auto
```

## Key Concepts

### Path Handling
Zenode automatically maps local paths to container paths:
```bash
# Local path: /Users/you/project/src/app.ts
# Container path: /workspace/project/src/app.ts
# Use in tools: zenode:analyze --files ["/workspace/project/src/app.ts"]
```

### Model Selection
Zenode's auto mode intelligently selects models:
- **Simple tasks**: Fast models (flash, o4-mini)
- **Complex analysis**: Deep reasoning (pro, o3)
- **Vision tasks**: Automatically delegates to vision models
- **Coordination**: Multiple models for consensus

### Conversation Threading
Redis-based persistence enables:
- Conversations survive container restarts
- Cross-tool conversation continuation
- Extended multi-stage analysis workflows
- Thread management with `continuation_id`

## Best Practices

### File Access
- **Always use `/workspace/` paths** for file operations
- **Verify file existence** with `zenode:gopher` before analysis
- **Use appropriate file patterns** for discovery and search

### Model Usage
- **Start with auto mode** for intelligent model selection
- **Use specific models** when you need particular capabilities
- **Leverage consensus** for important decisions
- **Combine tools** for comprehensive analysis

### Container Management
- **Monitor container health** with `docker-compose ps`
- **Check logs regularly** with `docker-compose logs zenode-server`
- **Restart when needed** with `docker-compose restart`
- **Update configurations** by restarting containers

## Troubleshooting Quick Reference

**Common Issues:**
```bash
# Container not responding
docker-compose restart zenode-server

# File not found
zenode:gopher --action file_exists --path "/workspace/your/file.ts"

# API key issues
zenode:version  # Check configured providers

# Redis connection
docker-compose logs redis
```

**Health Checks:**
```bash
# Basic functionality
zenode:version
zenode:chat "test" --model auto

# Container status
docker-compose ps

# Log analysis
docker-compose logs zenode-server --tail=20 | grep -E "(error|warn)"
```

## Integration Examples

### Code Analysis Workflow
```bash
# 1. Discover project structure
zenode:gopher --action analyze_code --path "/workspace"

# 2. High-level analysis
zenode:analyze "architecture overview" --files ["/workspace/src"] --analysis-type architecture

# 3. Deep thinking on improvements
zenode:thinkdeep "extend analysis with optimization recommendations" --continuation-id {analysis_id}

# 4. Code review for quality
zenode:codereview --files ["/workspace/src"] --focus-on "performance and maintainability"
```

### Decision Making Process
```bash
# 1. Multi-perspective evaluation
zenode:consensus "technology choice" --models '[
  {"model": "pro", "stance": "for", "stance_prompt": "Focus on benefits"},
  {"model": "o3", "stance": "against", "stance_prompt": "Identify risks"}
]'

# 2. Deep analysis of consensus
zenode:thinkdeep "analyze the consensus results and provide implementation roadmap" --continuation-id {consensus_id}

# 3. Document decision
zenode:chat "create architecture decision record based on analysis" --continuation-id {thinking_id}
```

## Contributing to Documentation

When adding new documentation:
1. **Follow the existing structure** and naming conventions
2. **Include zenode-specific examples** with container paths
3. **Provide both basic and advanced usage** patterns
4. **Reference related tools** and integration possibilities
5. **Include troubleshooting** for common issues

The zenode documentation reflects the enhanced capabilities and modern architecture of the Node.js port while maintaining compatibility with the original Zen MCP concepts.