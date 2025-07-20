import { OpenAIService } from '../../src/services/OpenAIService';
import { ChatMessage, AIOptions, TokenUsage } from '../../src/models/AI';
import {
  AIServiceError,
  AIRateLimitError,
  AIInvalidModelError,
  AIQuotaExceededError,
  AINetworkError,
} from '../../src/utils/errors';

// Mock OpenAI
jest.mock('openai');
import OpenAI from 'openai';

describe('OpenAIService', () => {
  let openAIService: OpenAIService;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock for the create method
    mockCreate = jest.fn();

    // Mock OpenAI constructor and methods
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as any));

    openAIService = new OpenAIService();
  });

  describe('generateResponse', () => {
    const testMessages: ChatMessage[] = [
      { role: 'user', content: 'Hello, how are you?' }
    ];

    const mockOpenAIResponse = {
      id: 'chatcmpl-test123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! I am doing well, thank you for asking.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25,
      },
    };

    it('should generate response successfully with default model', async () => {
      mockCreate.mockResolvedValue(mockOpenAIResponse as any);

      const result = await openAIService.generateResponse(testMessages);

      expect(result).toEqual({
        content: 'Hello! I am doing well, thank you for asking.',
        model: 'gpt-4o-mini',
        usage: {
          inputTokens: 10,
          outputTokens: 15,
          totalTokens: 25,
        },
        cost: expect.any(Number),
        finishReason: 'stop',
        id: 'chatcmpl-test123',
        created: 1677652288,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        temperature: 0.7,
        max_tokens: undefined,
        top_p: undefined,
        frequency_penalty: undefined,
        presence_penalty: undefined,
        stop: undefined,
        stream: false,
      });
    });

    it('should generate response with custom model and options', async () => {
      mockCreate.mockResolvedValue(mockOpenAIResponse as any);

      const options: AIOptions = {
        temperature: 0.5,
        maxTokens: 100,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
        stop: ['\\n'],
      };

      await openAIService.generateResponse(testMessages, 'gpt-4o', options);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        temperature: 0.5,
        max_tokens: 100,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stop: ['\\n'],
        stream: false,
      });
    });

    it('should throw AIInvalidModelError for unsupported model', async () => {
      await expect(
        openAIService.generateResponse(testMessages, 'invalid-model')
      ).rejects.toThrow(AIInvalidModelError);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should throw AIServiceError for invalid response', async () => {
      const invalidResponse = {
        ...mockOpenAIResponse,
        choices: [],
      };

      mockCreate.mockResolvedValue(invalidResponse as any);

      await expect(
        openAIService.generateResponse(testMessages)
      ).rejects.toThrow(AIServiceError);
    });

    it('should handle 401 authentication error', async () => {
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      mockCreate.mockRejectedValue(authError);

      await expect(
        openAIService.generateResponse(testMessages)
      ).rejects.toThrow(AIServiceError);
    });

    it('should handle 429 rate limit error', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      (rateLimitError as any).headers = { 'retry-after': '60' };

      mockCreate.mockRejectedValue(rateLimitError);

      await expect(
        openAIService.generateResponse(testMessages)
      ).rejects.toThrow(AIRateLimitError);
    });

    it('should handle 402 quota exceeded error', async () => {
      const quotaError = new Error('Quota exceeded');
      (quotaError as any).status = 402;

      mockCreate.mockRejectedValue(quotaError);

      await expect(
        openAIService.generateResponse(testMessages)
      ).rejects.toThrow(AIQuotaExceededError);
    });

    it('should handle 500 server error', async () => {
      const serverError = new Error('Internal server error');
      (serverError as any).status = 500;

      mockCreate.mockRejectedValue(serverError);

      await expect(
        openAIService.generateResponse(testMessages)
      ).rejects.toThrow(AINetworkError);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Connection reset');
      (networkError as any).code = 'ECONNRESET';

      mockCreate.mockRejectedValue(networkError);

      await expect(
        openAIService.generateResponse(testMessages)
      ).rejects.toThrow(AINetworkError);
    });

    it('should retry on retryable errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      // Fail twice, then succeed
      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockOpenAIResponse as any);

      const result = await openAIService.generateResponse(testMessages);

      expect(result.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockCreate.mockRejectedValue(rateLimitError);

      await expect(
        openAIService.generateResponse(testMessages)
      ).rejects.toThrow(AIRateLimitError);

      expect(mockCreate).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for gpt-4o-mini', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      const cost = openAIService.calculateCost(usage, 'gpt-4o-mini');

      // gpt-4o-mini: input $0.15/1M, output $0.60/1M
      // 1000 input tokens = 0.00015, 500 output tokens = 0.0003
      // Total = 0.00045, but due to rounding it becomes 0.0005
      expect(cost).toBe(0.0005);
    });

    it('should calculate cost correctly for gpt-4o', () => {
      const usage: TokenUsage = {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
      };

      const cost = openAIService.calculateCost(usage, 'gpt-4o');

      // gpt-4o: input $5.00/1M, output $15.00/1M
      // 2000 input tokens = 0.01, 1000 output tokens = 0.015
      // Total = 0.025
      expect(cost).toBe(0.025);
    });

    it('should return 0 for unknown model', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      const cost = openAIService.calculateCost(usage, 'unknown-model');
      expect(cost).toBe(0);
    });

    it('should round cost to 4 decimal places', () => {
      const usage: TokenUsage = {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      };

      const cost = openAIService.calculateCost(usage, 'gpt-4o-mini');
      
      // Should be rounded to 4 decimal places
      expect(cost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
    });
  });

  describe('validateModel', () => {
    it('should return true for supported models', () => {
      expect(openAIService.validateModel('gpt-4o')).toBe(true);
      expect(openAIService.validateModel('gpt-4o-mini')).toBe(true);
      expect(openAIService.validateModel('gpt-4-turbo')).toBe(true);
      expect(openAIService.validateModel('gpt-4')).toBe(true);
      expect(openAIService.validateModel('gpt-3.5-turbo')).toBe(true);
    });

    it('should return false for unsupported models', () => {
      expect(openAIService.validateModel('invalid-model')).toBe(false);
      expect(openAIService.validateModel('gpt-2')).toBe(false);
      expect(openAIService.validateModel('')).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', () => {
      const models = openAIService.getAvailableModels();

      expect(models).toHaveLength(5);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('description');
      expect(models[0]).toHaveProperty('inputCostPer1kTokens');
      expect(models[0]).toHaveProperty('outputCostPer1kTokens');
      expect(models[0]).toHaveProperty('maxTokens');
      expect(models[0]).toHaveProperty('capabilities');
    });

    it('should return a copy of the models array', () => {
      const models1 = openAIService.getAvailableModels();
      const models2 = openAIService.getAvailableModels();

      expect(models1).not.toBe(models2); // Different references
      expect(models1).toEqual(models2); // Same content
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for valid model', () => {
      const modelInfo = openAIService.getModelInfo('gpt-4o-mini');

      expect(modelInfo).toEqual({
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Affordable and intelligent small model for fast, lightweight tasks',
        inputCostPer1kTokens: 0.00015,
        outputCostPer1kTokens: 0.0006,
        maxTokens: 128000,
        capabilities: ['text', 'vision', 'function-calling', 'json-mode'],
      });
    });

    it('should return null for invalid model', () => {
      const modelInfo = openAIService.getModelInfo('invalid-model');
      expect(modelInfo).toBeNull();
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count correctly', () => {
      expect(openAIService.estimateTokenCount('Hello')).toBe(2); // 5 chars / 4 = 1.25, ceil = 2
      expect(openAIService.estimateTokenCount('Hello world')).toBe(3); // 11 chars / 4 = 2.75, ceil = 3
      expect(openAIService.estimateTokenCount('')).toBe(0);
      expect(openAIService.estimateTokenCount('a')).toBe(1);
    });
  });

  describe('checkTokenLimit', () => {
    const testMessages: ChatMessage[] = [
      { role: 'user', content: 'Hello world' }, // ~3 tokens
      { role: 'assistant', content: 'Hi there!' }, // ~3 tokens
    ];

    it('should return true when within token limit', () => {
      const result = openAIService.checkTokenLimit(testMessages, 'gpt-4o-mini', 1000);
      expect(result).toBe(true);
    });

    it('should return false when exceeding token limit', () => {
      const result = openAIService.checkTokenLimit(testMessages, 'gpt-4o-mini', 200000);
      expect(result).toBe(false);
    });

    it('should return false for invalid model', () => {
      const result = openAIService.checkTokenLimit(testMessages, 'invalid-model', 1000);
      expect(result).toBe(false);
    });

    it('should use default max tokens when not specified', () => {
      const result = openAIService.checkTokenLimit(testMessages, 'gpt-4o-mini');
      expect(result).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockCreate.mockResolvedValue({
        id: 'test',
        choices: [{ message: { content: 'test' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        created: Date.now(),
      } as any);

      const result = await openAIService.testConnection();
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      mockCreate.mockRejectedValue(new Error('Connection failed'));

      const result = await openAIService.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('getUsageStats', () => {
    it('should return placeholder usage stats', async () => {
      const result = await openAIService.getUsageStats();
      
      expect(result).toEqual({
        message: 'Usage stats not implemented yet',
      });
    });
  });
});