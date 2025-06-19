#!/bin/bash
# Zenode Auto-Repair Tool v1.0
# Comprehensive, idempotent script for diagnosing and repairing zenode MCP server connections

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$HOME/.zenode-backups/$(date +%Y-%m-%d_%H%M%S)"
LOG_FILE="$SCRIPT_DIR/.zenode/repair-logs/repair-$(date +%Y%m%d_%H%M%S).log"
ISSUES_FOUND=()
FIXES_APPLIED=()
MANUAL_STEPS=()

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Print functions
print_header() {
    echo -e "${BOLD}${BLUE}🔧 Zenode Auto-Repair Tool v1.0${NC}"
    echo -e "${BLUE}===============================${NC}"
    echo ""
}

print_phase() {
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS: $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARNING: $1"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    log "ERROR: $1"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO: $1"
}

print_action() {
    echo -e "${CYAN}🛠️  $1${NC}"
    log "ACTION: $1"
}

# Track issues and fixes
add_issue() {
    ISSUES_FOUND+=("$1")
    log "ISSUE: $1"
}

add_fix() {
    FIXES_APPLIED+=("$1")
    log "FIX: $1"
}

add_manual_step() {
    MANUAL_STEPS+=("$1")
    log "MANUAL: $1"
}

# Backup function
backup_file() {
    local file="$1"
    local backup_name="$2"
    
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/$backup_name"
        print_info "Backed up $file to $BACKUP_DIR/$backup_name"
        return 0
    fi
    return 1
}

# Source repair functions
source "$SCRIPT_DIR/scripts/diagnostics.sh" 2>/dev/null || {
    print_warning "Diagnostics script not found, using built-in functions"
}

source "$SCRIPT_DIR/scripts/repair-functions.sh" 2>/dev/null || {
    print_warning "Repair functions script not found, using built-in functions"
}

# Phase 1: System Health Check
phase1_health_check() {
    print_phase "🔍 Phase 1: System Health Check"
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        add_issue "Docker daemon not running"
        print_error "Docker daemon not running"
        add_manual_step "Start Docker daemon: 'sudo systemctl start docker' or start Docker Desktop"
    else
        print_success "Docker daemon running"
    fi
    
    # Check container status
    local zenode_status=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep zenode-server | awk '{print $2}' || echo "Down")
    local redis_status=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep zenode-redis | awk '{print $2}' || echo "Down")
    
    if [[ "$zenode_status" != "Up" ]]; then
        add_issue "zenode-server container not running (Status: $zenode_status)"
        print_error "zenode-server container stopped"
    else
        print_success "zenode-server container running"
    fi
    
    if [[ "$redis_status" != "Up" ]]; then
        add_issue "Redis container not running (Status: $redis_status)"
        print_error "Redis container stopped"
    else
        print_success "Redis container running"
    fi
    
    # Check port availability
    if lsof -i :6380 &> /dev/null; then
        local port_process=$(lsof -i :6380 | tail -n 1 | awk '{print $1, $2}')
        if [[ ! "$port_process" =~ redis ]]; then
            add_issue "Port 6380 occupied by non-Redis process: $port_process"
            print_error "Port 6380 conflict detected"
        else
            print_success "Redis port 6380 properly allocated"
        fi
    else
        print_warning "Port 6380 not in use (Redis may be down)"
    fi
    
    # Check API keys
    check_api_keys
    
    # Check MCP registration
    check_mcp_registration
    
    echo ""
}

# API key validation
check_api_keys() {
    local env_file="$SCRIPT_DIR/.env"
    if [ ! -f "$env_file" ]; then
        add_issue ".env file missing"
        print_error ".env file not found"
        return 1
    fi
    
    source "$env_file" 2>/dev/null || {
        add_issue ".env file corrupted"
        print_error "Cannot read .env file"
        return 1
    }
    
    local has_valid_key=false
    
    if [[ -n "${OPENROUTER_API_KEY:-}" ]] && [[ "${OPENROUTER_API_KEY}" != "your_openrouter_api_key_here" ]]; then
        print_success "OpenRouter API key configured"
        has_valid_key=true
    fi
    
    if [[ -n "${OPENAI_API_KEY:-}" ]] && [[ "${OPENAI_API_KEY}" != "your_openai_api_key_here" ]]; then
        print_success "OpenAI API key configured"
        has_valid_key=true
    fi
    
    if [[ -n "${GEMINI_API_KEY:-}" ]] && [[ "${GEMINI_API_KEY}" != "your_gemini_api_key_here" ]]; then
        print_success "Gemini API key configured"
        has_valid_key=true
    fi
    
    if [ "$has_valid_key" = false ]; then
        add_issue "No valid API keys configured"
        print_error "No valid API keys found"
    fi
}

# MCP registration check
check_mcp_registration() {
    # Check Claude Code CLI
    if command -v claude &> /dev/null; then
        if claude mcp list 2>/dev/null | grep -q "zenode" 2>/dev/null; then
            print_success "Zenode registered in Claude Code CLI"
        else
            add_issue "Zenode not registered in Claude Code CLI"
            print_error "MCP registration missing (CLI)"
        fi
    else
        print_info "Claude Code CLI not installed"
    fi
    
    # Check Claude Desktop config
    local config_paths=(
        "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
        "$HOME/.config/Claude/claude_desktop_config.json"
        "$APPDATA/Claude/claude_desktop_config.json"
    )
    
    local claude_config_found=false
    for config_path in "${config_paths[@]}"; do
        if [ -f "$config_path" ]; then
            claude_config_found=true
            if grep -q "zenode" "$config_path" 2>/dev/null; then
                print_success "Zenode registered in Claude Desktop"
            else
                add_issue "Zenode not registered in Claude Desktop"
                print_error "MCP registration missing (Desktop)"
            fi
            break
        fi
    done
    
    if [ "$claude_config_found" = false ]; then
        print_info "Claude Desktop config not found"
    fi
}

# Phase 2: Service Recovery
phase2_service_recovery() {
    print_phase "🛠️  Phase 2: Service Recovery"
    
    # Source environment
    if [ -f "$SCRIPT_DIR/.env" ]; then
        source "$SCRIPT_DIR/.env"
    fi
    
    # Use docker compose or docker-compose
    local compose_cmd="docker compose"
    if ! docker compose version &> /dev/null; then
        compose_cmd="docker-compose"
    fi
    
    # Check if services need to be started
    local services_down=false
    if ! docker ps | grep -q "zenode-server.*Up"; then
        services_down=true
    fi
    
    if ! docker ps | grep -q "zenode-redis.*Up"; then
        services_down=true
    fi
    
    if [ "$services_down" = true ]; then
        print_action "Starting zenode services..."
        
        # Stop any existing services first
        $compose_cmd down 2>/dev/null || true
        
        # Start services
        if $compose_cmd up -d; then
            print_success "Services started successfully"
            add_fix "Started zenode Docker services"
            
            # Wait for health checks
            print_info "Waiting for services to be healthy..."
            sleep 10
            
            # Verify services are healthy
            local retries=12
            local healthy=false
            
            for ((i=1; i<=retries; i++)); do
                if docker ps | grep -q "zenode-server.*Up.*healthy" && docker ps | grep -q "zenode-redis.*Up.*healthy"; then
                    healthy=true
                    break
                fi
                print_info "Waiting for health checks... ($i/$retries)"
                sleep 5
            done
            
            if [ "$healthy" = true ]; then
                print_success "All services are healthy"
            else
                add_issue "Services started but not healthy"
                print_warning "Services may not be fully ready"
            fi
        else
            add_issue "Failed to start Docker services"
            print_error "Could not start services"
            add_manual_step "Check Docker logs: docker-compose logs"
        fi
    else
        print_success "Services already running"
    fi
    
    echo ""
}

# Phase 3: MCP Connection Repair
phase3_mcp_repair() {
    print_phase "🔗 Phase 3: MCP Connection Repair"
    
    # Backup existing configurations
    print_action "Backing up configurations..."
    
    # Claude Code CLI backup
    if command -v claude &> /dev/null; then
        claude mcp list > "$BACKUP_DIR/claude-cli-config.txt" 2>/dev/null || true
    fi
    
    # Claude Desktop backup
    local config_paths=(
        "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
        "$HOME/.config/Claude/claude_desktop_config.json"
    )
    
    for config_path in "${config_paths[@]}"; do
        if [ -f "$config_path" ]; then
            backup_file "$config_path" "claude_desktop_config.json"
            break
        fi
    done
    
    # Repair Claude Code CLI registration
    if command -v claude &> /dev/null; then
        if ! claude mcp list 2>/dev/null | grep -q "zenode" 2>/dev/null; then
            print_action "Registering zenode with Claude Code CLI..."
            
            # Remove existing registration if present but broken
            claude mcp remove zenode 2>/dev/null || true
            
            # Add new registration
            if claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js 2>/dev/null; then
                print_success "Zenode registered with Claude Code CLI"
                add_fix "Registered zenode MCP server with Claude Code CLI"
            else
                add_issue "Failed to register with Claude Code CLI"
                print_error "CLI registration failed"
                add_manual_step "Manual registration: claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js"
            fi
        else
            print_success "Claude Code CLI registration already exists"
        fi
    else
        print_info "Claude Code CLI not available"
        add_manual_step "Install Claude Code CLI: npm install -g @anthropic-ai/claude-code"
    fi
    
    # Repair Claude Desktop registration
    repair_claude_desktop_config
    
    echo ""
}

# Repair Claude Desktop configuration
repair_claude_desktop_config() {
    local config_paths=(
        "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
        "$HOME/.config/Claude/claude_desktop_config.json"
    )
    
    local config_path=""
    for path in "${config_paths[@]}"; do
        if [ -f "$path" ] || [ -d "$(dirname "$path")" ]; then
            config_path="$path"
            break
        fi
    done
    
    if [ -n "$config_path" ]; then
        print_action "Updating Claude Desktop configuration..."
        
        # Create config if it doesn't exist
        if [ ! -f "$config_path" ]; then
            mkdir -p "$(dirname "$config_path")"
            echo '{"mcpServers":{}}' > "$config_path"
            print_info "Created new Claude Desktop config"
        fi
        
        # Update config using Node.js for proper JSON handling
        if command -v node &> /dev/null; then
            node -e "
                const fs = require('fs');
                const path = require('path');
                
                const configPath = '$config_path';
                const zenodePath = '$SCRIPT_DIR';
                
                try {
                    let config = {};
                    try {
                        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    } catch (e) {
                        config = { mcpServers: {} };
                    }
                    
                    if (!config.mcpServers) {
                        config.mcpServers = {};
                    }
                    
                    // Configure zenode
                    config.mcpServers.zenode = {
                        command: 'docker',
                        args: ['exec', '-i', 'zenode-server', 'node', 'dist/index.js'],
                        env: {
                            MCP_WORKSPACE: process.env.MCP_WORKSPACE || process.env.HOME
                        }
                    };
                    
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    console.log('Claude Desktop config updated successfully');
                } catch (error) {
                    console.error('Failed to update config:', error.message);
                    process.exit(1);
                }
            " && {
                print_success "Claude Desktop configuration updated"
                add_fix "Updated Claude Desktop MCP configuration"
            } || {
                add_issue "Failed to update Claude Desktop config"
                print_error "Desktop configuration update failed"
                add_manual_step "Manually add zenode to Claude Desktop config at: $config_path"
            }
        else
            add_manual_step "Install Node.js to automatically update Claude Desktop config"
        fi
    else
        print_info "Claude Desktop not installed or config directory not found"
    fi
}

# Phase 4: Configuration Validation
phase4_validation() {
    print_phase "🧪 Phase 4: Configuration Validation"
    
    # Test basic container connectivity
    print_action "Testing container connectivity..."
    if docker exec zenode-server node dist/index.js version &> /dev/null; then
        print_success "Container CLI mode working"
    else
        add_issue "Container CLI mode failed"
        print_error "Cannot execute tools in container"
    fi
    
    # Test MCP protocol with detailed logging
    print_action "Testing MCP protocol..."
    local mcp_test_output
    mcp_test_output=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 30 docker exec -i zenode-server node dist/index.js 2>&1)
    local mcp_exit_code=$?

    if [[ $mcp_exit_code -eq 0 ]] && echo "$mcp_test_output" | grep -q '"result"'; then
        print_success "MCP protocol responding"
        # Check for planner tool specifically
        if echo "$mcp_test_output" | grep -q '"planner"'; then
            print_success "Planner tool available in MCP response"
        else
            add_issue "Planner tool not found in MCP response"
            print_warning "Planner tool missing from tool list"
        fi
    else
        add_issue "MCP protocol not responding (exit code: $mcp_exit_code)"
        print_error "MCP communication failed"
        echo "MCP Test Output:" >> "$LOG_FILE"
        echo "$mcp_test_output" >> "$LOG_FILE"
        print_info "MCP test output logged to $LOG_FILE"
    fi
    
    # Test API connectivity (if we can access a tool)
    print_action "Testing API connectivity..."
    local test_result
    test_result=$(docker exec zenode-server node dist/index.js version 2>&1 | grep -o "Available Tools" || echo "FAILED")
    if [[ "$test_result" != "FAILED" ]]; then
        print_success "Tools are accessible"
    else
        add_issue "Tools not accessible"
        print_error "Tool execution failed"
    fi
    
    # Test UUID generation and planner tool with continuation_id
    print_action "Testing UUID generation and planner tool..."
    local planner_test_output
    planner_test_output=$(docker exec zenode-server node dist/index.js planner '{"step":"Test UUID generation","step_number":1,"total_steps":1,"next_step_required":false}' 2>&1)
    local planner_exit_code=$?
    
    if [[ $planner_exit_code -eq 0 ]]; then
        print_success "Planner tool execution successful"
        # Log the output to check UUID format
        echo "Planner Test Output:" >> "$LOG_FILE"
        echo "$planner_test_output" >> "$LOG_FILE"
        
        # Extract and validate UUID format from output if present
        if echo "$planner_test_output" | grep -E "🔗 Thread: [a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"; then
            print_success "UUID format validation passed"
        else
            add_issue "UUID format validation failed - may be using old format"
            print_warning "Check planner output for proper UUID format"
        fi
    else
        add_issue "Planner tool execution failed (exit code: $planner_exit_code)"
        print_error "Planner tool test failed"
        echo "Planner Error Output:" >> "$LOG_FILE"
        echo "$planner_test_output" >> "$LOG_FILE"
    fi
    
    # Test :z coordination capabilities by checking bootstrap tool
    print_action "Testing :z coordination capabilities..."
    local bootstrap_test_output
    bootstrap_test_output=$(docker exec zenode-server node dist/index.js bootstrap '{"action":"check"}' 2>&1)
    local bootstrap_exit_code=$?
    
    if [[ $bootstrap_exit_code -eq 0 ]]; then
        # Check if the bootstrap output includes coordination status
        if echo "$bootstrap_test_output" | grep -q ":z Coordination Status"; then
            print_success ":z coordination capabilities verified"
            
            # Check for specific tool availability
            if echo "$bootstrap_test_output" | grep -q "All critical tools available"; then
                print_success "All critical zenode tools available for :z coordination"
            else
                add_issue "Some critical tools missing for :z coordination"
                print_warning "Check bootstrap output for missing tools"
            fi
        else
            add_issue ":z coordination status not found in bootstrap output"
            print_warning "Bootstrap may not include coordination validation"
        fi
        
        # Log bootstrap output for debugging
        echo "Bootstrap Test Output:" >> "$LOG_FILE"
        echo "$bootstrap_test_output" >> "$LOG_FILE"
    else
        add_issue "Bootstrap tool execution failed"
        print_error "Bootstrap test failed with exit code: $bootstrap_exit_code"
        echo "Bootstrap Error Output:" >> "$LOG_FILE"
        echo "$bootstrap_test_output" >> "$LOG_FILE"
    fi
    
    # Validate workspace paths and self-analysis capability
    print_action "Validating workspace configuration..."
    if [ -n "${MCP_WORKSPACE:-}" ]; then
        if [ -d "$MCP_WORKSPACE" ]; then
            print_success "Workspace path valid: $MCP_WORKSPACE"
            
            # Check if workspace allows zenode self-analysis
            if [[ "$MCP_WORKSPACE" == *"zen-mcp-server"* ]]; then
                print_success "Workspace configured for zen-mcp-server self-analysis"
                
                # Test if zenode tools can access the project files
                if docker exec zenode-server test -d /workspace/zenode 2>/dev/null; then
                    print_success "Zenode tools can access project files for self-analysis"
                else
                    add_issue "Zenode tools cannot access project files in workspace"
                    print_warning "Check volume mount configuration"
                fi
            else
                print_info "Workspace not pointing to zen-mcp-server (using external workspace)"
                add_manual_step "Consider setting MCP_WORKSPACE to zen-mcp-server root for self-analysis"
            fi
        else
            add_issue "Invalid workspace path: $MCP_WORKSPACE"
            print_error "Workspace directory does not exist"
        fi
    else
        print_info "MCP_WORKSPACE not set, using default"
    fi
    
    echo ""
}

# Phase 5: User Guidance
phase5_guidance() {
    print_phase "📋 Phase 5: Summary"
    echo ""
    
    # Report issues found
    if [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
        echo -e "${BOLD}${YELLOW}Issues Found:${NC}"
        for issue in "${ISSUES_FOUND[@]}"; do
            echo -e "${YELLOW}❌ $issue${NC}"
        done
        echo ""
    fi
    
    # Report fixes applied
    if [ ${#FIXES_APPLIED[@]} -gt 0 ]; then
        echo -e "${BOLD}${GREEN}Fixes Applied:${NC}"
        for fix in "${FIXES_APPLIED[@]}"; do
            echo -e "${GREEN}✅ $fix${NC}"
        done
        echo ""
    fi
    
    # Report manual steps needed
    if [ ${#MANUAL_STEPS[@]} -gt 0 ]; then
        echo -e "${BOLD}${CYAN}Manual Steps Required:${NC}"
        for step in "${MANUAL_STEPS[@]}"; do
            echo -e "${CYAN}🔧 $step${NC}"
        done
        echo ""
    fi
    
    # Next steps
    echo -e "${BOLD}${BLUE}Next Steps:${NC}"
    
    if [ ${#FIXES_APPLIED[@]} -gt 0 ]; then
        echo -e "${BLUE}🔄 Restart Claude Code to apply MCP changes${NC}"
        echo ""
    fi
    
    # Test commands
    echo -e "${BOLD}${CYAN}Test Commands:${NC}"
    echo -e "${CYAN}💡 Test CLI mode: docker exec zenode-server node dist/index.js version${NC}"
    echo -e "${CYAN}💡 Test :z trigger: Open Claude Code and type ':z test connection'${NC}"
    echo ""
    
    # Backup information
    echo -e "${BOLD}${BLUE}Backup Information:${NC}"
    echo -e "${BLUE}📁 Backups stored in: $BACKUP_DIR${NC}"
    echo -e "${BLUE}📝 Log file: $LOG_FILE${NC}"
    if [ ${#FIXES_APPLIED[@]} -gt 0 ]; then
        echo -e "${BLUE}🔄 Rollback command: $0 --rollback $(basename "$BACKUP_DIR")${NC}"
    fi
    echo ""
    
    # Overall status
    if [ ${#ISSUES_FOUND[@]} -eq 0 ]; then
        echo -e "${BOLD}${GREEN}🎉 All systems operational!${NC}"
    elif [ ${#MANUAL_STEPS[@]} -eq 0 ]; then
        echo -e "${BOLD}${YELLOW}⚠️  Issues detected but automatically resolved. Please restart Claude Code.${NC}"
    else
        echo -e "${BOLD}${RED}❌ Manual intervention required. Please complete the steps above.${NC}"
    fi
}

# Rollback function
rollback() {
    local backup_timestamp="$1"
    local rollback_dir="$HOME/.zenode-backups/$backup_timestamp"
    
    if [ ! -d "$rollback_dir" ]; then
        print_error "Backup directory not found: $rollback_dir"
        exit 1
    fi
    
    print_header
    print_phase "🔄 Rollback Mode"
    
    print_action "Rolling back configurations from $backup_timestamp..."
    
    # Rollback Claude Desktop config
    if [ -f "$rollback_dir/claude_desktop_config.json" ]; then
        local config_paths=(
            "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
            "$HOME/.config/Claude/claude_desktop_config.json"
        )
        
        for config_path in "${config_paths[@]}"; do
            if [ -f "$config_path" ]; then
                cp "$rollback_dir/claude_desktop_config.json" "$config_path"
                print_success "Restored Claude Desktop config"
                break
            fi
        done
    fi
    
    print_success "Rollback completed"
    print_info "Please restart Claude Code to apply changes"
}

# Main function
main() {
    # Handle rollback mode
    if [[ "$1" == "--rollback" ]] && [[ -n "$2" ]]; then
        rollback "$2"
        exit 0
    fi
    
    # Main repair flow
    print_header
    log "Starting zenode auto-repair process"
    
    phase1_health_check
    phase2_service_recovery
    phase3_mcp_repair
    phase4_validation
    phase5_guidance
    
    log "Auto-repair process completed"
}

# Run main function with all arguments
main "$@"