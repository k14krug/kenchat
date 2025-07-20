import { Request, Response, NextFunction } from 'express';
import { ConversationService } from '../services/ConversationService';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { PersonaRepository } from '../repositories/PersonaRepository';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { validatePagination, validateConversationCreate, validateConversationUpdate, validateMessageCreate } from '../utils/validation';

export class ConversationController {
  private conversationService: ConversationService;

  constructor() {
    const conversationRepository = new ConversationRepository();
    const messageRepository = new MessageRepository();
    const personaRepository = new PersonaRepository();
    
    this.conversationService = new ConversationService(
      conversationRepository,
      messageRepository,
      personaRepository
    );
  }

  /**
   * Create a new conversation
   */
  createConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const validatedData = validateConversationCreate(req.body);
      const conversation = await this.conversationService.createConversation(userId, validatedData);

      res.status(201).json({
        success: true,
        data: conversation,
        message: 'Conversation created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's conversations with pagination and filtering
   */
  getConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const paginationOptions = validatePagination(req.query);
      const filters = {
        search: req.query.search as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        isArchived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
      };

      const result = await this.conversationService.getUserConversations(userId, paginationOptions, filters);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get conversation by ID
   */
  getConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      const conversation = await this.conversationService.getConversation(conversationId, userId);

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get conversation with messages
   */
  getConversationWithMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      const conversation = await this.conversationService.getConversationWithMessages(conversationId, userId);

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update conversation
   */
  updateConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      const validatedData = validateConversationUpdate(req.body);
      const conversation = await this.conversationService.updateConversation(conversationId, userId, validatedData);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update conversation intent
   */
  updateIntent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;
      const { intent } = req.body;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      if (!intent || typeof intent !== 'string') {
        throw new ValidationError('Intent is required and must be a string');
      }

      const conversation = await this.conversationService.updateConversationIntent(conversationId, userId, intent);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation intent updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update custom instructions
   */
  updateCustomInstructions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;
      const { customInstructions } = req.body;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      if (!customInstructions || typeof customInstructions !== 'string') {
        throw new ValidationError('Custom instructions are required and must be a string');
      }

      const conversation = await this.conversationService.updateCustomInstructions(conversationId, userId, customInstructions);

      res.json({
        success: true,
        data: conversation,
        message: 'Custom instructions updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Switch persona in conversation
   */
  switchPersona = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;
      const { personaId } = req.body;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      if (!personaId || typeof personaId !== 'string') {
        throw new ValidationError('Persona ID is required and must be a string');
      }

      const conversation = await this.conversationService.switchPersona(conversationId, userId, personaId);

      res.json({
        success: true,
        data: conversation,
        message: 'Persona switched successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Archive conversation
   */
  archiveConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      await this.conversationService.setArchiveStatus(conversationId, userId, true);

      res.json({
        success: true,
        message: 'Conversation archived successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Unarchive conversation
   */
  unarchiveConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      await this.conversationService.setArchiveStatus(conversationId, userId, false);

      res.json({
        success: true,
        message: 'Conversation unarchived successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete conversation
   */
  deleteConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      await this.conversationService.deleteConversation(conversationId, userId);

      res.json({
        success: true,
        message: 'Conversation deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add message to conversation
   */
  addMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      const validatedData = validateMessageCreate(req.body);
      const message = await this.conversationService.addMessage(conversationId, userId, validatedData);

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message added successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get conversation messages
   */
  getMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      const paginationOptions = validatePagination(req.query);
      const result = await this.conversationService.getConversationMessages(conversationId, userId, paginationOptions);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search conversations
   */
  searchConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const searchQuery = req.query.q as string;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!searchQuery) {
        throw new ValidationError('Search query is required');
      }

      const paginationOptions = validatePagination(req.query);
      const result = await this.conversationService.searchConversations(userId, searchQuery, paginationOptions);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get conversation statistics
   */
  getConversationStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      const stats = await this.conversationService.getConversationStats(conversationId, userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get recent messages
   */
  getRecentMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      const messages = await this.conversationService.getRecentMessages(conversationId, userId, limit);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      next(error);
    }
  };
}