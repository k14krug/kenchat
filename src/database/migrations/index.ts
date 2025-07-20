import { getConnection } from '../../config/database';
import { logger } from '../../config/logger';

export interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
}

export const migrations: Migration[] = [
  {
    id: '001',
    name: 'create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    down: 'DROP TABLE IF EXISTS users;'
  },
  {
    id: '002',
    name: 'create_personas_table',
    up: `
      CREATE TABLE IF NOT EXISTS personas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_default (is_default)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    down: 'DROP TABLE IF EXISTS personas;'
  },
  {
    id: '003',
    name: 'create_conversations_table',
    up: `
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        persona_id INT,
        title VARCHAR(255) NOT NULL,
        intent VARCHAR(255),
        custom_instructions TEXT,
        is_archived BOOLEAN DEFAULT FALSE,
        message_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_persona_id (persona_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    down: 'DROP TABLE IF EXISTS conversations;'
  },
  {
    id: '004',
    name: 'create_messages_table',
    up: `
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        role ENUM('user', 'assistant', 'system') NOT NULL,
        content TEXT NOT NULL,
        token_count INT DEFAULT 0,
        model VARCHAR(100),
        cost_usd DECIMAL(10, 6) DEFAULT 0.000000,
        is_summarized BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_role (role),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    down: 'DROP TABLE IF EXISTS messages;'
  },
  {
    id: '005',
    name: 'create_summaries_table',
    up: `
      CREATE TABLE IF NOT EXISTS summaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        summary_text TEXT NOT NULL,
        message_range_start INT NOT NULL,
        message_range_end INT NOT NULL,
        token_count INT DEFAULT 0,
        cost_usd DECIMAL(10, 6) DEFAULT 0.000000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_message_range (message_range_start, message_range_end)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    down: 'DROP TABLE IF EXISTS summaries;'
  },
  {
    id: '006',
    name: 'create_usage_logs_table',
    up: `
      CREATE TABLE IF NOT EXISTS usage_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        conversation_id INT,
        action_type ENUM('message_sent', 'message_received', 'summary_created', 'persona_used') NOT NULL,
        model VARCHAR(100),
        tokens_used INT DEFAULT 0,
        cost_usd DECIMAL(10, 6) DEFAULT 0.000000,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_action_type (action_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    down: 'DROP TABLE IF EXISTS usage_logs;'
  },
  {
    id: '007',
    name: 'create_migration_history_table',
    up: `
      CREATE TABLE IF NOT EXISTS migration_history (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    down: 'DROP TABLE IF EXISTS migration_history;'
  }
];

export const runMigrations = async (): Promise<void> => {
  const connection = await getConnection();
  
  try {
    logger.info('Starting database migrations...');
    
    // Create migration history table first if it doesn't exist
    await connection.execute(migrations[6].up);
    
    // Get executed migrations
    const [rows] = await connection.execute(
      'SELECT id FROM migration_history ORDER BY id'
    );
    const executedMigrations = (rows as any[]).map(row => row.id);
    
    // Run pending migrations
    for (const migration of migrations.slice(0, -1)) { // Exclude migration_history creation
      if (!executedMigrations.includes(migration.id)) {
        logger.info(`Running migration: ${migration.name}`);
        
        await connection.execute(migration.up);
        await connection.execute(
          'INSERT INTO migration_history (id, name) VALUES (?, ?)',
          [migration.id, migration.name]
        );
        
        logger.info(`Migration completed: ${migration.name}`);
      }
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};

export const rollbackMigration = async (migrationId: string): Promise<void> => {
  const connection = await getConnection();
  
  try {
    const migration = migrations.find(m => m.id === migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }
    
    logger.info(`Rolling back migration: ${migration.name}`);
    
    await connection.execute(migration.down);
    await connection.execute(
      'DELETE FROM migration_history WHERE id = ?',
      [migrationId]
    );
    
    logger.info(`Migration rolled back: ${migration.name}`);
  } catch (error) {
    logger.error('Migration rollback failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};