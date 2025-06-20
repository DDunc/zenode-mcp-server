/**
 * Health Tool - Diagnostic information for debugging connection issues
 */

import { BaseTool, ToolOutput, ToolRequest, ToolModelCategory } from '../types/tools.js';
import { healthChecker } from '../health/checker.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

interface HealthToolRequest extends ToolRequest {
  format?: 'summary' | 'detailed' | 'json';
  include_logs?: boolean;
}

export class HealthTool implements BaseTool {
  name = 'health';
  description = 'HEALTH & DIAGNOSTICS - Get detailed server health, connection status, and diagnostic information for troubleshooting MCP connection issues. Perfect for debugging connection problems and monitoring server status.';
  defaultTemperature = 0.2;
  modelCategory: ToolModelCategory = 'fast';

  getInputSchema() {
    return {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['summary', 'detailed', 'json'],
          description: 'Output format (default: detailed)',
          default: 'detailed'
        },
        include_logs: {
          type: 'boolean',
          description: 'Include recent log excerpts in the output',
          default: false
        }
      }
    };
  }

  getZodSchema() {
    return z.object({
      format: z.enum(['summary', 'detailed', 'json']).optional().default('detailed'),
      include_logs: z.boolean().optional().default(false)
    });
  }

  getSystemPrompt(): string {
    return 'You are a health diagnostic tool that provides server status and troubleshooting information.';
  }

  async execute(args: HealthToolRequest): Promise<ToolOutput> {
    const format = args.format || 'detailed';
    
    try {
      const health = await healthChecker.getHealthStatus();
      
      let content = '';
      
      if (format === 'json') {
        content = JSON.stringify(health, null, 2);
      } else {
        content = this.formatHealthReport(health, format === 'detailed');
      }
      
      if (args.include_logs) {
        content += '\n\n' + await this.getRecentLogs();
      }
      
      logger.info('Health check requested', { format, status: health.status });
      
      return {
        status: 'success',
        content,
        content_type: 'markdown'
      };
      
    } catch (error) {
      logger.error('Health check failed:', error);
      
      return {
        status: 'error',
        content: `❌ **Health Check Failed**\n\nError: ${error instanceof Error ? error.message : String(error)}`,
        content_type: 'markdown'
      };
    }
  }

  private formatHealthReport(health: any, detailed: boolean): string {
    const { status, timestamp, uptime, checks } = health;
    
    // Status emoji
    const statusEmoji = status === 'healthy' ? '✅' : 
                       status === 'degraded' ? '⚠️' : '❌';
    
    let report = `# ${statusEmoji} **Zenode Health Report**\n\n`;
    report += `**Overall Status:** ${status.toUpperCase()}\n`;
    report += `**Timestamp:** ${new Date(timestamp).toLocaleString()}\n`;
    report += `**Uptime:** ${this.formatUptime(uptime)}\n\n`;
    
    // Check details
    report += `## 🔍 **System Checks**\n\n`;
    
    for (const [checkName, check] of Object.entries(checks)) {
      const healthCheck = check as any;
      const checkEmoji = healthCheck.status === 'pass' ? '✅' : 
                        healthCheck.status === 'warn' ? '⚠️' : '❌';
      
      const displayName = checkName.replace(/_/g, ' ').toUpperCase();
      report += `### ${checkEmoji} ${displayName}\n`;
      report += `**Status:** ${healthCheck.status}\n`;
      report += `**Message:** ${healthCheck.message}\n`;
      
      if (detailed && healthCheck.details) {
        report += `**Details:**\n`;
        if (typeof healthCheck.details === 'object') {
          for (const [key, value] of Object.entries(healthCheck.details)) {
            report += `  - ${key}: ${JSON.stringify(value)}\n`;
          }
        } else {
          report += `  ${healthCheck.details}\n`;
        }
      }
      report += '\n';
    }
    
    // Connection troubleshooting tips
    if (status !== 'healthy') {
      report += this.getTroubleshootingTips(checks);
    }
    
    return report;
  }

  private getTroubleshootingTips(checks: any): string {
    let tips = `## 🔧 **Troubleshooting Tips**\n\n`;
    
    if (checks.mcp_connection?.status === 'fail') {
      tips += `**MCP Connection Issues:**\n`;
      tips += `- Check Docker containers: \`docker-compose ps\`\n`;
      tips += `- Restart containers: \`docker-compose restart zenode-server\`\n`;
      tips += `- Check logs: \`docker-compose logs zenode-server --tail=50\`\n\n`;
    }
    
    if (checks.providers?.status === 'fail') {
      tips += `**Provider Issues:**\n`;
      tips += `- Verify API keys in .env file\n`;
      tips += `- Check network connectivity\n`;
      tips += `- Run: \`zenode:config validate\`\n\n`;
    }
    
    if (checks.memory?.status === 'fail') {
      tips += `**Memory Issues:**\n`;
      tips += `- Restart containers to free memory\n`;
      tips += `- Check for memory leaks in logs\n`;
      tips += `- Consider increasing Docker memory limits\n\n`;
    }
    
    if (checks.redis?.status === 'fail') {
      tips += `**Redis Issues:**\n`;
      tips += `- Check Redis container: \`docker-compose logs redis\`\n`;
      tips += `- Restart Redis: \`docker-compose restart redis\`\n\n`;
    }
    
    return tips;
  }

  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private async getRecentLogs(): Promise<string> {
    try {
      // This is a simplified version - in production you'd read from log files
      // For now, return a placeholder that explains where logs are
      return `## 📋 **Recent Logs**\n\n` +
             `**Log Locations:**\n` +
             `- Main logs: \`docker-compose logs zenode-server --tail=50\`\n` +
             `- Activity logs: \`docker-compose logs zenode-server | grep "TOOL_CALL\\|MCP_CONNECTION"\`\n` +
             `- Error logs: \`docker-compose logs zenode-server | grep "ERROR\\|FAILED"\`\n\n` +
             `**Live monitoring:**\n` +
             `\`docker-compose logs -f zenode-server\``;
    } catch (error) {
      return `## 📋 **Recent Logs**\n\n❌ Could not retrieve logs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}