# Zenode Auto-Config Link Repair Plan

## Overview

This plan creates a comprehensive, idempotent script that diagnoses and repairs zenode MCP server connections when the `:z` trigger and other MCP functionality stops working. The script should be safe to run repeatedly and handle various failure scenarios.

## Problem Statement

Common issues when zenode MCP connection fails:
1. **Docker container not running** - Services stopped or crashed
2. **MCP registration missing** - Claude Code doesn't know about zenode server
3. **API key issues** - Invalid or expired keys
4. **Port conflicts** - Redis or other services conflicting
5. **Permission issues** - File access or Docker permissions
6. **Configuration drift** - Settings changed or corrupted
7. **Process conflicts** - Multiple zenode instances running

## Solution Architecture

### Core Script: `zenode-auto-repair.sh`

**Location**: `/zenode/zenode-auto-repair.sh`

**Design Principles**:
- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Backs up before changes
- **Self-diagnosing**: Reports what's wrong and what was fixed
- **Comprehensive**: Handles Docker, MCP, API, and config issues
- **User-friendly**: Clear output and actionable guidance

### Repair Phases

#### Phase 1: System Health Check
- Docker daemon status
- Container status (zenode-server, redis)
- Port availability check (6380 for Redis)
- API key validation
- File permissions check

#### Phase 2: Service Recovery
- Stop conflicting processes
- Clean up orphaned containers/networks
- Rebuild containers if needed
- Restart services in correct order
- Wait for health checks

#### Phase 3: MCP Connection Repair
- Detect Claude Code CLI vs Desktop
- Check existing MCP registrations
- Backup current configurations
- Re-register zenode MCP server
- Validate MCP communication

#### Phase 4: Configuration Validation
- Test `:z` trigger functionality
- Verify tool accessibility
- Check API connectivity
- Validate workspace paths
- Test basic operations

#### Phase 5: User Guidance
- Report what was fixed
- Provide next steps if manual intervention needed
- Suggest Claude Code restart if required
- Output diagnostic information

## Implementation Details

### Detection Logic

```bash
# Health check functions
check_docker_status()
check_container_health()
check_mcp_registration()
check_api_connectivity()
test_z_trigger()
```

### Repair Functions

```bash
# Repair operations
repair_docker_services()
repair_mcp_registration()
repair_api_configuration()
cleanup_conflicts()
rebuild_if_needed()
```

### Configuration Management

```bash
# Config handling
backup_configurations()
restore_configurations()
update_claude_config()
validate_env_file()
```

### Testing Framework

```bash
# Validation tests
test_basic_functionality()
test_planner_tool()
test_seer_tool()
test_conversation_memory()
```

## File Structure

```
zenode/
├── zenode-auto-repair.sh          # Main repair script
├── scripts/
│   ├── diagnostics.sh             # Health check utilities
│   ├── repair-functions.sh        # Individual repair operations
│   └── validation-tests.sh        # Post-repair testing
└── docs/
    └── troubleshooting/
        └── auto-repair-guide.md   # User documentation
```

## Script Behavior Matrix

| Issue Detected | Action Taken | Idempotent | Backup Created |
|---------------|--------------|------------|----------------|
| Container down | Restart services | ✅ | N/A |
| Port conflict | Kill conflicting process | ✅ | Process list |
| Missing MCP registration | Re-register with Claude | ✅ | Claude config |
| Invalid API key | Prompt for new key | ✅ | .env file |
| Corrupted config | Restore from backup | ✅ | Current config |
| Permission issues | Fix permissions | ✅ | Permission list |

## Error Handling Strategy

### Graceful Degradation
- If Docker fails: Guide to manual Docker setup
- If MCP registration fails: Provide manual registration commands
- If API keys invalid: Show API key setup instructions
- If permissions can't be fixed: Show manual permission commands

### Rollback Capability
- All changes backed up with timestamps
- Rollback command provided in output
- Original configurations preserved
- Clear restoration instructions

## User Experience Flow

```bash
$ ./zenode-auto-repair.sh

🔧 Zenode Auto-Repair Tool v1.0
===============================

🔍 Phase 1: System Health Check
✅ Docker daemon running
❌ zenode-server container stopped
✅ Redis container healthy
❌ MCP registration missing
✅ API keys valid

🛠️  Phase 2: Service Recovery
📦 Starting zenode-server container...
⏳ Waiting for container health check...
✅ Container started successfully

🔗 Phase 3: MCP Connection Repair
💾 Backing up Claude config...
🔧 Re-registering zenode MCP server...
✅ MCP registration successful

🧪 Phase 4: Configuration Validation
✅ :z trigger test passed
✅ Planner tool accessible
✅ API connectivity confirmed
✅ Workspace paths valid

📋 Phase 5: Summary
====================
✅ Fixed: Container startup
✅ Fixed: MCP registration
🔄 Action Required: Restart Claude Code for changes to take effect

💡 Test command: :z test connection
📁 Backups stored in: ~/.zenode-backups/2025-06-19_123456/
🔄 Rollback command: ./zenode-auto-repair.sh --rollback 2025-06-19_123456
```

## Integration Points

### Claude Code Instructions
- Automatic detection of Claude Code CLI vs Desktop
- Different registration commands for each
- Restart instructions specific to platform

### Docker Integration
- Use existing docker-compose.yml
- Leverage health checks
- Integrate with run-server.sh

### Monitoring Integration
- Log all actions to .zenode/repair-logs/
- Integrate with existing zenode logging
- Export diagnostics for troubleshooting

## Testing Strategy

### Unit Tests
- Each repair function individually tested
- Mock various failure scenarios
- Validate idempotent behavior

### Integration Tests
- Full repair cycle testing
- Multiple consecutive runs
- Rollback functionality testing

### User Acceptance Tests
- Real-world failure scenarios
- Different OS environments
- Various Claude Code configurations

## Documentation Plan

### User Documentation
- `docs/troubleshooting/auto-repair-guide.md`
- FAQ for common issues
- Manual troubleshooting steps

### Developer Documentation
- Code comments for each repair function
- Architecture decision records
- Maintenance procedures

## Success Metrics

### Primary Metrics
- **Repair Success Rate**: % of issues auto-resolved
- **False Positive Rate**: % of unnecessary repairs
- **User Satisfaction**: Feedback on repair experience

### Secondary Metrics
- **Time to Repair**: Average script execution time
- **Manual Intervention Required**: % needing human help
- **Rollback Usage**: % of users needing rollback

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- Basic health check framework
- Docker service management
- Configuration backup/restore

### Phase 2: MCP Integration (Week 1)
- Claude Code detection
- MCP registration logic
- Connection validation

### Phase 3: Advanced Diagnostics (Week 2)
- API connectivity testing
- Tool-specific validation
- Performance diagnostics

### Phase 4: User Experience (Week 2)
- Interactive mode
- Detailed reporting
- Rollback functionality

### Phase 5: Testing & Documentation (Week 3)
- Comprehensive test suite
- User documentation
- Integration with existing scripts

## Maintenance Plan

### Regular Updates
- Monthly review of common issues
- Quarterly script optimization
- Annual architecture review

### Monitoring
- Track script usage patterns
- Monitor repair success rates
- Collect user feedback

## Risk Mitigation

### Data Safety
- All changes backed up before execution
- Rollback capability for all operations
- Never delete original configurations

### System Safety
- Read-only checks before modifications
- Permission validation before file changes
- Service dependency checking

### User Safety
- Clear warnings before destructive operations
- Confirmation prompts for major changes
- Detailed logging of all actions

## Future Enhancements

### Advanced Features
- Remote diagnostic collection
- Automated issue reporting
- Predictive failure detection

### Integration Opportunities
- CI/CD pipeline integration
- Monitoring system integration
- Support ticket auto-creation

This plan ensures zenode MCP connectivity remains reliable and self-healing, reducing support burden and improving user experience.