/**
 * Health Checker - Provides detailed health status for monitoring
 */

import { MCPConnectionManager, ConnectionState } from '../connection/manager.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { logger } from '../utils/logger.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    mcp_connection: HealthCheck;
    providers: HealthCheck;
    memory: HealthCheck;
    redis?: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

export class HealthChecker {
  private connectionManager?: MCPConnectionManager;
  private startTime = Date.now();

  setConnectionManager(manager: MCPConnectionManager): void {
    this.connectionManager = manager;
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {
      mcp_connection: await this.checkMCPConnection(),
      providers: await this.checkProviders(),
      memory: this.checkMemory(),
    };

    // Add Redis check if available - commented out for now
    // try {
    //   checks.redis = await this.checkRedis();
    // } catch (error) {
    //   logger.debug('Redis health check failed (optional):', error);
    // }

    // Determine overall status
    const hasFailures = Object.values(checks).some(check => check.status === 'fail');
    const hasWarnings = Object.values(checks).some(check => check.status === 'warn');
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) {
      status = 'unhealthy';
    } else if (hasWarnings) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks
    };
  }

  private async checkMCPConnection(): Promise<HealthCheck> {
    if (!this.connectionManager) {
      return {
        status: 'warn',
        message: 'Connection manager not initialized'
      };
    }

    const health = this.connectionManager.getHealthStatus();
    const state = health.state;

    switch (state) {
      case ConnectionState.CONNECTED:
        return {
          status: 'pass',
          message: 'MCP connection active',
          details: {
            state,
            stats: health.stats
          }
        };
      
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return {
          status: 'warn',
          message: `MCP connection ${state}`,
          details: {
            state,
            stats: health.stats
          }
        };
      
      case ConnectionState.FAILED:
      case ConnectionState.DISCONNECTED:
        return {
          status: 'fail',
          message: `MCP connection ${state}`,
          details: {
            state,
            stats: health.stats
          }
        };
      
      default:
        return {
          status: 'fail',
          message: `Unknown MCP connection state: ${state}`
        };
    }
  }

  private async checkProviders(): Promise<HealthCheck> {
    try {
      const availableModels = await modelProviderRegistry.getAvailableModels(true);
      
      if (availableModels.length === 0) {
        return {
          status: 'fail',
          message: 'No AI models available',
          details: { availableModels: 0 }
        };
      }

      return {
        status: 'pass',
        message: `${availableModels.length} AI models available`,
        details: { 
          availableModels: availableModels.length,
          models: availableModels.slice(0, 5) // Limit details
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Provider registry error',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private checkMemory(): HealthCheck {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    // Warn if using over 1.5GB (Docker limit is 2GB)
    const warningThreshold = 1536; // MB
    const criticalThreshold = 1792; // MB
    
    if (heapUsedMB > criticalThreshold) {
      return {
        status: 'fail',
        message: `Critical memory usage: ${heapUsedMB}MB`,
        details: { heapUsedMB, heapTotalMB, threshold: criticalThreshold }
      };
    } else if (heapUsedMB > warningThreshold) {
      return {
        status: 'warn',
        message: `High memory usage: ${heapUsedMB}MB`,
        details: { heapUsedMB, heapTotalMB, threshold: warningThreshold }
      };
    } else {
      return {
        status: 'pass',
        message: `Memory usage normal: ${heapUsedMB}MB`,
        details: { heapUsedMB, heapTotalMB }
      };
    }
  }

  // private async checkRedis(): Promise<HealthCheck> {
  //   // Import Redis client dynamically to avoid issues if not configured
  //   try {
  //     const { redisClient } = await import('../utils/redis.js');
  //     await redisClient.ping();
  //     
  //     return {
  //       status: 'pass',
  //       message: 'Redis connection active'
  //     };
  //   } catch (error) {
  //     return {
  //       status: 'warn',
  //       message: 'Redis check failed',
  //       details: { error: error instanceof Error ? error.message : String(error) }
  //     };
  //   }
  // }

  // CLI health check for Docker healthcheck command
  async checkHealthCLI(): Promise<{ healthy: boolean; message: string }> {
    const health = await this.getHealthStatus();
    
    const healthy = health.status !== 'unhealthy';
    const message = healthy 
      ? `Status: ${health.status} (${Math.round(health.uptime/1000)}s uptime)`
      : `Unhealthy: ${Object.entries(health.checks)
          .filter(([, check]) => check.status === 'fail')
          .map(([name, check]) => `${name}: ${check.message}`)
          .join(', ')}`;

    return { healthy, message };
  }
}

export const healthChecker = new HealthChecker();