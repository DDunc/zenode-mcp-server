import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput } from '../types/tools.js';
import { logger } from '../utils/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BootstrapRequestSchema = z.object({
  action: z.enum(['check', 'configure', 'reset']).default('check'),
  config_updates: z.record(z.any()).optional(),
  skip_prompts: z.boolean().default(false),
});

type BootstrapRequest = z.infer<typeof BootstrapRequestSchema>;

export class BootstrapTool extends BaseTool {
  name = 'bootstrap';
  description = 'Bootstrap zenode configuration for first-time setup and project initialization';
  defaultTemperature = 0.3;
  modelCategory = 'all' as const;

  getZodSchema() {
    return BootstrapRequestSchema;
  }

  getSystemPrompt(): string {
    return 'You are helping with zenode bootstrap configuration. Provide clear, actionable guidance for setting up the development environment.';
  }

  async execute(request: BootstrapRequest): Promise<ToolOutput> {
    try {
      const validated = BootstrapRequestSchema.parse(request);
      
      const configPath = join(process.cwd(), 'bootstrap-config.json');
      const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
      
      if (!existsSync(configPath)) {
        return this.formatOutput(
          'Bootstrap configuration file not found. Please ensure bootstrap-config.json exists.',
          'error'
        );
      }

      const bootstrapConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      let userConfig = {};
      
      if (existsSync(userConfigPath)) {
        userConfig = JSON.parse(readFileSync(userConfigPath, 'utf8'));
      }

      switch (validated.action) {
        case 'check':
          return this.checkFirstRun(bootstrapConfig, userConfig);
        
        case 'configure':
          return this.configureSettings(bootstrapConfig, userConfig, validated.config_updates, validated.skip_prompts);
        
        case 'reset':
          return this.resetConfiguration(bootstrapConfig);
        
        default:
          return this.formatOutput('Invalid action specified', 'error');
      }
    } catch (error) {
      logger.error('Bootstrap tool error:', error);
      return this.formatOutput(
        `Bootstrap error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  private checkFirstRun(bootstrapConfig: any, userConfig: any) {
    const isFirstRun = !userConfig.first_run_complete;
    
    if (isFirstRun) {
      return this.formatOutput(`🚀 **First Time Setup Required**

${bootstrapConfig.prompts.welcome}

**Current Status:**
- File Access: Not configured
- Default Model: Not set  
- Conversation Memory: Not configured
- Debug Logging: Not configured

**Next Steps:**
1. Run \`:z bootstrap configure\` to set up your preferences
2. Or run \`:z bootstrap configure --skip_prompts=true\` for defaults

**What gets configured:**
- Full filesystem access for maximum productivity
- Model preferences (auto/sonnet4/gemini/etc.)
- Conversation memory settings
- Debug logging for game development
- Auto-restart behavior

Run the configure command to get started!`, 'success');
    }

    return this.formatOutput(`✅ **Zenode Already Configured**

**Current Settings:**
- File Access: ${userConfig.file_access_mode || 'full'}
- Default Model: ${userConfig.default_model || 'auto'}
- Conversation Memory: ${userConfig.conversation_memory || '3h'}
- Debug Logging: ${userConfig.debug_logging ? 'enabled' : 'disabled'}
- Auto-restart: ${userConfig.auto_restart_on_update ? 'enabled' : 'disabled'}

**Commands:**
- \`:z bootstrap configure\` - Reconfigure settings
- \`:z bootstrap reset\` - Reset to defaults
- All other \`:z\` tools are ready to use!`, 'success');
  }

  private configureSettings(bootstrapConfig: any, userConfig: any, updates: any = {}, skipPrompts: boolean = false) {
    const config = { ...bootstrapConfig.bootstrap.user_preferences, ...userConfig, ...updates };
    
    if (skipPrompts) {
      // Use defaults from bootstrap config
      config.first_run_complete = true;
      config.configured_at = new Date().toISOString();
    }

    const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
    
    // Ensure .zenode directory exists
    const fs = require('fs');
    const zenodefDir = join(process.cwd(), '.zenode');
    if (!fs.existsSync(zenodefDir)) {
      fs.mkdirSync(zenodefDir, { recursive: true });
    }
    
    writeFileSync(userConfigPath, JSON.stringify(config, null, 2));

    if (skipPrompts) {
      return this.formatOutput(`⚡ **Quick Setup Complete!**

Applied default configuration:
- File Access: Full system access (\`${process.env.HOME}\` mounted)
- Default Model: Auto-selection 
- Conversation Memory: 3 hours
- Debug Logging: Enabled
- Auto-restart: Enabled

${bootstrapConfig.prompts.completion}

**Ready to use:**
- \`:z chat "help me with my project"\`
- \`:z analyze /path/to/your/project/code\`
- \`:z codereview /path/to/files\`
- \`:z thinkdeep "complex architecture questions"\`

Your zenode server has full filesystem access for maximum creative productivity!`, 'success');
    }

    // Interactive configuration would go here
    return this.formatOutput(`🔧 **Interactive Configuration**

Use \`skip_prompts=true\` for now, or implement interactive prompts.

Example: \`:z bootstrap configure --skip_prompts=true\``, 'success');
  }

  private resetConfiguration(bootstrapConfig: any) {
    const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
    
    if (existsSync(userConfigPath)) {
      const fs = require('fs');
      fs.unlinkSync(userConfigPath);
    }

    return this.formatOutput(`🔄 **Configuration Reset**

All user settings have been cleared. 

Run \`:z bootstrap configure\` to set up again.`, 'success');
  }
}