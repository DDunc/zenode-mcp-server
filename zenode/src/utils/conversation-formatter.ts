/**
 * Conversation Formatter for Multi-Tool :z Responses
 * Formats multiple tool responses into a natural conversation
 */

import { ANALYZE_PERSONALITY } from '../systemprompts/analyze-prompt-enhanced.js';
import { CODEREVIEW_PERSONALITY } from '../systemprompts/codereview-prompt-enhanced.js';

interface ToolResponse {
  tool: string;
  content: string;
  threadId?: string;
}

interface ToolPersonality {
  emoji: string;
  title: string;
  voiceStyle: string;
  catchphrase: string;
  openingLines: string[];
  closingLines: string[];
  [key: string]: any;
}

// Complete personality mapping for all tools
export const TOOL_PERSONALITIES: Record<string, ToolPersonality> = {
  analyze: ANALYZE_PERSONALITY,
  codereview: CODEREVIEW_PERSONALITY,
  
  thinkdeep: {
    emoji: '🧠',
    title: 'The Philosopher',
    voiceStyle: 'contemplative, questioning, exploratory',
    catchphrase: 'But have we considered...',
    openingLines: [
      "Hmm, let me ponder this deeply...",
      "This raises interesting questions...",
      "Let's explore the deeper implications...",
      "What if we look at this from another angle..."
    ],
    closingLines: [
      "But perhaps I'm overthinking it...",
      "Food for thought, wouldn't you say?",
      "The answer may lie somewhere in between.",
      "Sometimes the questions matter more than answers."
    ]
  },
  
  debug: {
    emoji: '🐞',
    title: 'The Problem Solver',
    voiceStyle: 'focused, systematic, determined',
    catchphrase: 'Found it!',
    openingLines: [
      "Let me trace through this systematically...",
      "I'll get to the bottom of this...",
      "Time to hunt down this bug...",
      "Let's isolate the problem..."
    ],
    closingLines: [
      "Problem identified and solution provided.",
      "That should fix your issue.",
      "Mystery solved!",
      "The bug stops here."
    ]
  },
  
  chat: {
    emoji: '💬',
    title: 'The Collaborator',
    voiceStyle: 'friendly, supportive, encouraging',
    catchphrase: 'Let\'s figure this out together!',
    openingLines: [
      "Great question! Let's explore this together...",
      "I'm happy to help with this...",
      "Let's brainstorm some ideas...",
      "Here's what I'm thinking..."
    ],
    closingLines: [
      "Hope that helps! Let me know if you need more.",
      "We make a good team!",
      "Feel free to ask if anything's unclear.",
      "Looking forward to seeing what you build!"
    ]
  },
  
  testgen: {
    emoji: '🧪',
    title: 'The Scientist',
    voiceStyle: 'thorough, methodical, edge-case obsessed',
    catchphrase: 'But what if...',
    openingLines: [
      "Let's ensure we cover all test scenarios...",
      "Time to think about edge cases...",
      "We need comprehensive test coverage...",
      "Let me design some experiments..."
    ],
    closingLines: [
      "That should cover the critical paths.",
      "Remember to test the unhappy paths too!",
      "Science is about reproducibility.",
      "Test early, test often."
    ]
  },
  
  precommit: {
    emoji: '✅',
    title: 'The Guardian',
    voiceStyle: 'protective, checklist-oriented, thorough',
    catchphrase: 'Not on my watch!',
    openingLines: [
      "Hold on, let me check everything before we commit...",
      "Time for the pre-flight checklist...",
      "Let's make sure this is production-ready...",
      "Safety first - let me verify..."
    ],
    closingLines: [
      "All clear for commit!",
      "Fix these issues before proceeding.",
      "Better safe than sorry.",
      "Your future self will thank you."
    ]
  },
  
  consensus: {
    emoji: '🤝',
    title: 'The Moderator',
    voiceStyle: 'balanced, diplomatic, synthesizing',
    catchphrase: 'Let\'s find common ground.',
    openingLines: [
      "Let me gather different perspectives on this...",
      "I'll present multiple viewpoints...",
      "Let's consider all angles...",
      "Time to build consensus..."
    ],
    closingLines: [
      "The consensus seems to be...",
      "Multiple valid approaches exist here.",
      "Consider these perspectives moving forward.",
      "Agreement through understanding."
    ]
  },
  
  planner: {
    emoji: '📋',
    title: 'The Strategist',
    voiceStyle: 'organized, forward-thinking, systematic',
    catchphrase: 'First things first.',
    openingLines: [
      "Let's break this down into manageable steps...",
      "Here's how we can approach this systematically...",
      "Time to create a roadmap...",
      "Let me outline a plan..."
    ],
    closingLines: [
      "Follow these steps for best results.",
      "Adjust the plan as needed.",
      "Success is in the preparation.",
      "One step at a time."
    ]
  },
  
  refactor: {
    emoji: '🔧',
    title: 'The Craftsperson',
    voiceStyle: 'improvement-focused, pattern-aware, quality-driven',
    catchphrase: 'We can do better.',
    openingLines: [
      "I see opportunities to improve this code...",
      "Let's clean this up properly...",
      "Time to apply some craftsmanship...",
      "This code has potential..."
    ],
    closingLines: [
      "Much cleaner now!",
      "Quality code is a joy to work with.",
      "Small improvements, big impact.",
      "Craftsmanship matters."
    ]
  },
  
  seer: {
    emoji: '👁️',
    title: 'The Observer',
    voiceStyle: 'descriptive, detail-oriented, visual',
    catchphrase: 'I see what you did there.',
    openingLines: [
      "Looking at this image, I observe...",
      "Let me describe what I'm seeing...",
      "Visually speaking...",
      "The details tell a story..."
    ],
    closingLines: [
      "That's what catches my eye.",
      "The visual evidence is clear.",
      "Sometimes a picture says it all.",
      "Seen and understood."
    ]
  },
  
  gopher: {
    emoji: '🐹',
    title: 'The Explorer',
    voiceStyle: 'helpful, efficient, resourceful',
    catchphrase: 'I\'ll fetch that for you!',
    openingLines: [
      "Let me dig that up for you...",
      "Time to explore the filesystem...",
      "I'll fetch what you need...",
      "Let me navigate to that..."
    ],
    closingLines: [
      "Found what you were looking for!",
      "Delivered as requested.",
      "Anything else you need me to find?",
      "Happy to help navigate!"
    ]
  },
  
  visit: {
    emoji: '🌐',
    title: 'The Navigator',
    voiceStyle: 'web-savvy, informative, current',
    catchphrase: 'Let me check the web.',
    openingLines: [
      "I'll browse the web for that information...",
      "Let me search for current info...",
      "Time to see what's out there...",
      "Navigating to find answers..."
    ],
    closingLines: [
      "That's what I found online.",
      "The web has spoken.",
      "Stay curious, keep browsing!",
      "Information at your fingertips."
    ]
  },
  
  threads: {
    emoji: '🧵',
    title: 'The Historian',
    voiceStyle: 'memory-focused, contextual, connecting',
    catchphrase: 'As I recall...',
    openingLines: [
      "From our previous discussions...",
      "Let me check the conversation history...",
      "I remember we talked about this...",
      "Building on our past conversations..."
    ],
    closingLines: [
      "Context is everything.",
      "Our conversations build on each other.",
      "Memory serves us well.",
      "The thread continues..."
    ]
  },
  
  tracer: {
    emoji: '🔎',
    title: 'The Investigator',
    voiceStyle: 'detail-focused, technical, thorough',
    catchphrase: 'Following the trail...',
    openingLines: [
      "Let me trace through the execution path...",
      "Following the code flow...",
      "Time to map the dependencies...",
      "Investigating the call stack..."
    ],
    closingLines: [
      "The trail leads here.",
      "Mystery unraveled.",
      "Every path tells a story.",
      "Case closed on the code flow."
    ]
  }
};

export class ConversationFormatter {
  /**
   * Format multiple tool responses into a conversational format
   */
  static formatConversation(
    topic: string,
    responses: ToolResponse[],
    userIntent?: string
  ): string {
    const participants = responses.map(r => {
      const personality = TOOL_PERSONALITIES[r.tool] || this.getDefaultPersonality(r.tool);
      return `${personality.emoji} ${personality.title}`;
    }).join(', ');
    
    let output = `## 🎭 AI Council Discussion: ${topic}\n\n`;
    output += `*The council convenes to discuss: "${topic}". `;
    output += `Today's participants: ${participants}*\n\n`;
    output += `---\n\n`;
    
    // Add each tool's response with personality
    responses.forEach((response, index) => {
      const personality = TOOL_PERSONALITIES[response.tool] || this.getDefaultPersonality(response.tool);
      const opening = this.getRandomElement(personality.openingLines);
      
      output += `### ${personality.emoji} ${personality.title} ${this.getActionVerb(index)}:\n`;
      output += `*${opening}*\n\n`;
      output += response.content;
      output += `\n\n`;
    });
    
    output += `---\n\n`;
    output += this.generateSynthesis(responses, userIntent);
    
    return output;
  }
  
  /**
   * Generate a synthesis of all responses
   */
  private static generateSynthesis(responses: ToolResponse[], userIntent?: string): string {
    let synthesis = `**🎯 Key Takeaways:**\n`;
    
    // Extract key points from each response (simplified for now)
    const keyPoints = [
      "Multiple perspectives have been considered",
      "Verification and evidence are critical", 
      "Both immediate fixes and long-term improvements identified",
      "Next steps are clear and actionable"
    ];
    
    keyPoints.forEach(point => {
      synthesis += `- ${point}\n`;
    });
    
    synthesis += `\n**🚀 Recommended Actions:**\n`;
    synthesis += `1. Start with the highest-priority issues identified\n`;
    synthesis += `2. Verify all changes with the suggested commands\n`;
    synthesis += `3. Consider the long-term architectural implications\n`;
    
    return synthesis;
  }
  
  /**
   * Get action verb for natural flow
   */
  private static getActionVerb(index: number): string {
    const verbs = ['begins', 'adds', 'continues', 'chimes in', 'observes', 'notes', 'suggests', 'concludes'];
    return verbs[Math.min(index, verbs.length - 1)] || 'continues';
  }
  
  /**
   * Get random element from array
   */
  private static getRandomElement<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot get random element from empty array');
    }
    return array[Math.floor(Math.random() * array.length)]!;
  }
  
  /**
   * Get default personality for unknown tools
   */
  private static getDefaultPersonality(toolName: string): ToolPersonality {
    return {
      emoji: '🤖',
      title: `The ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`,
      voiceStyle: 'helpful and informative',
      catchphrase: 'Let me help with that.',
      openingLines: ["Let me assist with this..."],
      closingLines: ["Hope that helps!"]
    };
  }
  
  /**
   * Format a single tool response with personality
   */
  static formatSingleResponse(tool: string, content: string): string {
    const personality = TOOL_PERSONALITIES[tool] || this.getDefaultPersonality(tool);
    const opening = this.getRandomElement(personality.openingLines);
    const closing = this.getRandomElement(personality.closingLines);
    
    return `### ${personality.emoji} ${personality.title} responds:\n\n*${opening}*\n\n${content}\n\n*${closing}*`;
  }
}