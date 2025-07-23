import { CostTrackingService } from '../../src/services/CostTrackingService';
import { RepositoryFactory } from '../../src/repositories';
import { environment } from '../../src/config/environment';
import { AIResponse, TokenUsage } from '../../src/models/AI';
import { UsageLog, CreateUsageLogRequest } from '../../src/models/UsageLog';

// Mock the repositories
jest.mock('../../src/repositories');
jest.mock('../../src/config/environment');

describe('CostTrackingService', () => {
  let costTrackingService: CostTrackingService;
  let mockUsageLogRepository: any;
  let mockConversationRepository: any;

  const mockUsageLog: UsageLog = {
    id: 1,
    userId: 1,
    conversationId: 1,
    actionType: 'message_received',
    model: 'gpt-4o-mini',
    tokensUsed: 100,
    costUsd: 0.01,
    metadata: { inputTokens: 50, outputTokens: 50 },
    createdAt: new Date(),
  };

  const mockAIResponse: AIResponse = {
    content: 'Test response',
    model: 'gpt-4o-mini',
    usage: {
      inputTokens: 50,
      outputTokens: 50,
      totalTokens: 100,
    },
    cost: 0.01,
    finishReason: 'stop',
    id: 'test-id',
    created: Date.now(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock environment
    (environment as any).costTracking = {
      enabled: true,
      dailyLimit: 10.0,
      weeklyLimit: 50.0,
      monthlyLimit: 200.0,
      warningThreshold: 80,
    };

    // Mock repositories
    mockUsageLogRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      getUserUsageStats: jest.fn(),
      getDailyCostBreakdown: jest.fn(),
      getConversationCostBreakdown: jest.fn(),
      getUserTotalCost: jest.fn(),
      getConversationTotalCost: jest.fn(),
      countByUserId: jest.fn(),
    };

    mockConversationRepository = {
      updateTotalCost: jest.fn(),
    };

    (RepositoryFactory.getUsageLogRepository as jest.Mock).mockReturnValue(mockUsageLogRepository);
    (RepositoryFactory.getConversationRepository as jest.Mock).mockReturnValue(mockConversationRepository);

    costTrackingService = new CostTrackingService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logAIUsage', () => {
    it('should log AI usage successfully', async () => {
      mockUsageLogRepository.create.mockResolvedValue(mockUsageLog);
      mockUsageLogRepository.getUserTotalCost.mockResolvedValue(5.0);

      const result = await costTrackingService.logAIUsage(
        1,
        1,
        mockAIResponse,
        'message_received'
      );

      expect(mockUsageLogRepository.create).toHaveBeenCalledWith({
        userId: 1,
        conversationId: 1,
        actionType: 'message_received',
        model: 'gpt-4o-mini',
        tokensUsed: 100,
        costUsd: 0.01,
        metadata: {
          inputTokens: 50,
          outputTokens: 50,
          finishReason: 'stop',
          responseId: 'test-id',
          responseCreated: mockAIResponse.created,
        },
      });

      expect(mockConversationRepository.updateTotalCost).toHaveBeenCalledWith('1', 0.01);
      expect(result).toEqual(mockUsageLog);
    });

    it('should skip logging when cost tracking is disabled', async () => {
      (environment as any).costTracking.enabled = false;
      costTrackingService = new CostTrackingService();

      const result = await costTrackingService.logAIUsage(1, 1, mockAIResponse);

      expect(mockUsageLogRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle errors gracefully and not throw', async () => {
      mockUsageLogRepository.create.mockRejectedValue(new Error('Database error'));

      const result = await costTrackingService.logAIUsage(1, 1, mockAIResponse);

      expect(result).toEqual({});
    });
  });

  describe('logUsage', () => {
    it('should log general usage successfully', async () => {
      const usageData: CreateUsageLogRequest = {
        userId: 1,
        actionType: 'persona_used',
        tokensUsed: 0,
        costUsd: 0,
      };

      mockUsageLogRepository.create.mockResolvedValue(mockUsageLog);
      mockUsageLogRepository.getUserTotalCost.mockResolvedValue(5.0);

      const result = await costTrackingService.logUsage(usageData);

      expect(mockUsageLogRepository.create).toHaveBeenCalledWith(usageData);
      expect(result).toEqual(mockUsageLog);
    });
  });

  describe('getUserUsageStats', () => {
    it('should return user usage statistics', async () => {
      const mockStats = {
        totalCost: 25.50,
        totalTokens: 10000,
        totalRequests: 50,
        averageCostPerRequest: 0.51,
        averageTokensPerRequest: 200,
        modelBreakdown: [
          {
            model: 'gpt-4o-mini',
            requests: 30,
            tokens: 6000,
            cost: 15.30,
            percentage: 60,
          },
          {
            model: 'gpt-4o',
            requests: 20,
            tokens: 4000,
            cost: 10.20,
            percentage: 40,
          },
        ],
      };

      mockUsageLogRepository.getUserUsageStats.mockResolvedValue(mockStats);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await costTrackingService.getUserUsageStats(1, startDate, endDate);

      expect(mockUsageLogRepository.getUserUsageStats).toHaveBeenCalledWith(1, startDate, endDate);
      expect(result).toEqual(mockStats);
    });
  });

  describe('generateCostReport', () => {
    it('should generate a daily cost report', async () => {
      const mockStats = {
        totalCost: 5.25,
        totalTokens: 1000,
        totalRequests: 10,
        averageCostPerRequest: 0.525,
        averageTokensPerRequest: 100,
        modelBreakdown: [],
      };

      const mockDailyBreakdown = [
        {
          date: '2024-01-15',
          cost: 5.25,
          tokens: 1000,
          requests: 10,
        },
      ];

      const mockConversationBreakdown = [
        {
          conversationId: 1,
          conversationTitle: 'Test Conversation',
          cost: 5.25,
          tokens: 1000,
          requests: 10,
          lastActivity: new Date(),
        },
      ];

      mockUsageLogRepository.getUserUsageStats.mockResolvedValue(mockStats);
      mockUsageLogRepository.getDailyCostBreakdown.mockResolvedValue(mockDailyBreakdown);
      mockUsageLogRepository.getConversationCostBreakdown.mockResolvedValue(mockConversationBreakdown);

      const result = await costTrackingService.generateCostReport(1, 'daily', new Date('2024-01-15'));

      expect(result.period.type).toBe('daily');
      expect(result.summary).toEqual(mockStats);
      expect(result.dailyBreakdown).toEqual(mockDailyBreakdown);
      expect(result.conversationBreakdown).toEqual(mockConversationBreakdown);
    });

    it('should generate a weekly cost report', async () => {
      mockUsageLogRepository.getUserUsageStats.mockResolvedValue({
        totalCost: 35.75,
        totalTokens: 7000,
        totalRequests: 70,
        averageCostPerRequest: 0.511,
        averageTokensPerRequest: 100,
        modelBreakdown: [],
      });
      mockUsageLogRepository.getDailyCostBreakdown.mockResolvedValue([]);
      mockUsageLogRepository.getConversationCostBreakdown.mockResolvedValue([]);

      const result = await costTrackingService.generateCostReport(1, 'weekly');

      expect(result.period.type).toBe('weekly');
      expect(result.summary.totalCost).toBe(35.75);
    });

    it('should generate a monthly cost report', async () => {
      mockUsageLogRepository.getUserUsageStats.mockResolvedValue({
        totalCost: 150.25,
        totalTokens: 30000,
        totalRequests: 300,
        averageCostPerRequest: 0.501,
        averageTokensPerRequest: 100,
        modelBreakdown: [],
      });
      mockUsageLogRepository.getDailyCostBreakdown.mockResolvedValue([]);
      mockUsageLogRepository.getConversationCostBreakdown.mockResolvedValue([]);

      const result = await costTrackingService.generateCostReport(1, 'monthly');

      expect(result.period.type).toBe('monthly');
      expect(result.summary.totalCost).toBe(150.25);
    });
  });

  describe('checkCostLimits', () => {
    it('should return within limits when cost is below daily limit', async () => {
      mockUsageLogRepository.getUserTotalCost.mockResolvedValue(5.0);

      const result = await costTrackingService.checkCostLimits(1);

      expect(result.isWithinLimit).toBe(true);
      expect(result.currentCost).toBe(5.0);
      expect(result.limit).toBe(10.0);
      expect(result.isWarning).toBe(false);
    });

    it('should return warning when cost exceeds warning threshold', async () => {
      mockUsageLogRepository.getUserTotalCost.mockResolvedValue(8.5); // 85% of 10.0 limit

      const result = await costTrackingService.checkCostLimits(1);

      expect(result.isWithinLimit).toBe(true);
      expect(result.currentCost).toBe(8.5);
      expect(result.limit).toBe(10.0);
      expect(result.isWarning).toBe(true);
    });

    it('should return exceeded when cost is above daily limit', async () => {
      mockUsageLogRepository.getUserTotalCost.mockResolvedValue(12.0);

      const result = await costTrackingService.checkCostLimits(1);

      expect(result.isWithinLimit).toBe(false);
      expect(result.currentCost).toBe(12.0);
      expect(result.limit).toBe(10.0);
      expect(result.isWarning).toBe(false);
    });

    it('should check weekly limits when no daily limit is set', async () => {
      (environment as any).costTracking.dailyLimit = undefined;
      costTrackingService = new CostTrackingService();
      
      mockUsageLogRepository.getUserTotalCost.mockResolvedValue(25.0);

      const result = await costTrackingService.checkCostLimits(1);

      expect(result.isWithinLimit).toBe(true);
      expect(result.currentCost).toBe(25.0);
      expect(result.limit).toBe(50.0);
    });

    it('should check monthly limits when no daily or weekly limits are set', async () => {
      (environment as any).costTracking.dailyLimit = undefined;
      (environment as any).costTracking.weeklyLimit = undefined;
      costTrackingService = new CostTrackingService();
      
      mockUsageLogRepository.getUserTotalCost.mockResolvedValue(100.0);

      const result = await costTrackingService.checkCostLimits(1);

      expect(result.isWithinLimit).toBe(true);
      expect(result.currentCost).toBe(100.0);
      expect(result.limit).toBe(200.0);
    });

    it('should return safe default when no limits are configured', async () => {
      (environment as any).costTracking.dailyLimit = undefined;
      (environment as any).costTracking.weeklyLimit = undefined;
      (environment as any).costTracking.monthlyLimit = undefined;
      costTrackingService = new CostTrackingService();

      const result = await costTrackingService.checkCostLimits(1);

      expect(result.isWithinLimit).toBe(true);
      expect(result.currentCost).toBe(0);
      expect(result.limit).toBeUndefined();
      expect(result.isWarning).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockUsageLogRepository.getUserTotalCost.mockRejectedValue(new Error('Database error'));

      const result = await costTrackingService.checkCostLimits(1);

      expect(result.isWithinLimit).toBe(true);
      expect(result.currentCost).toBe(0);
      expect(result.isWarning).toBe(false);
    });
  });

  describe('getConversationCost', () => {
    it('should return conversation total cost', async () => {
      mockUsageLogRepository.getConversationTotalCost.mockResolvedValue(15.75);

      const result = await costTrackingService.getConversationCost(1);

      expect(mockUsageLogRepository.getConversationTotalCost).toHaveBeenCalledWith(1);
      expect(result).toBe(15.75);
    });
  });

  describe('getUserUsageLogs', () => {
    it('should return paginated usage logs', async () => {
      const mockLogs = [mockUsageLog];
      const mockTotal = 1;

      mockUsageLogRepository.findByUserId.mockResolvedValue(mockLogs);
      mockUsageLogRepository.countByUserId.mockResolvedValue(mockTotal);

      const options = {
        limit: 10,
        offset: 0,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await costTrackingService.getUserUsageLogs(1, options);

      expect(mockUsageLogRepository.findByUserId).toHaveBeenCalledWith(1, options);
      expect(mockUsageLogRepository.countByUserId).toHaveBeenCalledWith(1, options);
      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(mockTotal);
    });
  });
});