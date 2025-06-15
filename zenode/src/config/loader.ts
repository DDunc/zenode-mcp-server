/**
 * Configuration loader that supports both JSON and TypeScript config files
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ZenodeConfig, DEFAULT_CONFIG } from './types.js';
import { logger } from '../utils/logger.js';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: ZenodeConfig = DEFAULT_CONFIG;
  private configPath: string | null = null;

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Load configuration from file system
   * Priority: zenode.config.ts > zenode.config.js > zenode-config.json > defaults
   */
  async loadConfig(basePath: string = process.cwd()): Promise<ZenodeConfig> {
    const configFiles = [
      'zenode.config.ts',
      'zenode.config.js', 
      'zenode-config.json'
    ];

    for (const filename of configFiles) {
      const configPath = join(basePath, filename);
      
      try {
        await fs.access(configPath);
        
        if (filename.endsWith('.json')) {
          await this.loadJsonConfig(configPath);
        } else {
          await this.loadTsConfig(configPath);
        }
        
        this.configPath = configPath;
        logger.info(`Loaded configuration from: ${filename}`);
        return this.config;
      } catch (error) {
        // File doesn't exist, try next one
        continue;
      }
    }

    // No config file found, use defaults
    logger.info('No configuration file found, using defaults');
    this.config = { ...DEFAULT_CONFIG };
    return this.config;
  }

  /**
   * Load JSON configuration file
   */
  private async loadJsonConfig(configPath: string): Promise<void> {
    const content = await fs.readFile(configPath, 'utf8');
    const userConfig = JSON.parse(content);
    this.config = this.mergeConfigs(DEFAULT_CONFIG, userConfig);
  }

  /**
   * Load TypeScript/JavaScript configuration file
   */
  private async loadTsConfig(configPath: string): Promise<void> {
    // Convert to file URL for ES module import
    const fileUrl = pathToFileURL(configPath).href;
    
    // Dynamic import to load the config
    const configModule = await import(fileUrl);
    const userConfig = configModule.default || configModule;
    
    this.config = this.mergeConfigs(DEFAULT_CONFIG, userConfig);
  }

  /**
   * Merge user configuration with defaults
   */
  private mergeConfigs(defaults: ZenodeConfig, userConfig: Partial<ZenodeConfig>): ZenodeConfig {
    return {
      logging: { ...defaults.logging, ...userConfig.logging },
      shortcuts: { ...defaults.shortcuts, ...userConfig.shortcuts },
      server: { ...defaults.server, ...userConfig.server },
      version: userConfig.version || defaults.version
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ZenodeConfig {
    return { ...this.config };
  }

  /**
   * Get specific config section
   */
  getLoggingConfig() {
    return { ...this.config.logging };
  }

  getShortcutsConfig() {
    return { ...this.config.shortcuts };
  }

  getServerConfig() {
    return { ...this.config.server };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<ZenodeConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
    logger.info('Configuration updated at runtime');
  }

  /**
   * Get the path of the loaded config file
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ZenodeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate logging config
    if (!config.logging.conversationTrigger || config.logging.conversationTrigger.length === 0) {
      errors.push('logging.conversationTrigger cannot be empty');
    }

    if (!config.logging.logPath || config.logging.logPath.length === 0) {
      errors.push('logging.logPath cannot be empty');
    }

    // Validate shortcuts config
    if (!config.shortcuts.coordinationPrefix || config.shortcuts.coordinationPrefix.length === 0) {
      errors.push('shortcuts.coordinationPrefix cannot be empty');
    }

    if (!config.shortcuts.toolInvocation || config.shortcuts.toolInvocation.length === 0) {
      errors.push('shortcuts.toolInvocation cannot be empty');
    }

    // Validate server config
    if (config.server.port && (config.server.port < 1 || config.server.port > 65535)) {
      errors.push('server.port must be between 1 and 65535');
    }

    if (config.server.requestTimeout < 1000) {
      errors.push('server.requestTimeout must be at least 1000ms');
    }

    if (config.server.maxConcurrentRequests < 1) {
      errors.push('server.maxConcurrentRequests must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const configLoader = ConfigLoader.getInstance();