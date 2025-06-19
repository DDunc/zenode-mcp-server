# Planner Tool - Interactive Step-by-Step Planning

**Break down complex projects into manageable, structured plans through step-by-step thinking**

The `planner` tool helps you break down complex ideas, problems, or projects into multiple manageable steps. Perfect for system design, migration strategies, architectural planning, and feature development with branching and revision capabilities.

## How It Works

The planner tool enables step-by-step thinking with incremental plan building:

1. **Start with step 1**: Describe the task or problem to plan
2. **Continue building**: Add subsequent steps, building the plan piece by piece  
3. **Revise when needed**: Update earlier decisions as new insights emerge
4. **Branch alternatives**: Explore different approaches when multiple options exist
5. **Continue across sessions**: Resume planning later with full context via Redis persistence

## Zenode Usage Examples

### Basic Planning
```bash
zenode:planner "Plan a real-time notification system" --step_number 1 --total_steps 5 --next_step_required true
```

### Continue Planning Session
```bash
zenode:planner "Database schema design" --step_number 2 --continuation_id uuid-abc123 --next_step_required true
```

### Branch Alternative Approach
```bash
zenode:planner "Alternative: Use WebSockets" --step_number 3 --is_branch_point true --branch_id websocket-approach --branch_from_step 2
```

### Revise Previous Step
```bash
zenode:planner "Updated auth requirements" --step_number 4 --is_step_revision true --revises_step_number 2
```

### Cross-Tool Workflow
```bash
:z "Use planner to design the API, then analyze the existing codebase with zenode:analyze to see how it fits"
```

## Key Features

- **Step-by-step breakdown**: Build plans incrementally with full context awareness
- **Branching support**: Explore alternative approaches when needed  
- **Revision capabilities**: Update earlier decisions as new insights emerge
- **Multi-session continuation**: Resume planning across multiple sessions with Redis persistence
- **Dynamic adjustment**: Modify step count and approach as planning progresses
- **Visual presentation**: ASCII charts, diagrams, and structured formatting
- **Professional output**: Clean, structured plans without emojis or time estimates
- **Cross-tool integration**: Seamlessly flows into zenode:analyze, zenode:debug, etc.

## Zenode Integration Examples

### Planning with Analysis
```bash
zenode:planner "Plan microservices architecture" --step_number 1 --total_steps 5
# After planning is complete, analyze existing code:
zenode:analyze --files src/ --prompt "How does this plan fit with our current codebase?"
```

### Planning with Visual Design
```bash
zenode:planner "Design user authentication flow" --step_number 1 --total_steps 4
# Analyze visual mockups with seer tool:
zenode:seer "Review this login UI against our planned flow" --images "/workspace/designs/login.png"
```

### Planning with Research
```bash
zenode:planner "Plan AI integration strategy" --step_number 1 --total_steps 6
# Research current best practices:
zenode:visit "Research latest AI integration patterns and best practices"
```

### Collaborative Planning
```bash
:z "Create a comprehensive plan for migrating to microservices, then get multiple perspectives"
# This will use planner for structured breakdown, then coordinate with other tools for validation
```

## Advanced Features

### Continuation Logic (Redis-Powered)

The planner implements sophisticated 4-rule continuation logic:

1. **New Planning Thread**: `step_number=1` without `continuation_id` creates new session
2. **Load Previous Context**: `step_number=1` with `continuation_id` loads previous completed plans  
3. **Continue Current Plan**: `step_number>1` with `continuation_id` continues current session
4. **Complete Planning**: `next_step_required=false` stores complete plan summary

### Branching and Alternatives

```bash
# Create branch point
zenode:planner "Explore database options" --step_number 3 --is_branch_point true --branch_id database-choice

# Continue on branch
zenode:planner "PostgreSQL implementation" --step_number 4 --branch_id postgresql-approach

# Alternative branch  
zenode:planner "MongoDB implementation" --step_number 4 --branch_id mongodb-approach
```

### Revision Capabilities

```bash
# Revise earlier decision
zenode:planner "Updated security requirements" --step_number 5 --is_step_revision true --revises_step_number 2

# The tool tracks revision history and impacts on downstream steps
```

## Best Practices

- **Start broad, then narrow**: Begin with high-level strategy, then add implementation details
- **Include constraints**: Consider technical, organizational, and resource limitations
- **Plan for validation**: Include testing and verification steps
- **Think about dependencies**: Identify what needs to happen before each step
- **Consider alternatives**: Note when multiple approaches are viable
- **Enable continuation**: Use continuation_id for multi-session planning
- **Cross-tool integration**: Plan how outputs will feed into zenode:analyze, zenode:debug, etc.

## Zenode Advantages

### Redis Persistence
- **Session survival**: Planning sessions persist across container restarts
- **Multi-day planning**: Resume complex planning across multiple sessions
- **Historical context**: Previous completed plans inform new planning decisions
- **Conversation threading**: Full context maintained across tool transitions

### Cross-Tool Workflows
- **Analysis integration**: Plans flow directly into zenode:analyze for code review
- **Debug integration**: Implementation issues can reference original planning context
- **Visual integration**: zenode:seer can analyze UI/UX against planned workflows
- **Research integration**: zenode:visit can validate planning assumptions with real data

### Professional Output
- **Structured formatting**: Clear, actionable steps without time estimates
- **Technical depth**: Includes specific technology recommendations and security implications
- **Risk assessment**: Built-in consideration of challenges and mitigation strategies
- **Success criteria**: Clear validation steps for each planning phase

## Continue With Other Zenode Tools

Like all zenode tools, you can seamlessly continue with other tools using the output from planning:

```bash
# After completing a planning session
zenode:analyze --files src/ --continuation_id [plan-uuid] --prompt "Analyze how our current code aligns with this plan"

zenode:debug --problem "The authentication step from our plan isn't working" --continuation_id [plan-uuid]

:z "Review this completed plan and get consensus from multiple models on implementation priority"
```

## Redis Configuration Benefits

Unlike upstream's migration to in-memory storage, zenode maintains Redis-based conversation persistence, providing:

- **Production scalability**: Handle multiple concurrent planning sessions
- **Distributed planning**: Multiple team members can contribute to the same plan
- **Historical analysis**: Track planning patterns and improvement opportunities
- **Enterprise readiness**: Persistent conversation state for compliance and auditing

The planner tool showcases zenode's architectural advantages while providing sophisticated project planning capabilities that enhance the entire development workflow.