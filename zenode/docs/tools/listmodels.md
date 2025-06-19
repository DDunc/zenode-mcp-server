# ListModels Tool - Available AI Models Display

**Comprehensive view of all available AI models organized by provider**

The `zenode:listmodels` tool provides a real-time overview of all AI models available in your zenode environment. It shows provider configuration status, model capabilities, context windows, and helps you understand which models are accessible for different tasks. Perfect for model selection, configuration validation, and understanding your AI toolkit.

## Key Features

- **Multi-provider organization**: Google Gemini, OpenAI, X.AI, OpenRouter, Custom/Local
- **Real-time configuration status**: Shows which providers are actually available
- **Model capability overview**: Context windows, reasoning modes, special features
- **Alias mapping**: Convenient shortcuts for model selection
- **Container-native**: Works within zenode's Docker environment
- **Configuration validation**: Verify API keys without exposing them
- **Usage guidance**: Helps select the right model for specific tasks

## Tool Parameters

No parameters required - this is a utility tool that queries your current configuration.

## Usage Examples

### Basic Model Listing
```bash
zenode:listmodels
```

### Check Configuration Status
```bash
zenode:listmodels  # Shows which API keys are configured
```

### Model Selection Reference
```bash
# Use listmodels to understand options, then select:
zenode:chat "complex analysis task" --model pro     # Gemini Pro for deep thinking
zenode:chat "quick question" --model flash         # Gemini Flash for speed
zenode:debug "error analysis" --model o3           # OpenAI O3 for reasoning
```

## Expected Output Structure

### Provider Status Overview
```markdown
## Google Gemini ✅
**Status**: Configured and available

**Models**:
- `flash` → `gemini-2.5-flash-preview-05-20`
  - Ultra-fast (1M context) - Quick analysis, simple queries, rapid iterations
- `pro` → `gemini-2.5-pro-preview-06-05`
  - Deep reasoning + thinking mode (1M context) - Complex problems, architecture, deep analysis

## OpenAI ❌
**Status**: Not configured (set OPENAI_API_KEY)

## OpenRouter ✅
**Status**: Configured and available
**Description**: Access to multiple cloud AI providers via unified API
**Available Models**: Access to GPT-4, Claude, Mistral, and many others
```

### Model Categories Displayed

**Google Gemini Models:**
- `flash` - Ultra-fast processing with 1M context window
- `pro` - Deep reasoning with thinking modes and 1M context

**OpenAI Models:**
- `o3` - Strong reasoning with 200K context, ideal for code generation
- `o3-mini` - Balanced performance/speed, moderate complexity tasks
- `o3-pro` - Professional-grade reasoning, extremely expensive
- `o4-mini` - Latest reasoning model, optimized for shorter contexts
- `o4-mini-high` - Enhanced O4 with higher reasoning effort

**X.AI (Grok) Models:**
- `grok` / `grok-3` - Advanced reasoning with unique perspective
- `grok-3-fast` - Speed-optimized Grok variant

**OpenRouter Models:**
- Access to GPT-4, Claude, Mistral, and many more through unified API
- Specific model list shown when configured

**Custom/Local Models:**
- Ollama integration for local inference
- vLLM, LM Studio, and other OpenAI-compatible APIs
- Self-hosted models with custom endpoints

## Zenode-Specific Features

### Container Environment Integration
The listmodels tool operates within zenode's Docker architecture:
- **Environment variable access**: Reads API keys from container environment
- **Provider validation**: Tests actual connectivity without exposing keys
- **Multi-provider coordination**: Shows how models work together
- **Docker networking**: Handles local API endpoints within containers

### Configuration Detection
```bash
# Detects these environment variables:
GEMINI_API_KEY=your_gemini_key_here        # Google Gemini access
OPENAI_API_KEY=your_openai_key_here        # OpenAI models
XAI_API_KEY=your_xai_key_here              # X.AI Grok models
OPENROUTER_API_KEY=your_openrouter_key     # Multi-provider access
CUSTOM_API_URL=http://localhost:11434      # Local/custom models
```

### Model Selection Intelligence
Zenode automatically selects optimal models based on:
- **Task complexity**: Simple queries → flash, complex analysis → pro
- **Context requirements**: Large files → 1M context models
- **Reasoning needs**: Logic problems → O3/O4, creative tasks → Gemini
- **Cost considerations**: Balance performance vs expense
- **Provider availability**: Fallback to available alternatives

## Integration with Zenode Ecosystem

### Model Selection Workflow
```bash
# Step 1: Check available models
zenode:listmodels

# Step 2: Select appropriate model for task
zenode:analyze "complex codebase analysis" --model pro --files ["/workspace/src"]

# Step 3: Use different model for follow-up
zenode:chat "explain the findings" --model flash --continuation-id {previous_id}
```

### Auto Mode Benefits
```bash
# Let zenode choose the best model automatically
zenode:thinkdeep "architectural decision analysis" --model auto

# Zenode considers:
# - Task complexity (architectural = complex = pro/o3)
# - Available providers (configured APIs)
# - Context size (large files = 1M context models)
# - Cost optimization (balance quality vs expense)
```

### Multi-Provider Coordination
```bash
# Example: Coordinated analysis using multiple models
zenode:consensus "evaluate this approach" --models '[
  {"model": "pro", "stance": "for"},
  {"model": "o3", "stance": "against"},
  {"model": "flash", "stance": "neutral"}
]'
```

## Configuration Troubleshooting

### API Key Setup
```bash
# Check configuration status
zenode:listmodels

# If provider shows ❌, configure via zenode:config
zenode:config setup --provider gemini
zenode:config setup --provider openai
zenode:config setup --provider openrouter
```

### Common Configuration Issues

**Gemini Not Available:**
```bash
# Solution: Set API key
export GEMINI_API_KEY=your_actual_key_here
docker-compose restart zenode-server
```

**OpenAI Models Missing:**
```bash
# Solution: Configure OpenAI API
export OPENAI_API_KEY=sk-your_actual_key
docker-compose restart zenode-server
```

**Custom Models Not Listed:**
```bash
# Solution: Set custom API URL
export CUSTOM_API_URL=http://localhost:11434/v1
# Ensure Ollama/custom server is running and accessible
```

### Model Restrictions
```bash
# If models are restricted by policy:
export ALLOWED_MODELS=flash,pro,o3-mini
export BLOCKED_MODELS=o3-pro,gpt-4  # Block expensive models

# Listmodels will show restriction status
```

## Advanced Usage Patterns

### Model Capability Planning
```bash
# Before starting complex project
zenode:listmodels

# Plan model usage:
# - Initial analysis: flash (fast overview)
# - Deep dive: pro (comprehensive analysis) 
# - Code review: o3 (systematic reasoning)
# - Documentation: flash (quick generation)
```

### Performance Optimization
```bash
# Choose models based on requirements:

# Large codebase analysis (needs 1M context)
zenode:analyze "full project review" --model pro --files ["/workspace"]

# Quick question (200K sufficient)
zenode:chat "explain this function" --model o3-mini --files ["single_file.ts"]

# Local inference (no API costs)
zenode:chat "private analysis" --model llama3.2  # via CUSTOM_API_URL
```

### Cost Management
```bash
# Check available options to control costs
zenode:listmodels

# Avoid expensive models unless necessary:
# ✅ Use: flash, o3-mini, o4-mini (cost-effective)
# ⚠️ Careful: pro, o3 (moderate cost)
# 🚫 Avoid: o3-pro (extremely expensive)
```

### Development Environment Setup
```bash
# Development setup with multiple providers
export GEMINI_API_KEY=your_key_here      # Primary fast/reasoning
export OPENROUTER_API_KEY=your_key_here  # Backup/alternative models
export CUSTOM_API_URL=http://localhost:11434  # Local development

# Verify configuration
zenode:listmodels

# Should show 3 providers configured ✅
```

## Output Interpretation

### Provider Status Meanings
- **✅ Configured**: API key set and provider accessible
- **❌ Not configured**: Missing or invalid API key
- **⚠️ Limited**: Partial configuration or restrictions

### Model Capability Indicators
- **1M context**: Can handle very large files/conversations
- **200K context**: Good for most tasks, moderate file sizes
- **Thinking mode**: Supports extended reasoning and analysis
- **Ultra-fast**: Optimized for speed over deep reasoning
- **Vision capable**: Can analyze images (shown when applicable)
- **Local inference**: No API costs, runs on local hardware

### Usage Guidance
The tool provides specific recommendations:
- **Model selection**: Which models for which tasks
- **Context planning**: How to handle large files
- **Cost optimization**: Balance quality vs expense
- **Configuration next steps**: How to enable missing providers

## Integration Patterns

### Research and Analysis Pipeline
```bash
# Step 1: Check available models
zenode:listmodels

# Step 2: Plan model usage strategy
# Fast exploration → pro for deep analysis → flash for synthesis

# Step 3: Execute with appropriate models
zenode:visit "research topic" --action search
zenode:thinkdeep "analyze findings" --model pro
zenode:chat "summarize insights" --model flash
```

### Code Review Workflow
```bash
# Check available reasoning models
zenode:listmodels | grep -E "(o3|pro)"

# Select best available for code review
zenode:codereview "security analysis" --model o3 --files ["/workspace/src"]
```

### Multi-Model Collaboration
```bash
# Verify multiple providers available
zenode:listmodels

# Use different models for different perspectives
zenode:consensus "architectural decision" --models '[
  {"model": "pro", "stance": "for"},    # Gemini perspective
  {"model": "o3", "stance": "against"}  # OpenAI perspective
]'
```

## Best Practices

### Regular Configuration Checks
- **Run weekly**: Verify API keys haven't expired
- **After setup changes**: Confirm new configurations work
- **Before large projects**: Ensure adequate model access
- **Cost monitoring**: Check which models you're using

### Strategic Model Selection
- **Start broad**: Use `auto` mode for automatic selection
- **Optimize iteratively**: Switch to specific models as needed
- **Consider context**: Match model capabilities to task requirements
- **Balance cost**: Use expensive models only when necessary

### Environment Management
- **Development**: Local models + one cloud provider
- **Production**: Multiple providers for redundancy
- **Testing**: Fast models for rapid iteration
- **Critical tasks**: Best available models regardless of cost

## When to Use ListModels vs Other Zenode Tools

- **Use `zenode:listmodels`** for: Model selection, configuration validation, capability assessment
- **Use `zenode:version`** for: Server status, component versions, system information
- **Use `zenode:config`** for: Setting up API keys, provider configuration
- **Use other tools** for: Actual AI-powered analysis, debugging, development work

## Configuration Dependencies

The listmodels tool effectiveness depends on:
- **Docker environment**: Proper container setup with environment variables
- **Network access**: Ability to reach cloud APIs
- **API keys**: Valid credentials for each provider
- **Local services**: Ollama/custom APIs running and accessible

The zenode:listmodels tool provides essential visibility into your AI model ecosystem, enabling informed decisions about model selection and configuration optimization within zenode's powerful multi-provider architecture.