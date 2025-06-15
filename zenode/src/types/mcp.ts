/**
 * Type definitions for MCP (Model Context Protocol) interactions
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPTextContent {
  type: 'text';
  text: string;
}

export interface MCPImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export type MCPContent = MCPTextContent | MCPImageContent;

export interface MCPToolResponse {
  content: MCPContent[];
  isError?: boolean;
  metadata?: Record<string, any>;
}

export interface MCPServerCapabilities {
  tools?: {
    listTools?: boolean;
  };
  prompts?: {
    listPrompts?: boolean;
  };
  resources?: {
    listResources?: boolean;
    readResource?: boolean;
  };
}

export interface MCPInitializationOptions {
  capabilities?: MCPServerCapabilities;
}