import request from 'supertest';
import { app } from '../../src/app';
import { DatabaseConnection } from '../../src/database/connection';
import { UserRepository } from '../../src/repositories/UserRepository';
import { ConversationRepository } from '../../src/repositories/ConversationRepository';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { SummaryRepository } from '../../src/repositories/SummaryRepository';
import { AuthService } from '../../src/services/AuthService';
import { v4 as uuidv4 } from 'uuid';

describe('Debug Interface Integration Tests', () => {
  let userRepository: UserRepository;
  let conversationRepository: ConversationRepository;
  let messageRepository: MessageRepository;
  let summaryRepository: SummaryRepository;
  let authService: AuthService;
  
  let testUser: any;
  let testConversation: any;
  let testMessages: any[];
  let testSummary: any;
  let authToken: string;

  beforeAll(async () => {
    // Initialize database connection
    await DatabaseConnection.initialize();
    
    // Initialize repositories
    userRepository = new UserRepository();
    conversationRepository = new ConversationRepository();
    messageRepository = new MessageRepository();
    summaryRepository = new SummaryRepository();
    authService = new AuthService();

    // Set development environment for debug access
    process.env.NODE_ENV = 'development';
  });

  afterAll(async () => {
    // Clean up test data
    if (testSummary) {
      await summaryRepository.delete(testSummary.id);
    }
    if (testMessages) {
      for (const message of testMessages) {
        await messageRepository.delete(message.id);
      }
    }
    if (testConversation) {
      await conversationRepository.delete(testConversation.id);
    }
    if (testUser) {
      await userRepository.delete(testUser.id);
    }

    // Close database connection
    await DatabaseConnection.close();
    
    delete process.env.NODE_ENV;
  });

  beforeEach(async () => {
    // Create test user
    testUser = await userRepository.create({
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpassword123',
    });

    // Generate auth token
    const loginResult = await authService.login(testUser.username, 'testpassword123');
    authToken = loginResult.accessToken;

    // Create test conversation
    testConversation = await conversationRepository.create({
      userId: testUser.id,
      title: 'Test Debug Conversation',
      intent: 'testing',
      customInstructions: 'Test instructions',
    });

    // Create test messages
    testMessages = [];
    
    const message1 = await messageRepository.create({
      conversationId: testConversation.id,
      role: 'user',
      content: 'Hello, I need help with debugging summarization.',
      tokenCount: 12,
    });
    testMessages.push(message1);

    const message2 = await messageRepository.create({
      conversationId: testConversation.id,
      role: 'assistant',
      content: 'I can help you debug the summarization system. What specific issues are you experiencing?',
      tokenCount: 18,
    });
    testMessages.push(message2);

    const message3 = await messageRepository.create({
      conversationId: testConversation.id,
      role: 'user',
      content: 'I want to test how the summarization works with different prompts and see which messages get included.',
      tokenCount: 20,
    });
    testMessages.push(message3);

    const message4 = await messageRepository.create({
      conversationId: testConversation.id,
      role: 'assistant',
      content: 'Great! The debug interface allows you to test different prompts and see exactly which messages are included in summaries. You can also see the original messages alongside the generated summaries.',
      tokenCount: 35,
      isSummarized: true,
    });
    testMessages.push(message4);

    // Create test summary
    testSummary = await summaryRepository.create({
      conversationId: testConversation.id,
      content: 'User is asking for help with debugging summarization. They want to test different prompts and understand message inclusion. Assistant explained the debug interface capabilities.',
      messageRangeStart: message1.id,
      messageRangeEnd: message4.id,
      tokenCount: 45,
    });
  });

  afterEach(async () => {
    // Clean up test data after each test
    if (testSummary) {
      await summaryRepository.delete(testSummary.id);
      testSummary = null;
    }
    if (testMessages) {
      for (const message of testMessages) {
        await messageRepository.delete(message.id);
      }
      testMessages = [];
    }
    if (testConversation) {
      await conversationRepository.delete(testConversation.id);
      testConversation = null;
    }
    if (testUser) {
      await userRepository.delete(testUser.id);
      testUser = null;
    }
  });

  describe('Debug Data Retrieval', () => {
    it('should retrieve comprehensive debug data for a conversation', async () => {
      const response = await request(app)
        .get(`/api/debug/conversations/${testConversation.id}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      
      const debugData = response.body.data;
      
      // Verify conversation ID
      expect(debugData.conversationId).toBe(testConversation.id);
      
      // Verify messages
      expect(debugData.originalMessages).toHaveLength(4);
      expect(debugData.originalMessages[0].content).toBe('Hello, I need help with debugging summarization.');
      expect(debugData.originalMessages[3].isSummarized).toBe(true);
      
      // Verify summaries
      expect(debugData.summaries).toHaveLength(1);
      expect(debugData.summaries[0].content).toContain('User is asking for help');
      expect(debugData.summaries[0].isActive).toBe(true);
      
      // Verify prompts
      expect(debugData.summarizationPrompts).toHaveProperty('initialPrompt');
      expect(debugData.summarizationPrompts).toHaveProperty('rollingPrompt');
      expect(debugData.summarizationPrompts.initialPrompt).toContain('comprehensive summary');
      
      // Verify config
      expect(debugData.config).toHaveProperty('maxTokensBeforeSummarization');
      expect(debugData.config).toHaveProperty('summaryModel');
      expect(debugData.config).toHaveProperty('preserveRecentMessages');
      expect(debugData.config).toHaveProperty('maxSummaryTokens');
    });

    it('should track message inclusion in summaries correctly', async () => {
      const response = await request(app)
        .get(`/api/debug/conversations/${testConversation.id}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const messages = response.body.data.originalMessages;
      
      // All messages should be marked as included since they're in the summary range
      messages.forEach((message: any) => {
        expect(message.isIncludedInSummary).toBe(true);
      });
      
      // Only the last message should be marked as summarized
      expect(messages[3].isSummarized).toBe(true);
      expect(messages[0].isSummarized).toBe(false);
      expect(messages[1].isSummarized).toBe(false);
      expect(messages[2].isSummarized).toBe(false);
    });
  });

  describe('Test Summarization', () => {
    it('should test summarization with default settings', async () => {
      const response = await request(app)
        .post(`/api/debug/conversations/${testConversation.id}/test-summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.status).toBe('success');
      
      const testData = response.body.data;
      
      // Verify test summary
      expect(testData.testSummary).toHaveProperty('content');
      expect(testData.testSummary).toHaveProperty('messageCount');
      expect(testData.testSummary).toHaveProperty('promptUsed');
      expect(testData.testSummary).toHaveProperty('isRollingPrompt');
      
      expect(testData.testSummary.messageCount).toBe(4);
      expect(testData.testSummary.isRollingPrompt).toBe(false);
      
      // Verify original messages
      expect(testData.originalMessages).toHaveLength(4);
      expect(testData.originalMessages[0].content).toBe('Hello, I need help with debugging summarization.');
    });

    it('should test summarization with custom prompt', async () => {
      const customPrompt = `Create a brief summary of this conversation focusing on technical details:

{{MESSAGES}}

Context: {{CONTEXT}}
Message count: {{MESSAGE_COUNT}}

Provide a concise technical summary.`;

      const response = await request(app)
        .post(`/api/debug/conversations/${testConversation.id}/test-summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customPrompt,
          useRollingPrompt: false,
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      
      const testData = response.body.data;
      expect(testData.testSummary.promptUsed).toBe(customPrompt);
      expect(testData.testSummary.isRollingPrompt).toBe(false);
    });

    it('should test rolling summarization with existing summary', async () => {
      const response = await request(app)
        .post(`/api/debug/conversations/${testConversation.id}/test-summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          useRollingPrompt: true,
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      
      const testData = response.body.data;
      expect(testData.testSummary.isRollingPrompt).toBe(true);
      expect(testData.testSummary.existingSummary).toContain('User is asking for help');
    });

    it('should test summarization with specific message IDs', async () => {
      const messageIds = [testMessages[0].id, testMessages[2].id];

      const response = await request(app)
        .post(`/api/debug/conversations/${testConversation.id}/test-summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageIds,
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      
      const testData = response.body.data;
      expect(testData.testSummary.messageCount).toBe(2);
      expect(testData.originalMessages).toHaveLength(2);
      expect(testData.originalMessages[0].id).toBe(testMessages[0].id);
      expect(testData.originalMessages[1].id).toBe(testMessages[2].id);
    });
  });

  describe('Prompt Management', () => {
    it('should retrieve current prompts', async () => {
      const response = await request(app)
        .get('/api/debug/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.prompts).toHaveProperty('initial');
      expect(response.body.data.prompts).toHaveProperty('rolling');
      expect(response.body.data.prompts.initial).toContain('comprehensive summary');
      expect(response.body.data.prompts.rolling).toContain('existing summary');
    });

    it('should update initial prompt', async () => {
      const newPrompt = `Test initial prompt template:

{{MESSAGES}}

Create a test summary with context: {{CONTEXT}}
Message count: {{MESSAGE_COUNT}}

This is a test prompt for debugging purposes.`;

      const response = await request(app)
        .put('/api/debug/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialPrompt: newPrompt,
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updatedPrompts.initial).toBe(true);
      expect(response.body.data.updatedPrompts.rolling).toBe(false);

      // Verify the prompt was actually updated
      const getResponse = await request(app)
        .get('/api/debug/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.prompts.initial).toBe(newPrompt);
    });

    it('should update rolling prompt', async () => {
      const newPrompt = `Test rolling prompt template:

EXISTING SUMMARY:
{{EXISTING_SUMMARY}}

NEW MESSAGES:
{{MESSAGES}}

CONTEXT: {{CONTEXT}}

Update the summary with new information.`;

      const response = await request(app)
        .put('/api/debug/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rollingPrompt: newPrompt,
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updatedPrompts.rolling).toBe(true);
      expect(response.body.data.updatedPrompts.initial).toBe(false);

      // Verify the prompt was actually updated
      const getResponse = await request(app)
        .get('/api/debug/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.prompts.rolling).toBe(newPrompt);
    });
  });

  describe('Configuration Management', () => {
    it('should update summarization configuration', async () => {
      const configUpdates = {
        maxTokensBeforeSummarization: 15000,
        preserveRecentMessages: 15,
        maxSummaryTokens: 2500,
      };

      const response = await request(app)
        .put('/api/debug/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configUpdates)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updatedFields).toEqual([
        'maxTokensBeforeSummarization',
        'preserveRecentMessages',
        'maxSummaryTokens',
      ]);
      
      expect(response.body.data.newConfig.maxTokensBeforeSummarization).toBe(15000);
      expect(response.body.data.newConfig.preserveRecentMessages).toBe(15);
      expect(response.body.data.newConfig.maxSummaryTokens).toBe(2500);
    });

    it('should filter out invalid configuration fields', async () => {
      const configUpdates = {
        maxTokensBeforeSummarization: 15000,
        invalidField: 'should be ignored',
        anotherInvalidField: 123,
        preserveRecentMessages: 12,
      };

      const response = await request(app)
        .put('/api/debug/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configUpdates)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updatedFields).toEqual([
        'maxTokensBeforeSummarization',
        'preserveRecentMessages',
      ]);
      
      // Invalid fields should not be in the response
      expect(response.body.data.newConfig).not.toHaveProperty('invalidField');
      expect(response.body.data.newConfig).not.toHaveProperty('anotherInvalidField');
    });
  });

  describe('Access Control', () => {
    it('should deny access in production without debug user list', async () => {
      // Temporarily set production environment
      process.env.NODE_ENV = 'production';
      delete process.env.DEBUG_USERS;

      await request(app)
        .get(`/api/debug/conversations/${testConversation.id}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Restore development environment
      process.env.NODE_ENV = 'development';
    });

    it('should allow access for users in debug list in production', async () => {
      // Set production environment with debug user
      process.env.NODE_ENV = 'production';
      process.env.DEBUG_USERS = `${testUser.id},other-user-id`;

      const response = await request(app)
        .get(`/api/debug/conversations/${testConversation.id}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Clean up
      process.env.NODE_ENV = 'development';
      delete process.env.DEBUG_USERS;
    });

    it('should deny access to conversations owned by other users', async () => {
      // Create another user and conversation
      const otherUser = await userRepository.create({
        username: `otheruser_${Date.now()}`,
        email: `other_${Date.now()}@example.com`,
        password: 'otherpassword123',
      });

      const otherConversation = await conversationRepository.create({
        userId: otherUser.id,
        title: 'Other User Conversation',
      });

      try {
        await request(app)
          .get(`/api/debug/conversations/${otherConversation.id}/summarization`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      } finally {
        // Clean up
        await conversationRepository.delete(otherConversation.id);
        await userRepository.delete(otherUser.id);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent conversation', async () => {
      const nonExistentId = uuidv4();

      await request(app)
        .get(`/api/debug/conversations/${nonExistentId}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle invalid conversation ID format', async () => {
      await request(app)
        .get('/api/debug/conversations/invalid-uuid/summarization')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle missing authentication', async () => {
      await request(app)
        .get(`/api/debug/conversations/${testConversation.id}/summarization`)
        .expect(401);
    });

    it('should handle invalid prompt updates', async () => {
      // Test with too short prompt
      await request(app)
        .put('/api/debug/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialPrompt: 'short',
        })
        .expect(400);

      // Test with no prompts provided
      await request(app)
        .put('/api/debug/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should handle invalid configuration updates', async () => {
      // Test with values out of range
      await request(app)
        .put('/api/debug/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          maxTokensBeforeSummarization: 100, // Too low
        })
        .expect(400);

      await request(app)
        .put('/api/debug/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preserveRecentMessages: 100, // Too high
        })
        .expect(400);
    });
  });
});