import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../database/connection';
import { User, CreateUserRequest, UpdateUserRequest, UserResponse } from '../models/User';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { BaseRepository } from './BaseRepository';

export class UserRepository extends BaseRepository<User, CreateUserRequest, UpdateUserRequest> {
  protected readonly tableName = 'users';

  /**
   * Map database row to User object
   */
  protected mapRowToEntity(row: RowDataPacket): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      lastLogin: row.last_login,
    };
  }

  /**
   * Create a new user
   */
  async create(userData: CreateUserRequest & { passwordHash: string }): Promise<User> {
    try {
      const id = this.generateId();
      const query = `
        INSERT INTO ${this.tableName} 
        (id, username, email, password_hash) 
        VALUES (?, ?, ?, ?)
      `;

      const params = [id, userData.username, userData.email || null, userData.passwordHash];

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new DatabaseError('Failed to create user');
      }

      // Fetch and return the created user
      const createdUser = await this.findById(id);
      if (!createdUser) {
        throw new DatabaseError('User created but could not be retrieved');
      }

      logger.info(`User created successfully: ${userData.username}`);
      return createdUser;
    } catch (error) {
      logger.error('Error creating user:', error);

      // Handle duplicate key errors
      if (error instanceof Error && error.message.includes('Duplicate entry')) {
        if (error.message.includes('username')) {
          throw new DatabaseError('Username already exists');
        }
        if (error.message.includes('email')) {
          throw new DatabaseError('Email already exists');
        }
      }

      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to create user');
    }
  }

  /**
   * Update user
   */
  async update(id: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];

      if (userData.email !== undefined) {
        updateFields.push('email = ?');
        params.push(userData.email);
      }

      if (userData.password) {
        updateFields.push('password_hash = ?');
        params.push(userData.password);
      }

      if (updateFields.length === 0) {
        throw new DatabaseError('No fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `
        UPDATE ${this.tableName} 
        SET ${updateFields.join(', ')}
        WHERE id = ? AND is_active = TRUE
      `;

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new NotFoundError('User not found');
      }

      const updatedUser = await this.findById(id);
      if (!updatedUser) {
        throw new DatabaseError('User updated but could not be retrieved');
      }

      logger.info(`User updated successfully: ${id}`);
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to update user');
    }
  }

  /**
   * Find active user by ID
   */
  async findActiveById(id: string): Promise<User | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = ? AND is_active = TRUE`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [id]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(rows[0]);
    } catch (error) {
      logger.error('Error finding active user by ID:', error);
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE username = ? AND is_active = TRUE`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [username]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(rows[0]);
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE email = ? AND is_active = TRUE`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [email]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(rows[0]);
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      const query = `UPDATE ${this.tableName} SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      await db.execute(query, [id]);
    } catch (error) {
      logger.error('Error updating last login:', error);
      // Don't throw error for this non-critical operation
    }
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    try {
      const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE username = ?`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [username]);

      return (rows[0] as any).count > 0;
    } catch (error) {
      logger.error('Error checking username existence:', error);
      throw new DatabaseError('Failed to check username availability');
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE email = ?`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [email]);

      return (rows[0] as any).count > 0;
    } catch (error) {
      logger.error('Error checking email existence:', error);
      throw new DatabaseError('Failed to check email availability');
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivate(id: string): Promise<void> {
    try {
      const query = `UPDATE ${this.tableName} SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      const [result] = await db.execute<ResultSetHeader>(query, [id]);

      if (result.affectedRows === 0) {
        throw new NotFoundError('User not found');
      }

      logger.info(`User deactivated: ${id}`);
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error instanceof NotFoundError ? error : new DatabaseError('Failed to deactivate user');
    }
  }

  /**
   * Convert user data to response format (excluding sensitive fields)
   */
  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
    };
  }
}
