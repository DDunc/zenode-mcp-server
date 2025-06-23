/**
 * Threads Tool - Thread labeling, search, and management
 * 
 * This tool provides enhanced conversation thread management capabilities:
 * - Label threads with custom tags for organization
 * - Search through conversation history with fuzzy matching
 * - Smart context integration for related conversations
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput } from '../types/tools.js';
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';
import { TEMPERATURE_BALANCED } from '../config.js';
import { logger } from '../utils/logger.js';
import { getThread, getConversationStats } from '../utils/conversation-memory.js';
import { createClient, RedisClientType } from 'redis';
import { REDIS_URL } from '../config.js';
import { ChatTool } from './chat.js';

/**
 * Thread action types
 */
const ThreadAction = z.enum([
  'label',      // Add label to a thread
  'search',     // Search threads by label/content
  'list',       // List all threads with metadata
  'remove',     // Remove label from thread
  'delete',     // Delete entire thread
  'stats',      // Get thread statistics
  'export',     // Export thread for sharing
  'auto_label', // Auto-generate label using AI content analysis
]);

/**
 * Threads tool request schema
 */
const ThreadsRequestSchema = BaseToolRequestSchema.extend({
  action: ThreadAction.describe('Action to perform on threads'),
  thread_id: z.string().optional().describe('Target thread ID (required for label, remove, delete, export, auto_label actions)'),
  label: z.string().optional().describe('Label to add/remove (required for label, remove actions)'),
  tags: z.array(z.string()).optional().describe('Optional tags to associate with label'),
  query: z.string().optional().describe('Search query for content/label search'),
  filters: z.object({
    labels: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    tools_used: z.array(z.string()).optional(),
    date_range: z.tuple([z.string(), z.string()]).optional(),
    min_turns: z.number().optional(),
  }).optional().describe('Search filters'),
  limit: z.number().default(20).describe('Maximum number of results to return'),
  include_content: z.boolean().default(false).describe('Include thread content in results'),
});

type ThreadsRequest = z.infer<typeof ThreadsRequestSchema>;

/**
 * Enhanced thread metadata interface
 */
interface ThreadMetadata {
  id: string;
  label?: string;
  tags: string[];
  auto_generated_label?: string;
  auto_label_confidence?: number;
  preview_summary?: string; // 4-sentence AI-generated summary
  preview_generated?: string; // timestamp when preview was generated
  created: string;
  last_accessed: string;
  last_labeled?: string;
  total_turns: number;
  total_tokens: number;
  tools_used: string[];
  importance?: 'low' | 'medium' | 'high';
  project?: string;
}

/**
 * Thread search result interface
 */
interface ThreadSearchResult {
  id: string;
  label?: string;
  tags: string[];
  summary: string;
  relevance_score: number;
  metadata: ThreadMetadata;
  preview?: string;
}

/**
 * Threads tool implementation
 */
export class ThreadsTool extends BaseTool {
  name = 'threads';
  description = 
    'THREAD MANAGEMENT - Label, search, and manage conversation threads for better organization. ' +
    'Use this tool to add meaningful labels to conversations, search through your conversation history, ' +
    'and manage thread lifecycle. Supports: thread labeling with custom tags, fuzzy search across ' +
    'conversation content and labels, thread statistics and analytics, thread export/import. ' +
    'Perfect for: organizing development discussions, finding past solutions, tracking project conversations, ' +
    'maintaining conversation context across sessions.';
  
  defaultTemperature = TEMPERATURE_BALANCED;
  modelCategory = 'fast' as const;

  private redisClient: RedisClientType | null = null;

  constructor() {
    super();
    // Only initialize Redis if not disabled
    if (process.env.DISABLE_ALL_REDIS !== 'true') {
      this.initializeRedis();
    } else {
      logger.info('[THREADS] Redis initialization skipped (disabled via environment variable)');
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Add delay to avoid connection conflicts with conversation-memory Redis client
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.redisClient = createClient({ url: REDIS_URL });
      await this.redisClient.connect();
      logger.debug('[THREADS] Redis client connected');
    } catch (error) {
      logger.error('[THREADS] Failed to connect to Redis:', error);
      this.redisClient = null;
    }
  }

  getZodSchema() {
    return ThreadsRequestSchema;
  }

  getSystemPrompt(): string {
    return `You are a thread management assistant helping developers organize their conversation history.

Your role is to:
- Help users label and organize their conversation threads effectively
- Provide intelligent search across conversation history
- Generate meaningful thread summaries and previews
- Suggest relevant labels based on conversation content
- Maintain thread metadata and statistics

Guidelines:
- Be proactive in suggesting useful labels and tags
- When searching, provide relevant context and previews
- Use clear, descriptive labels that reflect the conversation topic
- Group related threads with consistent labeling patterns
- Prioritize recent and frequently accessed threads in search results

Remember: Your goal is to make conversation history searchable and organized for improved developer productivity.`;
  }

  async execute(args: ThreadsRequest): Promise<ToolOutput> {
    const startTime = Date.now();
    const requestId = `threads-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request
      const validated = ThreadsRequestSchema.parse(args);
      
      logger.info(`Threads tool invoked with action: ${validated.action}`);
      
      // Log the request
      await this.logToolRequest(requestId, validated, validated.continuation_id);

      if (!this.redisClient) {
        throw new Error('Redis connection not available - threads tool requires Redis for thread management');
      }

      let result: ToolOutput;

      switch (validated.action) {
        case 'label':
          result = await this.labelThread(validated);
          break;
        case 'search':
          result = await this.searchThreads(validated);
          break;
        case 'list':
          result = await this.listThreads(validated);
          break;
        case 'remove':
          result = await this.removeLabel(validated);
          break;
        case 'delete':
          result = await this.deleteThread(validated);
          break;
        case 'stats':
          result = await this.getThreadStats(validated);
          break;
        case 'export':
          result = await this.exportThread(validated);
          break;
        case 'auto_label':
          result = await this.autoLabelThread(validated);
          break;
        default:
          throw new Error(`Unknown action: ${validated.action}`);
      }

      // Log the response
      const duration = Date.now() - startTime;
      await this.logToolResponse(requestId, result, undefined, duration, validated.continuation_id);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Threads tool execution failed:', error);
      
      // Log the error response
      await this.logToolResponse(requestId, null, error as Error, duration, args.continuation_id);
      
      return this.formatOutput(
        `Thread management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * Label a thread with custom label and tags
   */
  private async labelThread(args: ThreadsRequest): Promise<ToolOutput> {
    if (!args.thread_id || !args.label) {
      throw new Error('thread_id and label are required for labeling action');
    }

    // Verify thread exists
    const thread = await getThread(args.thread_id);
    if (!thread) {
      throw new Error(`Thread ${args.thread_id} not found or has expired`);
    }

    // Get or create thread metadata
    const metadataKey = `zenode:thread:meta:${args.thread_id}`;
    const existingMeta = await this.redisClient!.get(metadataKey);
    
    const now = new Date().toISOString();
    const stats = await getConversationStats(args.thread_id);
    
    const metadata: ThreadMetadata = existingMeta ? JSON.parse(existingMeta) : {
      id: args.thread_id,
      tags: [],
      created: thread.created_at,
      last_accessed: now,
      total_turns: stats?.total_turns || 0,
      total_tokens: (stats?.total_input_tokens || 0) + (stats?.total_output_tokens || 0),
      tools_used: thread.metadata?.tools_used || [],
    };

    // Update metadata with new label
    metadata.label = args.label;
    metadata.last_labeled = now;
    metadata.last_accessed = now;
    if (args.tags) {
      metadata.tags = [...new Set([...metadata.tags, ...args.tags])];
    }

    // Save updated metadata
    await this.redisClient!.setEx(metadataKey, 86400 * 30, JSON.stringify(metadata)); // 30 days TTL

    // Update label index for fast lookup
    const labelKey = `zenode:label:${args.label}`;
    await this.redisClient!.sAdd(labelKey, args.thread_id);
    await this.redisClient!.expire(labelKey, 86400 * 30);

    // Update tag indices
    if (args.tags) {
      for (const tag of args.tags) {
        const tagKey = `zenode:tag:${tag}`;
        await this.redisClient!.sAdd(tagKey, args.thread_id);
        await this.redisClient!.expire(tagKey, 86400 * 30);
      }
    }

    logger.info(`Thread ${args.thread_id} labeled as "${args.label}" with ${args.tags?.length || 0} tags`);

    return this.formatOutput(
      `✅ **Thread labeled successfully**

**Thread:** ${args.thread_id}
**Label:** ${args.label}
**Tags:** ${args.tags?.join(', ') || 'none'}
**Total turns:** ${metadata.total_turns}
**Tools used:** ${metadata.tools_used.join(', ')}

The thread can now be found using the label "${args.label}" in searches.`,
      'success'
    );
  }

  /**
   * Search threads by query, labels, or content
   */
  private async searchThreads(args: ThreadsRequest): Promise<ToolOutput> {
    const results: ThreadSearchResult[] = [];
    const limit = Math.min(args.limit || 20, 50); // Cap at 50 results

    if (args.query) {
      // Search by query (simplified implementation for Phase 1)
      logger.debug(`[THREADS] Searching for query: "${args.query}"`);
      
      // Get all thread metadata keys
      const metadataKeys = await this.redisClient!.keys('zenode:thread:meta:*');
      
      for (const key of metadataKeys.slice(0, limit * 2)) { // Check more than limit to account for filtering
        try {
          const metadataStr = await this.redisClient!.get(key);
          if (!metadataStr) continue;
          
          const metadata: ThreadMetadata = JSON.parse(metadataStr);
          const threadId = key.replace('zenode:thread:meta:', '');
          
          // Simple text matching for Phase 1
          const searchText = `${metadata.label || ''} ${metadata.tags.join(' ')} ${metadata.tools_used.join(' ')}`.toLowerCase();
          const queryLower = args.query.toLowerCase();
          
          if (searchText.includes(queryLower)) {
            const relevanceScore = this.calculateRelevanceScore(searchText, queryLower, metadata);
            
            results.push({
              id: threadId,
              label: metadata.label,
              tags: metadata.tags,
              summary: await this.generateThreadSummary(threadId, metadata),
              relevance_score: relevanceScore,
              metadata,
              preview: args.include_content ? await this.generateThreadPreview(threadId) : undefined,
            });
          }
        } catch (error) {
          logger.warn(`Failed to process metadata for ${key}:`, error);
          continue;
        }
      }
    }

    // Apply filters
    if (args.filters) {
      // Filter by labels
      if (args.filters.labels && args.filters.labels.length > 0) {
        for (const label of args.filters.labels) {
          const labelKey = `zenode:label:${label}`;
          const threadIds = await this.redisClient!.sMembers(labelKey);
          
          for (const threadId of threadIds.slice(0, limit)) {
            if (results.some(r => r.id === threadId)) continue;
            
            const metadataKey = `zenode:thread:meta:${threadId}`;
            const metadataStr = await this.redisClient!.get(metadataKey);
            if (!metadataStr) continue;
            
            const metadata: ThreadMetadata = JSON.parse(metadataStr);
            results.push({
              id: threadId,
              label: metadata.label,
              tags: metadata.tags,
              summary: await this.generateThreadSummary(threadId, metadata),
              relevance_score: 1.0, // Direct label match
              metadata,
              preview: args.include_content ? await this.generateThreadPreview(threadId) : undefined,
            });
          }
        }
      }

      // Filter by tags
      if (args.filters.tags && args.filters.tags.length > 0) {
        for (const tag of args.filters.tags) {
          const tagKey = `zenode:tag:${tag}`;
          const threadIds = await this.redisClient!.sMembers(tagKey);
          
          for (const threadId of threadIds.slice(0, limit)) {
            if (results.some(r => r.id === threadId)) continue;
            
            const metadataKey = `zenode:thread:meta:${threadId}`;
            const metadataStr = await this.redisClient!.get(metadataKey);
            if (!metadataStr) continue;
            
            const metadata: ThreadMetadata = JSON.parse(metadataStr);
            results.push({
              id: threadId,
              label: metadata.label,
              tags: metadata.tags,
              summary: await this.generateThreadSummary(threadId, metadata),
              relevance_score: 0.9, // Direct tag match
              metadata,
              preview: args.include_content ? await this.generateThreadPreview(threadId) : undefined,
            });
          }
        }
      }
    }

    // Sort by relevance score and limit results
    results.sort((a, b) => b.relevance_score - a.relevance_score);
    const limitedResults = results.slice(0, limit);

    // Format output
    if (limitedResults.length === 0) {
      return this.formatOutput(
        `🔍 **No threads found**

${args.query ? `Query: "${args.query}"` : ''}
${args.filters?.labels ? `Labels: ${args.filters.labels.join(', ')}` : ''}
${args.filters?.tags ? `Tags: ${args.filters.tags.join(', ')}` : ''}

Try a different search query or check your thread labels.`,
        'success'
      );
    }

    const output = [`🔍 **Found ${limitedResults.length} thread${limitedResults.length === 1 ? '' : 's'}**`, ''];

    if (args.query) {
      output.push(`Query: "${args.query}"`);
    }
    if (args.filters?.labels?.length) {
      output.push(`Labels: ${args.filters.labels.join(', ')}`);
    }
    if (args.filters?.tags?.length) {
      output.push(`Tags: ${args.filters.tags.join(', ')}`);
    }
    output.push('');

    for (const result of limitedResults) {
      output.push(`## 🏷️ ${result.label || 'Unlabeled'} (${(result.relevance_score * 100).toFixed(0)}% match)`);
      output.push(`**Thread ID:** ${result.id}`);
      output.push(`**Summary:** ${result.summary}`);
      if (result.tags.length > 0) {
        output.push(`**Tags:** ${result.tags.join(', ')}`);
      }
      output.push(`**Stats:** ${result.metadata.total_turns} turns, ${result.metadata.total_tokens} tokens`);
      output.push(`**Tools:** ${result.metadata.tools_used.join(', ')}`);
      output.push(`**Created:** ${new Date(result.metadata.created).toLocaleDateString()}`);
      
      if (result.preview) {
        output.push(`**Preview:** ${result.preview}`);
      }
      
      output.push('');
    }

    return this.formatOutput(output.join('\n'), 'success');
  }

  /**
   * List all threads with basic metadata
   */
  private async listThreads(args: ThreadsRequest): Promise<ToolOutput> {
    const metadataKeys = await this.redisClient!.keys('zenode:thread:meta:*');
    const limit = Math.min(args.limit || 20, 50);
    
    const threads: ThreadMetadata[] = [];
    
    for (const key of metadataKeys.slice(0, limit)) {
      try {
        const metadataStr = await this.redisClient!.get(key);
        if (metadataStr) {
          threads.push(JSON.parse(metadataStr));
        }
      } catch (error) {
        logger.warn(`Failed to parse metadata for ${key}:`, error);
      }
    }

    // Sort by last accessed (most recent first)
    threads.sort((a, b) => new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime());

    if (threads.length === 0) {
      return this.formatOutput(
        `📋 **No threads found**

No conversation threads have been labeled yet. Use the \`label\` action to start organizing your conversations.`,
        'success'
      );
    }

    const output = [`📋 **Thread List (${threads.length} total)**`, ''];

    for (const thread of threads) {
      output.push(`## 🏷️ ${thread.label || 'Unlabeled'}`);
      output.push(`**ID:** ${thread.id}`);
      if (thread.tags.length > 0) {
        output.push(`**Tags:** ${thread.tags.join(', ')}`);
      }
      output.push(`**Stats:** ${thread.total_turns} turns, ${thread.total_tokens} tokens`);
      output.push(`**Tools:** ${thread.tools_used.join(', ')}`);
      output.push(`**Last accessed:** ${new Date(thread.last_accessed).toLocaleDateString()}`);
      output.push('');
    }

    return this.formatOutput(output.join('\n'), 'success');
  }

  /**
   * Remove label from a thread
   */
  private async removeLabel(args: ThreadsRequest): Promise<ToolOutput> {
    if (!args.thread_id || !args.label) {
      throw new Error('thread_id and label are required for remove action');
    }

    const metadataKey = `zenode:thread:meta:${args.thread_id}`;
    const metadataStr = await this.redisClient!.get(metadataKey);
    
    if (!metadataStr) {
      throw new Error(`Thread ${args.thread_id} metadata not found`);
    }

    const metadata: ThreadMetadata = JSON.parse(metadataStr);
    
    if (metadata.label !== args.label) {
      throw new Error(`Thread ${args.thread_id} does not have label "${args.label}"`);
    }

    // Remove label from metadata
    delete metadata.label;
    delete metadata.last_labeled;
    metadata.last_accessed = new Date().toISOString();

    // Save updated metadata
    await this.redisClient!.setEx(metadataKey, 86400 * 30, JSON.stringify(metadata));

    // Remove from label index
    const labelKey = `zenode:label:${args.label}`;
    await this.redisClient!.sRem(labelKey, args.thread_id);

    logger.info(`Removed label "${args.label}" from thread ${args.thread_id}`);

    return this.formatOutput(
      `✅ **Label removed successfully**

**Thread:** ${args.thread_id}
**Removed label:** ${args.label}

The thread is now unlabeled but retains its tags and metadata.`,
      'success'
    );
  }

  /**
   * Delete a thread entirely
   */
  private async deleteThread(args: ThreadsRequest): Promise<ToolOutput> {
    if (!args.thread_id) {
      throw new Error('thread_id is required for delete action');
    }

    // Get metadata first to clean up indices
    const metadataKey = `zenode:thread:meta:${args.thread_id}`;
    const metadataStr = await this.redisClient!.get(metadataKey);
    
    if (metadataStr) {
      const metadata: ThreadMetadata = JSON.parse(metadataStr);
      
      // Remove from label index
      if (metadata.label) {
        const labelKey = `zenode:label:${metadata.label}`;
        await this.redisClient!.sRem(labelKey, args.thread_id);
      }

      // Remove from tag indices
      for (const tag of metadata.tags) {
        const tagKey = `zenode:tag:${tag}`;
        await this.redisClient!.sRem(tagKey, args.thread_id);
      }
    }

    // Delete metadata
    await this.redisClient!.del(metadataKey);

    // Delete the actual conversation thread
    const threadKey = `zenode:conversation:${args.thread_id}`;
    await this.redisClient!.del(threadKey);

    logger.info(`Deleted thread ${args.thread_id} and all associated metadata`);

    return this.formatOutput(
      `✅ **Thread deleted successfully**

**Thread ID:** ${args.thread_id}

The thread and all associated metadata (labels, tags, statistics) have been permanently removed.`,
      'success'
    );
  }

  /**
   * Get thread statistics
   */
  private async getThreadStats(args: ThreadsRequest): Promise<ToolOutput> {
    if (args.thread_id) {
      // Get stats for specific thread
      const metadataKey = `zenode:thread:meta:${args.thread_id}`;
      const metadataStr = await this.redisClient!.get(metadataKey);
      
      if (!metadataStr) {
        throw new Error(`Thread ${args.thread_id} metadata not found`);
      }

      const metadata: ThreadMetadata = JSON.parse(metadataStr);
      const stats = await getConversationStats(args.thread_id);

      return this.formatOutput(
        `📊 **Thread Statistics**

**Thread ID:** ${metadata.id}
**Label:** ${metadata.label || 'Unlabeled'}
**Tags:** ${metadata.tags.join(', ') || 'none'}
**Total turns:** ${stats?.total_turns || metadata.total_turns}
**Total tokens:** ${(stats?.total_input_tokens || 0) + (stats?.total_output_tokens || 0)}
**Tools used:** ${metadata.tools_used.join(', ')}
**Created:** ${new Date(metadata.created).toLocaleString()}
**Last accessed:** ${new Date(metadata.last_accessed).toLocaleString()}
${metadata.last_labeled ? `**Last labeled:** ${new Date(metadata.last_labeled).toLocaleString()}` : ''}`,
        'success'
      );
    } else {
      // Get overall statistics
      const metadataKeys = await this.redisClient!.keys('zenode:thread:meta:*');
      const labelKeys = await this.redisClient!.keys('zenode:label:*');
      const tagKeys = await this.redisClient!.keys('zenode:tag:*');

      let totalTurns = 0;
      let totalTokens = 0;
      const toolUsage: Record<string, number> = {};

      for (const key of metadataKeys) {
        try {
          const metadataStr = await this.redisClient!.get(key);
          if (metadataStr) {
            const metadata: ThreadMetadata = JSON.parse(metadataStr);
            totalTurns += metadata.total_turns;
            totalTokens += metadata.total_tokens;
            
            for (const tool of metadata.tools_used) {
              toolUsage[tool] = (toolUsage[tool] || 0) + 1;
            }
          }
        } catch (error) {
          logger.warn(`Failed to process metadata for ${key}:`, error);
        }
      }

      const sortedTools = Object.entries(toolUsage)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      return this.formatOutput(
        `📊 **Overall Thread Statistics**

**Total threads:** ${metadataKeys.length}
**Total labels:** ${labelKeys.length}
**Total tags:** ${tagKeys.length}
**Total conversation turns:** ${totalTurns.toLocaleString()}
**Total tokens processed:** ${totalTokens.toLocaleString()}

**Top tools used:**
${sortedTools.map(([tool, count]) => `- ${tool}: ${count} threads`).join('\n')}`,
        'success'
      );
    }
  }

  /**
   * Auto-generate label using AI content analysis
   */
  private async autoLabelThread(args: ThreadsRequest): Promise<ToolOutput> {
    if (!args.thread_id) {
      throw new Error('thread_id is required for auto_label action');
    }

    // Verify thread exists
    const thread = await getThread(args.thread_id);
    if (!thread) {
      throw new Error(`Thread ${args.thread_id} not found or has expired`);
    }

    try {
      // Extract conversation content for analysis, filtering out JSON responses
      const conversationContent = thread.turns
        .filter(turn => turn.content && turn.content.trim().length > 0)
        .map(turn => {
          let content = turn.content.trim();
          
          // Filter out JSON responses that might confuse labeling
          if (content.startsWith('{') && content.includes('"status"')) {
            // This is likely an AnalyzeTool JSON response, replace with generic text
            content = '[Technical analysis response]';
          }
          
          return `${turn.role}: ${content}`;
        })
        .join('\n\n');

      if (!conversationContent || conversationContent.trim().length < 10) {
        throw new Error('Insufficient content in thread for auto-labeling');
      }

      // Use chat tool to generate label (better for conversation analysis)
      const chatTool = new ChatTool();
      const analysisResult = await chatTool.execute({
        prompt: `Analyze this conversation thread and suggest a concise, descriptive label (2-4 words) that captures the main topic or purpose. The label should be useful for organizing and finding this conversation later.

Focus on:
- Main technical topic or domain
- Type of activity (debugging, planning, review, etc.)
- Key technologies or tools mentioned
- Project or feature being discussed

Return only the suggested label, nothing else.

Conversation content:
${conversationContent.substring(0, 4000)}`, // Limit to avoid token issues
        model: 'auto',
        temperature: 0.3,
      });

      if (analysisResult.status !== 'success' || !analysisResult.content) {
        throw new Error('Failed to generate auto-label from content analysis');
      }

      // Extract the label from the analysis result
      let labelContent = analysisResult.content.trim();
      
      // Handle potential JSON responses (fallback safety)
      if (labelContent.startsWith('{') && labelContent.includes('"')) {
        try {
          const parsed = JSON.parse(labelContent);
          if (parsed.suggested_label) {
            labelContent = parsed.suggested_label;
          } else if (parsed.label) {
            labelContent = parsed.label;
          } else {
            throw new Error('No label found in JSON response');
          }
        } catch (jsonError) {
          // If JSON parsing fails, treat as plain text but warn
          logger.warn('ChatTool returned unexpected JSON format for label generation');
          labelContent = labelContent.substring(0, 50); // Use first 50 chars as fallback
        }
      }
      
      const suggestedLabel = labelContent
        .replace(/^["']|["']$/g, '') // Remove quotes
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Keep only alphanumeric, spaces, and hyphens
        .trim()
        .substring(0, 50); // Limit length

      if (!suggestedLabel || suggestedLabel.length < 3) {
        throw new Error('Generated label is too short or invalid');
      }

      // Generate suggested tags based on content
      const tagAnalysisResult = await chatTool.execute({
        prompt: `Analyze this conversation and suggest 2-4 relevant tags that would help categorize this thread. Focus on:
- Programming languages or technologies mentioned
- Type of development activity (debugging, feature, testing, etc.)
- Domain or area (frontend, backend, database, etc.)

Return only a comma-separated list of tags, nothing else.

Conversation content:
${conversationContent.substring(0, 2000)}`,
        model: 'auto', 
        temperature: 0.3,
      });

      let suggestedTags: string[] = [];
      if (tagAnalysisResult.status === 'success' && tagAnalysisResult.content) {
        let tagContent = tagAnalysisResult.content.trim();
        
        // Handle potential JSON responses (fallback safety)
        if (tagContent.startsWith('{') && tagContent.includes('"')) {
          try {
            const parsed = JSON.parse(tagContent);
            if (parsed.tags && Array.isArray(parsed.tags)) {
              tagContent = parsed.tags.join(', ');
            } else if (parsed.suggested_tags) {
              tagContent = parsed.suggested_tags;
            } else {
              throw new Error('No tags found in JSON response');
            }
          } catch (jsonError) {
            logger.warn('ChatTool returned unexpected JSON format for tag generation');
            tagContent = tagContent.substring(0, 100); // Use first 100 chars as fallback
          }
        }
        
        suggestedTags = tagContent
          .split(',')
          .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
          .filter(tag => tag.length >= 2 && tag.length <= 20)
          .slice(0, 4);
      }

      // Generate 4-sentence preview summary
      const previewSummary = await this.generateThreadPreviewSummary(args.thread_id);

      // Get or create thread metadata
      const metadataKey = `zenode:thread:meta:${args.thread_id}`;
      const existingMeta = await this.redisClient!.get(metadataKey);
      
      const now = new Date().toISOString();
      const stats = await getConversationStats(args.thread_id);
      
      const metadata: ThreadMetadata = existingMeta ? JSON.parse(existingMeta) : {
        id: args.thread_id,
        tags: [],
        created: thread.created_at,
        last_accessed: now,
        total_turns: stats?.total_turns || 0,
        total_tokens: (stats?.total_input_tokens || 0) + (stats?.total_output_tokens || 0),
        tools_used: thread.metadata?.tools_used || [],
      };

      // Update metadata with auto-generated label
      metadata.auto_generated_label = suggestedLabel;
      metadata.auto_label_confidence = 0.85; // Fixed confidence for now
      metadata.last_accessed = now;
      
      // Add preview summary if generated
      if (previewSummary) {
        metadata.preview_summary = previewSummary;
        metadata.preview_generated = now;
      }
      
      // If no manual label exists, use auto-generated as primary label
      if (!metadata.label) {
        metadata.label = suggestedLabel;
        metadata.last_labeled = now;
      }

      // Add suggested tags if not already present
      if (suggestedTags.length > 0) {
        metadata.tags = [...new Set([...metadata.tags, ...suggestedTags])];
      }

      // Save updated metadata
      await this.redisClient!.setEx(metadataKey, 86400 * 30, JSON.stringify(metadata)); // 30 days TTL

      // Update label index for fast lookup
      const labelKey = `zenode:label:${suggestedLabel}`;
      await this.redisClient!.sAdd(labelKey, args.thread_id);
      await this.redisClient!.expire(labelKey, 86400 * 30);

      // Update tag indices
      if (suggestedTags.length > 0) {
        for (const tag of suggestedTags) {
          const tagKey = `zenode:tag:${tag}`;
          await this.redisClient!.sAdd(tagKey, args.thread_id);
          await this.redisClient!.expire(tagKey, 86400 * 30);
        }
      }

      logger.info(`Auto-labeled thread ${args.thread_id} as "${suggestedLabel}" with ${suggestedTags.length} tags`);

      return this.formatOutput(
        `🤖 **Auto-labeling completed**

**Thread:** ${args.thread_id}
**Generated label:** ${suggestedLabel}
**Confidence:** ${(metadata.auto_label_confidence * 100).toFixed(1)}%
**Suggested tags:** ${suggestedTags.join(', ') || 'none'}
**Total turns analyzed:** ${metadata.total_turns}
**Tools used:** ${metadata.tools_used.join(', ')}
${previewSummary ? `\n**Preview summary:** ${previewSummary}` : ''}

${metadata.label === suggestedLabel ? 
  'The auto-generated label has been set as the primary label.' : 
  `Manual label "${metadata.label}" was preserved. Auto-label stored as suggestion.`}`,
        'success'
      );

    } catch (error) {
      logger.error(`Auto-labeling failed for thread ${args.thread_id}:`, error);
      return this.formatOutput(
        `❌ **Auto-labeling failed**

**Thread:** ${args.thread_id}
**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

The thread content may be insufficient for analysis, or the analyze tool may be unavailable. Try manual labeling instead.`,
        'error'
      );
    }
  }

  /**
   * Export thread for sharing
   */
  private async exportThread(args: ThreadsRequest): Promise<ToolOutput> {
    if (!args.thread_id) {
      throw new Error('thread_id is required for export action');
    }

    const thread = await getThread(args.thread_id);
    if (!thread) {
      throw new Error(`Thread ${args.thread_id} not found or has expired`);
    }

    const metadataKey = `zenode:thread:meta:${args.thread_id}`;
    const metadataStr = await this.redisClient!.get(metadataKey);
    
    const exportData = {
      thread,
      metadata: metadataStr ? JSON.parse(metadataStr) : null,
      exported_at: new Date().toISOString(),
      export_version: '1.0',
    };

    return this.formatOutput(
      `📤 **Thread Export**

**Thread ID:** ${args.thread_id}
**Export Date:** ${new Date().toLocaleString()}

\`\`\`json
${JSON.stringify(exportData, null, 2)}
\`\`\`

This JSON can be saved to a file and imported into another zenode instance.`,
      'success'
    );
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(searchText: string, query: string, metadata: ThreadMetadata): number {
    let score = 0;

    // Exact label match
    if (metadata.label?.toLowerCase().includes(query)) {
      score += 1.0;
    }

    // Tag match
    if (metadata.tags.some(tag => tag.toLowerCase().includes(query))) {
      score += 0.8;
    }

    // Tool match
    if (metadata.tools_used.some(tool => tool.toLowerCase().includes(query))) {
      score += 0.6;
    }

    // Recency boost (more recent = higher score)
    const daysSinceAccess = (Date.now() - new Date(metadata.last_accessed).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 0.5 - (daysSinceAccess * 0.01));
    score += recencyBoost;

    // Activity boost (more turns = higher score, up to a point)
    const activityBoost = Math.min(0.3, metadata.total_turns * 0.02);
    score += activityBoost;

    return Math.min(1.0, score);
  }

  /**
   * Generate a summary for a thread
   */
  private async generateThreadSummary(threadId: string, metadata: ThreadMetadata): Promise<string> {
    const parts = [];

    if (metadata.label) {
      parts.push(metadata.label);
    } else {
      parts.push(`${metadata.tools_used[0] || 'Unknown'} conversation`);
    }

    if (metadata.total_turns > 0) {
      parts.push(`${metadata.total_turns} turns`);
    }

    if (metadata.tags.length > 0) {
      parts.push(`Tags: ${metadata.tags.slice(0, 3).join(', ')}${metadata.tags.length > 3 ? '...' : ''}`);
    }

    const daysSinceAccess = Math.floor((Date.now() - new Date(metadata.last_accessed).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceAccess === 0) {
      parts.push('accessed today');
    } else if (daysSinceAccess === 1) {
      parts.push('accessed yesterday');
    } else if (daysSinceAccess < 7) {
      parts.push(`accessed ${daysSinceAccess} days ago`);
    }

    return parts.join(' • ');
  }

  /**
   * Generate a 4-sentence AI summary of thread content for preview
   */
  private async generateThreadPreviewSummary(threadId: string): Promise<string | null> {
    try {
      const thread = await getThread(threadId);
      if (!thread || !thread.turns || thread.turns.length === 0) {
        return null;
      }

      // Extract conversation content for analysis (limit to avoid token issues)
      const conversationContent = thread.turns
        .filter(turn => turn.content && turn.content.trim().length > 0)
        .map(turn => {
          let content = turn.content.trim();
          
          // Filter out JSON responses that might confuse summary generation
          if (content.startsWith('{') && content.includes('"status"')) {
            // This is likely an AnalyzeTool JSON response, replace with generic text
            content = '[Technical analysis response]';
          }
          
          return `${turn.role}: ${content}`;
        })
        .join('\n\n')
        .substring(0, 3000); // Limit content length

      if (!conversationContent || conversationContent.trim().length < 50) {
        return null;
      }

      // Use chat tool to generate 4-sentence summary (better for conversation analysis)
      const chatTool = new ChatTool();
      const summaryResult = await chatTool.execute({
        prompt: `Generate a concise 4-sentence summary of this conversation thread. Focus on:
1. What was the main topic or problem discussed?
2. What approach or solution was taken?
3. What was the key outcome or decision?
4. What value would this conversation provide for future reference?

Keep each sentence clear and informative. Return only the 4-sentence summary, nothing else.

Conversation content:
${conversationContent}`,
        model: 'auto',
        temperature: 0.3,
      });

      if (summaryResult.status !== 'success' || !summaryResult.content) {
        return null;
      }

      // Clean and validate the summary
      let summaryContent = summaryResult.content.trim();
      
      // Handle potential JSON responses (fallback safety)
      if (summaryContent.startsWith('{') && summaryContent.includes('"')) {
        try {
          const parsed = JSON.parse(summaryContent);
          if (parsed.summary) {
            summaryContent = parsed.summary;
          } else if (parsed.content) {
            summaryContent = parsed.content;
          } else {
            throw new Error('No summary found in JSON response');
          }
        } catch (jsonError) {
          logger.warn('ChatTool returned unexpected JSON format for summary generation');
          summaryContent = summaryContent.substring(0, 400); // Use first 400 chars as fallback
        }
      }
      
      const summary = summaryContent
        .replace(/^[\"']|[\"']$/g, '') // Remove quotes
        .substring(0, 400); // Limit length

      // Validate it's roughly 4 sentences
      const sentenceCount = (summary.match(/[.!?]+/g) || []).length;
      if (sentenceCount < 2 || summary.length < 50) {
        return null;
      }

      return summary;
    } catch (error) {
      logger.warn(`Failed to generate preview summary for thread ${threadId}:`, error);
      return null;
    }
  }

  /**
   * Generate a simple preview of thread content (fallback)
   */
  private async generateThreadPreview(threadId: string): Promise<string> {
    try {
      const thread = await getThread(threadId);
      if (!thread || !thread.turns || thread.turns.length === 0) {
        return 'No content available';
      }

      // Get the first user turn for preview
      const firstUserTurn = thread.turns.find(turn => turn.role === 'user');
      if (firstUserTurn) {
        const preview = firstUserTurn.content.substring(0, 150);
        return preview.length < firstUserTurn.content.length ? `${preview}...` : preview;
      }

      return 'No user content found';
    } catch (error) {
      logger.warn(`Failed to generate preview for thread ${threadId}:`, error);
      return 'Preview unavailable';
    }
  }
}