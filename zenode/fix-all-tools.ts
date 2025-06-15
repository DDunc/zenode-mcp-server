/**
 * Script to fix all mock responses in zenode tools
 * This ensures the Node.js implementation matches the Python version
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface ToolFix {
  file: string;
  importNeeded: boolean;
  mockResponsePattern: RegExp;
  replacementLogic: string;
}

const toolFixes: ToolFix[] = [
  {
    file: 'debug.ts',
    importNeeded: true,
    mockResponsePattern: /const mockResponse = `[\s\S]*?`;/m,
    replacementLogic: `// Get provider and make actual API call
      const provider = await modelProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new Error(\`No provider available for model: \${model}\`);
      }
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);`,
  },
  {
    file: 'precommit.ts',
    importNeeded: true,
    mockResponsePattern: /const mockResponse = `[\s\S]*?`;/m,
    replacementLogic: `// Get provider and make actual API call
      const provider = await modelProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new Error(\`No provider available for model: \${model}\`);
      }
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);`,
  },
  {
    file: 'testgen.ts',
    importNeeded: true,
    mockResponsePattern: /const mockResponse = `[\s\S]*?`;/m,
    replacementLogic: `// Get provider and make actual API call
      const provider = await modelProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new Error(\`No provider available for model: \${model}\`);
      }
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);`,
  },
  {
    file: 'thinkdeep.ts',
    importNeeded: true,
    mockResponsePattern: /const mockResponse = 'Deep analysis response would go here\.\.\.';/,
    replacementLogic: `// Get provider and make actual API call
      const provider = await modelProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new Error(\`No provider available for model: \${model}\`);
      }
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);`,
  },
];

async function fixTool(fix: ToolFix): Promise<void> {
  const filePath = join('./src/tools', fix.file);
  console.log(`Fixing ${fix.file}...`);
  
  try {
    let content = await readFile(filePath, 'utf-8');
    
    // Add import if needed
    if (fix.importNeeded && !content.includes("import { modelProviderRegistry }")) {
      content = content.replace(
        "import { logger } from '../utils/logger.js';",
        "import { logger } from '../utils/logger.js';\nimport { modelProviderRegistry } from '../providers/registry.js';"
      );
    }
    
    // Replace mock response with actual API call
    content = content.replace(fix.mockResponsePattern, fix.replacementLogic);
    
    // Update references from mockResponse to response.content
    content = content.replace(/mockResponse/g, 'response.content');
    
    // Add conversation threading where missing
    if (!content.includes('handleConversationThreading')) {
      const formatOutputPattern = /return this\.formatOutput\(\s*response\.content,\s*'success',\s*'text',?\s*\);/;
      if (formatOutputPattern.test(content)) {
        content = content.replace(formatOutputPattern, `// Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validatedRequest.prompt || request.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validatedRequest.continuation_id || request.continuation_id,
      );
      
      return this.formatOutput(
        response.content,
        'success',
        'text',
        {
          model_used: response.modelName,
          token_usage: response.usage,
        },
        continuationOffer,
      );`);
      }
    }
    
    await writeFile(filePath, content, 'utf-8');
    console.log(`✓ Fixed ${fix.file}`);
  } catch (error) {
    console.error(`✗ Error fixing ${fix.file}:`, error);
  }
}

async function main() {
  console.log('Fixing all mock responses in zenode tools...\n');
  
  for (const fix of toolFixes) {
    await fixTool(fix);
  }
  
  console.log('\n✓ All tools fixed! Now run: npm run build');
}

main().catch(console.error);