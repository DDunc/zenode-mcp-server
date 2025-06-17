import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput } from '../types/tools.js';
import { logger } from '../utils/logger.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT, IS_IN_PROJECT, NEEDS_PROJECT_MOUNT } from '../config.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BootstrapRequestSchema = z.object({
  action: z.enum(['check', 'configure', 'reset', 'auto-setup']).default('check'),
  config_updates: z.record(z.any()).optional(),
  skip_prompts: z.boolean().default(false),
  auto_restart: z.boolean().default(true),
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
      
      // Look for bootstrap config in current directory first, then zenode subdirectory
      let configPath = join(process.cwd(), 'bootstrap-config.json');
      if (!existsSync(configPath)) {
        configPath = join(process.cwd(), 'zenode', 'bootstrap-config.json');
      }
      
      const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
      
      if (!existsSync(configPath)) {
        return this.formatOutput(
          'Bootstrap configuration file not found. Please ensure bootstrap-config.json exists.',
          'error'
        );
      }

      const bootstrapConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      logger.info('Bootstrap config loaded:', JSON.stringify(bootstrapConfig, null, 2));
      let userConfig = {};
      
      if (existsSync(userConfigPath)) {
        userConfig = JSON.parse(readFileSync(userConfigPath, 'utf8'));
      }

      switch (validated.action) {
        case 'check':
          return this.checkFirstRun(bootstrapConfig, userConfig);
        
        case 'configure':
          return this.configureSettings(bootstrapConfig, userConfig, validated.config_updates, validated.skip_prompts);
        
        case 'auto-setup':
          return this.autoSetup(bootstrapConfig, userConfig, validated.auto_restart);
        
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
    
    // Check if we're in a project that needs mounting
    const projectStatus = this.getProjectStatus();
    
    if (isFirstRun) {
      return this.formatOutput(`🚀 **First Time Setup Required**

${bootstrapConfig.bootstrap?.prompts?.welcome || '🚀 Welcome to Zenode MCP Server! This is your first time running :z in this project.'}

${projectStatus}

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
- Debug logging for development
- Auto-restart behavior

Run the configure command to get started!`, 'success');
    }

    return this.formatOutput(`✅ **Zenode Already Configured**

${projectStatus}

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

  private getProjectStatus(): string {
    if (!IS_IN_PROJECT) {
      return `**Project Detection:** No project detected (no .git, package.json, etc. found)`;
    }

    if (NEEDS_PROJECT_MOUNT) {
      return `**⚠️ Project Detected but Not Mounted**
- Project Root: \`${PROJECT_ROOT}\`
- Status: Files not accessible to zenode tools
- Solution: Restart server to auto-mount project directory

**To enable project access:**
1. Stop zenode: \`docker compose down\`
2. Restart: \`./run-server.sh\`
3. Project will be mounted at \`/project\` inside container`;
    }

    return `**✅ Project Detected and Mounted**
- Project Root: \`${PROJECT_ROOT}\`
- Mounted at: \`/project\` (inside container)
- Status: All files accessible to zenode tools`;
  }

  private configureSettings(bootstrapConfig: any, userConfig: any, updates: any = {}, skipPrompts: boolean = false) {
    const config = { ...bootstrapConfig.bootstrap?.user_preferences, ...userConfig, ...updates };
    
    if (skipPrompts) {
      // Use defaults from bootstrap config
      config.first_run_complete = true;
      config.configured_at = new Date().toISOString();
    }

    const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
    
    // Ensure .zenode directory exists
    const zenodefDir = join(process.cwd(), '.zenode');
    if (!existsSync(zenodefDir)) {
      mkdirSync(zenodefDir, { recursive: true });
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

${bootstrapConfig.bootstrap?.prompts?.completion || '✅ Bootstrap complete! Zenode is ready for your creative development work.'}

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

  private async autoSetup(bootstrapConfig: any, userConfig: any, autoRestart: boolean = true) {
    try {
      // Step 1: Auto-detect project and create configuration
      const setupResult = await this.performAutoSetup();
      
      if (!setupResult.success) {
        return this.formatOutput(`❌ **Auto-setup Failed**\n\n${setupResult.error}`, 'error');
      }

      // Step 2: Save user configuration
      const config = {
        ...bootstrapConfig.bootstrap?.user_preferences,
        ...userConfig,
        first_run_complete: true,
        configured_at: new Date().toISOString(),
        auto_setup_used: true,
        project_root: setupResult.projectRoot,
        project_mounted: setupResult.projectMounted
      };

      const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
      const zenodefDir = join(process.cwd(), '.zenode');
      if (!existsSync(zenodefDir)) {
        mkdirSync(zenodefDir, { recursive: true });
      }
      writeFileSync(userConfigPath, JSON.stringify(config, null, 2));

      // Step 3: Restart services if requested and needed
      let restartMessage = '';
      if (autoRestart && setupResult.needsRestart) {
        const restartResult = await this.restartServices();
        restartMessage = restartResult.success ? 
          '\n\n✅ **Services restarted successfully!**' :
          `\n\n⚠️ **Manual restart required:** ${restartResult.error}`;
      } else if (setupResult.needsRestart) {
        restartMessage = '\n\n⚠️ **Manual restart required:** Run `./run-server.sh` to apply changes';
      }

      return this.formatOutput(`🚀 **Auto-setup Complete!**

${setupResult.summary}

**Configuration saved:**
- Project Root: ${setupResult.projectRoot || 'Not detected'}
- Project Mounted: ${setupResult.projectMounted ? 'Yes' : 'No'}
- File Access: Full system access
- Default Model: Auto-selection
- Conversation Memory: 3 hours
- Debug Logging: Enabled${restartMessage}

**Ready to use:**
- \`:z chat "help me with my project"\`
- \`:z analyze ${setupResult.projectRoot ? '/project' : '/home'}\`
- \`:z codereview /path/to/files\`
- \`:z thinkdeep "complex architecture questions"\``, 'success');

    } catch (error) {
      logger.error('Auto-setup error:', error);
      return this.formatOutput(`❌ Auto-setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  private async performAutoSetup(): Promise<{
    success: boolean;
    error?: string;
    projectRoot?: string;
    projectMounted: boolean;
    needsRestart: boolean;
    summary: string;
  }> {
    try {
      // Detect project root
      const projectRoot = this.detectProjectRoot();
      const isInProject = !!projectRoot;
      const needsMount = isInProject && !process.env.MCP_PROJECT_MOUNTED;

      let summary = '';
      let needsRestart = false;

      if (isInProject) {
        summary += `📁 **Project detected:** \`${projectRoot}\`\n`;
        
        if (needsMount) {
          summary += `🔧 **Setting up project mount:** Will be accessible at \`/project\`\n`;
          needsRestart = true;
        } else {
          summary += `✅ **Project already mounted:** Accessible at \`/project\`\n`;
        }
      } else {
        summary += `📂 **No project detected:** Using home directory access only\n`;
      }

      summary += `🏠 **Home directory:** Accessible at \`/home\`\n`;
      summary += `⚙️ **Model selection:** Auto mode (Claude will pick optimal models)\n`;
      summary += `💾 **Memory:** 3-hour conversation persistence\n`;

      return {
        success: true,
        projectRoot: projectRoot || undefined,
        projectMounted: !needsMount,
        needsRestart,
        summary
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectMounted: false,
        needsRestart: false,
        summary: ''
      };
    }
  }

  private detectProjectRoot(): string | null {
    const indicators = ['.git', 'package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', '.project'];
    let currentDir = process.cwd();
    
    while (currentDir !== '/') {
      for (const indicator of indicators) {
        if (existsSync(join(currentDir, indicator))) {
          return currentDir;
        }
      }
      currentDir = join(currentDir, '..');
    }
    return null;
  }

  private async restartServices(): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the zenode directory (we might be in a subdirectory)
      const zenodeDir = this.findZenodeDirectory();
      if (!zenodeDir) {
        return { success: false, error: 'Could not find zenode directory' };
      }

      logger.info(`Restarting services from directory: ${zenodeDir}`);
      
      // Stop current services
      await execAsync('docker compose down', { cwd: zenodeDir });
      
      // Start services with updated configuration
      await execAsync('./run-server.sh', { cwd: zenodeDir });
      
      return { success: true };
    } catch (error) {
      logger.error('Service restart error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private findZenodeDirectory(): string | null {
    // Check if we're already in zenode directory
    if (existsSync('./run-server.sh') && existsSync('./docker-compose.yml')) {
      return process.cwd();
    }
    
    // Check if there's a zenode subdirectory
    const zenodeSubdir = join(process.cwd(), 'zenode');
    if (existsSync(join(zenodeSubdir, 'run-server.sh'))) {
      return zenodeSubdir;
    }
    
    // Check parent directories
    let currentDir = process.cwd();
    while (currentDir !== '/') {
      const zenodeDir = join(currentDir, 'zenode');
      if (existsSync(join(zenodeDir, 'run-server.sh'))) {
        return zenodeDir;
      }
      currentDir = join(currentDir, '..');
    }
    
    return null;
  }

  private resetConfiguration(bootstrapConfig: any) {
    const userConfigPath = join(process.cwd(), '.zenode', 'user-config.json');
    
    if (existsSync(userConfigPath)) {
      unlinkSync(userConfigPath);
    }

    return this.formatOutput(`🔄 **Configuration Reset**

All user settings have been cleared. 

Run \`:z bootstrap configure\` to set up again.`, 'success');
  }
}