#!/bin/bash
# Zenode Repair Functions
# Individual repair operations

# Repair Docker services
repair_docker_services() {
    local compose_cmd="docker compose"
    if ! docker compose version &> /dev/null; then
        compose_cmd="docker-compose"
    fi
    
    echo "Stopping existing services..."
    $compose_cmd down 2>/dev/null || true
    
    # Clean up orphaned containers and networks
    docker container prune -f 2>/dev/null || true
    docker network prune -f 2>/dev/null || true
    
    echo "Starting services..."
    if $compose_cmd up -d; then
        echo "Services started successfully"
        return 0
    else
        echo "Failed to start services"
        return 1
    fi
}

# Repair MCP registration for Claude Code CLI
repair_mcp_registration() {
    if ! command -v claude &> /dev/null; then
        echo "Claude Code CLI not installed"
        return 1
    fi
    
    # Remove existing registration
    claude mcp remove zenode 2>/dev/null || true
    
    # Add new registration
    if claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js; then
        echo "MCP registration successful"
        return 0
    else
        echo "MCP registration failed"
        return 1
    fi
}

# Repair API configuration
repair_api_configuration() {
    local env_file="$SCRIPT_DIR/.env"
    
    if [ ! -f "$env_file" ]; then
        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            cp "$SCRIPT_DIR/.env.example" "$env_file"
            echo "Created .env from .env.example"
        else
            echo "No .env.example found"
            return 1
        fi
    fi
    
    # Validate API keys
    source "$env_file"
    
    local needs_key=true
    if [[ -n "${OPENROUTER_API_KEY:-}" ]] && [[ "${OPENROUTER_API_KEY}" != "your_openrouter_api_key_here" ]]; then
        needs_key=false
    fi
    
    if [[ -n "${OPENAI_API_KEY:-}" ]] && [[ "${OPENAI_API_KEY}" != "your_openai_api_key_here" ]]; then
        needs_key=false
    fi
    
    if [[ -n "${GEMINI_API_KEY:-}" ]] && [[ "${GEMINI_API_KEY}" != "your_gemini_api_key_here" ]]; then
        needs_key=false
    fi
    
    if [ "$needs_key" = true ]; then
        echo "No valid API keys found in .env"
        echo "Please add at least one API key to .env file:"
        echo "  - OPENROUTER_API_KEY"
        echo "  - OPENAI_API_KEY"
        echo "  - GEMINI_API_KEY"
        return 1
    fi
    
    return 0
}

# Clean up conflicts
cleanup_conflicts() {
    # Kill processes using Redis port
    local redis_pids=$(lsof -ti :6380 | grep -v docker || true)
    if [[ -n "$redis_pids" ]]; then
        echo "Killing processes on port 6380: $redis_pids"
        kill -9 $redis_pids 2>/dev/null || true
    fi
    
    # Clean up any orphaned zenode containers
    local orphaned=$(docker ps -a --filter "name=zenode" --format "{{.Names}}" | grep -v "zenode-server\|zenode-redis\|zenode-log-monitor" || true)
    if [[ -n "$orphaned" ]]; then
        echo "Removing orphaned containers: $orphaned"
        docker rm -f $orphaned 2>/dev/null || true
    fi
    
    return 0
}

# Rebuild containers if needed
rebuild_if_needed() {
    local compose_cmd="docker compose"
    if ! docker compose version &> /dev/null; then
        compose_cmd="docker-compose"
    fi
    
    # Check if rebuild is needed (force rebuild if build failed recently)
    local build_log="/tmp/zenode-build.log"
    
    echo "Rebuilding containers..."
    if $compose_cmd build --no-cache > "$build_log" 2>&1; then
        echo "Container rebuild successful"
        rm -f "$build_log"
        return 0
    else
        echo "Container rebuild failed. Check log at: $build_log"
        return 1
    fi
}

# Fix file permissions
fix_permissions() {
    local script_dir="$SCRIPT_DIR"
    
    # Ensure script directory is readable
    chmod -R u+rw "$script_dir" 2>/dev/null || {
        echo "Cannot fix permissions for $script_dir"
        return 1
    }
    
    # Ensure .env file is readable
    if [ -f "$script_dir/.env" ]; then
        chmod 600 "$script_dir/.env" 2>/dev/null || {
            echo "Cannot fix .env permissions"
            return 1
        }
    fi
    
    echo "File permissions fixed"
    return 0
}

# Validate environment
validate_environment() {
    # Check Node.js version in container
    local node_version=$(docker exec zenode-server node --version 2>/dev/null || echo "unknown")
    echo "Container Node.js version: $node_version"
    
    # Check npm packages
    local npm_status=$(docker exec zenode-server npm list --production --depth=0 2>/dev/null | grep -c "node_modules" || echo "0")
    echo "NPM packages installed: $npm_status"
    
    # Check TypeScript compilation
    if docker exec zenode-server test -d dist; then
        echo "TypeScript compilation: exists"
    else
        echo "TypeScript compilation: missing"
        return 1
    fi
    
    return 0
}