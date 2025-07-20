import { Request, Response, NextFunction } from 'express';
import { SummarizationService } from '../services/SummarizationService';
import { SummaryRepository } from '../repositories/SummaryRepository';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

export class SummarizationController {
  constructor(
    private summarizationService: SummarizationService,
    private summaryRepository: SummaryRepository
  ) {}

  /**
   * Check if conversation needs summarization
   * GET /api/conversations/:conversationId/summarization/check
   */
  checkSummarizationNeeded = async (
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

      // Verify conversation ownership is handled by the service
      const needsSummarization = await this.summarizationService.shouldSummarize(conversationId);

      res.json({
        status: 'success',
        data: {
          conversationId,
          needsSummarization,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error checking summarization need:', error);
      next(error);
    }
  };

  /**
   * Trigger conversation summarization
   * POST /api/conversations/:conversationId/summarization
   */
  summarizeConversation = async (
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

      logger.info(`Summarization requested for conversation: ${conversationId} by user: ${userId}`);

      const result = await this.summarizationService.summarizeConversation(conversationId, userId);

      res.json({
        status: 'success',
        data: {
          summary: this.summaryRepository.toSummaryResponse(result.summary),
          summarizedMessageCount: result.summarizedMessageIds.length,
          preservedMessageCount: result.preservedMessageIds.length,
          tokensSaved: result.tokensSaved,
          newTokenCount: result.newTokenCount,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error summarizing conversation:', error);
      next(error);
    }
  };

  /**
   * Get conversation context (summary + recent messages)
   * GET /api/conversations/:conversationId/context
   */
  getConversationContext = async (
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

      const context = await this.summarizationService.getConversationContext(conversationId);

      res.json({
        status: 'success',
        data: {
          conversationId,
          summary: context.summary ? this.summaryRepository.toSummaryResponse(context.summary) : null,
          recentMessageCount: context.recentMessages.length,
          totalTokens: context.totalTokens,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error getting conversation context:', error);
      next(error);
    }
  };

  /**
   * Get summarization configuration
   * GET /api/summarization/config
   */
  getConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const config = this.summarizationService.getConfig();

      res.json({
        status: 'success',
        data: {
          config: {
            maxTokensBeforeSummarization: config.maxTokensBeforeSummarization,
            summaryModel: config.summaryModel,
            preserveRecentMessages: config.preserveRecentMessages,
            maxSummaryTokens: config.maxSummaryTokens,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error getting summarization config:', error);
      next(error);
    }
  };
}