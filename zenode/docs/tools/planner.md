# Planner Tool - Interactive Sequential Planning

**Break down complex tasks through sophisticated step-by-step planning with branching and revision capabilities**

The `zenode:planner` tool enables systematic breakdown of complex ideas, problems, or projects into manageable, structured plans. Unlike simple planning tools, it supports incremental thinking, branching strategies, step revision, and multi-session continuation with Redis persistence. Perfect for system design, migration strategies, architectural decisions, and feature development.

## Key Features

- **Sequential step-by-step thinking** with full context awareness
- **Incremental plan building** - develop understanding as you progress
- **Branching support** for exploring alternative approaches
- **Revision capabilities** to update earlier decisions based on new insights
- **Multi-session continuation** with Redis persistence across sessions
- **Dynamic step adjustment** - modify total steps as complexity becomes clear
- **Cross-tool integration** with zenode ecosystem for execution
- **Professional output** with structured formatting and clear dependencies

## How It Works: 4-Rule Continuation Logic

### Rule 1: New Planning Session
```bash
# Starting fresh planning - creates new thread
zenode:planner --step "Define requirements for user authentication system" --step-number 1 --total-steps 5 --next-step-required true
```

### Rule 2: Previous Plan Context Loading
```bash
# Reference completed plan for new related planning
zenode:planner --step "Extend authentication to support OAuth" --step-number 1 --total-steps 3 --next-step-required true --continuation-id {previous_auth_plan_id}
```

### Rule 3: Continue Current Plan
```bash
# Continue existing planning session
zenode:planner --step "Design database schema for user profiles" --step-number 2 --total-steps 5 --next-step-required true --continuation-id {current_session_id}
```

### Rule 4: Complete Planning
```bash
# Final step in planning session
zenode:planner --step "Deploy and monitor authentication system" --step-number 5 --total-steps 5 --next-step-required false --continuation-id {current_session_id}
```

## Tool Parameters

### Required Parameters
- `step`: Detailed description of the current planning step and WHY it's needed
- `step_number`: Sequential step number (starting from 1)
- `total_steps`: Current estimate of total steps (can be adjusted)
- `next_step_required`: Whether another planning step will follow

### Revision Parameters
- `is_step_revision`: Boolean indicating this revises a previous step
- `revises_step_number`: Which step number this revision updates

### Branching Parameters
- `is_branch_point`: Boolean indicating this creates an alternative approach
- `branch_from_step`: Step number where this branch diverges
- `branch_id`: Identifier for the branch (e.g., 'microservices-approach')

### Continuation Parameters
- `continuation_id`: UUID for multi-session continuation
- `more_steps_needed`: Boolean indicating additional steps beyond estimate

## Usage Examples

### System Architecture Planning
```bash
# Step 1: Start new planning session
zenode:planner "Design scalable microservices architecture for e-commerce platform that needs to handle 100K concurrent users and integrate with existing legacy systems" --step-number 1 --total-steps 6 --next-step-required true

# Step 2: Continue with technical analysis
zenode:planner "Analyze current legacy system integration points and identify API boundaries for smooth data flow between old and new systems" --step-number 2 --total-steps 6 --next-step-required true --continuation-id {session_id}

# Step 3: Branch for alternative approach
zenode:planner "Consider strangler fig pattern as alternative to big-bang migration approach" --step-number 3 --total-steps 6 --next-step-required true --continuation-id {session_id} --is-branch-point true --branch-from-step 2 --branch-id "strangler-pattern"
```

### Feature Development Planning
```bash
# Initial feature planning
zenode:planner "Plan implementation of real-time chat feature with message persistence, user presence indicators, and file sharing capabilities" --step-number 1 --total-steps 4 --next-step-required true

# Detailed technical breakdown
zenode:planner "Design WebSocket connection management with fallback to long polling, including connection pooling and load balancing across multiple server instances" --step-number 2 --total-steps 4 --next-step-required true --continuation-id {session_id}

# Revision based on new requirements
zenode:planner "Revise connection management to include support for mobile app background states and push notifications when WebSocket disconnects" --step-number 2 --total-steps 4 --next-step-required true --continuation-id {session_id} --is-step-revision true --revises-step-number 2
```

## Zenode-Specific Features

### Redis Persistence Integration
The planner tool leverages zenode's Redis-based conversation memory:
- **Session persistence**: Plans survive container restarts
- **Cross-session references**: Load context from previous complete plans
- **Branch tracking**: Maintain multiple plan alternatives
- **Revision history**: Track changes and decision evolution

### Multi-Provider Model Support
```bash
# Use different models for different planning phases
zenode:planner "Strategic overview" --model pro --step-number 1    # Gemini Pro for high-level thinking
zenode:planner "Technical details" --model o3 --step-number 2     # OpenAI O3 for systematic analysis
zenode:planner "Implementation" --model flash --step-number 3     # Gemini Flash for rapid iteration
```

### Container-Native Operations
- **Workspace awareness**: Plans consider `/workspace/` file structure
- **Docker integration**: Account for containerized development environment
- **Volume persistence**: Plans reference accessible file paths
- **Service orchestration**: Consider multi-container deployments

### Cross-Tool Integration Patterns
```bash
# Planner → Analysis workflow
# Step 1: Create strategic plan
zenode:planner "Plan microservices decomposition" --step-number 1 --total-steps 3 --next-step-required true

# Step 2: Execute with analysis tools
zenode:analyze "analyze codebase for microservices boundaries based on plan" --files ["/workspace/src"] --continuation-id {planner_session}

# Step 3: Continue planning with analysis results
zenode:planner "Refine boundaries based on analysis findings" --step-number 2 --total-steps 3 --next-step-required true --continuation-id {planner_session}
```

## Advanced Planning Patterns

### Branching Strategy Example
```bash
# Main approach: Complete rewrite
zenode:planner "Plan complete TypeScript rewrite of legacy JavaScript codebase" --step-number 1 --total-steps 5 --next-step-required true

# Alternative branch: Incremental migration
zenode:planner "Consider incremental TypeScript adoption with gradual type introduction" --step-number 1 --total-steps 4 --next-step-required true --is-branch-point true --branch-from-step 1 --branch-id "incremental-migration"

# Compare branches with consensus
zenode:consensus "Compare rewrite vs incremental migration approaches" --models '[
  {"model": "pro", "stance": "for", "stance_prompt": "Advocate for complete rewrite approach"},
  {"model": "o3", "stance": "for", "stance_prompt": "Advocate for incremental migration"}
]'
```

### Multi-Session Continuation
```bash
# Complete Phase 1 planning
zenode:planner "Finalize Phase 1 architecture decisions" --step-number 8 --total-steps 8 --next-step-required false --continuation-id {phase1_id}

# Start Phase 2 with Phase 1 context
zenode:planner "Begin Phase 2 implementation planning using Phase 1 architecture" --step-number 1 --total-steps 5 --next-step-required true --continuation-id {phase1_id}
```

## Best Practices for Zenode

### Effective Step Descriptions
```bash
# ✅ GOOD: Specific with context
zenode:planner "Design database schema for user authentication with support for OAuth2, MFA, and role-based permissions, considering our existing PostgreSQL setup and need for GDPR compliance" --step-number 1

# ❌ BAD: Too vague
zenode:planner "Design database" --step-number 1
```

### Strategic Model Selection
```bash
# High-level strategic thinking
zenode:planner "Strategic overview" --model pro --thinking-mode high

# Detailed technical planning
zenode:planner "Technical implementation" --model o3 --thinking-mode medium

# Quick iteration planning
zenode:planner "Implementation details" --model flash --thinking-mode low
```

## When to Use Planner vs Other Zenode Tools

- **Use `zenode:planner`** for: Complex multi-step projects, architectural decisions, systematic problem breakdown
- **Use `zenode:thinkdeep`** for: Single-session deep analysis without step-by-step structure
- **Use `zenode:chat`** for: Open-ended discussions and brainstorming
- **Use `zenode:analyze`** for: Direct code/file analysis without planning overhead
- **Use `zenode:consensus`** for: Comparing completed plans or approaches

The zenode:planner tool provides sophisticated project planning capabilities that leverage zenode's unique architecture for persistent, collaborative, and executable planning workflows.