export enum MiddlewarePhase {
  REQUEST = 'request',
  RESPONSE = 'response',
  BOTH = 'both'
}

export interface MiddlewareConfig {
  name: string;
  phases: MiddlewarePhase;
  enabled: boolean;
}

export interface ToolContext {
  toolName: string;
  requestId: string;
  timestamp: Date;
  input: any;
  conversationId?: string;
  userId?: string;
}

export interface Middleware {
  config: MiddlewareConfig;
  onRequest?(context: ToolContext): Promise<void>;
  onResponse?(context: ToolContext, result: any, error?: Error): Promise<void>;
}

export interface MiddlewarePipeline {
  register(middleware: Middleware): void;
  executeRequest(context: ToolContext): Promise<void>;
  executeResponse(context: ToolContext, result: any, error?: Error): Promise<void>;
}