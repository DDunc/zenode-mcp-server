# Enhanced :z Command Design

## Current Status

### :z Command Works ✅
- The :z command detection in CLAUDE.md is functional
- When users type `:z` in their message, Claude Code properly recognizes it
- Claude then calls zenode-docker tools using the `mcp__zenode-docker__` prefix

### Redis Threading Discovery
- Thread IDs are generated when conversations continue
- However, the thread search functionality may need investigation
- OpenAI API key is required for some tools to function properly

## Dynamic Tool Selection Design

### Intent Analysis Algorithm

```typescript
interface UserIntent {
  primaryIntent: 'debug' | 'analyze' | 'plan' | 'review' | 'test' | 'explore';
  confidence: number;
  keywords: string[];
  suggestedTools: string[];
}

function analyzeUserIntent(message: string): UserIntent {
  const intents = {
    debug: {
      keywords: ['error', 'bug', 'issue', 'failing', 'broken', 'fix', 'debug', 'trace'],
      tools: ['debug', 'thinkdeep', 'analyze', 'tracer']
    },
    analyze: {
      keywords: ['analyze', 'understand', 'explain', 'how', 'why', 'structure'],
      tools: ['analyze', 'thinkdeep', 'chat', 'gopher']
    },
    plan: {
      keywords: ['plan', 'design', 'architect', 'implement', 'build', 'create'],
      tools: ['planner', 'thinkdeep', 'analyze', 'consensus']
    },
    review: {
      keywords: ['review', 'check', 'quality', 'improve', 'refactor'],
      tools: ['codereview', 'refactor', 'analyze', 'precommit']
    },
    test: {
      keywords: ['test', 'testing', 'coverage', 'validate', 'verify'],
      tools: ['testgen', 'codereview', 'analyze', 'debug']
    },
    explore: {
      keywords: ['explore', 'search', 'find', 'look', 'browse'],
      tools: ['gopher', 'visit', 'analyze', 'chat']
    }
  };
  
  // Score each intent based on keyword matches
  // Return the highest scoring intent with appropriate tools
}
```

## Tool Personality & Emoji Mapping

### Core Analysis Tools
- **🧠 ThinkDeep**: *The Philosopher* - Contemplative, asks deep questions, explores edge cases
  - Voice: "Hmm, let me ponder this deeply..."
  - Style: Thoughtful pauses, rhetorical questions, considers multiple angles

- **🔍 Analyze**: *The Detective* - Methodical, data-driven, systematic
  - Voice: "Let's break this down systematically..."
  - Style: Bullet points, clear structure, evidence-based

- **🐞 Debug**: *The Problem Solver* - Focused, persistent, detail-oriented
  - Voice: "I've identified the issue here..."
  - Style: Step-by-step reasoning, root cause analysis

- **💬 Chat**: *The Collaborator* - Friendly, supportive, brainstorming partner
  - Voice: "Great question! Let's explore this together..."
  - Style: Conversational, encouraging, idea generation

### Specialized Tools
- **📝 CodeReview**: *The Mentor* - Professional, constructive, quality-focused
  - Voice: "I notice a few areas for improvement..."
  - Style: Balanced feedback, best practices, actionable suggestions

- **🧪 TestGen**: *The Scientist* - Thorough, scenario-focused, edge-case hunter
  - Voice: "Let's ensure we cover all test scenarios..."
  - Style: Test cases, coverage analysis, boundary conditions

- **✅ PreCommit**: *The Guardian* - Protective, checklist-oriented, safety-first
  - Voice: "Before we commit, let's verify..."
  - Style: Checklists, validation steps, safety checks

- **🤝 Consensus**: *The Moderator* - Balanced, multi-perspective, diplomatic
  - Voice: "Let me gather different viewpoints..."
  - Style: Synthesizes opinions, finds common ground

- **📋 Planner**: *The Strategist* - Organized, forward-thinking, milestone-focused
  - Voice: "Here's how we can approach this step-by-step..."
  - Style: Numbered steps, dependencies, timelines

- **🔧 Refactor**: *The Craftsperson* - Improvement-focused, pattern-aware, clean code advocate
  - Voice: "I see opportunities to improve this code..."
  - Style: Before/after comparisons, design patterns

- **👁️ Seer**: *The Observer* - Visual-focused, descriptive, detail-noticing
  - Voice: "Looking at this image, I observe..."
  - Style: Descriptive, spatial awareness, visual patterns

- **🐹 Gopher**: *The Explorer* - File-savvy, navigation expert, resource finder
  - Voice: "Let me fetch that for you..."
  - Style: Directory trees, file listings, path navigation

- **🌐 Visit**: *The Navigator* - Web-aware, search-savvy, information gatherer
  - Voice: "I'll browse the web for this information..."
  - Style: Links, summaries, web content analysis

- **🧵 Threads**: *The Historian* - Memory-focused, context-aware, conversation tracker
  - Voice: "From our previous discussions..."
  - Style: References past conversations, maintains context

- **🔎 Tracer**: *The Investigator* - Code-flow expert, execution tracker, dependency mapper
  - Voice: "Following the execution path..."
  - Style: Call stacks, flow diagrams, dependency trees

## Conversation Formatting System

### Format Structure

```markdown
## 🎭 AI Council Discussion: [Topic]

[Moderator introduces the topic and participants]

---

### 🧠 ThinkDeep weighs in:
[ThinkDeep's response with their characteristic voice]

### 🔍 Analyze adds:
[Analyze's response building on or contrasting with ThinkDeep]

### 💬 Chat synthesizes:
[Chat brings the perspectives together]

---

**🎯 Key Takeaways:**
- [Synthesized insight 1]
- [Synthesized insight 2]
- [Action items if applicable]
```

### Implementation Example

When user types: `:z how can I improve the performance of my React app?`

```markdown
## 🎭 AI Council Discussion: React Performance Optimization

*The council convenes to discuss React performance improvements. Today's participants: 🔍 Analyze (The Detective), 🔧 Refactor (The Craftsperson), and 🐞 Debug (The Problem Solver).*

---

### 🔍 Analyze begins:
Let's break this down systematically. React performance issues typically fall into three categories:
- Unnecessary re-renders
- Large bundle sizes  
- Inefficient data fetching

First, we should profile your app to identify the specific bottlenecks...

### 🔧 Refactor suggests:
I see opportunities to improve this code through several patterns:
- Implementing React.memo for pure components
- Using useMemo and useCallback for expensive computations
- Code-splitting with lazy loading for route-based chunks

Would you like me to show specific refactoring examples?

### 🐞 Debug investigates:
I've identified potential issues in your current implementation:
1. State updates triggering cascade re-renders
2. Missing dependency arrays in useEffect hooks
3. Large component trees without optimization boundaries

Let me trace through your component hierarchy...

---

**🎯 Key Takeaways:**
- Profile first to identify actual bottlenecks
- Implement memoization strategically, not everywhere
- Consider code-splitting for immediate bundle size wins
- Set up performance monitoring for ongoing optimization
```

## Implementation Plan

### Phase 1: Claude Code Enhancement
1. Update CLAUDE.md to document the dynamic :z behavior
2. Create intent detection logic in Claude's processing
3. Map intents to appropriate tool combinations

### Phase 2: Tool Response Formatting
1. Add personality hints to each tool's system prompts
2. Create a conversation template system
3. Implement the moderator/synthesizer logic

### Phase 3: Redis Threading Integration
1. Ensure all :z coordinated conversations get unique thread IDs
2. Enable thread continuation across :z sessions
3. Add thread search and retrieval capabilities

### Phase 4: Testing & Refinement
1. Test various :z scenarios with different intents
2. Refine tool selection algorithm based on results
3. Adjust personalities and formatting based on user feedback

## Configuration Options

```typescript
interface ZCommandConfig {
  // Dynamic selection
  enableDynamicSelection: boolean;
  defaultTools: string[];
  maxToolsPerQuery: number;
  
  // Formatting
  enableConversationFormat: boolean;
  showModeratorIntro: boolean;
  includeSynthesis: boolean;
  
  // Personalities
  toolPersonalities: {
    [toolName: string]: {
      emoji: string;
      title: string;
      voiceStyle: string;
      catchphrase: string;
    }
  };
}
```

## Next Steps

1. Implement intent detection in Claude Code
2. Add personality hints to zenode tool prompts
3. Create conversation formatting templates
4. Test with various user scenarios
5. Document the enhanced :z functionality