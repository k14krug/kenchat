import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../database/connection';
import {
  Conversation,
  CreateConversationRequest,
  UpdateConversationRequest,
  ConversationResponse,
  ConversationWithMessages,
  PaginationOptions,
  FilterOptions,
} from '../models';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { BaseRepository } from './BaseRepository';

export class ConversationRepository extends BaseRepository<
  Conversation,
  CreateConversationRequest,
  UpdateConversationRequest
> {
  protected readonly tableName = 'conversations';

  /**
   * Map database row to Conversation object
   */
  protected mapRowToEntity(row: RowDataPacket): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      intent: row.intent,
      customInstructions: row.custom_instructions,
      currentPersonaId: row.current_persona_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isArchived: row.is_archived,
      totalCost: parseFloat(row.total_cost) || 0,
    };
  }

  /**
   * Create a new conversation
   */
  async create(conversationData: CreateConversationRequest): Promise<Conversation> {
    try {
      const id = this.generateId();
      const query = `
        INSERT INTO ${this.tableName} 
        (id, user_id, title, intent, custom_instructions, current_persona_id) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const params = [
        id,
        conversationData.userId,
        conversationData.title || null,
        conversationData.intent || null,
        conversationData.customInstructions || null,
        conversationData.currentPersonaId || null,
      ];

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new DatabaseError('Failed to create conversation');
      }

      // Fetch and return the created conversation
      const createdConversation = await this.findById(id);
      if (!createdConversation) {
        throw new DatabaseError('Conversation created but could not be retrieved');
      }

      logger.info(`Conversation created successfully: ${id}`);
      return createdConversation;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error instanceof DatabaseError
        ? error
        : new DatabaseError('Failed to create conversation');
    }
  }

  /**
   * Update conversation
   */
  async update(id: string, conversationData: UpdateConversationRequest): Promise<Conversation> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];

      if (conversationData.title !== undefined) {
        updateFields.push('title = ?');
        params.push(conversationData.title);
      }

      if (conversationData.intent !== undefined) {
        updateFields.push('intent = ?');
        params.push(conversationData.intent);
      }

      if (conversationData.customInstructions !== undefined) {
        updateFields.push('custom_instructions = ?');
        params.push(conversationData.customInstructions);
      }

      if (conversationData.currentPersonaId !== undefined) {
        updateFields.push('current_persona_id = ?');
        params.push(conversationData.currentPersonaId);
      }

      if (conversationData.isArchived !== undefined) {
        updateFields.push('is_archived = ?');
        params.push(conversationData.isArchived);
      }

      if (updateFields.length === 0) {
        throw new DatabaseError('No fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `
        UPDATE ${this.tableName} 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new NotFoundError('Conversation not found');
      }

      const updatedConversation = await this.findById(id);
      if (!updatedConversation) {
        throw new DatabaseError('Conversation updated but could not be retrieved');
      }

      logger.info(`Conversation updated successfully: ${id}`);
      return updatedConversation;
    } catch (error) {
      logger.error('Error updating conversation:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw error instanceof DatabaseError
        ? error
        : new DatabaseError('Failed to update conversation');
    }
  }

  /**
   * Find conversations by user ID with pagination and filtering
   */
  async findByUserId(userId: string, options: PaginationOptions = {}, filters: FilterOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'updated_at', sortOrder = 'DESC' } = options;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = ['user_id = ?'];
      const queryParams: any[] = [userId];

      if (filters.search) {
        whereConditions.push('(title LIKE ? OR intent LIKE ? OR custom_instructions LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      if (filters.startDate) {
        whereConditions.push('created_at >= ?');
        queryParams.push(filters.startDate);
      }

      if (filters.endDate) {
        whereConditions.push('created_at <= ?');
        queryParams.push(filters.endDate);
      }

      if (filters.isArchived !== undefined) {
        whereConditions.push('is_archived = ?');
        queryParams.push(filters.isArchived);
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Count total records
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
      const [countRows] = await db.execute<RowDataPacket[]>(countQuery, queryParams);
      const total = (countRows[0] as any).total;

      // Get paginated data with message count
      const dataQuery = `
        SELECT c.*, 
               COUNT(m.id) as message_count
        FROM ${this.tableName} c
        LEFT JOIN messages m ON c.id = m.conversation_id
        ${whereClause}
        GROUP BY c.id
        ORDER BY c.${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      const [dataRows] = await db.execute<RowDataPacket[]>(dataQuery, [
        ...queryParams,
        limit,
        offset,
      ]);

      const data = dataRows.map(row => ({
        ...this.mapRowToEntity(row),
        messageCount: row.message_count,
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
      logger.error('Error finding conversations by user ID:', error);
      throw new DatabaseError('Failed to find conversations');
    }
  }

  /**
   * Find conversation with messages and summaries
   */
  async findWithMessages(id: string, userId: string): Promise<ConversationWithMessages | null> {
    try {
      // First get the conversation
      const conversation = await this.findById(id);
      if (!conversation || conversation.userId !== userId) {
        return null;
      }

      // Get messages
      const messagesQuery = `
        SELECT m.*, p.name as persona_name
        FROM messages m
        LEFT JOIN personas p ON m.persona_id = p.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC
      `;
      const [messageRows] = await db.execute<RowDataPacket[]>(messagesQuery, [id]);

      // Get summaries
      const summariesQuery = `
        SELECT * FROM summaries 
        WHERE conversation_id = ? AND is_active = TRUE
        ORDER BY created_at ASC
      `;
      const [summaryRows] = await db.execute<RowDataPacket[]>(summariesQuery, [id]);

      const messages = messageRows.map(row => ({
        id: row.id,
        conversationId: row.conversation_id,
        personaId: row.persona_id,
        role: row.role as 'user' | 'assistant' | 'system',
        content: row.content,
        modelUsed: row.model_used,
        tokenCount: row.token_count,
        cost: parseFloat(row.cost) || 0,
        createdAt: row.created_at,
        isSummarized: row.is_summarized,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

      const summaries = summaryRows.map(row => ({
        id: row.id,
        conversationId: row.conversation_id,
        content: row.content,
        messageRangeStart: row.message_range_start,
        messageRangeEnd: row.message_range_end,
        createdAt: row.created_at,
        isActive: row.is_active,
        tokenCount: row.token_count,
      }));

      return {
        ...conversation,
        messages,
        summaries,
      };
    } catch (error) {
      logger.error('Error finding conversation with messages:', error);
      throw new DatabaseError('Failed to find conversation with messages');
    }
  }

  /**
   * Update conversation total cost
   */
  async updateTotalCost(id: string, additionalCost: number): Promise<void> {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET total_cost = total_cost + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const [result] = await db.execute<ResultSetHeader>(query, [additionalCost, id]);

      if (result.affectedRows === 0) {
        throw new NotFoundError('Conversation not found');
      }

      logger.debug(`Conversation cost updated: ${id}, additional cost: ${additionalCost}`);
    } catch (error) {
      logger.error('Error updating conversation cost:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update conversation cost');
    }
  }

  /**
   * Archive/unarchive conversation
   */
  async setArchiveStatus(id: string, userId: string, isArchived: boolean): Promise<void> {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET is_archived = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `;

      const [result] = await db.execute<ResultSetHeader>(query, [isArchived, id, userId]);

      if (result.affectedRows === 0) {
        throw new NotFoundError('Conversation not found');
      }

      logger.info(`Conversation ${isArchived ? 'archived' : 'unarchived'}: ${id}`);
    } catch (error) {
      logger.error('Error setting conversation archive status:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update conversation archive status');
    }
  }

  /**
   * Delete conversation and all related data
   */
  async deleteWithRelatedData(id: string, userId: string): Promise<void> {
    try {
      await this.executeTransaction(async connection => {
        // Verify ownership
        const checkQuery = 'SELECT user_id FROM conversations WHERE id = ?';
        const [checkRows] = await connection.execute(checkQuery, [id]) as [RowDataPacket[], any];

        if (checkRows.length === 0) {
          throw new NotFoundError('Conversation not found');
        }

        if (checkRows[0].user_id !== userId) {
          throw new NotFoundError('Conversation not found');
        }

        // Delete related data in correct order
        await connection.execute('DELETE FROM summaries WHERE conversation_id = ?', [id]);
        await connection.execute('DELETE FROM messages WHERE conversation_id = ?', [id]);
        await connection.execute('DELETE FROM usage_logs WHERE conversation_id = ?', [id]);
        await connection.execute('DELETE FROM conversations WHERE id = ?', [id]);

        logger.info(`Conversation and related data deleted: ${id}`);
      });
    } catch (error) {
      logger.error('Error deleting conversation with related data:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete conversation');
    }
  }

  /**
   * Convert conversation to response format
   */
  toConversationResponse(conversation: Conversation, messageCount?: number): ConversationResponse {
    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      intent: conversation.intent,
      customInstructions: conversation.customInstructions,
      currentPersonaId: conversation.currentPersonaId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isArchived: conversation.isArchived,
      totalCost: conversation.totalCost,
      messageCount,
    };
  }
}
