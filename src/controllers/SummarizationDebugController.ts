import { Request, Response, NextFunction } from 'express';
import { SummarizationService } from '../services/SummarizationService';
import { SummaryRepository } from '../repositories/SummaryRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/errors';


export interface DebugSummaryData {
  conversationId: string;
  originalMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    isSummarized: boolean;
    isIncludedInSummary: boolean;
  }>;
  summaries: Array<{
    id: string;
    content: string;
    messageRangeStart?: string;
    messageRangeEnd?: string;
    createdAt: Date;
    isActive: boolean;
    tokenCount?: number;
  }>;
  summarizationPrompts: {
    initialPrompt: string;
    rollingPrompt: string;
  };
  config: {
    maxTokensBeforeSummarization: number;
    summaryModel: string;
    preserveRecentMessages: number;
    maxSummaryTokens: number;
  };
}

export interface TestSummaryRequest {
  conversationId: string;
  customPrompt?: string;
  useRollingPrompt?: boolean;
  messageIds?: string[];
}

export class SummarizationDebugController {
  constructor(
    private summarizationService: SummarizationService,
    private summaryRepository: SummaryRepository,
    private messageRepository: MessageRepository,
    private conversationRepository: ConversationRepository
  ) {}

  /**
   * Check if user has debug access (developer/admin only)
   */
  private async checkDebugAccess(userId: string): Promise<void> {
    // For now, we'll use a simple environment variable or config
    // In a real application, this would check user roles/permissions
    const debugUsers = process.env.DEBUG_USERS?.split(',') || [];
    const isDeveloper = process.env.NODE_ENV === 'development';
    
    if (!isDeveloper && !debugUsers.includes(userId)) {
      throw new AuthorizationError('Debug access requires developer privileges');
    }
  }

  /**
   * Get comprehensive debug data for a conversation
   * GET /api/debug/conversations/:conversationId/summarization
   */
  getDebugData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new ValidationError('User authentication required');
      }

      // Check debug access
      await this.checkDebugAccess(userId);

      // Verify conversation exists and user has access
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      if (conversation.userId !== userId) {
        throw new AuthorizationError('Access denied to this conversation');
      }

      // Get all messages for the conversation
      const messagesResult = await this.messageRepository.findByConversationId(conversationId, {
        limit: 1000,
        sortBy: 'created_at',
        sortOrder: 'ASC',
      });

      // Get all summaries for the conversation (including inactive ones)
      const summariesResult = await this.summaryRepository.findByConversationId(conversationId, {}, false);
      const summaries = summariesResult.data;

      // Get summarization prompts and config
      const config = this.summarizationService.getConfig();
      const initialPrompt = this.summarizationService.getSummaryPromptTemplate();
      const rollingPrompt = this.summarizationService.getRollingSummaryPromptTemplate();

      // Build message inclusion tracking
      const messagesWithInclusion = messagesResult.data.map(message => {
        // Check if message is included in any summary
        const isIncludedInSummary = summaries.some(summary => {
          if (!summary.messageRangeStart || !summary.messageRangeEnd) {
            return false;
          }
          
          // Find the message indices to determine range
          const startIndex = messagesResult.data.findIndex(m => m.id === summary.messageRangeStart);
          const endIndex = messagesResult.data.findIndex(m => m.id === summary.messageRangeEnd);
          const messageIndex = messagesResult.data.findIndex(m => m.id === message.id);
          
          return messageIndex >= startIndex && messageIndex <= endIndex;
        });

        return {
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
          isSummarized: message.isSummarized,
          isIncludedInSummary,
        };
      });

      const debugData: DebugSummaryData = {
        conversationId,
        originalMessages: messagesWithInclusion,
        summaries: summaries.map(summary => ({
          id: summary.id,
          content: summary.content,
          messageRangeStart: summary.messageRangeStart,
          messageRangeEnd: summary.messageRangeEnd,
          createdAt: summary.createdAt,
          isActive: summary.isActive,
          tokenCount: summary.tokenCount,
        })),
        summarizationPrompts: {
          initialPrompt,
          rollingPrompt,
        },
        config: {
          maxTokensBeforeSummarization: config.maxTokensBeforeSummarization,
          summaryModel: config.summaryModel,
          preserveRecentMessages: config.preserveRecentMessages,
          maxSummaryTokens: config.maxSummaryTokens,
        },
      };

      res.json({
        status: 'success',
        data: debugData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting debug data:', error);
      next(error);
    }
  };

  /**
   * Test summarization with custom prompt or settings
   * POST /api/debug/conversations/:conversationId/test-summary
   */
  testSummarization = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new ValidationError('User authentication required');
      }
      const { customPrompt, useRollingPrompt, messageIds }: TestSummaryRequest = req.body;

      // Check debug access
      await this.checkDebugAccess(userId);

      // Verify conversation exists and user has access
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      if (conversation.userId !== userId) {
        throw new AuthorizationError('Access denied to this conversation');
      }

      // Get messages to test with
      let messagesToTest;
      if (messageIds && messageIds.length > 0) {
        // Use specific messages
        messagesToTest = await Promise.all(
          messageIds.map(id => this.messageRepository.findById(id))
        );
        messagesToTest = messagesToTest.filter(msg => msg !== null);
      } else {
        // Use all messages
        const messagesResult = await this.messageRepository.findByConversationId(conversationId, {
          limit: 1000,
          sortBy: 'created_at',
          sortOrder: 'ASC',
        });
        messagesToTest = messagesResult.data;
      }

      if (messagesToTest.length === 0) {
        throw new ValidationError('No messages found to test summarization');
      }

      // Temporarily update prompt if custom prompt provided
      const originalPrompt = useRollingPrompt 
        ? this.summarizationService.getRollingSummaryPromptTemplate()
        : this.summarizationService.getSummaryPromptTemplate();

      if (customPrompt) {
        if (useRollingPrompt) {
          this.summarizationService.updateRollingSummaryPromptTemplate(customPrompt);
        } else {
          this.summarizationService.updateSummaryPromptTemplate(customPrompt);
        }
      }

      try {
        // Create a test summarization context
        const existingSummary = useRollingPrompt 
          ? await this.summaryRepository.getLatestForConversation(conversationId)
          : undefined;

        // Build context for testing
        const context: any = {
          conversation: {
            id: conversationId,
            userId,
            title: conversation.title || 'Debug Test',
            createdAt: conversation.createdAt || new Date(),
            updatedAt: conversation.updatedAt || new Date(),
            isArchived: conversation.isArchived || false,
            totalCost: conversation.totalCost || 0,
          },
          messages: messagesToTest,
          existingSummary: existingSummary || undefined,
        };

        // Generate test summary using the service's test method
        const testSummary = await this.summarizationService.generateTestSummary(context, useRollingPrompt || false);

        res.json({
          status: 'success',
          data: {
            testSummary: {
              content: testSummary,
              messageCount: messagesToTest.length,
              promptUsed: customPrompt || originalPrompt,
              isRollingPrompt: useRollingPrompt || false,
              existingSummary: existingSummary?.content,
            },
            originalMessages: messagesToTest.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              createdAt: msg.createdAt,
            })),
          },
          timestamp: new Date().toISOString(),
        });
      } finally {
        // Restore original prompt
        if (customPrompt) {
          if (useRollingPrompt) {
            this.summarizationService.updateRollingSummaryPromptTemplate(originalPrompt);
          } else {
            this.summarizationService.updateSummaryPromptTemplate(originalPrompt);
          }
        }
      }
    } catch (error) {
      logger.error('Error testing summarization:', error);
      next(error);
    }
  };

  /**
   * Update summarization prompts
   * PUT /api/debug/summarization/prompts
   */
  updatePrompts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ValidationError('User authentication required');
      }
      const { initialPrompt, rollingPrompt } = req.body;

      // Check debug access
      await this.checkDebugAccess(userId);

      if (!initialPrompt && !rollingPrompt) {
        throw new ValidationError('At least one prompt must be provided');
      }

      if (initialPrompt) {
        this.summarizationService.updateSummaryPromptTemplate(initialPrompt);
      }

      if (rollingPrompt) {
        this.summarizationService.updateRollingSummaryPromptTemplate(rollingPrompt);
      }

      res.json({
        status: 'success',
        data: {
          message: 'Prompts updated successfully',
          updatedPrompts: {
            initial: initialPrompt ? true : false,
            rolling: rollingPrompt ? true : false,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating prompts:', error);
      next(error);
    }
  };

  /**
   * Update summarization configuration
   * PUT /api/debug/summarization/config
   */
  updateConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ValidationError('User authentication required');
      }
      const configUpdates = req.body;

      // Check debug access
      await this.checkDebugAccess(userId);

      // Validate config updates
      const allowedFields = [
        'maxTokensBeforeSummarization',
        'summaryModel',
        'preserveRecentMessages',
        'maxSummaryTokens',
      ];

      const filteredUpdates = Object.keys(configUpdates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = configUpdates[key];
          return obj;
        }, {} as any);

      if (Object.keys(filteredUpdates).length === 0) {
        throw new ValidationError('No valid configuration fields provided');
      }

      this.summarizationService.updateConfig(filteredUpdates);

      res.json({
        status: 'success',
        data: {
          message: 'Configuration updated successfully',
          updatedFields: Object.keys(filteredUpdates),
          newConfig: this.summarizationService.getConfig(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating config:', error);
      next(error);
    }
  };

  /**
   * Get current prompts
   * GET /api/debug/summarization/prompts
   */
  getPrompts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ValidationError('User authentication required');
      }

      // Check debug access
      await this.checkDebugAccess(userId);

      const initialPrompt = this.summarizationService.getSummaryPromptTemplate();
      const rollingPrompt = this.summarizationService.getRollingSummaryPromptTemplate();

      res.json({
        status: 'success',
        data: {
          prompts: {
            initial: initialPrompt,
            rolling: rollingPrompt,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting prompts:', error);
      next(error);
    }
  };


}