import { Request, Response } from 'express';
import { CostTrackingController } from '../../src/controllers/CostTrackingController';
import { CostTrackingService } from '../../src/services/CostTrackingService';

// Mock the CostTrackingService
jest.mock('../../src/services/CostTrackingService');

describe('CostTrackingController', () => {
  let costTrackingController: CostTrackingController;
  let mockCostTrackingService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CostTrackingService
    mockCostTrackingService = {
      getUserUsageStats: jest.fn(),
      generateCostReport: jest.fn(),
      checkCostLimits: jest.fn(),
      getConversationCost: jest.fn(),
      getUserUsageLogs: jest.fn(),
    };

    (CostTrackingService as any).mockImplementation(() => mockCostTrackingService);

    costTrackingController = new CostTrackingController();

    // Mock Express Request and Response
    mockRequest = {
      user: { 
        id: '1',
        username: 'testuser',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      query: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUserUsageStats', () => {
    it('should return user usage statistics', async () => {
      const mockStats = {
        totalCost: 25.50,
        totalTokens: 10000,
        totalRequests: 50,
        averageCostPerRequest: 0.51,
        averageTokensPerRequest: 200,
        modelBreakdown: [],
      };

      mockRequest.query = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z',
      };

      mockCostTrackingService.getUserUsageStats.mockResolvedValue(mockStats);

      await costTrackingController.getUserUsageStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.getUserUsageStats).toHaveBeenCalledWith(
        1,
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-01-31T23:59:59.999Z')
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await costTrackingController.getUserUsageStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not authenticated',
      });
    });

    it('should return 400 when startDate or endDate is missing', async () => {
      mockRequest.query = { startDate: '2024-01-01' };

      await costTrackingController.getUserUsageStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'startDate and endDate query parameters are required',
      });
    });

    it('should return 400 when date format is invalid', async () => {
      mockRequest.query = {
        startDate: 'invalid-date',
        endDate: '2024-01-31',
      };

      await costTrackingController.getUserUsageStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid date format',
      });
    });

    it('should handle service errors', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      mockCostTrackingService.getUserUsageStats.mockRejectedValue(
        new Error('Service error')
      );

      await costTrackingController.getUserUsageStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve usage statistics',
      });
    });
  });

  describe('generateCostReport', () => {
    it('should generate a daily cost report', async () => {
      const mockReport = {
        period: {
          start: new Date('2024-01-15'),
          end: new Date('2024-01-15T23:59:59.999Z'),
          type: 'daily' as const,
        },
        summary: {
          totalCost: 5.25,
          totalTokens: 1000,
          totalRequests: 10,
          averageCostPerRequest: 0.525,
          averageTokensPerRequest: 100,
          modelBreakdown: [],
        },
        dailyBreakdown: [],
        conversationBreakdown: [],
      };

      mockRequest.query = {
        period: 'daily',
        date: '2024-01-15',
      };

      mockCostTrackingService.generateCostReport.mockResolvedValue(mockReport);

      await costTrackingController.generateCostReport(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.generateCostReport).toHaveBeenCalledWith(
        1,
        'daily',
        new Date('2024-01-15')
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport,
      });
    });

    it('should generate report without date parameter', async () => {
      mockRequest.query = { period: 'weekly' };

      const mockReport = {
        period: { start: new Date(), end: new Date(), type: 'weekly' as const },
        summary: { totalCost: 0, totalTokens: 0, totalRequests: 0, averageCostPerRequest: 0, averageTokensPerRequest: 0, modelBreakdown: [] },
        dailyBreakdown: [],
        conversationBreakdown: [],
      };

      mockCostTrackingService.generateCostReport.mockResolvedValue(mockReport);

      await costTrackingController.generateCostReport(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.generateCostReport).toHaveBeenCalledWith(
        1,
        'weekly',
        undefined
      );
    });

    it('should return 400 when period is invalid', async () => {
      mockRequest.query = { period: 'invalid' };

      await costTrackingController.generateCostReport(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'period query parameter is required and must be daily, weekly, or monthly',
      });
    });

    it('should return 400 when date format is invalid', async () => {
      mockRequest.query = {
        period: 'daily',
        date: 'invalid-date',
      };

      await costTrackingController.generateCostReport(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid date format',
      });
    });
  });

  describe('checkCostLimits', () => {
    it('should return cost limit status', async () => {
      const mockStatus = {
        isWithinLimit: true,
        currentCost: 5.0,
        limit: 10.0,
        warningThreshold: 80,
        isWarning: false,
      };

      mockCostTrackingService.checkCostLimits.mockResolvedValue(mockStatus);

      await costTrackingController.checkCostLimits(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.checkCostLimits).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus,
      });
    });
  });

  describe('getConversationCost', () => {
    it('should return conversation cost', async () => {
      mockRequest.params = { conversationId: '5' };
      mockCostTrackingService.getConversationCost.mockResolvedValue(15.75);

      await costTrackingController.getConversationCost(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.getConversationCost).toHaveBeenCalledWith(5);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          conversationId: 5,
          totalCost: 15.75,
        },
      });
    });

    it('should return 400 when conversationId is invalid', async () => {
      mockRequest.params = { conversationId: 'invalid' };

      await costTrackingController.getConversationCost(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Valid conversation ID is required',
      });
    });
  });

  describe('getUserUsageLogs', () => {
    it('should return paginated usage logs', async () => {
      const mockResult = {
        logs: [
          {
            id: 1,
            userId: 1,
            actionType: 'message_received',
            tokensUsed: 100,
            costUsd: 0.01,
            createdAt: new Date(),
          },
        ],
        total: 1,
      };

      mockRequest.query = {
        page: '1',
        limit: '10',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      mockCostTrackingService.getUserUsageLogs.mockResolvedValue(mockResult);

      await costTrackingController.getUserUsageLogs(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.getUserUsageLogs).toHaveBeenCalledWith(1, {
        limit: 10,
        offset: 0,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: mockResult.logs,
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
    });

    it('should use default pagination values', async () => {
      const mockResult = { logs: [], total: 0 };
      mockCostTrackingService.getUserUsageLogs.mockResolvedValue(mockResult);

      await costTrackingController.getUserUsageLogs(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.getUserUsageLogs).toHaveBeenCalledWith(1, {
        limit: 50,
        offset: 0,
      });
    });

    it('should return 400 when page is invalid', async () => {
      mockRequest.query = { page: '0' };

      await costTrackingController.getUserUsageLogs(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid page number',
      });
    });

    it('should return 400 when limit is invalid', async () => {
      mockRequest.query = { limit: '101' };

      await costTrackingController.getUserUsageLogs(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid limit (must be 1-100)',
      });
    });

    it('should apply filters correctly', async () => {
      mockRequest.query = {
        actionType: 'message_received',
        conversationId: '5',
      };

      const mockResult = { logs: [], total: 0 };
      mockCostTrackingService.getUserUsageLogs.mockResolvedValue(mockResult);

      await costTrackingController.getUserUsageLogs(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCostTrackingService.getUserUsageLogs).toHaveBeenCalledWith(1, {
        limit: 50,
        offset: 0,
        actionType: 'message_received',
        conversationId: 5,
      });
    });
  });

  describe('getPricingInfo', () => {
    it('should return pricing information', async () => {
      await costTrackingController.getPricingInfo(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          models: expect.any(Array),
          pricing: expect.any(Object),
          lastUpdated: expect.any(String),
        }),
      });
    });

    it('should handle import errors', async () => {
      // Mock dynamic import to throw error
      jest.doMock('../../src/models/AI', () => {
        throw new Error('Import error');
      });

      await costTrackingController.getPricingInfo(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve pricing information',
      });
    });
  });
});