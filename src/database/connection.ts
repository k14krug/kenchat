import mysql from 'mysql2/promise';
import { createPool, testConnection } from '../config/database';
import { logger } from '../config/logger';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: mysql.Pool;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds

  private constructor() {
    this.pool = createPool();
    this.setupEventHandlers();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private setupEventHandlers(): void {
    // Note: mysql2 pool doesn't have the same event handlers as mysql
    // We'll handle connection management through the connection methods
    this.isConnected = true; // Assume connected initially, will be verified in health checks
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    logger.info(
      `Attempting to reconnect to database (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(async () => {
      try {
        const connected = await testConnection();
        if (connected) {
          logger.info('Database reconnection successful');
          this.isConnected = true;
          this.reconnectAttempts = 0;
        } else {
          this.handleReconnect();
        }
      } catch (error) {
        logger.error('Reconnection attempt failed:', error);
        this.handleReconnect();
      }
    }, this.reconnectDelay * this.reconnectAttempts); // Exponential backoff
  }

  public async getConnection(): Promise<mysql.PoolConnection> {
    try {
      return await this.pool.getConnection();
    } catch (error) {
      logger.error('Failed to get database connection:', error);
      throw new Error('Database connection unavailable');
    }
  }

  public async execute<T = any>(query: string, params?: any[]): Promise<[T, mysql.FieldPacket[]]> {
    const connection = await this.getConnection();

    try {
      logger.debug('Executing query:', { query, params });
      const result = await connection.execute(query, params);
      return result as [T, mysql.FieldPacket[]];
    } catch (error) {
      logger.error('Query execution failed:', { query, params, error });
      throw error;
    } finally {
      connection.release();
    }
  }

  public async query<T = any>(query: string, params?: any[]): Promise<[T, mysql.FieldPacket[]]> {
    const connection = await this.getConnection();

    try {
      logger.debug('Executing query:', { query, params });
      const result = await connection.query(query, params);
      return result as [T, mysql.FieldPacket[]];
    } catch (error) {
      logger.error('Query execution failed:', { query, params, error });
      throw error;
    } finally {
      connection.release();
    }
  }

  public async transaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();
      logger.debug('Transaction started');

      const result = await callback(connection);

      await connection.commit();
      logger.debug('Transaction committed');

      return result;
    } catch (error) {
      await connection.rollback();
      logger.error('Transaction rolled back due to error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  public async healthCheck(): Promise<{
    isConnected: boolean;
    connectionCount: number;
    error?: string;
  }> {
    try {
      const connection = await this.getConnection();

      // Test basic connectivity
      await connection.ping();

      // Get connection pool status
      const [rows] = await connection.execute(
        'SHOW STATUS WHERE Variable_name = "Threads_connected"'
      );

      connection.release();

      const connectionCount = (rows as any[])[0]?.Value || 0;

      return {
        isConnected: true,
        connectionCount: parseInt(connectionCount),
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        isConnected: false,
        connectionCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database connection pool:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance();
