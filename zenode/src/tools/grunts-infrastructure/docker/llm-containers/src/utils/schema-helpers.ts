/**
 * Schema utilities for converting Zod schemas to JSON Schema
 * and standardizing validation across tools
 */

import { z, ZodSchema } from 'zod';
import { IS_AUTO_MODE } from '../config.js';
import { getThinkingModeDescription } from './tool-helpers.js';

/**
 * Convert a Zod schema to JSON Schema format for MCP
 * This maintains compatibility with the MCP protocol while using Zod internally
 */
export function zodToJsonSchema(schema: ZodSchema): any {
  // For now, we'll implement a basic converter
  // In the future, we could use a library like zod-to-json-schema
  
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const jsonSchema = convertZodType(value as ZodSchema, key);
      properties[key] = jsonSchema.schema;
      if (jsonSchema.required) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  throw new Error('Only ZodObject schemas are currently supported');
}

/**
 * Convert individual Zod types to JSON Schema
 */
function convertZodType(zodType: ZodSchema, key: string): { schema: any; required: boolean } {
  let schema: any = {};
  let required = true;

  if (zodType instanceof z.ZodOptional) {
    required = false;
    zodType = zodType.unwrap();
  }

  if (zodType instanceof z.ZodDefault) {
    const defaultValue = zodType._def.defaultValue();
    schema.default = defaultValue;
    required = false;
    zodType = zodType.removeDefault();
  }

  if (zodType instanceof z.ZodString) {
    schema.type = 'string';
    
    // Add specific descriptions for common fields
    switch (key) {
      case 'model':
        schema.description = IS_AUTO_MODE 
          ? 'Model to use. Auto mode will select optimal model for task complexity.'
          : `Model to use. Default: ${process.env.DEFAULT_MODEL || 'auto'}`;
        break;
      case 'prompt':
        schema.description = 'The main request or question';
        break;
      case 'continuation_id':
        schema.description = 'Thread continuation ID for multi-turn conversations';
        break;
      default:
        schema.description = `${key} parameter`;
    }
  } else if (zodType instanceof z.ZodNumber) {
    schema.type = 'number';
    
    // Check for min/max constraints
    for (const check of zodType._def.checks) {
      if (check.kind === 'min') {
        schema.minimum = check.value;
      } else if (check.kind === 'max') {
        schema.maximum = check.value;
      }
    }
    
    if (key === 'temperature') {
      schema.description = 'Temperature (0-1, default varies by tool)';
    }
  } else if (zodType instanceof z.ZodBoolean) {
    schema.type = 'boolean';
    
    if (key === 'use_websearch') {
      schema.description = 'Enable web search for documentation and best practices';
    }
  } else if (zodType instanceof z.ZodArray) {
    schema.type = 'array';
    const elementType = zodType.element;
    
    if (elementType instanceof z.ZodString) {
      schema.items = { type: 'string' };
      
      if (key === 'files') {
        schema.description = 'Files or directories to process (must be absolute paths)';
      }
    }
  } else if (zodType instanceof z.ZodEnum) {
    schema.type = 'string';
    schema.enum = zodType.options;
    
    // Add specific descriptions for enum fields
    switch (key) {
      case 'thinking_mode':
        schema.description = getThinkingModeDescription();
        break;
      case 'analysis_type':
        schema.description = 'Type of analysis to perform';
        break;
      case 'review_type':
        schema.description = 'Type of review to perform';
        break;
      case 'severity_filter':
        schema.description = 'Minimum severity level to report';
        break;
      case 'output_format':
        schema.description = 'How to format the output';
        break;
      default:
        schema.description = `${key} option`;
    }
  }

  return { schema, required };
}

/**
 * Base schema for all tool requests
 */
export const BaseToolRequestSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  thinking_mode: z.enum(['minimal', 'low', 'medium', 'high', 'max']).optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
});

/**
 * Validate and parse tool arguments using a Zod schema
 */
export function validateToolArgs<T>(schema: ZodSchema<T>, args: any): T {
  return schema.parse(args);
}