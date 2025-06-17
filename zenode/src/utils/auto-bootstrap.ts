import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

/**
 * Check if this is the first time zenode is being used in this project
 */
export function isFirstRun(): boolean {
  const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
  
  if (!existsSync(userConfigPath)) {
    return true;
  }
  
  try {
    const config = JSON.parse(readFileSync(userConfigPath, 'utf8'));
    return !config.first_run_complete;
  } catch (error) {
    logger.warn('Could not read user config, treating as first run:', error);
    return true;
  }
}

/**
 * Get bootstrap welcome message for first-time users
 */
export function getBootstrapWelcome(): string {
  return `🚀 **Welcome to Zenode MCP Server!**

This appears to be your first time using \`:z\` in this project.

**Quick Setup Options:**
1. \`:z bootstrap configure --skip_prompts=true\` - Use smart defaults
2. \`:z bootstrap configure\` - Interactive setup (coming soon)
3. \`:z bootstrap check\` - See current configuration status

**What Zenode provides:**
- Full filesystem access for maximum productivity  
- AI-powered code analysis, review, and assistance
- Multi-model support (Claude, GPT, Gemini, local models)
- Conversation memory across tool calls
- Development workflows optimized for creative projects

Run \`:z bootstrap configure --skip_prompts=true\` to get started instantly!`;
}

/**
 * Check if zenode has appropriate file access permissions
 */
export function checkFileAccess(): { hasAccess: boolean; message: string } {
  try {
    // Check if we can access user home directory through mounted volume
    const homeAccess = existsSync('/home');
    
    if (!homeAccess) {
      return {
        hasAccess: false,
        message: `⚠️ **Limited File Access Detected**

Zenode doesn't have full filesystem access. To enable:

1. Stop zenode: \`docker compose down\`
2. Update docker-compose.yml to mount home directory:
   \`\`\`yaml
   volumes:
     - \${HOME}:/home:rw
   \`\`\`
3. Restart: \`docker compose up -d\`

Or run \`:z bootstrap configure\` for automated setup.`
      };
    }
    
    return {
      hasAccess: true,
      message: '✅ Full filesystem access configured'
    };
  } catch (error) {
    return {
      hasAccess: false,
      message: `❌ File access check failed: ${error}`
    };
  }
}

/**
 * Auto-detect if user needs bootstrap guidance
 */
export function shouldShowBootstrapGuidance(): { show: boolean; reason: string; suggestion: string } {
  const firstRun = isFirstRun();
  const { hasAccess } = checkFileAccess();
  
  if (firstRun && !hasAccess) {
    return {
      show: true,
      reason: 'First run + limited file access',
      suggestion: 'Run `:z bootstrap configure --skip_prompts=true` to set up full access and defaults'
    };
  }
  
  if (firstRun) {
    return {
      show: true,
      reason: 'First run (file access OK)',
      suggestion: 'Run `:z bootstrap configure --skip_prompts=true` to complete setup'
    };
  }
  
  if (!hasAccess) {
    return {
      show: true,
      reason: 'Limited file access (previously configured)',
      suggestion: 'Run `:z bootstrap configure` to enable full filesystem access'
    };
  }
  
  return {
    show: false,
    reason: 'Already configured',
    suggestion: ''
  };
}