import { Request, Response, NextFunction } from 'express';
import { SummarizationDebugController } from '../../src/controllers/SummarizationDebugController';
import { SummarizationService } from '../../src/services/SummarizationService';
import { SummaryRepository } from '../../src/repositories/SummaryRepository';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { ConversationRepository } from '../../src/repositories/ConversationRepository';
import { v4 as uuidv4 } from 'uuid';

// Mock the dependencies
jest.mock('../../src/services/SummarizationService');
jest.mock('../../src/repositories/SummaryRepository');
jest.mock('../../src/repositories/MessageRepository');
jest.mock('../../src/repositories/ConversationRepository');

describe('SummarizationDebugController', () => {
  let controller: SummarizationDebugController;
  let mockSummarizationService: jest.Mocked<SummarizationService>;
  let mockSummaryRepository: jest.Mocked<SummaryRepository>;
  let mockMessageRepository: jest.Mocked<MessageRepository>;
  let mockConversationRepository: jest.Mocked<ConversationRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let userId: string;
  let conversationId: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create test data
    userId = uuidv4();
    conversationId = uuidv4();

    // Set up environment for debug access
    process.env.NODE_ENV = 'development';

    // Create mock instances
    mockSummarizationService = {
      getConfig: jest.fn(),
      getSummaryPromptTemplate: jest.fn(),
      getRollingSummaryPromptTemplate: jest.fn(),
      updateSummaryPromptTemplate: jest.fn(),
      updateRollingSummaryPromptTemplate: jest.fn(),
      updateConfig: jest.fn(),
      generateTestSummary: jest.fn(),
    } as any;
    
    mockSummaryRepository = {
      findByConversationId: jest.fn(),
      getLatestForConversation: jest.fn(),
    } as any;
    
    mockMessageRepository = {
      findByConversationId: jest.fn(),
      findById: jest.fn(),
    } as any;
    
    mockConversationRepository = {
      findById: jest.fn(),
    } as any;

    // Create controller instance
    controller = new SummarizationDebugController(
      mockSummarizationService,
      mockSummaryRepository,
      mockMessageRepository,
      mockConversationRepository
    );

    // Set up mock request and response
    mockRequest = {
      params: { conversationId },
      user: { 
        id: userId, 
        username: 'testuser',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      body: {},
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.DEBUG_USERS;
  });

  describe('getDebugData', () => {
    it('should return debug data for authorized user', async () => {
      // Mock conversation
      const mockConversation = {
        id: conversationId,
        userId,
        title: 'Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        isArchived: false,
        totalCost: 0,
      };

      // Mock messages
      const mockMessages = [
        {
          id: uuidv4(),
          conversationId,
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
          isSummarized: false,
        },
        {
          id: uuidv4(),
          conversationId,
          role: 'assistant',
          content: 'Hi there!',
          createdAt: new Date(),
          isSummarized: true,
        },
      ];

      // Mock summaries
      const mockSummaries = [
        {
          id: uuidv4(),
          conversationId,
          content: 'Test summary',
          createdAt: new Date(),
          isActive: true,
          tokenCount: 50,
        },
      ];

      // Mock config
      const mockConfig = {
        maxTokensBeforeSummarization: 12000,
        summaryModel: 'gpt-4o-mini',
        preserveRecentMessages: 10,
        maxSummaryTokens: 2000,
      };

      // Set up mocks
      mockConversationRepository.findById.mockResolvedValue(mockConversation as any);
      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        total: mockMessages.length,
        page: 1,
        limit: 1000,
      } as any);
      mockSummaryRepository.findByConversationId.mockResolvedValue({
        data: mockSummaries,
        pagination: {
          page: 1,
          limit: 20,
          total: mockSummaries.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      } as any);
      mockSummarizationService.getConfig.mockReturnValue(mockConfig as any);
      mockSummarizationService.getSummaryPromptTemplate.mockReturnValue('Initial prompt template');
      mockSummarizationService.getRollingSummaryPromptTemplate.mockReturnValue('Rolling prompt template');

      await controller.getDebugData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: expect.objectContaining({
          conversationId,
          originalMessages: expect.arrayContaining([
            expect.objectContaining({
              content: 'Hello',
              isSummarized: false,
            }),
            expect.objectContaining({
              content: 'Hi there!',
              isSummarized: true,
            }),
          ]),
          summaries: expect.arrayContaining([
            expect.objectContaining({
              content: 'Test summary',
              isActive: true,
            }),
          ]),
          summarizationPrompts: {
            initialPrompt: 'Initial prompt template',
            rollingPrompt: 'Rolling prompt template',
          },
          config: mockConfig,
        }),
        timestamp: expect.any(String),
      });
    });

    it('should deny access for non-developer in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DEBUG_USERS;

      await controller.getDebugData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Debug access requires developer privileges',
          statusCode: 403,
        })
      );
    });

    it('should return 404 for non-existent conversation', async () => {
      mockConversationRepository.findById.mockResolvedValue(null);

      await controller.getDebugData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Conversation not found',
          statusCode: 404,
        })
      );
    });

    it('should require user authentication', async () => {
      mockRequest.user = undefined;

      await controller.getDebugData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User authentication required',
          statusCode: 400,
        })
      );
    });
  });

  describe('testSummarization', () => {
    beforeEach(() => {
      // Mock conversation access
      mockConversationRepository.findById.mockResolvedValue({
        id: conversationId,
        userId,
        title: 'Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        isArchived: false,
        totalCost: 0,
      } as any);
    });

    it('should test summarization with default settings', async () => {
      const mockMessages = [
        {
          id: uuidv4(),
          conversationId,
          role: 'user',
          content: 'Test message',
          createdAt: new Date(),
        },
      ];

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        total: 1,
        page: 1,
        limit: 1000,
      } as any);

      mockSummarizationService.generateTestSummary.mockResolvedValue('Test summary result');

      await controller.testSummarization(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: expect.objectContaining({
          testSummary: expect.objectContaining({
            content: 'Test summary result',
            messageCount: 1,
            isRollingPrompt: false,
          }),
          originalMessages: expect.arrayContaining([
            expect.objectContaining({
              content: 'Test message',
            }),
          ]),
        }),
        timestamp: expect.any(String),
      });
    });

    it('should test summarization with custom prompt', async () => {
      const customPrompt = 'Custom test prompt: {{MESSAGES}}';
      mockRequest.body = {
        customPrompt,
        useRollingPrompt: false,
      };

      const mockMessages = [
        {
          id: uuidv4(),
          conversationId,
          role: 'user',
          content: 'Test message',
          createdAt: new Date(),
        },
      ];

      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: mockMessages,
        total: 1,
        page: 1,
        limit: 1000,
      } as any);

      mockSummarizationService.getSummaryPromptTemplate.mockReturnValue('Original prompt');
      mockSummarizationService.updateSummaryPromptTemplate.mockImplementation(() => {});
      mockSummarizationService.generateTestSummary.mockResolvedValue('Custom summary result');

      await controller.testSummarization(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSummarizationService.updateSummaryPromptTemplate).toHaveBeenCalledWith(customPrompt);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: expect.objectContaining({
          testSummary: expect.objectContaining({
            content: 'Custom summary result',
            promptUsed: customPrompt,
            isRollingPrompt: false,
          }),
        }),
        timestamp: expect.any(String),
      });
      
      // Verify prompt was restored
      expect(mockSummarizationService.updateSummaryPromptTemplate).toHaveBeenCalledWith('Original prompt');
    });
  });

  describe('updatePrompts', () => {
    it('should update initial prompt', async () => {
      const newPrompt = 'New initial prompt template';
      mockRequest.body = {
        initialPrompt: newPrompt,
      };

      mockSummarizationService.updateSummaryPromptTemplate.mockImplementation(() => {});

      await controller.updatePrompts(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSummarizationService.updateSummaryPromptTemplate).toHaveBeenCalledWith(newPrompt);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          message: 'Prompts updated successfully',
          updatedPrompts: {
            initial: true,
            rolling: false,
          },
        },
        timestamp: expect.any(String),
      });
    });

    it('should update rolling prompt', async () => {
      const newPrompt = 'New rolling prompt template';
      mockRequest.body = {
        rollingPrompt: newPrompt,
      };

      mockSummarizationService.updateRollingSummaryPromptTemplate.mockImplementation(() => {});

      await controller.updatePrompts(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSummarizationService.updateRollingSummaryPromptTemplate).toHaveBeenCalledWith(newPrompt);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          message: 'Prompts updated successfully',
          updatedPrompts: {
            initial: false,
            rolling: true,
          },
        },
        timestamp: expect.any(String),
      });
    });
  });

  describe('getPrompts', () => {
    it('should return current prompts', async () => {
      mockSummarizationService.getSummaryPromptTemplate.mockReturnValue('Initial prompt');
      mockSummarizationService.getRollingSummaryPromptTemplate.mockReturnValue('Rolling prompt');

      await controller.getPrompts(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          prompts: {
            initial: 'Initial prompt',
            rolling: 'Rolling prompt',
          },
        },
        timestamp: expect.any(String),
      });
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', async () => {
      const configUpdates = {
        maxTokensBeforeSummarization: 15000,
        preserveRecentMessages: 15,
      };
      mockRequest.body = configUpdates;

      mockSummarizationService.updateConfig.mockImplementation(() => {});
      mockSummarizationService.getConfig.mockReturnValue({
        maxTokensBeforeSummarization: 15000,
        summaryModel: 'gpt-4o-mini',
        preserveRecentMessages: 15,
        maxSummaryTokens: 2000,
      } as any);

      await controller.updateConfig(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSummarizationService.updateConfig).toHaveBeenCalledWith(configUpdates);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          message: 'Configuration updated successfully',
          updatedFields: ['maxTokensBeforeSummarization', 'preserveRecentMessages'],
          newConfig: expect.objectContaining({
            maxTokensBeforeSummarization: 15000,
            preserveRecentMessages: 15,
          }),
        },
        timestamp: expect.any(String),
      });
    });

    it('should filter out invalid configuration fields', async () => {
      const configUpdates = {
        maxTokensBeforeSummarization: 15000,
        invalidField: 'should be ignored',
        preserveRecentMessages: 15,
      };
      mockRequest.body = configUpdates;

      mockSummarizationService.updateConfig.mockImplementation(() => {});
      mockSummarizationService.getConfig.mockReturnValue({} as any);

      await controller.updateConfig(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSummarizationService.updateConfig).toHaveBeenCalledWith({
        maxTokensBeforeSummarization: 15000,
        preserveRecentMessages: 15,
      });
    });
  });

  describe('Access Control', () => {
    it('should allow access for debug users in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG_USERS = `${userId},other-user-id`;

      // Mock minimal required data
      mockConversationRepository.findById.mockResolvedValue({
        id: conversationId,
        userId,
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
        isArchived: false,
        totalCost: 0,
      } as any);
      mockMessageRepository.findByConversationId.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1000,
      } as any);
      mockSummaryRepository.findByConversationId.mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      } as any);
      mockSummarizationService.getConfig.mockReturnValue({} as any);
      mockSummarizationService.getSummaryPromptTemplate.mockReturnValue('');
      mockSummarizationService.getRollingSummaryPromptTemplate.mockReturnValue('');

      await controller.getDebugData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
        })
      );
    });

    it('should deny access to conversations owned by other users', async () => {
      const otherUserId = uuidv4();
      mockConversationRepository.findById.mockResolvedValue({
        id: conversationId,
        userId: otherUserId,
      } as any);

      await controller.getDebugData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Access denied to this conversation',
          statusCode: 403,
        })
      );
    });
  });
});