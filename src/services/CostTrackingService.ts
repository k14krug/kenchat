import { logger } from '../config/logger';
import { environment } from '../config/environment';
import { RepositoryFactory } from '../repositories';
import {
  UsageLog,
  CreateUsageLogRequest,
  UsageStats,
  CostReport,
  CostLimitStatus,
  DailyCostBreakdown,
  ConversationCostBreakdown,
} from '../models/UsageLog';
import { AIResponse, TokenUsage } from '../models/AI';
import { ValidationError } from '../utils/errors';

export interface CostLimits {
  daily?: number;
  weekly?: number;
  monthly?: number;
  warningThreshold?: number; // Percentage (0-100) at which to show warnings
}

export interface CostTrackingConfig {
  enabled: boolean;
  limits: CostLimits;
  alertWebhookUrl?: string;
}

export class CostTrackingService {
  private readonly usageLogRepository = RepositoryFactory.getUsageLogRepository();
  private readonly conversationRepository = RepositoryFactory.getConversationRepository();
  
  private readonly config: CostTrackingConfig;

  constructor() {
    this.config = {
      enabled: environment.costTracking?.enabled ?? true,
      limits: {
        daily: environment.costTracking?.dailyLimit,
        weekly: environment.costTracking?.weeklyLimit,
        monthly: environment.costTracking?.monthlyLimit,
        warningThreshold: environment.costTracking?.warningThreshold ?? 80,
      },
      alertWebhookUrl: environment.costTracking?.alertWebhookUrl,
    };
  }

  /**
   * Log OpenAI API usage from an AI response
   */
  async logAIUsage(
    userId: number,
    conversationId: number | undefined,
    aiResponse: AIResponse,
    actionType: 'message_sent' | 'message_received' | 'summary_created' = 'message_received'
  ): Promise<UsageLog> {
    if (!this.config.enabled) {
      logger.debug('Cost tracking is disabled, skipping usage log');
      return {} as UsageLog; // Return empty object when disabled
    }

    try {
      const usageLogData: CreateUsageLogRequest = {
        userId,
        conversationId,
        actionType,
        model: aiResponse.model,
        tokensUsed: aiResponse.usage.totalTokens,
        costUsd: aiResponse.cost,
        metadata: {
          inputTokens: aiResponse.usage.inputTokens,
          outputTokens: aiResponse.usage.outputTokens,
          finishReason: aiResponse.finishReason,
          responseId: aiResponse.id,
          responseCreated: aiResponse.created,
        },
      };

      const usageLog = await this.usageLogRepository.create(usageLogData);

      // Update conversation total cost if conversation exists
      if (conversationId && aiResponse.cost > 0) {
        await this.conversationRepository.updateTotalCost(
          conversationId.toString(),
          aiResponse.cost
        );
      }

      // Check cost limits after logging
      await this.checkCostLimits(userId);

      logger.info('AI usage logged successfully', {
        userId,
        conversationId,
        model: aiResponse.model,
        tokens: aiResponse.usage.totalTokens,
        cost: aiResponse.cost,
      });

      return usageLog;
    } catch (error) {
      logger.error('Failed to log AI usage:', error);
      // Don't throw error to avoid breaking the main flow
      return {} as UsageLog;
    }
  }

  /**
   * Log general usage (e.g., persona usage)
   */
  async logUsage(data: CreateUsageLogRequest): Promise<UsageLog> {
    if (!this.config.enabled) {
      logger.debug('Cost tracking is disabled, skipping usage log');
      return {} as UsageLog;
    }

    try {
      const usageLog = await this.usageLogRepository.create(data);

      // Check cost limits after logging
      await this.checkCostLimits(data.userId);

      logger.debug('Usage logged successfully', {
        userId: data.userId,
        actionType: data.actionType,
        cost: data.costUsd,
      });

      return usageLog;
    } catch (error) {
      logger.error('Failed to log usage:', error);
      throw error;
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
      return await this.usageLogRepository.getUserUsageStats(userId, startDate, endDate);
    } catch (error) {
      logger.error('Failed to get user usage stats:', error);
      throw error;
    }
  }

  /**
   * Generate cost report for a user
   */
  async generateCostReport(
    userId: number,
    period: 'daily' | 'weekly' | 'monthly',
    date?: Date
  ): Promise<CostReport> {
    try {
      const { startDate, endDate } = this.calculateDateRange(period, date);

      const [summary, dailyBreakdown, conversationBreakdown] = await Promise.all([
        this.usageLogRepository.getUserUsageStats(userId, startDate, endDate),
        this.usageLogRepository.getDailyCostBreakdown(userId, startDate, endDate),
        this.usageLogRepository.getConversationCostBreakdown(userId, startDate, endDate),
      ]);

      return {
        period: {
          start: startDate,
          end: endDate,
          type: period,
        },
        summary,
        dailyBreakdown,
        conversationBreakdown,
      };
    } catch (error) {
      logger.error('Failed to generate cost report:', error);
      throw error;
    }
  }

  /**
   * Check if user is within cost limits
   */
  async checkCostLimits(userId: number): Promise<CostLimitStatus> {
    try {
      const now = new Date();
      const limits = this.config.limits;
      
      // Check daily limit
      if (limits.daily) {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        const dailyCost = await this.usageLogRepository.getUserTotalCost(
          userId,
          startOfDay,
          endOfDay
        );

        const status = this.evaluateCostLimit(dailyCost, limits.daily, limits.warningThreshold);
        
        if (!status.isWithinLimit) {
          await this.handleCostLimitExceeded(userId, 'daily', dailyCost, limits.daily);
        } else if (status.isWarning) {
          await this.handleCostWarning(userId, 'daily', dailyCost, limits.daily);
        }

        return status;
      }

      // Check weekly limit
      if (limits.weekly) {
        const startOfWeek = this.getStartOfWeek(now);
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        
        const weeklyCost = await this.usageLogRepository.getUserTotalCost(
          userId,
          startOfWeek,
          endOfWeek
        );

        const status = this.evaluateCostLimit(weeklyCost, limits.weekly, limits.warningThreshold);
        
        if (!status.isWithinLimit) {
          await this.handleCostLimitExceeded(userId, 'weekly', weeklyCost, limits.weekly);
        } else if (status.isWarning) {
          await this.handleCostWarning(userId, 'weekly', weeklyCost, limits.weekly);
        }

        return status;
      }

      // Check monthly limit
      if (limits.monthly) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const monthlyCost = await this.usageLogRepository.getUserTotalCost(
          userId,
          startOfMonth,
          endOfMonth
        );

        const status = this.evaluateCostLimit(monthlyCost, limits.monthly, limits.warningThreshold);
        
        if (!status.isWithinLimit) {
          await this.handleCostLimitExceeded(userId, 'monthly', monthlyCost, limits.monthly);
        } else if (status.isWarning) {
          await this.handleCostWarning(userId, 'monthly', monthlyCost, limits.monthly);
        }

        return status;
      }

      // No limits configured
      return {
        isWithinLimit: true,
        currentCost: 0,
        isWarning: false,
      };
    } catch (error) {
      logger.error('Failed to check cost limits:', error);
      // Return safe default to not block operations
      return {
        isWithinLimit: true,
        currentCost: 0,
        isWarning: false,
      };
    }
  }

  /**
   * Get conversation cost summary
   */
  async getConversationCost(conversationId: number): Promise<number> {
    try {
      return await this.usageLogRepository.getConversationTotalCost(conversationId);
    } catch (error) {
      logger.error('Failed to get conversation cost:', error);
      throw error;
    }
  }

  /**
   * Get user's usage logs with pagination
   */
  async getUserUsageLogs(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      actionType?: string;
      conversationId?: number;
    } = {}
  ): Promise<{ logs: UsageLog[]; total: number }> {
    try {
      const [logs, total] = await Promise.all([
        this.usageLogRepository.findByUserId(userId, options),
        this.usageLogRepository.countByUserId(userId, options),
      ]);

      return { logs, total };
    } catch (error) {
      logger.error('Failed to get user usage logs:', error);
      throw error;
    }
  }

  /**
   * Calculate date range for different periods
   */
  private calculateDateRange(
    period: 'daily' | 'weekly' | 'monthly',
    date: Date = new Date()
  ): { startDate: Date; endDate: Date } {
    const now = date;

    switch (period) {
      case 'daily':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
        return { startDate: startOfDay, endDate: endOfDay };

      case 'weekly':
        const startOfWeek = this.getStartOfWeek(now);
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        return { startDate: startOfWeek, endDate: endOfWeek };

      case 'monthly':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { startDate: startOfMonth, endDate: endOfMonth };

      default:
        throw new ValidationError(`Invalid period: ${period}`);
    }
  }

  /**
   * Get start of week (Monday)
   */
  private getStartOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(date.getFullYear(), date.getMonth(), diff);
  }

  /**
   * Evaluate if cost is within limit and if warning should be shown
   */
  private evaluateCostLimit(
    currentCost: number,
    limit: number,
    warningThreshold: number = 80
  ): CostLimitStatus {
    const percentage = (currentCost / limit) * 100;
    
    return {
      isWithinLimit: currentCost <= limit,
      currentCost,
      limit,
      warningThreshold,
      isWarning: percentage >= warningThreshold && currentCost <= limit,
    };
  }

  /**
   * Handle cost limit exceeded
   */
  private async handleCostLimitExceeded(
    userId: number,
    period: string,
    currentCost: number,
    limit: number
  ): Promise<void> {
    logger.warn(`Cost limit exceeded for user ${userId}`, {
      userId,
      period,
      currentCost,
      limit,
      percentage: (currentCost / limit) * 100,
    });

    // Send alert if webhook is configured
    if (this.config.alertWebhookUrl) {
      await this.sendCostAlert(userId, period, currentCost, limit, 'exceeded');
    }
  }

  /**
   * Handle cost warning
   */
  private async handleCostWarning(
    userId: number,
    period: string,
    currentCost: number,
    limit: number
  ): Promise<void> {
    logger.info(`Cost warning for user ${userId}`, {
      userId,
      period,
      currentCost,
      limit,
      percentage: (currentCost / limit) * 100,
    });

    // Send warning if webhook is configured
    if (this.config.alertWebhookUrl) {
      await this.sendCostAlert(userId, period, currentCost, limit, 'warning');
    }
  }

  /**
   * Send cost alert to webhook
   */
  private async sendCostAlert(
    userId: number,
    period: string,
    currentCost: number,
    limit: number,
    type: 'warning' | 'exceeded'
  ): Promise<void> {
    try {
      const payload = {
        type,
        userId,
        period,
        currentCost,
        limit,
        percentage: (currentCost / limit) * 100,
        timestamp: new Date().toISOString(),
      };

      // In a real implementation, you would send this to your webhook URL
      // For now, just log it
      logger.info('Cost alert would be sent to webhook:', payload);
      
      // Example implementation:
      // await fetch(this.config.alertWebhookUrl!, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });
    } catch (error) {
      logger.error('Failed to send cost alert:', error);
    }
  }

  /**
   * Clean up old usage logs (for maintenance)
   */
  async cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // This would need to be implemented in the repository
      // For now, just log the intention
      logger.info(`Would clean up usage logs older than ${cutoffDate.toISOString()}`);
      
      return 0; // Return number of deleted records
    } catch (error) {
      logger.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }
}