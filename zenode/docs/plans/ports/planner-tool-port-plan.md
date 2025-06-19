# Planner Tool Port Plan - From Python to Zenode TypeScript

**Target Commit:** `a509730` - "New Planner tool to help you break down complex ideas, problems, and projects into multiple manageable steps"  
**Author:** Fahad <fahad@2doapp.com>  
**Date:** Tue Jun 17 20:49:53 2025 +0400  
**Complexity:** HIGH - 1,940 lines of code changes across 14 files  
**Priority:** 🔴 CRITICAL - Core workflow enhancement tool

## Executive Summary

The Planner tool represents one of the most sophisticated additions to the Zen MCP toolkit - a self-prompt generation system that enables Claude to break down complex projects into manageable, sequential steps with advanced features like branching, revision capabilities, and multi-session continuation. This tool transforms how users approach complex planning by enabling incremental plan building with full context awareness.

### Why This Tool is Critical for Zenode

1. **Workflow Enhancement** - Addresses fundamental gap in complex project planning
2. **Multi-Session Intelligence** - Sophisticated conversation threading that leverages our Redis advantage
3. **Self-Prompt Generation** - Meta-cognitive capabilities for AI-driven planning
4. **Integration Opportunity** - Perfect showcase for zenode tool collaboration

## Technical Architecture Analysis

### Core Components (Python → TypeScript Mapping)

```python
# Python Structure (tools/planner.py - 440 lines)
class PlanStep:
    step_number: int
    content: str
    branch_id: Optional[str] = "main"
    parent_step: Optional[int] = None
    children: List[PlanStep] = []

class PlannerRequest(ToolRequest):
    # Required fields
    step: str
    step_number: int
    total_steps: int
    next_step_required: bool
    
    # Optional revision/branching
    is_step_revision: Optional[bool] = False
    revises_step_number: Optional[int] = None
    is_branch_point: Optional[bool] = False
    branch_from_step: Optional[int] = None
    branch_id: Optional[str] = None
    more_steps_needed: Optional[bool] = False
    
    # Continuation support
    continuation_id: Optional[str] = None
```

```typescript
// Zenode TypeScript Target Structure
interface PlanStep {
  step_number: number;
  content: string;
  branch_id: string;
  parent_step?: number;
  children: PlanStep[];
}

interface PlannerToolRequest {
  // Required fields
  step: string;
  step_number: number;
  total_steps: number;
  next_step_required: boolean;
  
  // Optional revision/branching
  is_step_revision?: boolean;
  revises_step_number?: number;
  is_branch_point?: boolean;
  branch_from_step?: number;
  branch_id?: string;
  more_steps_needed?: boolean;
  
  // Continuation support
  continuation_id?: string;
}
```

### Continuation Logic - The Core Innovation

The Planner tool implements sophisticated 4-rule continuation logic that enables multi-session planning:

#### Rule 1: New Planning Session
```typescript
// No continuation_id + step_number=1 → Create NEW planning thread
if (!continuation_id && step_number === 1) {
  continuation_id = await createThread("planner", serializableArgs);
  // Returns: New thread created, no previous context, returns continuation_id
}
```

#### Rule 2: Resume with Context
```typescript
// continuation_id + step_number=1 → Load PREVIOUS COMPLETE PLAN as context
if (continuation_id && step_number === 1) {
  const thread = await getThread(continuation_id);
  // Search for most recent COMPLETE PLAN from previous sessions
  const previousPlanContext = extractCompletePlanContext(thread);
  // Provides historical context for new planning session
}
```

#### Rule 3: Continue Current Session
```typescript
// continuation_id + step_number>1 → Continue current plan (no context loading)
// Middle of current planning session - no historical interference
```

#### Rule 4: Complete Planning Session
```typescript
// next_step_required=false → Mark complete and store plan summary
if (!next_step_required) {
  await storeCompletePlanSummary(continuation_id, planSummary);
  return { planning_complete: true, continuation_id };
}
```

## Implementation Roadmap

### Phase 1: Foundation (Days 1-3)
**Goal:** Basic planner tool functionality without advanced features

#### Day 1: Core Interfaces & Schema
- [ ] Create `zenode/src/tools/planner.ts`
- [ ] Define TypeScript interfaces for `PlanStep` and `PlannerToolRequest`
- [ ] Create Zod schema validation for all parameters
- [ ] Implement basic tool registration in tool registry
- [ ] Create minimal test file

**Files to Create:**
```
zenode/src/tools/planner.ts
zenode/src/tools/__tests__/planner.test.ts
zenode/src/types/planner.ts
```

#### Day 2: System Prompts & Basic Logic
- [ ] Port `systemprompts/planner_prompt.py` to `zenode/src/systemprompts/planner-prompt.ts`
- [ ] Implement field descriptions mapping
- [ ] Create basic `execute()` method structure
- [ ] Add step validation logic
- [ ] Implement basic response formatting

**Files to Create:**
```
zenode/src/systemprompts/planner-prompt.ts
```

#### Day 3: Basic Step Management
- [ ] Implement step history tracking
- [ ] Add basic branching data structures
- [ ] Create step validation and adjustment logic
- [ ] Implement basic response structure
- [ ] Create unit tests for core functionality

**Validation Criteria:**
- [ ] Tool responds to basic planner calls
- [ ] Step numbering works correctly
- [ ] Basic validation prevents invalid inputs

### Phase 2: Conversation Integration (Days 4-6)
**Goal:** Integrate with zenode's Redis-based conversation memory

#### Day 4: Redis Conversation Threading
- [ ] Enhance `zenode/src/utils/conversation-memory.ts` for planner support
- [ ] Implement `createThread()` functionality for planner
- [ ] Add `getThread()` and `addTurn()` integration
- [ ] Create planner-specific conversation serialization

#### Day 5: Continuation Logic Implementation
- [ ] Implement the 4-rule continuation system
- [ ] Add previous plan context extraction
- [ ] Create complete plan summary storage
- [ ] Implement conversation threading validation

#### Day 6: Multi-Session Testing
- [ ] Create comprehensive continuation tests
- [ ] Test cross-session plan loading
- [ ] Validate context preservation
- [ ] Test edge cases and error handling

**Validation Criteria:**
- [ ] Multi-session planning works correctly
- [ ] Previous plan context loads appropriately
- [ ] Conversation memory integration is stable

### Phase 3: Advanced Features (Days 7-9)
**Goal:** Port branching, revision, and advanced planning capabilities

#### Day 7: Branching System
- [ ] Implement branch point creation
- [ ] Add branch management and tracking
- [ ] Create branch navigation logic
- [ ] Add branch visualization in responses

#### Day 8: Revision Capabilities
- [ ] Implement step revision functionality
- [ ] Add revision history tracking
- [ ] Create revision impact analysis
- [ ] Add revision validation logic

#### Day 9: Dynamic Planning
- [ ] Add dynamic step count adjustment
- [ ] Implement "more steps needed" functionality
- [ ] Create adaptive planning logic
- [ ] Add planning completion detection

**Validation Criteria:**
- [ ] Branching works correctly with multiple alternatives
- [ ] Step revisions update correctly
- [ ] Dynamic step adjustment functions properly

### Phase 4: Documentation & Integration (Days 10-12)
**Goal:** Complete documentation and zenode integration

#### Day 10: Documentation Creation
- [ ] Create `zenode/docs/tools/planner.md`
- [ ] Update `CLAUDE.md` with planner usage patterns
- [ ] Add zenode-specific examples and workflows
- [ ] Document Redis conversation persistence benefits

#### Day 11: Tool Integration
- [ ] Add planner to zenode tool registry
- [ ] Create comprehensive integration tests
- [ ] Test with other zenode tools (chat, analyze, etc.)
- [ ] Validate cross-tool continuation

#### Day 12: Performance & Polish
- [ ] Optimize Redis queries for large plans
- [ ] Add error handling and recovery
- [ ] Create performance benchmarks
- [ ] Polish user experience and error messages

## File Structure & Dependencies

### New Files to Create

```
zenode/src/tools/planner.ts              # Main tool implementation
zenode/src/tools/__tests__/planner.test.ts # Unit tests
zenode/src/systemprompts/planner-prompt.ts # System prompts
zenode/src/types/planner.ts              # TypeScript interfaces
zenode/docs/tools/planner.md             # Tool documentation
```

### Files to Modify

```
zenode/src/tools/index.ts                # Add planner export
zenode/src/config.ts                     # Add planner configuration
zenode/src/utils/conversation-memory.ts  # Enhance for planner threading
zenode/CLAUDE.md                         # Add planner usage examples
```

### Dependencies Analysis

#### Redis Integration
- **Advantage:** Zenode's Redis architecture perfectly supports the planner's multi-session requirements
- **Implementation:** Enhance existing conversation memory for planner-specific threading
- **Benefit:** Persistent conversation state survives container restarts

#### Provider Integration  
- **Multi-Model Support:** Planner can leverage different models for different planning phases
- **Auto Mode:** Perfect integration with zenode's auto model selection
- **Custom Models:** Support for specialized planning models

## Technical Challenges & Solutions

### Challenge 1: Complex Continuation Logic
**Problem:** The 4-rule continuation system is sophisticated and error-prone  
**Solution:**
- Create comprehensive test suite for each rule
- Implement with clear state machines
- Add extensive logging and debugging capabilities
- Use TypeScript's type system for state validation

### Challenge 2: Redis Conversation Scaling
**Problem:** Large plans could create extensive conversation histories  
**Solution:**
- Implement conversation compression for large plans
- Add pagination for plan history retrieval
- Create efficient indexing for plan summaries
- Add configurable retention policies

### Challenge 3: Cross-Tool Integration
**Problem:** Planner output needs to integrate seamlessly with other zenode tools  
**Solution:**
- Standardize plan output format for tool consumption
- Create plan parsing utilities for other tools
- Add explicit integration points with analyze, debug, etc.
- Document cross-tool workflow patterns

### Challenge 4: Branch Management Complexity
**Problem:** Multiple branches with revisions create complex state trees  
**Solution:**
- Implement clear branch visualization
- Add branch merging and comparison capabilities
- Create branch navigation helpers
- Use graph-like data structures for branch management

## Testing Strategy

### Unit Tests (40+ test cases planned)
```typescript
describe('PlannerTool', () => {
  describe('Basic Planning', () => {
    it('should create new planning session for step 1 without continuation_id');
    it('should validate step numbers and adjust total_steps');
    it('should handle step completion correctly');
  });

  describe('Continuation Logic', () => {
    it('should implement Rule 1: new planning thread creation');
    it('should implement Rule 2: previous context loading');
    it('should implement Rule 3: current session continuation'); 
    it('should implement Rule 4: planning completion storage');
  });

  describe('Branching System', () => {
    it('should create branch points correctly');
    it('should navigate between branches');
    it('should handle branch merging');
  });

  describe('Revision Capabilities', () => {
    it('should revise previous steps');
    it('should maintain revision history');
    it('should validate revision impacts');
  });
});
```

### Integration Tests
- [ ] Multi-session planning across container restarts
- [ ] Cross-tool integration with chat, analyze, debug
- [ ] Redis conversation memory stress testing
- [ ] Provider switching during planning sessions

### Performance Tests
- [ ] Large plan handling (100+ steps)
- [ ] Multiple concurrent planning sessions
- [ ] Redis memory usage optimization
- [ ] Response time benchmarking

## Integration with Zenode Ecosystem

### Chat Tool Integration
```typescript
// Example: Planning output feeds into chat tool
const planningResult = await plannerTool.execute({
  step: "Database architecture",
  step_number: 1,
  total_steps: 5,
  next_step_required: true
});

// Chat tool can continue with planning context
const discussion = await chatTool.execute({
  prompt: `Analyze this planning step: ${planningResult.step_output}`,
  continuation_id: planningResult.continuation_id
});
```

### Analyze Tool Integration
```typescript
// Analyze can examine planned code changes
const analysis = await analyzeTool.execute({
  prompt: "Review the implementation approach from this plan",
  files: ["src/components/auth.ts"],
  context: planningResult.step_output
});
```

### Debug Tool Integration
```typescript
// Debug can troubleshoot planned implementations
const debugging = await debugTool.execute({
  problem: "The authentication flow planned in step 3 isn't working",
  context: planningResult.step_output,
  continuation_id: planningResult.continuation_id
});
```

## User Experience Enhancements

### CLAUDE.md Usage Examples

```markdown
### Planner Tool Usage Patterns

#### Basic Project Planning
```
zenode:planner "Plan a real-time notification system" --step_number 1 --total_steps 5 --next_step_required true
```

#### Continue Planning Session
```
zenode:planner "Database schema design" --step_number 2 --continuation_id uuid-abc123 --next_step_required true
```

#### Branch Alternative Approach
```
zenode:planner "Alternative: Use WebSockets" --step_number 3 --is_branch_point true --branch_id websocket-approach
```

#### Revise Previous Step
```
zenode:planner "Updated auth requirements" --step_number 2 --is_step_revision true --revises_step_number 2
```

#### Cross-Tool Workflow
```
:z "Use planner to design the API, then analyze the existing codebase to see how it fits"
```
```

### Redis Conversation Benefits Documentation

```markdown
### Why Zenode's Redis Architecture Enhances Planning

- **Persistent Sessions:** Planning sessions survive container restarts
- **Distributed Planning:** Multiple team members can contribute to the same plan
- **Historical Context:** Previous completed plans inform new planning sessions
- **Cross-Tool Continuity:** Plans seamlessly flow into analysis, debugging, and implementation
- **Scalable Storage:** Large, complex plans don't impact memory usage
```

## Success Metrics & Validation

### Functional Success Criteria
- [ ] All 4 continuation rules work correctly
- [ ] Branching and revision capabilities function properly
- [ ] Multi-session planning maintains context accurately
- [ ] Cross-tool integration works seamlessly
- [ ] Redis conversation persistence is reliable

### Performance Success Criteria
- [ ] Tool responds within 2 seconds for basic steps
- [ ] Large plans (50+ steps) load within 5 seconds
- [ ] Redis memory usage scales linearly with plan complexity
- [ ] Concurrent planning sessions don't interfere

### User Experience Success Criteria
- [ ] Clear, actionable planning output
- [ ] Intuitive branching and revision workflow
- [ ] Helpful error messages and validation
- [ ] Comprehensive documentation and examples
- [ ] Smooth integration with CLAUDE.md workflows

## Risk Mitigation

### High Risk: Continuation Logic Complexity
**Mitigation:**
- Extensive unit testing for each rule
- Clear state machine implementation
- Comprehensive logging and debugging
- Gradual rollout with feature flags

### Medium Risk: Redis Performance
**Mitigation:**
- Conversation compression for large plans
- Efficient indexing strategies
- Monitoring and alerting for performance
- Configurable retention policies

### Low Risk: Cross-Tool Integration
**Mitigation:**
- Standardized output formats
- Clear integration documentation
- Extensive integration testing
- Version compatibility checks

## Future Enhancements

### Phase 2 Features (Post-MVP)
- [ ] **Visual Plan Rendering** - ASCII diagrams and flowcharts
- [ ] **Plan Templates** - Pre-built planning templates for common scenarios
- [ ] **Collaborative Planning** - Multiple users contributing to the same plan
- [ ] **Plan Export** - Export plans to external project management tools
- [ ] **AI-Suggested Branches** - Automatic alternative approach suggestions

### Integration Opportunities
- [ ] **Seer Tool Integration** - Visual planning with diagrams and mockups
- [ ] **Visit Tool Integration** - Research-informed planning
- [ ] **Gopher Tool Integration** - File-system aware planning
- [ ] **Advanced Analytics** - Planning pattern analysis and optimization

## Conclusion

The Planner tool represents a significant enhancement to zenode's capabilities, providing sophisticated project breakdown functionality that leverages our Redis-based architecture for superior conversation persistence and multi-session planning. The implementation requires careful attention to the complex continuation logic and branching system, but the resulting tool will provide immense value for complex project planning and cross-tool workflow orchestration.

The 12-day implementation timeline balances thorough development with rapid delivery, ensuring we maintain code quality while delivering this critical capability to enhance zenode's position as the premier Node.js MCP toolkit.

---

**Key Implementation Notes:**
- Leverage zenode's Redis advantage for superior conversation persistence
- Implement robust TypeScript interfaces and Zod validation
- Create comprehensive test coverage for complex continuation logic
- Document integration patterns for cross-tool workflows
- Maintain compatibility with zenode's existing tool ecosystem