import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { BaseRepository } from './BaseRepository';
import { db } from '../database/connection';
import { logger } from '../config/logger';
import {
  UsageLog,
  CreateUsageLogRequest,
  UsageLogRow,
  UsageStats,
  ModelUsageBreakdown,
  DailyCostBreakdown,
  ConversationCostBreakdown,
  CostReport,
} from '../models/UsageLog';
import { DatabaseError, NotFoundError } from '../utils/errors';

export class UsageLogRepository extends BaseRepository<UsageLog, CreateUsageLogRequest, never> {
  protected tableName = 'usage_logs';

  /**
   * Convert database row to UsageLog model
   */
  protected mapRowToEntity(row: RowDataPacket): UsageLog {
    return this.mapRowToModel(row as UsageLogRow);
  }

  /**
   * Convert database row to UsageLog model
   */
  protected mapRowToModel(row: UsageLogRow): UsageLog {
    return {
      id: row.id,
      userId: row.user_id,
      conversationId: row.conversation_id || undefined,
      actionType: row.action_type as any,
      model: row.model || undefined,
      tokensUsed: row.tokens_used,
      costUsd: parseFloat(row.cost_usd),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * Create a new usage log entry
   */
  async create(data: CreateUsageLogRequest): Promise<UsageLog> {
    try {
      const query = `
        INSERT INTO ${this.tableName} 
        (user_id, conversation_id, action_type, model, tokens_used, cost_usd, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        data.userId,
        data.conversationId || null,
        data.actionType,
        data.model || null,
        data.tokensUsed,
        data.costUsd,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ];

      const [result] = await db.execute<ResultSetHeader>(query, values);

      if (!result.insertId) {
        throw new DatabaseError('Failed to create usage log entry');
      }

      logger.debug(`Usage log created: ${result.insertId}`, {
        userId: data.userId,
        actionType: data.actionType,
        cost: data.costUsd,
        tokens: data.tokensUsed,
      });

      const created = await this.findById(result.insertId.toString());
      if (!created) {
        throw new DatabaseError('Failed to retrieve created usage log entry');
      }
      return created;
    } catch (error) {
      logger.error('Error creating usage log:', error);
      throw new DatabaseError('Failed to create usage log entry');
    }
  }

  /**
   * Get usage logs for a specific user with pagination
   */
  async findByUserId(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      actionType?: string;
      conversationId?: number;
    } = {}
  ): Promise<UsageLog[]> {
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE user_id = ?`;
      const values: any[] = [userId];

      // Add date filters
      if (options.startDate) {
        query += ' AND created_at >= ?';
        values.push(options.startDate);
      }

      if (options.endDate) {
        query += ' AND created_at <= ?';
        values.push(options.endDate);
      }

      // Add action type filter
      if (options.actionType) {
        query += ' AND action_type = ?';
        values.push(options.actionType);
      }

      // Add conversation filter
      if (options.conversationId) {
        query += ' AND conversation_id = ?';
        values.push(options.conversationId);
      }

      query += ' ORDER BY created_at DESC';

      // Add pagination
      if (options.limit) {
        query += ' LIMIT ?';
        values.push(options.limit);

        if (options.offset) {
          query += ' OFFSET ?';
          values.push(options.offset);
        }
      }

      const [rows] = await db.execute<UsageLogRow[]>(query, values);
      return rows.map(row => this.mapRowToModel(row));
    } catch (error) {
      logger.error('Error finding usage logs by user ID:', error);
      throw new DatabaseError('Failed to retrieve usage logs');
    }
  }

  /**
   * Get usage statistics for a user within a date range
   */
  async getUserUsageStats(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<UsageStats> {
    try {
      // Get overall stats
      const statsQuery = `
        SELECT 
          COUNT(*) as total_requests,
          SUM(tokens_used) as total_tokens,
          SUM(cost_usd) as total_cost,
          AVG(tokens_used) as avg_tokens,
          AVG(cost_usd) as avg_cost
        FROM ${this.tableName}
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
      `;

      const [statsRows] = await db.execute<RowDataPacket[]>(statsQuery, [
        userId,
        startDate,
        endDate,
      ]);

      const stats = statsRows[0];

      // Get model breakdown
      const modelQuery = `
        SELECT 
          model,
          COUNT(*) as requests,
          SUM(tokens_used) as tokens,
          SUM(cost_usd) as cost
        FROM ${this.tableName}
        WHERE user_id = ? AND created_at BETWEEN ? AND ? AND model IS NOT NULL
        GROUP BY model
        ORDER BY cost DESC
      `;

      const [modelRows] = await db.execute<RowDataPacket[]>(modelQuery, [
        userId,
        startDate,
        endDate,
      ]);

      const totalCost = parseFloat(stats.total_cost) || 0;
      const modelBreakdown: ModelUsageBreakdown[] = modelRows.map(row => ({
        model: row.model,
        requests: row.requests,
        tokens: row.tokens,
        cost: parseFloat(row.cost),
        percentage: totalCost > 0 ? (parseFloat(row.cost) / totalCost) * 100 : 0,
      }));

      return {
        totalCost,
        totalTokens: stats.total_tokens || 0,
        totalRequests: stats.total_requests || 0,
        averageCostPerRequest: parseFloat(stats.avg_cost) || 0,
        averageTokensPerRequest: parseFloat(stats.avg_tokens) || 0,
        modelBreakdown,
      };
    } catch (error) {
      logger.error('Error getting user usage stats:', error);
      throw new DatabaseError('Failed to retrieve usage statistics');
    }
  }

  /**
   * Get daily cost breakdown for a user within a date range
   */
  async getDailyCostBreakdown(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<DailyCostBreakdown[]> {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          SUM(cost_usd) as cost,
          SUM(tokens_used) as tokens,
          COUNT(*) as requests
        FROM ${this.tableName}
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [
        userId,
        startDate,
        endDate,
      ]);

      return rows.map(row => ({
        date: row.date,
        cost: parseFloat(row.cost),
        tokens: row.tokens,
        requests: row.requests,
      }));
    } catch (error) {
      logger.error('Error getting daily cost breakdown:', error);
      throw new DatabaseError('Failed to retrieve daily cost breakdown');
    }
  }

  /**
   * Get conversation cost breakdown for a user
   */
  async getConversationCostBreakdown(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ConversationCostBreakdown[]> {
    try {
      const query = `
        SELECT 
          ul.conversation_id,
          c.title as conversation_title,
          SUM(ul.cost_usd) as cost,
          SUM(ul.tokens_used) as tokens,
          COUNT(*) as requests,
          MAX(ul.created_at) as last_activity
        FROM ${this.tableName} ul
        LEFT JOIN conversations c ON ul.conversation_id = c.id
        WHERE ul.user_id = ? AND ul.created_at BETWEEN ? AND ? AND ul.conversation_id IS NOT NULL
        GROUP BY ul.conversation_id, c.title
        ORDER BY cost DESC
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [
        userId,
        startDate,
        endDate,
      ]);

      return rows.map(row => ({
        conversationId: row.conversation_id,
        conversationTitle: row.conversation_title,
        cost: parseFloat(row.cost),
        tokens: row.tokens,
        requests: row.requests,
        lastActivity: row.last_activity,
      }));
    } catch (error) {
      logger.error('Error getting conversation cost breakdown:', error);
      throw new DatabaseError('Failed to retrieve conversation cost breakdown');
    }
  }

  /**
   * Get total cost for a user within a date range
   */
  async getUserTotalCost(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const query = `
        SELECT SUM(cost_usd) as total_cost
        FROM ${this.tableName}
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [
        userId,
        startDate,
        endDate,
      ]);

      return parseFloat(rows[0].total_cost) || 0;
    } catch (error) {
      logger.error('Error getting user total cost:', error);
      throw new DatabaseError('Failed to retrieve total cost');
    }
  }

  /**
   * Get conversation total cost
   */
  async getConversationTotalCost(conversationId: number): Promise<number> {
    try {
      const query = `
        SELECT SUM(cost_usd) as total_cost
        FROM ${this.tableName}
        WHERE conversation_id = ?
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [conversationId]);
      return parseFloat(rows[0].total_cost) || 0;
    } catch (error) {
      logger.error('Error getting conversation total cost:', error);
      throw new DatabaseError('Failed to retrieve conversation cost');
    }
  }

  /**
   * Delete usage logs for a conversation (used when conversation is deleted)
   */
  async deleteByConversationId(conversationId: number): Promise<void> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE conversation_id = ?`;
      const [result] = await db.execute<ResultSetHeader>(query, [conversationId]);

      logger.debug(`Deleted ${result.affectedRows} usage log entries for conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error deleting usage logs by conversation ID:', error);
      throw new DatabaseError('Failed to delete usage logs');
    }
  }

  /**
   * Delete usage logs for a user (used when user is deleted)
   */
  async deleteByUserId(userId: number): Promise<void> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE user_id = ?`;
      const [result] = await db.execute<ResultSetHeader>(query, [userId]);

      logger.debug(`Deleted ${result.affectedRows} usage log entries for user ${userId}`);
    } catch (error) {
      logger.error('Error deleting usage logs by user ID:', error);
      throw new DatabaseError('Failed to delete usage logs');
    }
  }

  /**
   * Get usage logs count for a user (for pagination)
   */
  async countByUserId(
    userId: number,
    options: {
      startDate?: Date;
      endDate?: Date;
      actionType?: string;
      conversationId?: number;
    } = {}
  ): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE user_id = ?`;
      const values: any[] = [userId];

      if (options.startDate) {
        query += ' AND created_at >= ?';
        values.push(options.startDate);
      }

      if (options.endDate) {
        query += ' AND created_at <= ?';
        values.push(options.endDate);
      }

      if (options.actionType) {
        query += ' AND action_type = ?';
        values.push(options.actionType);
      }

      if (options.conversationId) {
        query += ' AND conversation_id = ?';
        values.push(options.conversationId);
      }

      const [rows] = await db.execute<RowDataPacket[]>(query, values);
      return rows[0].count;
    } catch (error) {
      logger.error('Error counting usage logs:', error);
      throw new DatabaseError('Failed to count usage logs');
    }
  }
}