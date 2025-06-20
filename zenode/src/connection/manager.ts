/**
 * MCP Connection Manager - Handles connection lifecycle and recovery
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger, logError } from '../utils/logger.js';

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting', 
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

interface ConnectionStats {
  connectionAttempts: number;
  successfulConnections: number;
  lastConnectionTime?: Date;
  lastDisconnectionTime?: Date;
  totalUptime: number;
}

export class MCPConnectionManager {
  private server: Server;
  private transport?: StdioServerTransport;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private retryCount = 0;
  private maxRetries = 5;
  private baseRetryDelay = 1000; // 1 second
  private maxRetryDelay = 30000; // 30 seconds
  private stats: ConnectionStats = {
    connectionAttempts: 0,
    successfulConnections: 0,
    totalUptime: 0
  };
  private connectionStartTime?: Date;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(server: Server) {
    this.server = server;
    this.setupProcessHandlers();
  }

  async connect(): Promise<void> {
    this.setState(ConnectionState.CONNECTING);
    this.stats.connectionAttempts++;
    
    try {
      this.transport = new StdioServerTransport();
      
      // Setup transport error handlers
      this.transport.onclose = () => {
        logger.warn('MCP transport closed unexpectedly');
        this.handleDisconnection();
      };

      this.transport.onerror = (error: any) => {
        logError('MCP transport error', error);
        this.handleDisconnection();
      };

      await this.server.connect(this.transport);
      
      this.setState(ConnectionState.CONNECTED);
      this.stats.successfulConnections++;
      this.stats.lastConnectionTime = new Date();
      this.connectionStartTime = new Date();
      this.retryCount = 0; // Reset on successful connection
      
      logger.info('MCP connection established successfully', {
        attempt: this.stats.connectionAttempts,
        successCount: this.stats.successfulConnections
      });
      
    } catch (error) {
      logError('Failed to establish MCP connection', error, {
        attempt: this.stats.connectionAttempts,
        retryCount: this.retryCount
      });
      
      this.setState(ConnectionState.FAILED);
      throw error;
    }
  }

  private handleDisconnection(): void {
    if (this.state === ConnectionState.CONNECTED && this.connectionStartTime) {
      const uptime = Date.now() - this.connectionStartTime.getTime();
      this.stats.totalUptime += uptime;
    }
    
    this.stats.lastDisconnectionTime = new Date();
    this.setState(ConnectionState.DISCONNECTED);
    
    if (this.retryCount < this.maxRetries) {
      this.scheduleReconnect();
    } else {
      logger.error('Max reconnection attempts reached, giving up', {
        maxRetries: this.maxRetries,
        totalAttempts: this.stats.connectionAttempts
      });
      this.setState(ConnectionState.FAILED);
      // Don't exit - let external monitoring handle restart
    }
  }

  private scheduleReconnect(): void {
    this.setState(ConnectionState.RECONNECTING);
    
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, this.retryCount),
      this.maxRetryDelay
    );
    
    logger.info(`Scheduling reconnection attempt ${this.retryCount + 1}/${this.maxRetries} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.retryCount++;
      try {
        await this.connect();
      } catch (error) {
        // Error already logged in connect(), will trigger another retry if under limit
      }
    }, delay);
  }

  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    this.state = newState;
    
    logger.info(`MCP connection state: ${oldState} → ${newState}`);
    
    // Log state changes to activity logger for monitoring
    if (newState === ConnectionState.CONNECTED) {
      logger.info('MCP_CONNECTION_ESTABLISHED');
    } else if (newState === ConnectionState.FAILED) {
      logger.error('MCP_CONNECTION_FAILED');
    }
  }

  private setupProcessHandlers(): void {
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, closing MCP connection gracefully...');
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, closing MCP connection gracefully...');
      this.cleanup();
      process.exit(0);
    });
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.transport) {
      try {
        this.transport.close?.();
      } catch (error) {
        logger.warn('Error closing transport during cleanup:', error);
      }
    }
  }

  // Health check for Docker/monitoring
  getHealthStatus(): { healthy: boolean; state: ConnectionState; stats: ConnectionStats } {
    const healthy = this.state === ConnectionState.CONNECTED || 
                   this.state === ConnectionState.CONNECTING ||
                   (this.state === ConnectionState.RECONNECTING && this.retryCount < this.maxRetries);
    
    return {
      healthy,
      state: this.state,
      stats: { ...this.stats }
    };
  }

  getState(): ConnectionState {
    return this.state;
  }
}