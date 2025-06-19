# Zenode Auto-Repair Guide

## Overview

The Zenode Auto-Repair Tool (`zenode-auto-repair.sh`) is a comprehensive diagnostic and repair script designed to automatically fix common issues with the zenode MCP server connection.

## When to Use

Run the auto-repair script when you experience:

- `:z` trigger not working in Claude Code
- MCP tools not accessible
- Container connectivity issues
- API authentication failures
- Configuration drift or corruption

## Basic Usage

```bash
# Run automatic repair
./zenode-auto-repair.sh

# View help
./zenode-auto-repair.sh --help

# Rollback changes
./zenode-auto-repair.sh --rollback 2025-06-19_123456
```

## What the Script Does

### Phase 1: System Health Check
- ✅ Verifies Docker daemon status
- ✅ Checks container health (zenode-server, redis)
- ✅ Validates port availability (Redis port 6380)
- ✅ Confirms API key configuration
- ✅ Checks MCP registration status

### Phase 2: Service Recovery
- 🛠️ Stops conflicting processes
- 🛠️ Cleans up orphaned containers/networks
- 🛠️ Rebuilds containers if needed
- 🛠️ Restarts services in correct order
- 🛠️ Waits for health checks to pass

### Phase 3: MCP Connection Repair
- 🔗 Detects Claude Code CLI vs Desktop installation
- 🔗 Backs up existing configurations
- 🔗 Re-registers zenode MCP server
- 🔗 Updates Claude Desktop config if needed
- 🔗 Validates MCP communication

### Phase 4: Configuration Validation
- 🧪 Tests container CLI mode
- 🧪 Verifies MCP protocol communication
- 🧪 Checks API connectivity
- 🧪 Validates workspace paths
- 🧪 Confirms tool accessibility

### Phase 5: User Guidance
- 📋 Reports issues found and fixes applied
- 📋 Provides manual steps if needed
- 📋 Suggests Claude Code restart
- 📋 Shows test commands and backup info

## Safety Features

### Idempotent Operation
- Safe to run multiple times
- Won't break working configurations
- Skips unnecessary operations

### Backup and Rollback
- All configurations backed up before changes
- Timestamped backup directories
- Easy rollback functionality

### Non-Destructive
- Never deletes original configurations
- Preserves user customizations
- Clear restoration instructions

## Output Explanation

### Status Icons
- ✅ **Success**: Operation completed successfully
- ❌ **Error**: Issue detected or operation failed
- ⚠️ **Warning**: Potential issue or non-critical failure
- ℹ️ **Info**: Informational message
- 🛠️ **Action**: Repair operation in progress
- 🔧 **Manual**: Manual intervention required

### Example Output
```bash
🔧 Zenode Auto-Repair Tool v1.0
===============================

🔍 Phase 1: System Health Check
✅ Docker daemon running
❌ zenode-server container stopped
✅ Redis container healthy
❌ MCP registration missing
✅ API keys valid

🛠️ Phase 2: Service Recovery
📦 Starting zenode-server container...
⏳ Waiting for container health check...
✅ Container started successfully

📋 Phase 5: Summary
✅ Fixed: Container startup
✅ Fixed: MCP registration
🔄 Action Required: Restart Claude Code
```

## Common Scenarios

### Scenario 1: Container Stopped
**Issue**: Docker containers not running
**Auto-Fix**: Restarts all zenode services
**Manual Steps**: None (usually auto-resolved)

### Scenario 2: MCP Registration Missing
**Issue**: Claude Code doesn't see zenode tools
**Auto-Fix**: Re-registers with both CLI and Desktop
**Manual Steps**: Restart Claude Code to apply changes

### Scenario 3: API Key Problems
**Issue**: Invalid or missing API keys
**Auto-Fix**: Validates existing keys
**Manual Steps**: Update .env file with valid keys

### Scenario 4: Port Conflicts
**Issue**: Redis port 6380 occupied by other process
**Auto-Fix**: Terminates conflicting processes
**Manual Steps**: May require manual process investigation

### Scenario 5: Configuration Corruption
**Issue**: Broken Claude Desktop config
**Auto-Fix**: Restores clean configuration
**Manual Steps**: None (automatically backed up and fixed)

## Manual Troubleshooting

If auto-repair doesn't resolve your issue:

### 1. Check Logs
```bash
# View repair log
cat .zenode/repair-logs/repair-YYYYMMDD_HHMMSS.log

# View container logs
docker logs zenode-server
docker logs zenode-redis
```

### 2. Test Individual Components
```bash
# Test container CLI
docker exec zenode-server node dist/index.js version

# Test MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | docker exec -i zenode-server node dist/index.js

# Test Claude Code registration
claude mcp list
```

### 3. Manual MCP Registration
```bash
# Claude Code CLI
claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js

# Claude Desktop (add to config file)
{
  "mcpServers": {
    "zenode": {
      "command": "docker",
      "args": ["exec", "-i", "zenode-server", "node", "dist/index.js"],
      "env": {
        "MCP_WORKSPACE": "/Users/yourusername"
      }
    }
  }
}
```

### 4. Force Rebuild
```bash
# Complete rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Rollback Instructions

If the auto-repair causes issues:

```bash
# List available backups
ls ~/.zenode-backups/

# Rollback to specific backup
./zenode-auto-repair.sh --rollback 2025-06-19_123456

# Manual rollback
cp ~/.zenode-backups/2025-06-19_123456/claude_desktop_config.json \
   "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

## Advanced Usage

### Debug Mode
Set environment variable for verbose output:
```bash
DEBUG=1 ./zenode-auto-repair.sh
```

### Custom Backup Directory
```bash
BACKUP_DIR=/custom/path ./zenode-auto-repair.sh
```

### Skip Specific Phases
```bash
# Skip service recovery (containers already running)
SKIP_SERVICE_RECOVERY=1 ./zenode-auto-repair.sh
```

## Prevention Tips

1. **Regular Health Checks**: Run auto-repair monthly
2. **Backup Configurations**: Keep manual backups of working configs
3. **Monitor Logs**: Check zenode logs for early warning signs
4. **Update Regularly**: Keep Docker and Claude Code updated
5. **Clean Environment**: Restart Docker occasionally to clear cache

## Getting Help

If issues persist after auto-repair:

1. **Check Documentation**: Review zenode README and troubleshooting guides
2. **Examine Logs**: Share repair logs and container logs when reporting issues
3. **Test Environment**: Ensure Docker, Node.js, and Claude Code are updated
4. **Report Issues**: Include auto-repair output when reporting bugs

## Script Maintenance

The auto-repair script logs all operations and maintains usage statistics. Review logs periodically to identify common issues and improve the repair logic.

### Log Locations
- Repair logs: `.zenode/repair-logs/`
- Backups: `~/.zenode-backups/`
- Container logs: `docker logs zenode-server`