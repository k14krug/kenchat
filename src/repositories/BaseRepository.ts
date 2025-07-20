import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../database/connection';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { PaginationOptions, PaginatedResponse, FilterOptions } from '../models';

export abstract class BaseRepository<T, CreateRequest, UpdateRequest> {
  protected abstract tableName: string;
  protected abstract mapRowToEntity(row: RowDataPacket): T;

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [id]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(rows[0]);
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by ID:`, error);
      throw new DatabaseError(`Failed to find ${this.tableName}`);
    }
  }

  /**
   * Find all entities with optional pagination and filtering
   */
  async findAll(
    options: PaginationOptions = {},
    filters: FilterOptions = {}
  ): Promise<PaginatedResponse<T>> {
    try {
      const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = options;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];

      if (filters.search) {
        // This will be overridden in specific repositories for appropriate search fields
        whereConditions.push('1=1');
      }

      if (filters.startDate) {
        whereConditions.push('created_at >= ?');
        queryParams.push(filters.startDate);
      }

      if (filters.endDate) {
        whereConditions.push('created_at <= ?');
        queryParams.push(filters.endDate);
      }

      if (filters.isActive !== undefined) {
        whereConditions.push('is_active = ?');
        queryParams.push(filters.isActive);
      }

      if (filters.isArchived !== undefined) {
        whereConditions.push('is_archived = ?');
        queryParams.push(filters.isArchived);
      }

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count total records
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
      const [countRows] = await db.execute<RowDataPacket[]>(countQuery, queryParams);
      const total = (countRows[0] as any).total;

      // Get paginated data
      const dataQuery = `
        SELECT * FROM ${this.tableName} 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      const [dataRows] = await db.execute<RowDataPacket[]>(dataQuery, [
        ...queryParams,
        limit,
        offset,
      ]);

      const data = dataRows.map(row => this.mapRowToEntity(row));
      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error(`Error finding all ${this.tableName}:`, error);
      throw new DatabaseError(`Failed to find ${this.tableName} records`);
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const [result] = await db.execute<ResultSetHeader>(query, [id]);

      if (result.affectedRows === 0) {
        throw new NotFoundError(`${this.tableName} not found`);
      }

      logger.info(`${this.tableName} deleted: ${id}`);
    } catch (error) {
      logger.error(`Error deleting ${this.tableName}:`, error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete ${this.tableName}`);
    }
  }

  /**
   * Check if entity exists by ID
   */
  async exists(id: string): Promise<boolean> {
    try {
      const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE id = ?`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [id]);

      return (rows[0] as any).count > 0;
    } catch (error) {
      logger.error(`Error checking ${this.tableName} existence:`, error);
      throw new DatabaseError(`Failed to check ${this.tableName} existence`);
    }
  }

  /**
   * Execute a transaction
   */
  protected async executeTransaction<R>(callback: (connection: any) => Promise<R>): Promise<R> {
    return await db.transaction(callback);
  }

  /**
   * Generate UUID for new entities
   */
  protected generateId(): string {
    return require('crypto').randomUUID();
  }
}
