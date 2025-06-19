# Version Tool - Server Information & Configuration

**Get comprehensive server version, configuration details, and system capabilities overview**

The `zenode:version` tool provides essential information about your zenode MCP server installation, including version details, configuration status, available providers, and tool inventory. This is the primary diagnostic tool for troubleshooting, configuration verification, and understanding server capabilities.

## Key Features

- **Server version information** - Current version, build details, and update status
- **Configuration overview** - Active providers, models, and feature settings
- **Tool inventory** - Complete list of available zenode tools with descriptions
- **Provider status** - Which AI providers are configured and operational
- **System diagnostics** - Node.js version, startup time, and health indicators
- **Zero parameters required** - Instant information with no configuration needed

## Tool Parameters

No parameters required - this utility tool provides comprehensive server information automatically.

## Usage Examples

### Basic Server Information
```bash
# Get complete server information
zenode:version
```

### Troubleshooting and Diagnostics
```bash
# Check server status for support requests
zenode:version  # Include output in bug reports

# Verify configuration after setup changes
zenode:version  # Confirm providers and tools are properly configured

# Check available tools and capabilities
zenode:version  # See what functionality is available
```

## Expected Output Structure

### Version Information
```markdown
Zenode MCP Server v2.15.0
Updated: 2024-01-15T10:30:00Z
Author: Zen Development Team

Configuration:
- Default Model: auto
- Default Thinking Mode (ThinkDeep): high
- Max Context: Dynamic (model-specific)
- Node.js: v20.10.0
- Started: 2024-01-15T14:22:35.123Z
```

### Provider Configuration Status
```markdown
Configured Providers:
  - Gemini (Google AI)
  - OpenAI (o3, o4-mini models)
  - OpenRouter (Multi-provider access)
  - Custom API (http://localhost:11434)
```

### Complete Tool Inventory
```markdown
Available Tools:
  - analyze       - Smart file analysis and code understanding
  - bootstrap     - First-time setup and project initialization
  - chat          - General development chat & collaborative thinking
  - codereview    - Professional code review with security analysis
  - config        - Interactive CLI configuration for API keys
  - consensus     - Multi-model perspective gathering with stance assignment
  - debug         - Expert debugging with 1M token capacity
  - gopher        - Local file system access bridge
  - grunts        - Distributed LLM orchestration for web development
  - listmodels    - Display available AI models organized by provider
  - planner       - Interactive step-by-step planning tool
  - precommit     - Pre-commit validation for git changes
  - refactor      - Intelligent code refactoring with precise guidance
  - seer          - Dedicated vision and image analysis tool
  - testgen       - Comprehensive test generation with edge case coverage
  - thinkdeep     - Extended reasoning partner for complex problems
  - tracer        - Static code analysis workflow generator
  - version       - Server information & configuration (this tool)
  - visit         - Web browsing, search, and reverse image search
```

## Zenode-Specific Information

### Container Environment Details
The version tool provides container-specific information:
- **Docker environment status** - Container health and networking
- **Volume mount configuration** - Workspace access verification
- **Node.js runtime version** - Container runtime environment
- **Network connectivity** - Access to external APIs and services

### Multi-Provider Architecture Status
```markdown
Provider Priority and Status:
  - Native APIs (Gemini, OpenAI) ✅ Primary
  - Custom endpoints (Ollama, vLLM) ✅ Local inference
  - OpenRouter ✅ Fallback/additional models

Model Resolution:
  - Auto mode: Enabled - Intelligent model selection
  - Restrictions: None active
  - Available models: 15+ across all providers
```

### Tool Categories Overview
```markdown
Tool Categories Available:
  🧠 Reasoning: chat, thinkdeep, consensus, planner
  🔍 Analysis: analyze, debug, seer, tracer
  ⚙️ Development: codereview, precommit, refactor, testgen
  🌐 External: visit, gopher, grunts
  🔧 Utility: config, bootstrap, listmodels, version
```

## Diagnostic Use Cases

### Configuration Verification
```bash
# After initial setup
zenode:version
# Verify: All expected providers show as "Configured"
# Verify: Tool inventory shows all 18 tools
# Verify: Node.js version is 18+ for compatibility
```

### Troubleshooting Connection Issues
```bash
# If zenode tools aren't working
zenode:version
# Check: "Started" timestamp shows recent startup
# Check: Providers section shows ✅ status
# Check: No error messages in output
```

### Support and Bug Reporting
```bash
# Always include version output in bug reports
zenode:version
# Provides: Exact version, configuration, environment details
# Helps: Developers reproduce and diagnose issues
```

### Update Verification
```bash
# After updating zenode
zenode:version
# Verify: Version number reflects latest release
# Verify: New tools appear in inventory if added
# Verify: Configuration remains intact
```

### Performance Assessment
```bash
# Check server performance indicators
zenode:version
# Monitor: Startup time and response speed
# Assess: Available providers for load distribution
# Evaluate: Tool availability for workflow optimization
```

## Configuration Status Indicators

### Provider Status Meanings
- **Listed in "Configured Providers"**: API key valid and provider accessible
- **Missing from list**: API key not set or invalid
- **Error indicators**: Configuration problems requiring attention

### Tool Availability Status
- **All 18 tools listed**: Full zenode functionality available
- **Missing tools**: Installation or configuration issues
- **Tool count verification**: Should match latest zenode release

### Environment Health Indicators
```markdown
Healthy Configuration:
✅ Recent startup time (< 1 hour for active development)
✅ Node.js v18+ (required for optimal performance)
✅ Multiple providers configured (redundancy)
✅ All expected tools present

Warning Signs:
⚠️ Very old startup time (possible memory leaks)
⚠️ Single provider only (no fallback options)
⚠️ Missing tools from expected inventory
⚠️ Old Node.js version (compatibility issues)
```

## Integration with Other Tools

### Version → Configuration Workflow
```bash
# Step 1: Check current status
zenode:version

# Step 2: Configure missing providers
zenode:config setup --provider openrouter  # if OpenRouter missing

# Step 3: Verify configuration
zenode:version  # confirm new provider appears
```

### Version → Model Selection Workflow
```bash
# Step 1: Check available providers
zenode:version

# Step 2: List specific models
zenode:listmodels

# Step 3: Use appropriate model for task
zenode:chat "test message" --model pro  # using confirmed provider
```

### Troubleshooting Workflow
```bash
# Step 1: Gather system information
zenode:version

# Step 2: Test basic functionality
zenode:chat "test connection" --model auto

# Step 3: Verify file access if issues persist
zenode:gopher --action list_directory --path "/workspace"
```

## CLI Mode Compatibility

The version tool works in both MCP server mode and CLI mode:

### MCP Server Mode (Default)
```bash
# Called via Claude Code or MCP client
zenode:version
# Returns: Formatted MCP response with server details
```

### CLI Mode (Direct Execution)
```bash
# Direct command line execution
node dist/index.js version
# Returns: Plain text version information
```

### JSON Output Mode
```bash
# Machine-readable format for automation
ZENODE_CLI_OUTPUT=json node dist/index.js version
# Returns: Structured JSON with all version data
```

## Configuration Dependencies

### Required for Full Functionality
- **At least one AI provider**: Gemini, OpenAI, OpenRouter, or Custom
- **Docker environment**: Container runtime with proper networking
- **Node.js 18+**: Modern JavaScript runtime support
- **Network access**: For AI API calls and web search features

### Optional for Enhanced Features
- **Multiple providers**: Better redundancy and model selection
- **Custom API endpoint**: Local inference capabilities
- **Redis server**: For conversation memory and threading
- **Web search APIs**: For enhanced research capabilities

## When to Use Version vs Other Tools

- **Use `zenode:version`** for: System diagnostics, configuration verification, troubleshooting, support requests
- **Use `zenode:listmodels`** for: Detailed model availability and capabilities
- **Use `zenode:config`** for: Setting up API keys and provider configuration
- **Use `zenode:bootstrap`** for: Initial project setup and configuration
- **Use other tools** for: Actual development, analysis, and AI-powered tasks

## Best Practices

### Regular Monitoring
- **Run after configuration changes** to verify updates
- **Include in bug reports** when requesting support
- **Check before major projects** to ensure full capabilities
- **Monitor startup time** for performance assessment

### Troubleshooting Strategy
1. **Start with version check** to understand current state
2. **Compare with expected configuration** based on your setup
3. **Identify missing providers or tools** for targeted fixes
4. **Verify environment requirements** (Node.js version, network access)

### Configuration Management
- **Document your version output** for environment tracking
- **Compare across environments** (development, staging, production)
- **Track changes over time** to identify configuration drift
- **Validate after updates** to ensure compatibility

The zenode:version tool serves as the essential first step in understanding, configuring, and troubleshooting your zenode MCP server environment, providing comprehensive insights into the system's capabilities and health.