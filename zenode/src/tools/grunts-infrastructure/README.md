# 🤖 ZN-Grunts: Distributed LLM Orchestration System

**Competitive coding with specialized AI models for web development**

## Overview

ZN-Grunts deploys multiple specialized Large Language Models (LLMs) in Docker containers to competitively solve web development tasks. Each LLM specializes in different aspects of modern web development and works independently to create the best possible solution.

## Features

### 🎯 **Multi-LLM Competition**
- 2-6 specialized LLMs working on the same task
- Real-time competitive coding with live metrics
- Quality assessment and automatic best-solution selection

### 🌐 **Web Technology Focus**
- JavaScript/TypeScript/Node.js specialists
- DOM manipulation and modern frameworks (React/Vue/Angular)
- CSS/SCSS and responsive design experts
- API development and testing specialists
- Performance optimization and bundling experts

### 📊 **Real-Time Monitoring**
- Live dashboard on `http://localhost:3030`
- Progress tracking: lines added/deleted, tests passed/failed
- Container status and resource usage
- Execution timeline with 4-hour maximum

### 🔧 **Tiered Resource Management**
- **Ultralight (8GB):** 2 small models for development/testing
- **Light (24GB):** 4 models for small projects
- **Medium (48GB):** 6 specialized models (default)
- **High (96GB):** 6 large enterprise-grade models

### 🍎 **Apple Silicon Optimized**
- Native ARM64 Docker containers
- Metal Performance Shaders support
- Node.js + C++ bridge capabilities

## Quick Start

### Prerequisites
- Docker with Apple Silicon support
- 48GB+ RAM (for medium tier)
- Node.js 20+ for development

### Using the Tool

```bash
# Call via zenode MCP
zenode:grunts "Create a React todo app with TypeScript and tests"

# With specific tier
zenode:grunts "Build a REST API with Node.js" --tier high

# With custom technologies
zenode:grunts "Modern e-commerce frontend" --target_technologies ["react", "typescript", "tailwind", "jest"]
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | Development task description |
| `tier` | enum | "medium" | Resource tier: ultralight/light/medium/high |
| `max_execution_time` | number | 14400 | Max execution time in seconds (4 hours) |
| `partial_assessment_interval` | number | 1800 | Partial assessment interval (30 min) |
| `target_technologies` | array | ["javascript", "typescript", "nodejs", "dom", "css"] | Target technologies |

## Architecture

### Container Structure
```
grunts-status (port 3030)     # Monitoring dashboard
├── WebSocket live updates
├── Container health monitoring
└── Progress metrics

test-runner (port 8080)       # Test execution service
├── Jest/Vitest support
├── Auto-generated tests
└── Continuous testing

LLM Containers (2-6)          # Specialized coding models
├── grunt-qwen-14b            # JavaScript/TypeScript specialist
├── grunt-codellama-13b       # Framework development
├── grunt-deepseek-33b        # Performance optimization
├── grunt-starcoder-15b       # Testing and CI/CD
├── grunt-mistral-7b          # CSS/Design systems
└── grunt-llama-8b            # Documentation/APIs
```

### Workflow Pipeline
1. **Task Decomposition** (via `zenode:thinkdeep`)
2. **Container Deployment** (specialized LLMs)
3. **Competitive Coding** (iterative development)
4. **Real-time Testing** (continuous validation)
5. **Partial Assessments** (every 30 minutes)
6. **Quality Evaluation** (via `zenode:analyze`, `zenode:debug`)
7. **Final Integration** (best solution selection)

## Model Configurations

### Medium Tier (48GB) - Default
```yaml
Models:
  - qwen2.5-coder:14b (20GB) - JavaScript/TypeScript/Node.js
  - codellama:13b (18GB) - React/Vue/Angular frameworks  
  - deepseek-coder:33b (25GB) - Performance optimization
  - starcoder2:15b (22GB) - Testing/CI/CD
  - mistral:7b-instruct (8GB) - CSS/Design systems
  - llama3.1:8b (10GB) - Documentation/APIs
```

### High Tier (96GB) - Enterprise
```yaml
Models:
  - qwen2.5-coder:32b (40GB) - Enterprise JavaScript
  - codellama:34b (45GB) - Complex framework development
  - deepseek-coder:67b (60GB) - Architecture/optimization
  - llama3.1:70b (70GB) - Research/planning
  - mixtral:8x7b (50GB) - Multi-language support
  - starcoder2:34b (45GB) - Advanced testing/QA
```

## Status Dashboard

### Live Metrics
- **Execution Timer:** Real-time countdown from 4-hour limit
- **Container Status:** Running/completed/failed for each LLM
- **Code Metrics:** Lines added/deleted per container
- **Test Results:** Passed/failed test counts
- **Progress:** Overall completion percentage

### API Endpoints
```bash
GET  /api/status              # Current execution status
GET  /api/logs/:containerId   # Container logs
GET  /api/workspace/:task/:worker  # Generated files
POST /api/test/:task/:worker  # Trigger tests
```

## File Structure

```
.zenode/tools/zn-grunts/
├── docker/
│   ├── status-service/       # Monitoring dashboard
│   ├── test-runner/          # Test execution environment
│   └── llm-containers/       # Worker scripts
├── templates/
│   └── docker-compose.yml.template
├── workspace/
│   ├── task1/worker1/        # Generated code
│   └── task1/worker2/
├── results/
│   ├── execution-logs/
│   ├── generated-code/
│   └── quality-reports/
└── README.md
```

## Development

### Running Tests
```bash
# Unit tests
npm test src/tools/__tests__/grunts.test.ts

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### Building Containers
```bash
# Build all services
docker compose -f docker-compose.yml build

# Build specific service
docker build docker/status-service -t grunts-status

# Start monitoring only
docker compose up grunts-status
```

### Debugging
```bash
# View all container logs
docker compose logs -f

# Debug specific container
docker exec -it grunt-qwen-14b /bin/bash

# Monitor resource usage
docker stats
```

## Troubleshooting

### Common Issues

**Out of Memory**
```bash
# Check available RAM
free -h

# Monitor container memory usage
docker stats --format "table {{.Container}}\\t{{.MemUsage}}"

# Switch to lower tier
zenode:grunts "task" --tier light
```

**Model Download Failures**
```bash
# Check Ollama status
docker exec grunt-qwen-14b ollama list

# Manual model download
docker exec grunt-qwen-14b ollama pull qwen2.5-coder:14b

# Use fallback models (automatic)
```

**Container Startup Issues**
```bash
# Check container logs
docker logs grunt-qwen-14b

# Restart specific container
docker compose restart grunt-qwen-14b

# Rebuild containers
docker compose down && docker compose up --build
```

### Performance Tuning

**Memory Optimization**
- Use appropriate tier for available RAM
- Enable swap if needed (not recommended for production)
- Monitor container memory limits

**CPU Optimization**
- Ensure Docker has access to all CPU cores
- Use CPU quotas for resource balancing
- Monitor CPU usage during execution

## Contributing

### Adding New Models
1. Update model configurations in `grunts.ts`
2. Add fallback models for reliability
3. Test with different resource tiers
4. Update documentation

### Extending Specializations
1. Define new specialization areas
2. Create specialized prompts
3. Add corresponding test templates
4. Update monitoring dashboard

## License

MIT License - See LICENSE file for details

---

**🚀 Ready to orchestrate distributed AI coding? Deploy your grunts!**