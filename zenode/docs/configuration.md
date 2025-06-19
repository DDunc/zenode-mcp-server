# Zenode Configuration Guide

This guide covers all configuration options for the Zenode MCP Server. The zenode server is configured through environment variables defined in your `.env` file and follows Node.js/Docker best practices.

## Quick Start Configuration

**Auto Mode (Recommended):** Set `DEFAULT_MODEL=auto` and let Claude intelligently select the best model for each task:

```env
# Basic zenode configuration
DEFAULT_MODEL=auto
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
```

## Complete Configuration Reference

### Docker Environment Setup

**Zenode Docker Configuration:**
```env
# Node.js Environment
NODE_ENV=production
LOG_LEVEL=INFO

# Docker Container Settings
MCP_WORKSPACE=/workspace  # Container workspace path
REDIS_URL=redis://redis:6379/0  # Redis for conversation persistence
```

### API Keys (At least one required)

**Important:** Zenode supports multiple providers simultaneously for optimal model selection.

**Option 1: Native APIs (Recommended for direct access)**
```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
# Get from: https://makersuite.google.com/app/apikey

# OpenAI API  
OPENAI_API_KEY=your_openai_api_key_here
# Get from: https://platform.openai.com/api-keys

# X.AI GROK API (future support)
XAI_API_KEY=your_xai_api_key_here
# Get from: https://console.x.ai/
```

**Option 2: OpenRouter (Access multiple models through one API)**
```env
# OpenRouter for unified model access
OPENROUTER_API_KEY=your_openrouter_api_key_here
# Get from: https://openrouter.ai/
# Works alongside native APIs for fallback
```

**Option 3: Custom API Endpoints (Local models)**
```env
# For Ollama, vLLM, LM Studio, etc.
CUSTOM_API_URL=http://host.docker.internal:11434/v1  # Ollama via Docker
CUSTOM_API_KEY=                                      # Empty for Ollama
CUSTOM_MODEL_NAME=llama3.2                          # Default model
```

**Docker Network Notes:**
- Use `host.docker.internal` to reach localhost from containers
- Example: `http://host.docker.internal:11434/v1` for Ollama
- Zenode containers handle network routing automatically

### Model Configuration

**Default Model Selection:**
```env
# Options: 'auto', 'pro', 'flash', 'o3', 'o3-mini', 'o4-mini', 'o4-mini-high'
DEFAULT_MODEL=auto  # Claude picks best model for each task (recommended)

# Vision Model Selection
DEFAULT_VISION_MODEL=openai/gpt-4o  # For zenode:seer image analysis
```

**Available Models in Zenode:**
- **`auto`**: Zenode automatically selects the optimal model
- **`pro`** (Gemini 2.5 Pro): Extended thinking, deep analysis (1M context)
- **`flash`** (Gemini 2.5 Flash): Ultra-fast responses (1M context)
- **`o3`**: Strong logical reasoning (200K context)
- **`o3-mini`**: Balanced speed/quality (200K context)
- **`o4-mini`**: Latest reasoning model (200K context)
- **`o4-mini-high`**: Enhanced O4 with higher reasoning effort
- **Vision models**: Auto-selected for zenode:seer

### Thinking Mode Configuration

**Default Thinking Mode for ThinkDeep:**
```env
# Only applies to models supporting extended thinking (e.g., Gemini 2.5 Pro)
DEFAULT_THINKING_MODE_THINKDEEP=high

# Available modes and token consumption (% of model max):
#   minimal: 0.5% - Quick analysis, fastest response
#   low:     8%   - Light reasoning tasks  
#   medium:  33%  - Balanced reasoning
#   high:    67%  - Complex analysis (recommended for thinkdeep)
#   max:     100% - Maximum reasoning depth
```

### Temperature and Model Constraints

**Temperature Defaults:**
```env
# Zenode uses different temperatures for different tool categories
TEMPERATURE_ANALYTICAL=0.2   # codereview, debug (precision)
TEMPERATURE_BALANCED=0.5     # chat (general use)
TEMPERATURE_CREATIVE=0.7     # thinkdeep, architecture
TEMPERATURE_CONSENSUS=0.2    # consensus (consistency)
```

**Model-Specific Constraints:**
```env
# O3/O4 models don't support temperature parameters
# Zenode automatically handles this via temperature constraint system
# No additional configuration needed
```

### Model Usage Restrictions

Control which models can be used from each provider:

```env
# Restrict Gemini models
GOOGLE_ALLOWED_MODELS=gemini-2.5-pro-preview-06-05,gemini-2.5-flash-preview-05-20

# Restrict OpenAI models  
OPENAI_ALLOWED_MODELS=o3,o3-mini,o4-mini,gpt-4o

# Restrict OpenRouter models
OPENROUTER_ALLOWED_MODELS=google/gemini-2.5-pro-preview,openai/gpt-4o

# Enable expensive models (requires explicit opt-in)
ENABLE_CLAUDE_OPUS=true
```

### Conversation Threading & Redis

**Redis Configuration:**
```env
# Redis connection for conversation persistence
REDIS_URL=redis://redis:6379/0

# Conversation limits
MAX_CONVERSATION_TURNS=20
CONVERSATION_TIMEOUT_HOURS=3
```

**Conversation Features:**
- **Persistent threading**: Conversations survive container restarts
- **Cross-tool continuation**: Continue conversations across different zenode tools
- **Memory optimization**: Automatic conversation pruning and token management

### Consensus Tool Configuration

**Multi-Model Coordination:**
```env
# Maximum instances per model+stance combination in consensus tool
DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION=2
```

### MCP Protocol Configuration

**Protocol Limits:**
```env
# MCP prompt size limit (characters)
MCP_PROMPT_SIZE_LIMIT=50000  # 50K chars (~12K tokens)
```

### Docker Compose Configuration

**zenode/docker-compose.yml settings:**
```yaml
version: '3.8'
services:
  zenode-server:
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
      - DEFAULT_MODEL=${DEFAULT_MODEL:-auto}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ${HOME}:/workspace:rw  # Mount home directory
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### Advanced Configuration

**Development Mode:**
```env
NODE_ENV=development
LOG_LEVEL=DEBUG
ZENODE_CLI_DEBUG=1      # Enable CLI debug mode
ZENODE_CLI_OUTPUT=json  # JSON output for CLI tools
```

**Performance Tuning:**
```env
# Token allocation for conversation history
TOKEN_ALLOCATION_PERCENTAGE=70  # % of context for conversation history
```

**Security Configuration:**
```env
# Additional API security
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_APP_NAME=YourApp
```

## Configuration Validation

**Check Configuration:**
```bash
# Verify zenode configuration
zenode:version

# Check configured providers
zenode:config --action list

# Test API connectivity
zenode:chat "test message" --model auto
```

**Docker Health Checks:**
```bash
# Check container status
docker-compose ps

# View configuration logs
docker-compose logs zenode-server | grep -i "config\|provider"

# Test Redis connection
docker-compose exec redis redis-cli ping
```

## Configuration Templates

### Development Setup
```env
# zenode/.env.development
NODE_ENV=development
LOG_LEVEL=DEBUG
DEFAULT_MODEL=auto
GEMINI_API_KEY=your_dev_key
OPENAI_API_KEY=your_dev_key
REDIS_URL=redis://redis:6379/0
```

### Production Setup
```env
# zenode/.env.production
NODE_ENV=production
LOG_LEVEL=INFO
DEFAULT_MODEL=auto
GEMINI_API_KEY=your_prod_key
OPENAI_API_KEY=your_prod_key
OPENROUTER_API_KEY=your_fallback_key
REDIS_URL=redis://redis:6379/0
MAX_CONVERSATION_TURNS=50
CONVERSATION_TIMEOUT_HOURS=24
```

### Local Development with Ollama
```env
# zenode/.env.local
NODE_ENV=development
DEFAULT_MODEL=auto
CUSTOM_API_URL=http://host.docker.internal:11434/v1
CUSTOM_MODEL_NAME=llama3.2
GEMINI_API_KEY=your_backup_key  # Fallback
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Node.js environment |
| `LOG_LEVEL` | `INFO` | Logging level |
| `DEFAULT_MODEL` | `auto` | Default AI model |
| `DEFAULT_VISION_MODEL` | `openai/gpt-4o` | Vision model for zenode:seer |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `MCP_WORKSPACE` | auto-detected | Container workspace path |
| `MAX_CONVERSATION_TURNS` | `20` | Conversation turn limit |
| `CONVERSATION_TIMEOUT_HOURS` | `3` | Conversation timeout |
| `MCP_PROMPT_SIZE_LIMIT` | `50000` | MCP prompt character limit |

## Troubleshooting Configuration

**Common Issues:**

1. **API Key Not Working:**
   ```bash
   # Check key format
   echo $GEMINI_API_KEY | grep -E "^[A-Za-z0-9_-]+$"
   
   # Test provider directly
   zenode:chat "test" --model pro
   ```

2. **Redis Connection Issues:**
   ```bash
   # Check Redis status
   docker-compose logs redis
   
   # Test connection
   docker-compose exec zenode-server ping redis
   ```

3. **File Access Problems:**
   ```bash
   # Verify workspace mounting
   zenode:gopher --action list_directory --path "/workspace"
   
   # Check volume permissions
   docker-compose exec zenode-server ls -la /workspace
   ```

4. **Model Selection Issues:**
   ```bash
   # Check available models
   zenode:listmodels
   
   # Test specific model
   zenode:chat "test" --model flash
   ```

The zenode configuration system is designed to be robust and flexible while maintaining the simplicity of Docker-based deployment.