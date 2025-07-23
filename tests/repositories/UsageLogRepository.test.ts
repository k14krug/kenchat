import { UsageLogRepository } from '../../src/repositories/UsageLogRepository';
import { db } from '../../src/database/connection';
import { CreateUsageLogRequest, UsageLogRow } from '../../src/models/UsageLog';

// Mock the database connection
jest.mock('../../src/database/connection');

describe('UsageLogRepository', () => {
  let usageLogRepository: UsageLogRepository;
  let mockDb: any;

  const mockUsageLogRow: UsageLogRow = {
    id: 1,
    user_id: 1,
    conversation_id: 1,
    action_type: 'message_received',
    model: 'gpt-4o-mini',
    tokens_used: 100,
    cost_usd: '0.010000',
    metadata: '{"inputTokens":50,"outputTokens":50}',
    created_at: new Date(),
  };

  const mockCreateRequest: CreateUsageLogRequest = {
    userId: 1,
    conversationId: 1,
    actionType: 'message_received',
    model: 'gpt-4o-mini',
    tokensUsed: 100,
    costUsd: 0.01,
    metadata: { inputTokens: 50, outputTokens: 50 },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      execute: jest.fn(),
    };

    (db as any) = mockDb;
    usageLogRepository = new UsageLogRepository();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a new usage log entry', async () => {
      const mockResult = { insertId: 1, affectedRows: 1 };
      mockDb.execute
        .mockResolvedValueOnce([mockResult]) // INSERT
        .mockResolvedValueOnce([[mockUsageLogRow]]); // SELECT for findById

      const result = await usageLogRepository.create(mockCreateRequest);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage_logs'),
        [1, 1, 'message_received', 'gpt-4o-mini', 100, 0.01, '{"inputTokens":50,"outputTokens":50}']
      );

      expect(result.id).toBe(1);
      expect(result.userId).toBe(1);
      expect(result.actionType).toBe('message_received');
    });

    it('should handle null values correctly', async () => {
      const requestWithNulls: CreateUsageLogRequest = {
        userId: 1,
        actionType: 'persona_used',
        tokensUsed: 0,
        costUsd: 0,
      };

      const mockResult = { insertId: 2, affectedRows: 1 };
      const mockRowWithNulls = { ...mockUsageLogRow, id: 2, conversation_id: null, model: null, metadata: null };
      
      mockDb.execute
        .mockResolvedValueOnce([mockResult])
        .mockResolvedValueOnce([[mockRowWithNulls]]);

      const result = await usageLogRepository.create(requestWithNulls);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage_logs'),
        [1, null, 'persona_used', null, 0, 0, null]
      );

      expect(result.conversationId).toBeUndefined();
      expect(result.model).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it('should throw error when insert fails', async () => {
      const mockResult = { insertId: null, affectedRows: 0 };
      mockDb.execute.mockResolvedValueOnce([mockResult]);

      await expect(usageLogRepository.create(mockCreateRequest)).rejects.toThrow('Failed to create usage log entry');
    });
  });

  describe('findByUserId', () => {
    it('should find usage logs by user ID', async () => {
      mockDb.execute.mockResolvedValueOnce([[mockUsageLogRow]]);

      const result = await usageLogRepository.findByUserId(1);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM usage_logs WHERE user_id = ?'),
        [1]
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(1);
    });

    it('should apply date filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      mockDb.execute.mockResolvedValueOnce([[mockUsageLogRow]]);

      await usageLogRepository.findByUserId(1, { startDate, endDate });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('AND created_at >= ? AND created_at <= ?'),
        [1, startDate, endDate]
      );
    });

    it('should apply action type filter', async () => {
      mockDb.execute.mockResolvedValueOnce([[mockUsageLogRow]]);

      await usageLogRepository.findByUserId(1, { actionType: 'message_received' });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('AND action_type = ?'),
        [1, 'message_received']
      );
    });

    it('should apply conversation filter', async () => {
      mockDb.execute.mockResolvedValueOnce([[mockUsageLogRow]]);

      await usageLogRepository.findByUserId(1, { conversationId: 5 });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('AND conversation_id = ?'),
        [1, 5]
      );
    });

    it('should apply pagination', async () => {
      mockDb.execute.mockResolvedValueOnce([[mockUsageLogRow]]);

      await usageLogRepository.findByUserId(1, { limit: 10, offset: 20 });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        [1, 10, 20]
      );
    });
  });

  describe('getUserUsageStats', () => {
    it('should return user usage statistics', async () => {
      const mockStatsRow = {
        total_requests: 50,
        total_tokens: 10000,
        total_cost: '25.500000',
        avg_tokens: '200.000000',
        avg_cost: '0.510000',
      };

      const mockModelRows = [
        {
          model: 'gpt-4o-mini',
          requests: 30,
          tokens: 6000,
          cost: '15.300000',
        },
        {
          model: 'gpt-4o',
          requests: 20,
          tokens: 4000,
          cost: '10.200000',
        },
      ];

      mockDb.execute
        .mockResolvedValueOnce([[mockStatsRow]]) // Overall stats
        .mockResolvedValueOnce([mockModelRows]); // Model breakdown

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await usageLogRepository.getUserUsageStats(1, startDate, endDate);

      expect(result.totalCost).toBe(25.5);
      expect(result.totalTokens).toBe(10000);
      expect(result.totalRequests).toBe(50);
      expect(result.averageCostPerRequest).toBe(0.51);
      expect(result.averageTokensPerRequest).toBe(200);
      expect(result.modelBreakdown).toHaveLength(2);
      expect(result.modelBreakdown[0].model).toBe('gpt-4o-mini');
      expect(result.modelBreakdown[0].percentage).toBe(60);
    });

    it('should handle zero total cost for percentage calculation', async () => {
      const mockStatsRow = {
        total_requests: 1,
        total_tokens: 100,
        total_cost: '0.000000',
        avg_tokens: '100.000000',
        avg_cost: '0.000000',
      };

      const mockModelRows = [
        {
          model: 'gpt-4o-mini',
          requests: 1,
          tokens: 100,
          cost: '0.000000',
        },
      ];

      mockDb.execute
        .mockResolvedValueOnce([[mockStatsRow]])
        .mockResolvedValueOnce([mockModelRows]);

      const result = await usageLogRepository.getUserUsageStats(1, new Date(), new Date());

      expect(result.modelBreakdown[0].percentage).toBe(0);
    });
  });

  describe('getDailyCostBreakdown', () => {
    it('should return daily cost breakdown', async () => {
      const mockRows = [
        {
          date: '2024-01-15',
          cost: '5.250000',
          tokens: 1000,
          requests: 10,
        },
        {
          date: '2024-01-16',
          cost: '3.750000',
          tokens: 750,
          requests: 8,
        },
      ];

      mockDb.execute.mockResolvedValueOnce([mockRows]);

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-16');
      const result = await usageLogRepository.getDailyCostBreakdown(1, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].cost).toBe(5.25);
      expect(result[0].tokens).toBe(1000);
      expect(result[0].requests).toBe(10);
    });
  });

  describe('getConversationCostBreakdown', () => {
    it('should return conversation cost breakdown', async () => {
      const mockRows = [
        {
          conversation_id: 1,
          conversation_title: 'Test Conversation 1',
          cost: '15.750000',
          tokens: 3000,
          requests: 25,
          last_activity: new Date('2024-01-15T10:30:00Z'),
        },
        {
          conversation_id: 2,
          conversation_title: 'Test Conversation 2',
          cost: '9.250000',
          tokens: 1800,
          requests: 15,
          last_activity: new Date('2024-01-14T14:20:00Z'),
        },
      ];

      mockDb.execute.mockResolvedValueOnce([mockRows]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await usageLogRepository.getConversationCostBreakdown(1, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].conversationId).toBe(1);
      expect(result[0].conversationTitle).toBe('Test Conversation 1');
      expect(result[0].cost).toBe(15.75);
      expect(result[0].tokens).toBe(3000);
      expect(result[0].requests).toBe(25);
    });
  });

  describe('getUserTotalCost', () => {
    it('should return user total cost', async () => {
      const mockRow = { total_cost: '45.750000' };
      mockDb.execute.mockResolvedValueOnce([[mockRow]]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await usageLogRepository.getUserTotalCost(1, startDate, endDate);

      expect(result).toBe(45.75);
    });

    it('should return 0 when total_cost is null', async () => {
      const mockRow = { total_cost: null };
      mockDb.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await usageLogRepository.getUserTotalCost(1, new Date(), new Date());

      expect(result).toBe(0);
    });
  });

  describe('getConversationTotalCost', () => {
    it('should return conversation total cost', async () => {
      const mockRow = { total_cost: '12.500000' };
      mockDb.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await usageLogRepository.getConversationTotalCost(1);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE conversation_id = ?'),
        [1]
      );
      expect(result).toBe(12.5);
    });
  });

  describe('deleteByConversationId', () => {
    it('should delete usage logs by conversation ID', async () => {
      const mockResult = { affectedRows: 5 };
      mockDb.execute.mockResolvedValueOnce([mockResult]);

      await usageLogRepository.deleteByConversationId(1);

      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM usage_logs WHERE conversation_id = ?',
        [1]
      );
    });
  });

  describe('deleteByUserId', () => {
    it('should delete usage logs by user ID', async () => {
      const mockResult = { affectedRows: 25 };
      mockDb.execute.mockResolvedValueOnce([mockResult]);

      await usageLogRepository.deleteByUserId(1);

      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM usage_logs WHERE user_id = ?',
        [1]
      );
    });
  });

  describe('countByUserId', () => {
    it('should count usage logs by user ID', async () => {
      const mockRow = { count: 42 };
      mockDb.execute.mockResolvedValueOnce([[mockRow]]);

      const result = await usageLogRepository.countByUserId(1);

      expect(result).toBe(42);
    });

    it('should apply filters when counting', async () => {
      const mockRow = { count: 15 };
      mockDb.execute.mockResolvedValueOnce([[mockRow]]);

      const options = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        actionType: 'message_received',
        conversationId: 5,
      };

      const result = await usageLogRepository.countByUserId(1, options);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('AND created_at >= ? AND created_at <= ? AND action_type = ? AND conversation_id = ?'),
        [1, options.startDate, options.endDate, 'message_received', 5]
      );
      expect(result).toBe(15);
    });
  });

  describe('mapRowToModel', () => {
    it('should map database row to model correctly', async () => {
      mockDb.execute.mockResolvedValueOnce([[mockUsageLogRow]]);

      const result = await usageLogRepository.findByUserId(1);
      const mappedModel = result[0];

      expect(mappedModel.id).toBe(mockUsageLogRow.id);
      expect(mappedModel.userId).toBe(mockUsageLogRow.user_id);
      expect(mappedModel.conversationId).toBe(mockUsageLogRow.conversation_id);
      expect(mappedModel.actionType).toBe(mockUsageLogRow.action_type);
      expect(mappedModel.model).toBe(mockUsageLogRow.model);
      expect(mappedModel.tokensUsed).toBe(mockUsageLogRow.tokens_used);
      expect(mappedModel.costUsd).toBe(0.01);
      expect(mappedModel.metadata).toEqual({ inputTokens: 50, outputTokens: 50 });
      expect(mappedModel.createdAt).toBe(mockUsageLogRow.created_at);
    });

    it('should handle null values in row mapping', async () => {
      const rowWithNulls = {
        ...mockUsageLogRow,
        conversation_id: null,
        model: null,
        metadata: null,
      };

      mockDb.execute.mockResolvedValueOnce([[rowWithNulls]]);

      const result = await usageLogRepository.findByUserId(1);
      const mappedModel = result[0];

      expect(mappedModel.conversationId).toBeUndefined();
      expect(mappedModel.model).toBeUndefined();
      expect(mappedModel.metadata).toBeUndefined();
    });
  });
});