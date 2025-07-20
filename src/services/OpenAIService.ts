import OpenAI from 'openai';
import { environment } from '../config/environment';
import { logger } from '../config/logger';
import {
  AIModel,
  AIResponse,
  AIOptions,
  ChatMessage,
  AIRequest,
  TokenUsage,
  SUPPORTED_MODELS,
  MODEL_PRICING,
} from '../models/AI';
import {
  AIServiceError,
  AIRateLimitError,
  AIInvalidModelError,
  AIQuotaExceededError,
  AINetworkError,
} from '../utils/errors';

export class OpenAIService {
  private readonly client: OpenAI;
  private readonly defaultModel: string = 'gpt-4o-mini';
  private readonly maxRetries: number = 3;
  private readonly baseDelay: number = 1000; // 1 second

  constructor() {
    this.client = new OpenAI({
      apiKey: environment.openai.apiKey,
      organization: environment.openai.organization,
    });
  }

  /**
   * Generate AI response using OpenAI chat completion
   */
  async generateResponse(
    messages: ChatMessage[],
    model: string = this.defaultModel,
    options: AIOptions = {}
  ): Promise<AIResponse> {
    try {
      // Validate model
      if (!this.validateModel(model)) {
        throw new AIInvalidModelError(`Unsupported model: ${model}`);
      }

      // Prepare request options
      const requestOptions = {
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        stream: options.stream ?? false,
      };

      // Make API call with retry logic
      const response = await this.makeRequestWithRetry(requestOptions);

      // Extract response data
      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new AIServiceError('Invalid response from OpenAI API');
      }

      // Calculate token usage and cost
      const usage: TokenUsage = {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      };

      const cost = this.calculateCost(usage, model);

      // Build AI response
      const aiResponse: AIResponse = {
        content: choice.message.content || '',
        model,
        usage,
        cost,
        finishReason: choice.finish_reason || 'unknown',
        id: response.id,
        created: response.created,
      };

      logger.info(`AI response generated successfully`, {
        model,
        tokens: usage.totalTokens,
        cost,
        finishReason: aiResponse.finishReason,
      });

      return aiResponse;
    } catch (error) {
      logger.error('Failed to generate AI response:', error);
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Calculate cost based on token usage and model
   */
  calculateCost(usage: TokenUsage, model: string): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      logger.warn(`No pricing information for model: ${model}`);
      return 0;
    }

    const inputCost = (usage.inputTokens / 1000) * pricing.input;
    const outputCost = (usage.outputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return Math.round(totalCost * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Validate if model is supported
   */
  validateModel(model: string): boolean {
    return SUPPORTED_MODELS.some(supportedModel => supportedModel.id === model);
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): AIModel[] {
    return [...SUPPORTED_MODELS];
  }

  /**
   * Get model information by ID
   */
  getModelInfo(modelId: string): AIModel | null {
    return SUPPORTED_MODELS.find(model => model.id === modelId) || null;
  }

  /**
   * Count tokens in text (approximate)
   * This is a rough estimation - for precise counting, use tiktoken library
   */
  estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // This is a simplified approach - in production, use tiktoken for accuracy
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if request would exceed model's token limit
   */
  checkTokenLimit(messages: ChatMessage[], model: string, maxTokens?: number): boolean {
    const modelInfo = this.getModelInfo(model);
    if (!modelInfo) {
      return false;
    }

    const inputTokens = messages.reduce((total, msg) => {
      return total + this.estimateTokenCount(msg.content);
    }, 0);

    const requestedMaxTokens = maxTokens || modelInfo.maxTokens * 0.5; // Use 50% as default
    const totalEstimatedTokens = inputTokens + requestedMaxTokens;

    return totalEstimatedTokens <= modelInfo.maxTokens;
  }

  /**
   * Make OpenAI API request with exponential backoff retry logic
   */
  private async makeRequestWithRetry(
    requestOptions: any,
    attempt: number = 1
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      return await this.client.chat.completions.create(requestOptions);
    } catch (error: any) {
      // Check if we should retry
      if (attempt < this.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateBackoffDelay(attempt);
        
        logger.warn(`OpenAI API request failed, retrying in ${delay}ms (attempt ${attempt}/${this.maxRetries})`, {
          error: error.message,
          status: error.status,
        });

        await this.sleep(delay);
        return this.makeRequestWithRetry(requestOptions, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Determine if error is retryable
   */
  private shouldRetry(error: any): boolean {
    // Retry on rate limits, server errors, and network issues
    const retryableStatuses = [429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status) || error.code === 'ECONNRESET';
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle and transform OpenAI errors to application errors
   */
  private handleOpenAIError(error: any): Error {
    if (error instanceof AIServiceError || 
        error instanceof AIRateLimitError || 
        error instanceof AIInvalidModelError ||
        error instanceof AIQuotaExceededError ||
        error instanceof AINetworkError) {
      return error;
    }

    // Handle OpenAI specific errors
    if (error.status) {
      switch (error.status) {
        case 400:
          return new AIInvalidModelError(`Invalid request: ${error.message}`);
        case 401:
          return new AIServiceError('Invalid OpenAI API key');
        case 402:
          return new AIQuotaExceededError('OpenAI quota exceeded');
        case 429:
          const retryAfter = error.headers?.['retry-after'];
          return new AIRateLimitError(
            'OpenAI rate limit exceeded',
            retryAfter ? parseInt(retryAfter) : undefined
          );
        case 500:
        case 502:
        case 503:
        case 504:
          return new AINetworkError(`OpenAI service error: ${error.message}`);
        default:
          return new AIServiceError(`OpenAI API error: ${error.message}`);
      }
    }

    // Handle network errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return new AINetworkError(`Network error: ${error.message}`);
    }

    // Default to generic AI service error
    return new AIServiceError(`Unexpected error: ${error.message}`);
  }

  /**
   * Test API connection and key validity
   */
  async testConnection(): Promise<boolean> {
    try {
      const testMessages: ChatMessage[] = [
        { role: 'user', content: 'Hello, this is a connection test.' }
      ];

      await this.generateResponse(testMessages, 'gpt-3.5-turbo', { maxTokens: 10 });
      return true;
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current API usage (if available from OpenAI)
   * Note: This would require additional API calls to OpenAI's usage endpoint
   */
  async getUsageStats(): Promise<any> {
    // This would require implementing OpenAI's usage API
    // For now, return placeholder
    logger.info('Usage stats requested - not implemented yet');
    return {
      message: 'Usage stats not implemented yet',
      // In future: implement actual usage tracking from OpenAI API
    };
  }
}