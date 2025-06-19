# Zenode Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Zenode MCP Server. Zenode-specific troubleshooting focuses on Docker containers, Node.js/TypeScript issues, and Redis persistence.

## Quick Diagnostic Commands

**Health Check Sequence:**
```bash
# 1. Check Docker containers
cd zenode && docker-compose ps

# 2. Test basic zenode functionality
zenode:version

# 3. Test simple operation
zenode:chat "test - what is 2+2?" --model auto

# 4. Check logs for errors
docker-compose logs zenode-server --tail=20 | grep -E "(error|fail|warn)"
```

## Common Issues and Solutions

### 1. Docker Container Issues

#### **Container Not Starting**
**Symptoms:** `docker-compose ps` shows containers as "Exit 1" or not running

**Diagnosis:**
```bash
# Check container logs
docker-compose logs zenode-server

# Check for port conflicts
docker-compose ps
lsof -i :6380  # Redis port
```

**Solutions:**
```bash
# Restart containers
docker-compose down && docker-compose up -d

# Rebuild if code changes
docker-compose down && docker-compose up --build -d

# Check for resource constraints
docker system df
docker system prune  # If needed
```

#### **Container Health Issues**
**Symptoms:** Containers running but zenode tools timeout or fail

**Diagnosis:**
```bash
# Check container health
docker-compose ps
# Look for "Up (healthy)" status

# Check resource usage
docker stats

# Inspect container logs
docker-compose logs zenode-server --tail=50
docker-compose logs redis --tail=20
```

**Solutions:**
```bash
# Restart unhealthy containers
docker-compose restart zenode-server redis

# Check memory/CPU limits in docker-compose.yml
# Increase resources if needed

# Verify network connectivity
docker-compose exec zenode-server ping redis
```

### 2. API Key and Authentication Issues

#### **API Keys Not Working**
**Symptoms:** Tools respond with authentication errors

**Diagnosis:**
```bash
# Check .env file exists and has keys
cat zenode/.env | grep -E "(GEMINI|OPENAI|OPENROUTER)_API_KEY"

# Verify API key format
echo $OPENROUTER_API_KEY | grep -E "^sk-or-v1-"  # OpenRouter format
echo $GEMINI_API_KEY | grep -E "^[A-Za-z0-9_-]+$"  # Gemini format
```

**Solutions:**
```bash
# Update .env file
cp zenode/.env.example zenode/.env
# Edit with valid API keys

# Restart containers to pick up new keys
docker-compose restart

# Test specific provider
zenode:chat "test" --model pro  # Gemini
zenode:chat "test" --model o3   # OpenAI
```

#### **Invalid API Key Format**
**Common Formats:**
- **OpenRouter**: `sk-or-v1-xxxxxxxx`
- **OpenAI**: `sk-xxxxxxxx`
- **Gemini**: `AIxxxxxxxx` or alphanumeric string

**Verification:**
```bash
# Test API key with simple request
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models | jq '.data[0].id'
```

### 3. File Access and Path Issues

#### **Files Not Found in Container**
**Symptoms:** zenode:seer or zenode:gopher can't find files

**Diagnosis:**
```bash
# Check if file exists on host
ls -la /Users/you/project/file.jpg

# Check workspace mounting
docker-compose config | grep -A5 -B5 volumes

# Test file access in container
zenode:gopher --action file_exists --path "/workspace/project/file.jpg"
```

**Solutions:**
```bash
# Use correct container paths
# ❌ Wrong: /Users/you/Desktop/image.jpg
# ✅ Correct: /workspace/Desktop/image.jpg

# Verify volume mount in docker-compose.yml
volumes:
  - ${HOME}:/workspace:rw

# Check file permissions
docker-compose exec zenode-server ls -la /workspace/
```

#### **Path Translation Issues**
**Auto Path Conversion:**
```bash
# Zenode should automatically convert:
# /Users/edunc/project/file.txt → /workspace/project/file.txt
# ~/Desktop/image.jpg → /workspace/Desktop/image.jpg

# If not working, use explicit workspace paths
zenode:seer "analyze image" --images ["/workspace/Desktop/image.jpg"]
```

### 4. Redis and Conversation Issues

#### **Conversation Threading Not Working**
**Symptoms:** Conversations don't persist, continuation_id errors

**Diagnosis:**
```bash
# Check Redis container status
docker-compose ps redis

# Test Redis connectivity
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis --tail=20
```

**Solutions:**
```bash
# Restart Redis container
docker-compose restart redis

# Check Redis configuration in .env
REDIS_URL=redis://redis:6379/0

# Test conversation persistence
zenode:chat "remember this: 42" --model auto
# Should return continuation_id for follow-up
```

#### **Redis Memory Issues**
**Symptoms:** Redis container crashes, memory errors

**Diagnosis:**
```bash
# Check Redis memory usage
docker-compose exec redis redis-cli info memory

# Monitor container resources
docker stats redis
```

**Solutions:**
```bash
# Add memory limit to docker-compose.yml
redis:
  image: redis:7-alpine
  mem_limit: 512m
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### 5. Model Selection and Provider Issues

#### **Model Not Available**
**Symptoms:** "Unknown model" or "Model not supported" errors

**Diagnosis:**
```bash
# List available models
zenode:listmodels

# Check provider configuration
zenode:version

# Test specific provider
zenode:chat "test" --model flash  # Gemini
zenode:chat "test" --model o3     # OpenAI
```

**Solutions:**
```bash
# Verify API keys are configured
grep -E "(GEMINI|OPENAI|OPENROUTER)_API_KEY" zenode/.env

# Check model restrictions
grep "ALLOWED_MODELS" zenode/.env

# Use auto mode for intelligent selection
zenode:chat "test" --model auto
```

#### **Vision Models Not Working**
**Symptoms:** zenode:seer fails with model errors

**Diagnosis:**
```bash
# Check vision model configuration
grep "DEFAULT_VISION_MODEL" zenode/.env

# Test vision provider directly
zenode:chat "describe this" --images ["/workspace/test.jpg"] --model auto
```

**Solutions:**
```bash
# Set explicit vision model
DEFAULT_VISION_MODEL=openai/gpt-4o

# Ensure vision provider has API key
OPENAI_API_KEY=your_key_here
# or
OPENROUTER_API_KEY=your_key_here

# Restart containers
docker-compose restart
```

### 6. MCP Protocol Issues

#### **MCP Server Not Responding**
**Symptoms:** `zenode:version` fails, no response from zenode tools

**Diagnosis:**
```bash
# Check MCP server process
docker-compose exec zenode-server ps aux | grep node

# Check MCP server logs
docker-compose logs zenode-server | grep -i "mcp\|server\|listening"

# Test JSON-RPC protocol
echo '{"method":"tools/list","params":{}}' | docker-compose exec -T zenode-server node dist/index.js
```

**Solutions:**
```bash
# Restart MCP server
docker-compose restart zenode-server

# Check for JavaScript/TypeScript errors
docker-compose logs zenode-server | grep -i "error\|exception"

# Rebuild if code changed
docker-compose up --build -d
```

#### **MCP Tool Registration Issues**
**Symptoms:** Tools not available in Claude Code

**Diagnosis:**
```bash
# Check tool registration
zenode:version | grep -i "tools"

# Verify MCP server configuration
docker-compose logs zenode-server | grep -i "tool"
```

**Solutions:**
```bash
# Restart Claude Code session
# Tools are registered on server startup

# Check MCP configuration in Claude Code
# Verify server path and arguments
```

### 7. Performance Issues

#### **Slow Response Times**
**Symptoms:** Tools take much longer than expected

**Diagnosis:**
```bash
# Check container resource usage
docker stats

# Monitor network latency
time zenode:chat "quick test" --model flash

# Check Redis performance
docker-compose exec redis redis-cli --latency
```

**Solutions:**
```bash
# Use faster models for simple tasks
zenode:chat "quick question" --model flash

# Optimize conversation history
MAX_CONVERSATION_TURNS=10  # Reduce in .env

# Add resource limits to docker-compose.yml
zenode-server:
  mem_limit: 2g
  cpus: 2
```

#### **High Memory Usage**
**Symptoms:** System slowdown, container restarts

**Diagnosis:**
```bash
# Check memory usage by service
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Monitor Node.js heap usage
docker-compose logs zenode-server | grep -i "memory\|heap"
```

**Solutions:**
```bash
# Set Node.js memory limits
environment:
  - NODE_OPTIONS=--max-old-space-size=1024

# Optimize conversation pruning
CONVERSATION_TIMEOUT_HOURS=1
```

### 8. TypeScript and Build Issues

#### **JavaScript/TypeScript Errors**
**Symptoms:** Container starts but tools fail with TypeError

**Diagnosis:**
```bash
# Check TypeScript compilation
docker-compose exec zenode-server npm run build

# Check for missing dependencies
docker-compose logs zenode-server | grep -i "cannot find module"
```

**Solutions:**
```bash
# Rebuild with dependencies
docker-compose down
docker-compose up --build -d

# Check package.json dependencies
docker-compose exec zenode-server npm list
```

## Advanced Debugging

### Container Deep Dive
```bash
# Enter container for debugging
docker-compose exec zenode-server bash

# Check Node.js process
ps aux | grep node
lsof -p $(pgrep node)

# Test modules directly
node -e "console.log(require('./dist/config.js'))"
```

### Network Debugging
```bash
# Check container networking
docker network ls
docker network inspect zenode_default

# Test internal connectivity
docker-compose exec zenode-server ping redis
docker-compose exec zenode-server curl http://redis:6379
```

### Log Analysis
```bash
# Real-time log monitoring
docker-compose logs -f zenode-server

# Search for specific errors
docker-compose logs zenode-server | grep -C5 "ERROR"

# Export logs for analysis
docker-compose logs zenode-server > zenode-debug.log
```

## Recovery Procedures

### Complete Reset
```bash
# Nuclear option - complete reset
cd zenode
docker-compose down -v  # Removes volumes too
docker-compose up --build -d

# Wait for startup
sleep 30

# Verify functionality
zenode:version
```

### Partial Recovery
```bash
# Just restart services
docker-compose restart

# Rebuild only if needed
docker-compose up --build -d zenode-server
```

### Data Recovery
```bash
# Backup Redis data before reset
docker-compose exec redis redis-cli save
docker cp $(docker-compose ps -q redis):/data/dump.rdb ./redis-backup.rdb

# Restore after reset
docker cp ./redis-backup.rdb $(docker-compose ps -q redis):/data/dump.rdb
docker-compose restart redis
```

## Prevention Tips

1. **Monitor container health regularly**
2. **Keep API keys secure and properly formatted**
3. **Use `/workspace/` paths consistently**
4. **Monitor Redis memory usage**
5. **Test zenode:version regularly**
6. **Keep Docker and Node.js updated**
7. **Review logs periodically for warnings**

## Getting Help

When reporting issues, include:

```bash
# System information
zenode:version
docker-compose --version
docker --version

# Container status
docker-compose ps

# Recent logs
docker-compose logs zenode-server --tail=50
docker-compose logs redis --tail=20

# Configuration (redact API keys)
grep -v "API_KEY" zenode/.env
```

For complex issues, use zenode's debugging capabilities:
```bash
:z "help me debug this zenode issue with detailed analysis"
```