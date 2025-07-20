import { testConnection } from '../config/database';
import { runMigrations } from './migrations';
import { logger } from '../config/logger';
import { db } from './connection';

export const initializeDatabase = async (): Promise<void> => {
  try {
    logger.info('Initializing database...');

    // Test database connection
    logger.info('Testing database connection...');
    const isConnected = await testConnection();

    if (!isConnected) {
      throw new Error('Unable to connect to database. Please check your database configuration.');
    }

    logger.info('Database connection successful');

    // Run migrations
    logger.info('Running database migrations...');
    await runMigrations();

    // Verify database health
    const health = await db.healthCheck();
    if (!health.isConnected) {
      throw new Error('Database health check failed after initialization');
    }

    logger.info('Database initialization completed successfully');
    logger.info(`Active database connections: ${health.connectionCount}`);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// CLI script to initialize database
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      logger.info('Database initialization script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Database initialization script failed:', error);
      process.exit(1);
    });
}
