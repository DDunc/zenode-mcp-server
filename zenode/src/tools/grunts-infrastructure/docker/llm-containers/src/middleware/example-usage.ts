import { DefaultMiddlewarePipeline, ConversationLoggerMiddleware, ToolContext } from './index.js';

// Example of how to set up and use the middleware system
export function setupMiddleware() {
  const pipeline = new DefaultMiddlewarePipeline();
  
  // Register the conversation logger middleware
  // Configuration will be loaded automatically from config files
  const conversationLogger = new ConversationLoggerMiddleware();
  
  pipeline.register(conversationLogger);
  
  return pipeline;
}

// Example of how to use the middleware in a tool execution
export async function executeToolWithMiddleware(toolName: string, input: any) {
  const pipeline = setupMiddleware();
  
  const context: ToolContext = {
    toolName,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    input,
    conversationId: 'conv-123',
    userId: 'user-456'
  };
  
  try {
    // Execute request middleware
    await pipeline.executeRequest(context);
    
    // Your actual tool execution would go here
    const result = await executeActualTool(toolName, input);
    
    // Execute response middleware
    await pipeline.executeResponse(context, result);
    
    return result;
  } catch (error) {
    // Execute response middleware even on error
    await pipeline.executeResponse(context, null, error as Error);
    throw error;
  }
}

// Placeholder for actual tool execution
async function executeActualTool(toolName: string, input: any): Promise<any> {
  // This would be replaced with your actual tool execution logic
  return { message: `Tool ${toolName} executed with input: ${JSON.stringify(input)}` };
}