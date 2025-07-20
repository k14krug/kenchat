import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../database/connection';
import {
  Message,
  CreateMessageRequest,
  UpdateMessageRequest,
  MessageResponse,
  MessageWithPersona,
  PaginationOptions,
} from '../models';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { BaseRepository } from './BaseRepository';

export class MessageRepository extends BaseRepository<
  Message,
  CreateMessageRequest,
  UpdateMessageRequest
> {
  protected readonly tableName = 'messages';

  /**
   * Map database row to Message object
   */
  protected mapRowToEntity(row: RowDataPacket): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      personaId: row.persona_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      modelUsed: row.model_used,
      tokenCount: row.token_count,
      cost: row.cost ? parseFloat(row.cost) : undefined,
      createdAt: row.created_at,
      isSummarized: row.is_summarized,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Create a new message
   */
  async create(messageData: CreateMessageRequest): Promise<Message> {
    try {
      const id = this.generateId();
      const query = `
        INSERT INTO ${this.tableName} 
        (id, conversation_id, persona_id, role, content, model_used, token_count, cost, metadata) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        id,
        messageData.conversationId,
        messageData.personaId || null,
        messageData.role,
        messageData.content,
        messageData.modelUsed || null,
        messageData.tokenCount || null,
        messageData.cost || null,
        messageData.metadata ? JSON.stringify(messageData.metadata) : null,
      ];

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new DatabaseError('Failed to create message');
      }

      // Fetch and return the created message
      const createdMessage = await this.findById(id);
      if (!createdMessage) {
        throw new DatabaseError('Message created but could not be retrieved');
      }

      logger.debug(`Message created successfully: ${id}`);
      return createdMessage;
    } catch (error) {
      logger.error('Error creating message:', error);
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to create message');
    }
  }

  /**
   * Update message
   */
  async update(id: string, messageData: UpdateMessageRequest): Promise<Message> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];

      if (messageData.content !== undefined) {
        updateFields.push('content = ?');
        params.push(messageData.content);
      }

      if (messageData.isSummarized !== undefined) {
        updateFields.push('is_summarized = ?');
        params.push(messageData.isSummarized);
      }

      if (messageData.metadata !== undefined) {
        updateFields.push('metadata = ?');
        params.push(messageData.metadata ? JSON.stringify(messageData.metadata) : null);
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
        throw new NotFoundError('Message not found');
      }

      const updatedMessage = await this.findById(id);
      if (!updatedMessage) {
        throw new DatabaseError('Message updated but could not be retrieved');
      }

      logger.debug(`Message updated successfully: ${id}`);
      return updatedMessage;
    } catch (error) {
      logger.error('Error updating message:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to update message');
    }
  }

  /**
   * Find messages by conversation ID with pagination
   */
  async findByConversationId(conversationId: string, options: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'ASC' } = options;
      const offset = (page - 1) * limit;

      // Count total records
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE conversation_id = ?`;
      const [countRows] = await db.execute<RowDataPacket[]>(countQuery, [conversationId]);
      const total = (countRows[0] as any).total;

      // Get paginated data with persona information
      const dataQuery = `
        SELECT m.*, p.name as persona_name, p.description as persona_description
        FROM ${this.tableName} m
        LEFT JOIN personas p ON m.persona_id = p.id
        WHERE m.conversation_id = ?
        ORDER BY m.${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      const [dataRows] = await db.execute<RowDataPacket[]>(dataQuery, [
        conversationId,
        limit,
        offset,
      ]);

      const data: MessageWithPersona[] = dataRows.map(row => ({
        ...this.mapRowToEntity(row),
        persona: row.persona_name
          ? {
              id: row.persona_id,
              name: row.persona_name,
              description: row.persona_description,
            }
          : undefined,
      }));

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
      logger.error('Error finding messages by conversation ID:', error);
      throw new DatabaseError('Failed to find messages');
    }
  }

  /**
   * Find messages in date range for summarization
   */
  async findForSummarization(
    conversationId: string,
    startDate?: Date,
    endDate?: Date,
    excludeSummarized: boolean = true
  ): Promise<Message[]> {
    try {
      const whereConditions: string[] = ['conversation_id = ?'];
      const params: any[] = [conversationId];

      if (startDate) {
        whereConditions.push('created_at >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('created_at <= ?');
        params.push(endDate);
      }

      if (excludeSummarized) {
        whereConditions.push('is_summarized = FALSE');
      }

      const query = `
        SELECT * FROM ${this.tableName}
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at ASC
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, params);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Error finding messages for summarization:', error);
      throw new DatabaseError('Failed to find messages for summarization');
    }
  }

  /**
   * Mark messages as summarized
   */
  async markAsSummarized(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    try {
      const placeholders = messageIds.map(() => '?').join(',');
      const query = `
        UPDATE ${this.tableName} 
        SET is_summarized = TRUE
        WHERE id IN (${placeholders})
      `;

      const [result] = await db.execute<ResultSetHeader>(query, messageIds);

      logger.debug(`Marked ${result.affectedRows} messages as summarized`);
    } catch (error) {
      logger.error('Error marking messages as summarized:', error);
      throw new DatabaseError('Failed to mark messages as summarized');
    }
  }

  /**
   * Get conversation message statistics
   */
  async getConversationStats(conversationId: string): Promise<{
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    messagesByRole: Record<string, number>;
    summarizedCount: number;
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_messages,
          SUM(COALESCE(token_count, 0)) as total_tokens,
          SUM(COALESCE(cost, 0)) as total_cost,
          SUM(CASE WHEN is_summarized = TRUE THEN 1 ELSE 0 END) as summarized_count,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
          SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
          SUM(CASE WHEN role = 'system' THEN 1 ELSE 0 END) as system_messages
        FROM ${this.tableName}
        WHERE conversation_id = ?
      `;

      const [rows] = await db.execute<RowDataPacket[]>(statsQuery, [conversationId]);
      const row = rows[0] as any;

      return {
        totalMessages: row.total_messages || 0,
        totalTokens: row.total_tokens || 0,
        totalCost: parseFloat(row.total_cost) || 0,
        summarizedCount: row.summarized_count || 0,
        messagesByRole: {
          user: row.user_messages || 0,
          assistant: row.assistant_messages || 0,
          system: row.system_messages || 0,
        },
      };
    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      throw new DatabaseError('Failed to get conversation statistics');
    }
  }

  /**
   * Delete messages by conversation ID
   */
  async deleteByConversationId(conversationId: string): Promise<number> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE conversation_id = ?`;
      const [result] = await db.execute<ResultSetHeader>(query, [conversationId]);

      logger.info(`Deleted ${result.affectedRows} messages for conversation: ${conversationId}`);
      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting messages by conversation ID:', error);
      throw new DatabaseError('Failed to delete messages');
    }
  }

  /**
   * Get recent messages for context
   */
  async getRecentMessages(conversationId: string, limit: number = 10): Promise<Message[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const [rows] = await db.execute<RowDataPacket[]>(query, [conversationId, limit]);
      return rows.map(row => this.mapRowToEntity(row)).reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Error getting recent messages:', error);
      throw new DatabaseError('Failed to get recent messages');
    }
  }

  /**
   * Convert message to response format
   */
  toMessageResponse(message: Message): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      personaId: message.personaId,
      role: message.role,
      content: message.content,
      modelUsed: message.modelUsed,
      tokenCount: message.tokenCount,
      cost: message.cost,
      createdAt: message.createdAt,
      isSummarized: message.isSummarized,
      metadata: message.metadata,
    };
  }
}
