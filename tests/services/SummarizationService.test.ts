import { SummarizationService, SummarizationConfig } from '../../src/services/SummarizationService';
import { SummaryRepository } from '../../src/repositories/SummaryRepository';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { OpenAIService } from '../../src/services/OpenAIService';
import {
  Message,
  Summary,
  CreateSummaryRequest,
  PaginatedResponse,
} from '../../src/models';
import { ValidationError, AIServiceError } from '../../src/utils/errors';

// Mock dependencies
jest.mock('../../src/repositories/SummaryRepository');
jest.mock('../../src/repositories/MessageRepository');
jest.mock('../../src/services/OpenAIService');
jest.mock('../../src/config/logger');

describe('SummarizationService', () => {
  let summarizationService: SummarizationService;
  let mockSummaryRepository: jest.Mocked<SummaryRepository>;
  let mockMessageRepository: jest.Mocked<MessageRepository>;
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  const mockConversationId = 'conv-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    // Create mocked instances
    mockSummaryRepository = new SummaryRepository() as jest.Mocked<SummaryRepository>;
    mockMessageRepository = new MessageRepository() as jest.Mocked<MessageRepository>;
    mockOpenAIService = new OpenAIService() as jest.Mocked<OpenAIService>;

    // Create service instance
    summarizationService = new SummarizationService(
      mockSummaryRepository,
      mockMessageRepository,
      mockOpenAIService
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('shouldSummarize', () => {
    it('should return false for conversations with less than 5 messages', async () => {
      const mockMessages: PaginatedResponse<Message> = {
        data: [
          createMockMessage('msg-1', 'Hello'),
          createMockMessage('msg-2', 'Hi there'),
        ],
        pagination: {
          page: 1,
          limit: 1000,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockMessageRepository.findByConversationId.mockResolvedValue(mockMessages);

      const result = await summarizationService.shouldSummarize(mockConversationId);

      expect(result).toBe(false);
      expect(mockMessageRepository.findByConversationId).toHaveBeenCalledWith(
        mockConversationId,
        {
          limit: 1000,
          sortBy: 'created_at',
          sortOrder: 'ASC',
        }
      );
    });

    it('should return true when token count exceeds threshold', async () => {
      const mockMessages: PaginatedResponse<Message> = {
        data: Array.from({ length: 10 }, (_, i) =>
          createMockMessage(`msg-${i}`, 'A'.repeat(500), 1500) // High token count messages
        ),
        pagination: {
          page: 1,
          limit: 1000,
          total: 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockMessageRepository.findByConversationId.mockResolvedValue(mockMessages);

      const result = await summarizationService.shouldSummarize(mockConversationId);

      expect(result).toBe(true);
    });

    it('should return false when token count is below threshold', async () => {
      const mockMessages: PaginatedResponse<Message> = {
        data: Array.from({ length: 10 }, (_, i) =>
          createMockMessage(`msg-${i}`, 'Short message', 50) // Low token count messages
        ),
        pagination: {
          page: 1,
          limit: 1000,
          total: 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockMessageRepository.findByConversationId.mockResolvedValue(mockMessages);

      const result = await summarizationService.shouldSummarize(mockConversationId);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully and return false', async () => {
      mockMessageRepository.findByConversationId.mockRejectedValue(new Error('Database error'));

      const result = await summarizationService.shouldSummarize(mockConversationId);

      expect(result).toBe(false);
    });

    it('should estimate token count when not provided', async () => {
      const mockMessages: PaginatedResponse<Message> = {
        data: Array.from({ length: 10 }, (_, i) =>
          createMockMessage(`msg-${i}`, 'A'.repeat(2000)) // No tokenCount provided
        ),
        pagination: {
          page: 1,
          limit: 1000,
          total: 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockMessageRepository.findByConversationId.mockResolvedValue(mockMessages);
      mockOpenAIService.estimateTokenCount.mockReturnValue(1500); // Higher token count to exceed threshold

      const result = await summarizationService.shouldSummarize(mockConversationId);

      expect(result).toBe(true);
      expect(mockOpenAIService.estimateTokenCount).toHaveBeenCalledTimes(10);
    });
  });

  describe('summarizeConversation', () => {
    it('should successfully create initial summary', async () => {
      const mockMessages = createMockMessageList(15);
      const mockSummary = createMockSummary('summary-1', mockConversationId);

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(15),
      });
      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);
      mockOpenAIService.generateResponse.mockResolvedValue({
        content: 'Generated summary content',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
        cost: 0.01,
        finishReason: 'stop',
        id: 'response-1',
        created: Date.now(),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(200);
      mockSummaryRepository.createRollingSummary.mockResolvedValue(mockSummary);
      mockMessageRepository.update.mockResolvedValue({} as Message);

      const result = await summarizationService.summarizeConversation(
        mockConversationId,
        mockUserId
      );

      expect(result.summary).toEqual(mockSummary);
      expect(result.summarizedMessageIds).toHaveLength(5); // 15 messages - 10 preserved
      expect(result.preservedMessageIds).toHaveLength(10);
      expect(result.tokensSaved).toBeGreaterThan(0);
      expect(mockSummaryRepository.createRollingSummary).toHaveBeenCalled();
    });

    it('should create rolling summary when existing summary exists', async () => {
      const mockMessages = createMockMessageList(20);
      const existingSummary = createMockSummary('existing-summary', mockConversationId);
      const newSummary = createMockSummary('new-summary', mockConversationId);

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(20),
      });
      mockSummaryRepository.getLatestForConversation.mockResolvedValue(existingSummary);
      mockOpenAIService.generateResponse.mockResolvedValue({
        content: 'Updated rolling summary content',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 1200, outputTokens: 250, totalTokens: 1450 },
        cost: 0.012,
        finishReason: 'stop',
        id: 'response-2',
        created: Date.now(),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(250);
      mockSummaryRepository.createRollingSummary.mockResolvedValue(newSummary);
      mockMessageRepository.update.mockResolvedValue({} as Message);

      const result = await summarizationService.summarizeConversation(
        mockConversationId,
        mockUserId
      );

      expect(result.summary).toEqual(newSummary);
      expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('EXISTING SUMMARY'),
          }),
        ]),
        'gpt-4o-mini',
        expect.any(Object)
      );
    });

    it('should throw ValidationError when no messages found', async () => {
      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: [],
        pagination: createMockPagination(0),
      });

      await expect(
        summarizationService.summarizeConversation(mockConversationId, mockUserId)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when no messages available for summarization', async () => {
      const mockMessages = createMockMessageList(5); // Only 5 messages, all will be preserved
      
      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(5),
      });
      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);

      await expect(
        summarizationService.summarizeConversation(mockConversationId, mockUserId)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle AI service errors', async () => {
      const mockMessages = createMockMessageList(15);

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(15),
      });
      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);
      mockOpenAIService.generateResponse.mockRejectedValue(new Error('AI service error'));

      await expect(
        summarizationService.summarizeConversation(mockConversationId, mockUserId)
      ).rejects.toThrow(AIServiceError);
    });

    it('should preserve user tone and goals in summary', async () => {
      const mockMessages = [
        createMockMessage('msg-1', 'I am frustrated with this issue!', 100, 'user'),
        createMockMessage('msg-2', 'I want to solve this problem quickly', 100, 'user'),
        createMockMessage('msg-3', 'Here is my response', 100, 'assistant'),
        ...createMockMessageList(12, 4), // Additional messages
      ];

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(15),
      });
      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);
      mockOpenAIService.generateResponse.mockResolvedValue({
        content: 'Summary with preserved context',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
        cost: 0.01,
        finishReason: 'stop',
        id: 'response-1',
        created: Date.now(),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(200);
      mockSummaryRepository.createRollingSummary.mockResolvedValue(
        createMockSummary('summary-1', mockConversationId)
      );
      mockMessageRepository.update.mockResolvedValue({} as Message);

      await summarizationService.summarizeConversation(mockConversationId, mockUserId);

      // Verify that the prompt includes user context
      const promptCall = mockOpenAIService.generateResponse.mock.calls[0];
      const prompt = promptCall[0][0].content;
      
      expect(prompt).toContain('User tone: frustrated');
      expect(prompt).toContain('User goals:');
      expect(prompt).toContain('want to solve');
    });
  });

  describe('updateRollingSummary', () => {
    it('should successfully update rolling summary with new messages', async () => {
      const existingSummary = createMockSummary('existing-summary', mockConversationId);
      const newMessages = createMockMessageList(3);
      const updatedSummary = createMockSummary('updated-summary', mockConversationId);

      mockSummaryRepository.getLatestForConversation.mockResolvedValue(existingSummary);
      mockOpenAIService.generateResponse.mockResolvedValue({
        content: 'Updated rolling summary',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 800, outputTokens: 150, totalTokens: 950 },
        cost: 0.008,
        finishReason: 'stop',
        id: 'response-3',
        created: Date.now(),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(150);
      mockSummaryRepository.createRollingSummary.mockResolvedValue(updatedSummary);
      mockMessageRepository.update.mockResolvedValue({} as Message);

      const result = await summarizationService.updateRollingSummary(
        mockConversationId,
        mockUserId,
        newMessages
      );

      expect(result).toEqual(updatedSummary);
      expect(mockSummaryRepository.createRollingSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: mockConversationId,
          content: 'Updated rolling summary',
          messageRangeStart: existingSummary.messageRangeStart,
          messageRangeEnd: newMessages[newMessages.length - 1].id,
          tokenCount: 150,
        })
      );
    });

    it('should throw ValidationError when no existing summary found', async () => {
      const newMessages = createMockMessageList(3);

      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);

      await expect(
        summarizationService.updateRollingSummary(mockConversationId, mockUserId, newMessages)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getConversationContext', () => {
    it('should return summary and recent messages', async () => {
      const mockSummary = createMockSummary('summary-1', mockConversationId);
      const recentMessages = createMockMessageList(5);

      mockSummaryRepository.getLatestForConversation.mockResolvedValue(mockSummary);
      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: recentMessages,
        pagination: createMockPagination(5),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(100);

      const result = await summarizationService.getConversationContext(mockConversationId);

      expect(result.summary).toEqual(mockSummary);
      expect(result.recentMessages).toHaveLength(5);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('should handle conversation without summary', async () => {
      const recentMessages = createMockMessageList(5);

      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);
      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: recentMessages,
        pagination: createMockPagination(5),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(100);

      const result = await summarizationService.getConversationContext(mockConversationId);

      expect(result.summary).toBeUndefined();
      expect(result.recentMessages).toHaveLength(5);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('should filter out summarized messages', async () => {
      const allMessages = [
        ...createMockMessageList(3).map(msg => ({ ...msg, isSummarized: true })),
        ...createMockMessageList(5).map(msg => ({ ...msg, isSummarized: false })),
      ];

      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);
      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: allMessages,
        pagination: createMockPagination(8),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(100);

      const result = await summarizationService.getConversationContext(mockConversationId);

      expect(result.recentMessages).toHaveLength(5);
      expect(result.recentMessages.every(msg => !msg.isSummarized)).toBe(true);
    });
  });

  describe('prompt template management', () => {
    it('should get and update summary prompt template', () => {
      const originalTemplate = summarizationService.getSummaryPromptTemplate();
      expect(originalTemplate).toContain('CONVERSATION TO SUMMARIZE');

      const newTemplate = 'New summary template: {{MESSAGES}}';
      summarizationService.updateSummaryPromptTemplate(newTemplate);

      expect(summarizationService.getSummaryPromptTemplate()).toBe(newTemplate);
    });

    it('should get and update rolling summary prompt template', () => {
      const originalTemplate = summarizationService.getRollingSummaryPromptTemplate();
      expect(originalTemplate).toContain('EXISTING SUMMARY');

      const newTemplate = 'New rolling template: {{EXISTING_SUMMARY}} {{MESSAGES}}';
      summarizationService.updateRollingSummaryPromptTemplate(newTemplate);

      expect(summarizationService.getRollingSummaryPromptTemplate()).toBe(newTemplate);
    });
  });

  describe('configuration management', () => {
    it('should get current configuration', () => {
      const config = summarizationService.getConfig();

      expect(config).toHaveProperty('maxTokensBeforeSummarization');
      expect(config).toHaveProperty('summaryModel');
      expect(config).toHaveProperty('preserveRecentMessages');
      expect(config).toHaveProperty('maxSummaryTokens');
    });

    it('should update configuration', () => {
      const updates: Partial<SummarizationConfig> = {
        maxTokensBeforeSummarization: 15000,
        preserveRecentMessages: 15,
        summaryModel: 'gpt-4',
      };

      summarizationService.updateConfig(updates);
      const updatedConfig = summarizationService.getConfig();

      expect(updatedConfig.maxTokensBeforeSummarization).toBe(15000);
      expect(updatedConfig.preserveRecentMessages).toBe(15);
      expect(updatedConfig.summaryModel).toBe('gpt-4');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty message content gracefully', async () => {
      const mockMessages = [
        createMockMessage('msg-1', '', 0),
        createMockMessage('msg-2', 'Valid content', 100),
        ...createMockMessageList(13, 3),
      ];

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(15),
      });
      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);
      mockOpenAIService.generateResponse.mockResolvedValue({
        content: 'Summary with empty messages handled',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 500, outputTokens: 100, totalTokens: 600 },
        cost: 0.005,
        finishReason: 'stop',
        id: 'response-4',
        created: Date.now(),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(100);
      mockSummaryRepository.createRollingSummary.mockResolvedValue(
        createMockSummary('summary-1', mockConversationId)
      );
      mockMessageRepository.update.mockResolvedValue({} as Message);

      const result = await summarizationService.summarizeConversation(
        mockConversationId,
        mockUserId
      );

      expect(result.summary).toBeDefined();
    });

    it('should handle messages with missing token counts', async () => {
      const mockMessages = createMockMessageList(15).map(msg => ({
        ...msg,
        tokenCount: undefined,
      }));

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(15),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(1000); // Higher token count to exceed threshold

      const result = await summarizationService.shouldSummarize(mockConversationId);

      expect(mockOpenAIService.estimateTokenCount).toHaveBeenCalledTimes(15);
      expect(result).toBe(true); // Should still work with estimated tokens
    });

    it('should handle very long conversations efficiently', async () => {
      const mockMessages = createMockMessageList(1000); // Very long conversation

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        pagination: createMockPagination(1000),
      });
      mockSummaryRepository.getLatestForConversation.mockResolvedValue(null);
      mockOpenAIService.generateResponse.mockResolvedValue({
        content: 'Summary of very long conversation',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 5000, outputTokens: 500, totalTokens: 5500 },
        cost: 0.05,
        finishReason: 'stop',
        id: 'response-5',
        created: Date.now(),
      });
      mockOpenAIService.estimateTokenCount.mockReturnValue(500);
      mockSummaryRepository.createRollingSummary.mockResolvedValue(
        createMockSummary('summary-1', mockConversationId)
      );
      mockMessageRepository.update.mockResolvedValue({} as Message);

      const result = await summarizationService.summarizeConversation(
        mockConversationId,
        mockUserId
      );

      expect(result.summarizedMessageIds).toHaveLength(990); // 1000 - 10 preserved
      expect(result.preservedMessageIds).toHaveLength(10);
    });
  });

  // Helper functions
  function createMockMessage(
    id: string,
    content: string,
    tokenCount?: number,
    role: 'user' | 'assistant' | 'system' = 'user'
  ): Message {
    return {
      id,
      conversationId: mockConversationId,
      role,
      content,
      tokenCount,
      createdAt: new Date(),
      isSummarized: false,
    };
  }

  function createMockMessageList(count: number, startIndex: number = 1): Message[] {
    return Array.from({ length: count }, (_, i) =>
      createMockMessage(
        `msg-${startIndex + i}`,
        `Message content ${startIndex + i}`,
        100,
        i % 2 === 0 ? 'user' : 'assistant'
      )
    );
  }

  function createMockSummary(id: string, conversationId: string): Summary {
    return {
      id,
      conversationId,
      content: 'Mock summary content',
      createdAt: new Date(),
      isActive: true,
      tokenCount: 200,
    };
  }

  function createMockPagination(total: number) {
    return {
      page: 1,
      limit: 1000,
      total,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
  }
});