import { Request, Response } from 'express';
import { CostTrackingService } from '../services/CostTrackingService';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

export class CostTrackingController {
  private readonly costTrackingService = new CostTrackingService();

  /**
   * Get user's usage statistics
   */
  getUserUsageStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const userIdNum = parseInt(userId);
      if (isNaN(userIdNum)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ 
          error: 'startDate and endDate query parameters are required' 
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      const stats = await this.costTrackingService.getUserUsageStats(userIdNum, start, end);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting user usage stats:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve usage statistics' 
      });
    }
  };

  /**
   * Generate cost report for user
   */
  generateCostReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const userIdNum = parseInt(userId);
      if (isNaN(userIdNum)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const { period, date } = req.query;

      if (!period || !['daily', 'weekly', 'monthly'].includes(period as string)) {
        res.status(400).json({ 
          error: 'period query parameter is required and must be daily, weekly, or monthly' 
        });
        return;
      }

      let reportDate: Date | undefined;
      if (date) {
        reportDate = new Date(date as string);
        if (isNaN(reportDate.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
      }

      const report = await this.costTrackingService.generateCostReport(
        userIdNum,
        period as 'daily' | 'weekly' | 'monthly',
        reportDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Error generating cost report:', error);
      res.status(500).json({ 
        error: 'Failed to generate cost report' 
      });
    }
  };

  /**
   * Check user's cost limit status
   */
  checkCostLimits = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const userIdNum = parseInt(userId);
      if (isNaN(userIdNum)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const status = await this.costTrackingService.checkCostLimits(userIdNum);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Error checking cost limits:', error);
      res.status(500).json({ 
        error: 'Failed to check cost limits' 
      });
    }
  };

  /**
   * Get conversation cost
   */
  getConversationCost = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { conversationId } = req.params;

      if (!conversationId || isNaN(parseInt(conversationId))) {
        res.status(400).json({ error: 'Valid conversation ID is required' });
        return;
      }

      const cost = await this.costTrackingService.getConversationCost(
        parseInt(conversationId)
      );

      res.json({
        success: true,
        data: {
          conversationId: parseInt(conversationId),
          totalCost: cost,
        },
      });
    } catch (error) {
      logger.error('Error getting conversation cost:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve conversation cost' 
      });
    }
  };

  /**
   * Get user's usage logs with pagination
   */
  getUserUsageLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const userIdNum = parseInt(userId);
      if (isNaN(userIdNum)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const {
        page = '1',
        limit = '50',
        startDate,
        endDate,
        actionType,
        conversationId,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({ error: 'Invalid page number' });
        return;
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({ error: 'Invalid limit (must be 1-100)' });
        return;
      }

      const options: any = {
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
      };

      if (startDate) {
        options.startDate = new Date(startDate as string);
        if (isNaN(options.startDate.getTime())) {
          res.status(400).json({ error: 'Invalid startDate format' });
          return;
        }
      }

      if (endDate) {
        options.endDate = new Date(endDate as string);
        if (isNaN(options.endDate.getTime())) {
          res.status(400).json({ error: 'Invalid endDate format' });
          return;
        }
      }

      if (actionType) {
        options.actionType = actionType as string;
      }

      if (conversationId) {
        const convId = parseInt(conversationId as string);
        if (isNaN(convId)) {
          res.status(400).json({ error: 'Invalid conversation ID' });
          return;
        }
        options.conversationId = convId;
      }

      const result = await this.costTrackingService.getUserUsageLogs(userIdNum, options);

      res.json({
        success: true,
        data: {
          logs: result.logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.total,
            totalPages: Math.ceil(result.total / limitNum),
            hasNext: pageNum * limitNum < result.total,
            hasPrev: pageNum > 1,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting user usage logs:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve usage logs' 
      });
    }
  };

  /**
   * Get current pricing information
   */
  getPricingInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      // This could be moved to a separate service if needed
      const { MODEL_PRICING, SUPPORTED_MODELS } = await import('../models/AI');

      res.json({
        success: true,
        data: {
          models: SUPPORTED_MODELS,
          pricing: MODEL_PRICING,
          lastUpdated: new Date().toISOString(), // In production, track actual update time
        },
      });
    } catch (error) {
      logger.error('Error getting pricing info:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve pricing information' 
      });
    }
  };
}