import { Request, Response, NextFunction } from 'express';
import { ChatController } from '../../src/controllers/ChatController';
import { OpenAIService } from '../../src/services/OpenAIService';
import { ConversationService } from '../../src/services/ConversationService';
import { PersonaService } from '../../src/services/PersonaService';
import { SummarizationService } from '../../src/services/SummarizationService';
import { ValidationError, NotFoundError } from '../../src/utils/errors';

// Mock the services
jest.mock('../../src/services/OpenAIService');
jest.mock('../../src/services/ConversationService');
jest.mock('../../src/services/PersonaService');
jest.mock('../../src/services/SummarizationService');
jest.mock('../../src/repositories/ConversationRepository');
jest.mock('../../src/repositories/MessageRepository');
jest.mock('../../src/repositories/PersonaRepository');
jest.mock('../../src/repositories/SummaryRepository');

describe('ChatController', () => {
  let chatController: ChatController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let mockConversationService: jest.Mocked<ConversationService>;
  let mockPersonaService: jest.Mocked<PersonaService>;
  let mockSummarizationService: jest.Mocked<SummarizationService>;

  beforeEach(() => {
    // Create mocked services
    mockOpenAIService = new OpenAIService() as jest.Mocked<OpenAIService>;
    mockConversationService = new ConversationService(null as any, null as any, null as any) as jest.Mocked<ConversationService>;
    mockPersonaService = new PersonaService(null as any) as jest.Mocked<PersonaService>;
    mockSummarizationService = new SummarizationService(null as any, null as any, null as any) as jest.Mocked<SummarizationService>;

    chatController = new ChatController();

    // Mock request and response
    mockRequest = {
      user: { id: 'user123' },
      body: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    mockNext = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should generate AI response successfully', async () => {
      // Arrange
      const requestBody = {
        conversationId: 'conv123',
        content: 'Hello, how are you?',
        personaId: 'persona123',
        model: 'gpt-4o-mini',
        options: { temperature: 0.7 },
      };

      const mockConversation = {
        id: 'conv123',
        userId: 'user123',
        title: 'Test Conversation',
      };

      const mockPersona = {
        id: 'persona123',
        userId: 'user123',
        name: 'Assistant',
        systemPrompt: 'You are a helpful assistant.',
      };

      const mockUserMessage = {
        id: 'msg1',
        conversationId: 'conv123',
        role: 'user',
        content: 'Hello, how are you?',
        createdAt: new Date().toISOString(),
      };

      const mockAIResponse = {
        content: 'I am doing well, thank you!',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
        cost: 0.001,
        finishReason: 'stop',
      };

      const mockAssistantMessage = {
        id: 'msg2',
        conversationId: 'conv123',
        role: 'assistant',
        content: 'I am doing well, thank you!',
        createdAt: new Date().toISOString(),
        cost: 0.001,
      };

      mockRequest.body = requestBody;
      mockConversationService.getConversation = jest.fn().mockResolvedValue(mockConversation);
      mockPersonaService.getPersona = jest.fn().mockResolvedValue(mockPersona);
      mockConversationService.addMessage = jest.fn()
        .mockResolvedValueOnce(mockUserMessage)
        .mockResolvedValueOnce(mockAssistantMessage);
      mockOpenAIService.generateResponseWithTracking = jest.fn().mockResolvedValue(mockAIResponse);
      mockSummarizationService.getConversationContext = jest.fn().mockResolvedValue({
        summary: null,
        recentMessages: [],
      });
      mockSummarizationService.shouldSummarize = jest.fn().mockReturnValue(false);

      // Act
      await chatController.generateResponse(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConversationService.getConversation).toHaveBeenCalledWith('conv123', 'user123');
      expect(mockPersonaService.getPersona).toHaveBeenCalledWith('persona123', 'user123');
      expect(mockConversationService.addMessage).toHaveBeenCalledTimes(2);
      expect(mockOpenAIService.generateResponseWithTracking).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          userMessage: mockUserMessage,
          assistantMessage: mockAssistantMessage,
          aiResponse: {
            model: mockAIResponse.model,
            usage: mockAIResponse.usage,
            cost: mockAIResponse.cost,
            finishReason: mockAIResponse.finishReason,
          },
        },
      });
    });

    it('should handle missing user ID', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await chatController.generateResponse(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should handle conversation not found', async () => {
      // Arrange
      mockRequest.body = {
        conversationId: 'conv123',
        content: 'Hello',
      };
      mockConversationService.getConversation = jest.fn().mockResolvedValue(null);

      // Act
      await chatController.generateResponse(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should handle invalid persona', async () => {
      // Arrange
      mockRequest.body = {
        conversationId: 'conv123',
        content: 'Hello',
        personaId: 'invalid-persona',
      };

      const mockConversation = {
        id: 'conv123',
        userId: 'user123',
      };

      mockConversationService.getConversation = jest.fn().mockResolvedValue(mockConversation);
      mockPersonaService.getPersona = jest.fn().mockResolvedValue(null);

      // Act
      await chatController.generateResponse(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('getModels', () => {
    it('should return available models', async () => {
      // Arrange
      const mockModels = [
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          description: 'Fast and efficient model',
          maxTokens: 128000,
          inputCostPer1kTokens: 0.00015,
          outputCostPer1kTokens: 0.0006,
          capabilities: ['chat', 'completion'],
        },
      ];

      mockOpenAIService.getAvailableModels = jest.fn().mockReturnValue(mockModels);

      // Act
      await chatController.getModels(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockOpenAIService.getAvailableModels).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockModels,
      });
    });
  });

  describe('getModelInfo', () => {
    it('should return model information', async () => {
      // Arrange
      const mockModel = {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and efficient model',
        maxTokens: 128000,
        inputCostPer1kTokens: 0.00015,
        outputCostPer1kTokens: 0.0006,
        capabilities: ['chat', 'completion'],
      };

      mockRequest.params = { modelId: 'gpt-4o-mini' };
      mockOpenAIService.getModelInfo = jest.fn().mockReturnValue(mockModel);

      // Act
      await chatController.getModelInfo(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockOpenAIService.getModelInfo).toHaveBeenCalledWith('gpt-4o-mini');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockModel,
      });
    });

    it('should handle model not found', async () => {
      // Arrange
      mockRequest.params = { modelId: 'invalid-model' };
      mockOpenAIService.getModelInfo = jest.fn().mockReturnValue(null);

      // Act
      await chatController.getModelInfo(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should handle missing model ID', async () => {
      // Arrange
      mockRequest.params = {};

      // Act
      await chatController.getModelInfo(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('generateStreamingResponse', () => {
    it('should handle streaming response setup', async () => {
      // Arrange
      const requestBody = {
        conversationId: 'conv123',
        content: 'Hello, how are you?',
      };

      const mockConversation = {
        id: 'conv123',
        userId: 'user123',
      };

      mockRequest.body = requestBody;
      mockConversationService.getConversation = jest.fn().mockResolvedValue(mockConversation);
      mockConversationService.addMessage = jest.fn().mockResolvedValue({
        id: 'msg1',
        content: 'Hello, how are you?',
      });
      mockSummarizationService.getConversationContext = jest.fn().mockResolvedValue({
        summary: null,
        recentMessages: [],
      });
      mockOpenAIService.generateResponseWithTracking = jest.fn().mockResolvedValue({
        content: 'I am doing well!',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
        cost: 0.001,
        finishReason: 'stop',
      });

      // Act
      await chatController.generateStreamingResponse(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));
      expect(mockResponse.write).toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });
});