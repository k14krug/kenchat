import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../database/connection';
import {
  Summary,
  CreateSummaryRequest,
  UpdateSummaryRequest,
  SummaryResponse,
  SummaryWithMessages,
  PaginationOptions,
} from '../models';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { BaseRepository } from './BaseRepository';

export class SummaryRepository extends BaseRepository<
  Summary,
  CreateSummaryRequest,
  UpdateSummaryRequest
> {
  protected readonly tableName = 'summaries';

  /**
   * Map database row to Summary object
   */
  protected mapRowToEntity(row: RowDataPacket): Summary {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      content: row.content,
      messageRangeStart: row.message_range_start,
      messageRangeEnd: row.message_range_end,
      createdAt: row.created_at,
      isActive: row.is_active,
      tokenCount: row.token_count,
    };
  }

  /**
   * Create a new summary
   */
  async create(summaryData: CreateSummaryRequest): Promise<Summary> {
    try {
      const id = this.generateId();
      const query = `
        INSERT INTO ${this.tableName} 
        (id, conversation_id, content, message_range_start, message_range_end, token_count) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const params = [
        id,
        summaryData.conversationId,
        summaryData.content,
        summaryData.messageRangeStart || null,
        summaryData.messageRangeEnd || null,
        summaryData.tokenCount || null,
      ];

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new DatabaseError('Failed to create summary');
      }

      // Fetch and return the created summary
      const createdSummary = await this.findById(id);
      if (!createdSummary) {
        throw new DatabaseError('Summary created but could not be retrieved');
      }

      logger.info(`Summary created successfully: ${id}`);
      return createdSummary;
    } catch (error) {
      logger.error('Error creating summary:', error);
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to create summary');
    }
  }

  /**
   * Update summary
   */
  async update(id: string, summaryData: UpdateSummaryRequest): Promise<Summary> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];

      if (summaryData.content !== undefined) {
        updateFields.push('content = ?');
        params.push(summaryData.content);
      }

      if (summaryData.isActive !== undefined) {
        updateFields.push('is_active = ?');
        params.push(summaryData.isActive);
      }

      if (summaryData.tokenCount !== undefined) {
        updateFields.push('token_count = ?');
        params.push(summaryData.tokenCount);
      }

      if (updateFields.length === 0) {
        throw new DatabaseError('No fields to update');
      }

      params.push(id);

      const query = `
        UPDATE ${this.tableName} 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new NotFoundError('Summary not found');
      }

      const updatedSummary = await this.findById(id);
      if (!updatedSummary) {
        throw new DatabaseError('Summary updated but could not be retrieved');
      }

      logger.info(`Summary updated successfully: ${id}`);
      return updatedSummary;
    } catch (error) {
      logger.error('Error updating summary:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to update summary');
    }
  }

  /**
   * Find summaries by conversation ID with pagination
   */
  async findByConversationId(
    conversationId: string,
    options: PaginationOptions = {},
    activeOnly: boolean = true
  ) {
    try {
      const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'ASC' } = options;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = ['conversation_id = ?'];
      const queryParams: any[] = [conversationId];

      if (activeOnly) {
        whereConditions.push('is_active = TRUE');
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

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
      logger.error('Error finding summaries by conversation ID:', error);
      throw new DatabaseError('Failed to find summaries');
    }
  }

  /**
   * Find active summaries for conversation
   */
  async findActiveByConversationId(conversationId: string): Promise<Summary[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE conversation_id = ? AND is_active = TRUE
        ORDER BY created_at ASC
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [conversationId]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Error finding active summaries:', error);
      throw new DatabaseError('Failed to find active summaries');
    }
  }

  /**
   * Find summary with message range details
   */
  async findWithMessages(id: string): Promise<SummaryWithMessages | null> {
    try {
      const summary = await this.findById(id);
      if (!summary) {
        return null;
      }

      let startMessage = undefined;
      let endMessage = undefined;

      // Get start message if specified
      if (summary.messageRangeStart) {
        const startQuery = `
          SELECT id, content, created_at 
          FROM messages 
          WHERE id = ?
        `;
        const [startRows] = await db.execute<RowDataPacket[]>(startQuery, [
          summary.messageRangeStart,
        ]);
        if (startRows.length > 0) {
          const row = startRows[0];
          startMessage = {
            id: row.id,
            content: row.content,
            createdAt: row.created_at,
          };
        }
      }

      // Get end message if specified
      if (summary.messageRangeEnd) {
        const endQuery = `
          SELECT id, content, created_at 
          FROM messages 
          WHERE id = ?
        `;
        const [endRows] = await db.execute<RowDataPacket[]>(endQuery, [summary.messageRangeEnd]);
        if (endRows.length > 0) {
          const row = endRows[0];
          endMessage = {
            id: row.id,
            content: row.content,
            createdAt: row.created_at,
          };
        }
      }

      return {
        ...summary,
        startMessage,
        endMessage,
      };
    } catch (error) {
      logger.error('Error finding summary with messages:', error);
      throw new DatabaseError('Failed to find summary with messages');
    }
  }

  /**
   * Get latest active summary for conversation
   */
  async getLatestForConversation(conversationId: string): Promise<Summary | null> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE conversation_id = ? AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [conversationId]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(rows[0]);
    } catch (error) {
      logger.error('Error getting latest summary:', error);
      throw new DatabaseError('Failed to get latest summary');
    }
  }

  /**
   * Deactivate old summaries when creating a new one
   */
  async deactivateOldSummaries(conversationId: string, excludeId?: string): Promise<void> {
    try {
      let query = `
        UPDATE ${this.tableName} 
        SET is_active = FALSE
        WHERE conversation_id = ?
      `;
      const params: any[] = [conversationId];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows > 0) {
        logger.debug(
          `Deactivated ${result.affectedRows} old summaries for conversation: ${conversationId}`
        );
      }
    } catch (error) {
      logger.error('Error deactivating old summaries:', error);
      throw new DatabaseError('Failed to deactivate old summaries');
    }
  }

  /**
   * Delete summaries by conversation ID
   */
  async deleteByConversationId(conversationId: string): Promise<number> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE conversation_id = ?`;
      const [result] = await db.execute<ResultSetHeader>(query, [conversationId]);

      logger.info(`Deleted ${result.affectedRows} summaries for conversation: ${conversationId}`);
      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting summaries by conversation ID:', error);
      throw new DatabaseError('Failed to delete summaries');
    }
  }

  /**
   * Get summary statistics for conversation
   */
  async getConversationSummaryStats(conversationId: string): Promise<{
    totalSummaries: number;
    activeSummaries: number;
    totalTokens: number;
    latestSummaryDate?: Date;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_summaries,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_summaries,
          SUM(COALESCE(token_count, 0)) as total_tokens,
          MAX(created_at) as latest_summary_date
        FROM ${this.tableName}
        WHERE conversation_id = ?
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [conversationId]);
      const row = rows[0] as any;

      return {
        totalSummaries: row.total_summaries || 0,
        activeSummaries: row.active_summaries || 0,
        totalTokens: row.total_tokens || 0,
        latestSummaryDate: row.latest_summary_date,
      };
    } catch (error) {
      logger.error('Error getting summary statistics:', error);
      throw new DatabaseError('Failed to get summary statistics');
    }
  }

  /**
   * Create rolling summary (replace old active summary)
   */
  async createRollingSummary(summaryData: CreateSummaryRequest): Promise<Summary> {
    try {
      return await this.executeTransaction(async connection => {
        // Deactivate existing active summaries
        await connection.execute(
          'UPDATE summaries SET is_active = FALSE WHERE conversation_id = ? AND is_active = TRUE',
          [summaryData.conversationId]
        );

        // Create new summary
        const id = this.generateId();
        const insertQuery = `
          INSERT INTO summaries 
          (id, conversation_id, content, message_range_start, message_range_end, token_count) 
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [
          id,
          summaryData.conversationId,
          summaryData.content,
          summaryData.messageRangeStart || null,
          summaryData.messageRangeEnd || null,
          summaryData.tokenCount || null,
        ];

        await connection.execute(insertQuery, params);

        // Fetch and return the created summary
        const [summaryRows] = await connection.execute(
          'SELECT * FROM summaries WHERE id = ?',
          [id]
        ) as [RowDataPacket[], any];

        if (summaryRows.length === 0) {
          throw new DatabaseError('Rolling summary created but could not be retrieved');
        }

        const createdSummary = this.mapRowToEntity(summaryRows[0]);
        logger.info(`Rolling summary created successfully: ${id}`);
        return createdSummary;
      });
    } catch (error) {
      logger.error('Error creating rolling summary:', error);
      throw error instanceof DatabaseError
        ? error
        : new DatabaseError('Failed to create rolling summary');
    }
  }

  /**
   * Convert summary to response format
   */
  toSummaryResponse(summary: Summary): SummaryResponse {
    return {
      id: summary.id,
      conversationId: summary.conversationId,
      content: summary.content,
      messageRangeStart: summary.messageRangeStart,
      messageRangeEnd: summary.messageRangeEnd,
      createdAt: summary.createdAt,
      isActive: summary.isActive,
      tokenCount: summary.tokenCount,
    };
  }
}
