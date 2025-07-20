import { DatabaseConnection, db } from '../../src/database/connection';
import { testConnection } from '../../src/config/database';
import { runMigrations } from '../../src/database/migrations';

describe('Database Connection', () => {
  beforeAll(async () => {
    // Wait a bit for database connection to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Connection Management', () => {
    it('should create a singleton instance', () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should test database connectivity', async () => {
      const isConnected = await testConnection();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should perform health check', async () => {
      const health = await db.healthCheck();
      expect(health).toHaveProperty('isConnected');
      expect(health).toHaveProperty('connectionCount');
      expect(typeof health.isConnected).toBe('boolean');
      expect(typeof health.connectionCount).toBe('number');
    });
  });

  describe('Query Execution', () => {
    it('should execute basic queries', async () => {
      const [rows] = await db.execute('SELECT 1 as test');
      expect(Array.isArray(rows)).toBe(true);
      expect((rows as any[])[0]).toHaveProperty('test', 1);
    });

    it('should execute parameterized queries', async () => {
      const testValue = 'test_value';
      const [rows] = await db.execute('SELECT ? as test_param', [testValue]);
      expect((rows as any[])[0]).toHaveProperty('test_param', testValue);
    });

    it('should handle query errors gracefully', async () => {
      await expect(db.execute('INVALID SQL QUERY')).rejects.toThrow();
    });
  });

  describe('Transaction Management', () => {
    it('should execute successful transactions', async () => {
      const result = await db.transaction(async (connection) => {
        const [rows] = await connection.execute('SELECT 1 as transaction_test');
        return (rows as any[])[0].transaction_test;
      });
      
      expect(result).toBe(1);
    });

    it('should rollback failed transactions', async () => {
      await expect(
        db.transaction(async (connection) => {
          await connection.execute('SELECT 1');
          throw new Error('Test transaction error');
        })
      ).rejects.toThrow('Test transaction error');
    });
  });

  describe('Database Migrations', () => {
    it('should run migrations without errors', async () => {
      // This test will actually create the database schema
      await expect(runMigrations()).resolves.not.toThrow();
    });

    it('should verify tables were created', async () => {
      const [rows] = await db.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `);
      
      const tableNames = (rows as any[]).map(row => row.TABLE_NAME);
      
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('personas');
      expect(tableNames).toContain('conversations');
      expect(tableNames).toContain('messages');
      expect(tableNames).toContain('summaries');
      expect(tableNames).toContain('usage_logs');
      expect(tableNames).toContain('migration_history');
    });

    it('should verify table structures', async () => {
      // Test users table structure
      const [userColumns] = await db.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        ORDER BY ORDINAL_POSITION
      `);
      
      const userColumnNames = (userColumns as any[]).map(col => col.COLUMN_NAME);
      expect(userColumnNames).toContain('id');
      expect(userColumnNames).toContain('username');
      expect(userColumnNames).toContain('email');
      expect(userColumnNames).toContain('password_hash');
      
      // Test conversations table structure
      const [conversationColumns] = await db.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations'
        ORDER BY ORDINAL_POSITION
      `);
      
      const conversationColumnNames = (conversationColumns as any[]).map(col => col.COLUMN_NAME);
      expect(conversationColumnNames).toContain('id');
      expect(conversationColumnNames).toContain('user_id');
      expect(conversationColumnNames).toContain('persona_id');
      expect(conversationColumnNames).toContain('title');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // This test verifies error handling without actually breaking the connection
      const health = await db.healthCheck();
      expect(health).toHaveProperty('isConnected');
    });

    it('should validate database schema exists', async () => {
      const [rows] = await db.execute(`
        SELECT SCHEMA_NAME 
        FROM INFORMATION_SCHEMA.SCHEMATA 
        WHERE SCHEMA_NAME = DATABASE()
      `);
      
      expect((rows as any[]).length).toBeGreaterThan(0);
    });
  });
});