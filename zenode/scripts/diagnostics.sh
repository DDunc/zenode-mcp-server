#!/bin/bash
# Zenode Diagnostics Script
# Advanced health check utilities

# Check Docker status with detailed diagnostics
check_docker_status() {
    local status="healthy"
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        echo "Docker daemon not running"
        return 1
    fi
    
    # Check Docker version compatibility
    local docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
    if [[ -n "$docker_version" ]]; then
        echo "Docker version: $docker_version"
    fi
    
    # Check available resources
    local docker_info=$(docker system df 2>/dev/null)
    if [[ -n "$docker_info" ]]; then
        echo "Docker system resources:"
        echo "$docker_info"
    fi
    
    return 0
}

# Check container health with detailed status
check_container_health() {
    local container_name="$1"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q "$container_name.*Up"; then
        local status=$(docker inspect "$container_name" --format='{{.State.Health.Status}}' 2>/dev/null)
        if [[ "$status" == "healthy" ]]; then
            echo "$container_name: healthy"
            return 0
        else
            echo "$container_name: running but not healthy (status: $status)"
            return 1
        fi
    else
        echo "$container_name: not running"
        return 1
    fi
}

# Advanced API connectivity test
check_api_connectivity() {
    local env_file="$SCRIPT_DIR/.env"
    
    if [ ! -f "$env_file" ]; then
        echo "No .env file found"
        return 1
    fi
    
    source "$env_file"
    
    # Test OpenRouter connectivity
    if [[ -n "${OPENROUTER_API_KEY:-}" ]] && [[ "${OPENROUTER_API_KEY}" != "your_openrouter_api_key_here" ]]; then
        if curl -s -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/models | grep -q "models"; then
            echo "OpenRouter API: accessible"
        else
            echo "OpenRouter API: authentication failed"
            return 1
        fi
    fi
    
    # Test OpenAI connectivity
    if [[ -n "${OPENAI_API_KEY:-}" ]] && [[ "${OPENAI_API_KEY}" != "your_openai_api_key_here" ]]; then
        if curl -s -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models | grep -q "models"; then
            echo "OpenAI API: accessible"
        else
            echo "OpenAI API: authentication failed"
            return 1
        fi
    fi
    
    return 0
}

# Test :z trigger functionality
test_z_trigger() {
    # This is a placeholder - actual :z trigger testing would require
    # integration with Claude Code client
    echo "Note: :z trigger testing requires manual verification in Claude Code"
    return 0
}

# Network connectivity diagnostics
check_network_connectivity() {
    # Check if container can reach external networks
    if docker exec zenode-server ping -c 1 8.8.8.8 &> /dev/null; then
        echo "Container network: external connectivity OK"
    else
        echo "Container network: external connectivity failed"
        return 1
    fi
    
    # Check internal Docker network
    if docker network ls | grep -q "zenode_zenode-network"; then
        echo "Docker network: zenode network exists"
    else
        echo "Docker network: zenode network missing"
        return 1
    fi
    
    return 0
}

# Performance diagnostics
check_performance() {
    # Check container resource usage
    local stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep zenode || echo "No containers")
    echo "Container resource usage:"
    echo "$stats"
    
    # Check disk space
    local disk_usage=$(df -h . | tail -1 | awk '{print $5}')
    echo "Disk usage: $disk_usage"
    
    return 0
}