import {
  Conversation,
  CreateConversationRequest,
  UpdateConversationRequest,
  ConversationResponse,
  ConversationWithMessages,
  Message,
  CreateMessageRequest,
  PaginationOptions,
  FilterOptions,
  PaginatedResponse,
} from '../models';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { PersonaRepository } from '../repositories/PersonaRepository';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../config/logger';

export class ConversationService {
  constructor(
    private conversationRepository: ConversationRepository,
    private messageRepository: MessageRepository,
    private personaRepository: PersonaRepository
  ) {}

  /**
   * Create a new conversation with user isolation
   */
  async createConversation(
    userId: string,
    conversationData: Omit<CreateConversationRequest, 'userId'>
  ): Promise<ConversationResponse> {
    try {
      // Validate persona if provided
      if (conversationData.currentPersonaId) {
        const persona = await this.personaRepository.findById(conversationData.currentPersonaId);
        if (!persona || persona.userId !== userId) {
          throw new ValidationError('Invalid persona ID or persona does not belong to user');
        }
      }

      // Create conversation with user isolation
      const createRequest: CreateConversationRequest = {
        ...conversationData,
        userId,
      };

      const conversation = await this.conversationRepository.create(createRequest);
      
      logger.info(`Conversation created for user ${userId}: ${conversation.id}`);
      return this.conversationRepository.toConversationResponse(conversation);
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get user's conversations with pagination and filtering
   */
  async getUserConversations(
    userId: string,
    options: PaginationOptions = {},
    filters: FilterOptions = {}
  ): Promise<PaginatedResponse<ConversationResponse>> {
    try {
      const result = await this.conversationRepository.findByUserId(userId, options, filters);
      
      const conversationResponses = result.data.map(conv => 
        this.conversationRepository.toConversationResponse(conv, (conv as any).messageCount)
      );

      return {
        data: conversationResponses,
        pagination: result.pagination,
      };
    } catch (error) {
      logger.error('Error getting user conversations:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID with user isolation
   */
  async getConversation(conversationId: string, userId: string): Promise<ConversationResponse> {
    try {
      const conversation = await this.conversationRepository.findById(conversationId);
      
      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }

      return this.conversationRepository.toConversationResponse(conversation);
    } catch (error) {
      logger.error('Error getting conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation with messages and user isolation
   */
  async getConversationWithMessages(
    conversationId: string,
    userId: string
  ): Promise<ConversationWithMessages> {
    try {
      const conversation = await this.conversationRepository.findWithMessages(conversationId, userId);
      
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      return conversation;
    } catch (error) {
      logger.error('Error getting conversation with messages:', error);
      throw error;
    }
  }

  /**
   * Update conversation with user isolation
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    updateData: UpdateConversationRequest
  ): Promise<ConversationResponse> {
    try {
      // Verify ownership first
      const existingConversation = await this.conversationRepository.findById(conversationId);
      if (!existingConversation || existingConversation.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }

      // Validate persona if being updated
      if (updateData.currentPersonaId) {
        const persona = await this.personaRepository.findById(updateData.currentPersonaId);
        if (!persona || persona.userId !== userId) {
          throw new ValidationError('Invalid persona ID or persona does not belong to user');
        }
      }

      const updatedConversation = await this.conversationRepository.update(conversationId, updateData);
      
      logger.info(`Conversation updated: ${conversationId}`);
      return this.conversationRepository.toConversationResponse(updatedConversation);
    } catch (error) {
      logger.error('Error updating conversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation intent
   */
  async updateConversationIntent(
    conversationId: string,
    userId: string,
    intent: string
  ): Promise<ConversationResponse> {
    try {
      return await this.updateConversation(conversationId, userId, { intent });
    } catch (error) {
      logger.error('Error updating conversation intent:', error);
      throw error;
    }
  }

  /**
   * Update conversation custom instructions
   */
  async updateCustomInstructions(
    conversationId: string,
    userId: string,
    customInstructions: string
  ): Promise<ConversationResponse> {
    try {
      return await this.updateConversation(conversationId, userId, { customInstructions });
    } catch (error) {
      logger.error('Error updating custom instructions:', error);
      throw error;
    }
  }

  /**
   * Switch persona in conversation
   */
  async switchPersona(
    conversationId: string,
    userId: string,
    personaId: string
  ): Promise<ConversationResponse> {
    try {
      return await this.updateConversation(conversationId, userId, { currentPersonaId: personaId });
    } catch (error) {
      logger.error('Error switching persona:', error);
      throw error;
    }
  }

  /**
   * Archive/unarchive conversation
   */
  async setArchiveStatus(
    conversationId: string,
    userId: string,
    isArchived: boolean
  ): Promise<void> {
    try {
      await this.conversationRepository.setArchiveStatus(conversationId, userId, isArchived);
      logger.info(`Conversation ${isArchived ? 'archived' : 'unarchived'}: ${conversationId}`);
    } catch (error) {
      logger.error('Error setting archive status:', error);
      throw error;
    }
  }

  /**
   * Delete conversation with user isolation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    try {
      await this.conversationRepository.deleteWithRelatedData(conversationId, userId);
      logger.info(`Conversation deleted: ${conversationId}`);
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    conversationId: string,
    userId: string,
    messageData: Omit<CreateMessageRequest, 'conversationId'>
  ): Promise<Message> {
    try {
      // Verify conversation ownership
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }

      // Validate persona if provided
      if (messageData.personaId) {
        const persona = await this.personaRepository.findById(messageData.personaId);
        if (!persona || persona.userId !== userId) {
          throw new ValidationError('Invalid persona ID or persona does not belong to user');
        }
      }

      const createRequest: CreateMessageRequest = {
        ...messageData,
        conversationId,
      };

      const message = await this.messageRepository.create(createRequest);

      // Update conversation cost if message has cost
      if (messageData.cost && messageData.cost > 0) {
        await this.conversationRepository.updateTotalCost(conversationId, messageData.cost);
      }

      logger.debug(`Message added to conversation ${conversationId}: ${message.id}`);
      return message;
    } catch (error) {
      logger.error('Error adding message:', error);
      throw error;
    }
  }

  /**
   * Get conversation messages with pagination
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    options: PaginationOptions = {}
  ) {
    try {
      // Verify conversation ownership
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }

      return await this.messageRepository.findByConversationId(conversationId, options);
    } catch (error) {
      logger.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  /**
   * Search conversations by content, title, or intent
   */
  async searchConversations(
    userId: string,
    searchQuery: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<ConversationResponse>> {
    try {
      const filters: FilterOptions = {
        search: searchQuery,
      };

      return await this.getUserConversations(userId, options, filters);
    } catch (error) {
      logger.error('Error searching conversations:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(conversationId: string, userId: string) {
    try {
      // Verify conversation ownership
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }

      return await this.messageRepository.getConversationStats(conversationId);
    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      throw error;
    }
  }

  /**
   * Get recent messages for context
   */
  async getRecentMessages(
    conversationId: string,
    userId: string,
    limit: number = 10
  ): Promise<Message[]> {
    try {
      // Verify conversation ownership
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }

      return await this.messageRepository.getRecentMessages(conversationId, limit);
    } catch (error) {
      logger.error('Error getting recent messages:', error);
      throw error;
    }
  }

  /**
   * Filter conversations by date range
   */
  async getConversationsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<ConversationResponse>> {
    try {
      const filters: FilterOptions = {
        startDate,
        endDate,
      };

      return await this.getUserConversations(userId, options, filters);
    } catch (error) {
      logger.error('Error getting conversations by date range:', error);
      throw error;
    }
  }

  /**
   * Get archived conversations
   */
  async getArchivedConversations(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<ConversationResponse>> {
    try {
      const filters: FilterOptions = {
        isArchived: true,
      };

      return await this.getUserConversations(userId, options, filters);
    } catch (error) {
      logger.error('Error getting archived conversations:', error);
      throw error;
    }
  }

  /**
   * Get active (non-archived) conversations
   */
  async getActiveConversations(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<ConversationResponse>> {
    try {
      const filters: FilterOptions = {
        isArchived: false,
      };

      return await this.getUserConversations(userId, options, filters);
    } catch (error) {
      logger.error('Error getting active conversations:', error);
      throw error;
    }
  }
}