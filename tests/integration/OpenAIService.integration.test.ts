import { OpenAIService } from '../../src/services/OpenAIService';
import { ChatMessage } from '../../src/models/AI';
import { environment } from '../../src/config/environment';

// Integration tests that use real OpenAI API
// These tests are slower and require a valid API key
// Run with: npm run test:integration

describe('OpenAIService Integration Tests', () => {
  let openAIService: OpenAIService;

  beforeAll(() => {
    // Skip integration tests if no API key is provided
    if (!environment.openai.apiKey || environment.openai.apiKey === 'test-key') {
      console.log('Skipping integration tests - no valid OpenAI API key provided');
      return;
    }
    
    openAIService = new OpenAIService();
  });

  // Helper to skip tests if no API key
  const skipIfNoApiKey = () => {
    if (!environment.openai.apiKey || environment.openai.apiKey === 'test-key') {
      pending('No valid OpenAI API key provided');
    }
  };

  describe('Real API Integration', () => {
    it('should successfully connect to OpenAI API', async () => {
      skipIfNoApiKey();
      
      const isConnected = await openAIService.testConnection();
      expect(isConnected).toBe(true);
    }, 30000); // 30 second timeout for real API calls

    it('should generate a real response from GPT-3.5-turbo', async () => {
      skipIfNoApiKey();
      
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Say "Hello, this is a test!" and nothing else.' }
      ];

      const response = await openAIService.generateResponse(messages, 'gpt-3.5-turbo', {
        maxTokens: 20,
        temperature: 0 // Deterministic response
      });

      expect(response).toBeDefined();
      expect(response.content).toContain('Hello');
      expect(response.model).toBe('gpt-3.5-turbo');
      expect(response.usage.totalTokens).toBeGreaterThan(0);
      expect(response.cost).toBeGreaterThan(0);
      expect(response.id).toBeDefined();
      expect(response.created).toBeGreaterThan(0);
    }, 30000);

    it('should handle different models correctly', async () => {
      skipIfNoApiKey();
      
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Respond with exactly: "Model test successful"' }
      ];

      // Test with GPT-4o-mini (cheaper for testing)
      const response = await openAIService.generateResponse(messages, 'gpt-4o-mini', {
        maxTokens: 10,
        temperature: 0
      });

      expect(response.model).toBe('gpt-4o-mini');
      expect(response.content).toBeTruthy();
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    }, 30000);

    it('should calculate real costs accurately', async () => {
      skipIfNoApiKey();
      
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Say "Cost test"' }
      ];

      const response = await openAIService.generateResponse(messages, 'gpt-3.5-turbo', {
        maxTokens: 5,
        temperature: 0
      });

      // Verify cost calculation matches expected pricing
      const expectedCost = openAIService.calculateCost(response.usage, 'gpt-3.5-turbo');
      expect(response.cost).toBe(expectedCost);
      expect(response.cost).toBeGreaterThan(0);
      expect(response.cost).toBeLessThan(0.01); // Should be very small for short response
    }, 30000);

    it('should handle real rate limiting gracefully', async () => {
      skipIfNoApiKey();
      
      // This test might trigger rate limiting in some cases
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Short response please' }
      ];

      // Make multiple rapid requests to potentially trigger rate limiting
      const promises = Array(3).fill(null).map(() => 
        openAIService.generateResponse(messages, 'gpt-3.5-turbo', {
          maxTokens: 5,
          temperature: 0
        })
      );

      // All should eventually succeed due to retry logic
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
      });
    }, 60000); // Longer timeout for potential retries

    it('should validate model availability', async () => {
      skipIfNoApiKey();
      
      const availableModels = openAIService.getAvailableModels();
      
      // Test that at least one model is actually available
      const testModel = availableModels.find(m => m.id === 'gpt-3.5-turbo');
      expect(testModel).toBeDefined();
      
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test' }
      ];

      // Should not throw for supported model
      await expect(
        openAIService.generateResponse(messages, testModel!.id, { maxTokens: 5 })
      ).resolves.toBeDefined();
    }, 30000);
  });

  describe('Error Handling with Real API', () => {
    it('should handle invalid model with real API', async () => {
      skipIfNoApiKey();
      
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test' }
      ];

      // Should fail validation before hitting API
      await expect(
        openAIService.generateResponse(messages, 'invalid-model-name')
      ).rejects.toThrow('Unsupported model');
    });

    it('should handle token limit validation', async () => {
      skipIfNoApiKey();
      
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ];

      // Test token limit checking
      const withinLimit = openAIService.checkTokenLimit(messages, 'gpt-3.5-turbo', 1000);
      expect(withinLimit).toBe(true);

      const exceedsLimit = openAIService.checkTokenLimit(messages, 'gpt-3.5-turbo', 50000);
      expect(exceedsLimit).toBe(false);
    });
  });
});