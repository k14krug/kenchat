import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/database/connection';
import { 
  createTestUser, 
  createTestConversation, 
  createTestMessages,
  getAuthToken,
  cleanupTestData 
} from '../utils/testHelpers';

describe('Summarization Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const user = await createTestUser();
    userId = user.id;
    authToken = await getAuthToken(user.username, 'testpassword');

    // Create test conversation
    const conversation = await createTestConversation(userId);
    conversationId = conversation.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /api/conversations/:conversationId/summarization/check', () => {
    it('should check if conversation needs summarization', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/summarization/check`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('conversationId', conversationId);
      expect(response.body.data).toHaveProperty('needsSummarization');
      expect(typeof response.body.data.needsSummarization).toBe('boolean');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/conversations/${conversationId}/summarization/check`)
        .expect(401);
    });

    it('should return 400 for invalid conversation ID', async () => {
      await request(app)
        .get('/api/conversations/invalid-id/summarization/check')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /api/conversations/:conversationId/summarization', () => {
    beforeEach(async () => {
      // Create enough messages to trigger summarization
      await createTestMessages(conversationId, 15, {
        longContent: true, // Create messages with high token count
      });
    });

    it('should successfully summarize conversation', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('summarizedMessageCount');
      expect(response.body.data).toHaveProperty('preservedMessageCount');
      expect(response.body.data).toHaveProperty('tokensSaved');
      expect(response.body.data).toHaveProperty('newTokenCount');

      // Verify summary structure
      const summary = response.body.data.summary;
      expect(summary).toHaveProperty('id');
      expect(summary).toHaveProperty('conversationId', conversationId);
      expect(summary).toHaveProperty('content');
      expect(summary).toHaveProperty('isActive', true);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/conversations/${conversationId}/summarization`)
        .expect(401);
    });

    it('should handle conversation with insufficient messages', async () => {
      // Create a new conversation with few messages
      const newConversation = await createTestConversation(userId);
      await createTestMessages(newConversation.id, 2);

      const response = await request(app)
        .post(`/api/conversations/${newConversation.id}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/conversations/:conversationId/context', () => {
    it('should get conversation context', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('conversationId', conversationId);
      expect(response.body.data).toHaveProperty('recentMessageCount');
      expect(response.body.data).toHaveProperty('totalTokens');
      expect(typeof response.body.data.totalTokens).toBe('number');
    });

    it('should include summary in context when available', async () => {
      // First create a summary
      await request(app)
        .post(`/api/conversations/${conversationId}/summarization`)
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.summary).toBeTruthy();
      expect(response.body.data.summary).toHaveProperty('content');
    });
  });

  describe('GET /api/conversations/:conversationId/summaries', () => {
    beforeEach(async () => {
      // Ensure we have a summary
      await request(app)
        .post(`/api/conversations/${conversationId}/summarization`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should get conversation summaries with pagination', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/summaries`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/summaries?page=1&limit=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get(`/api/conversations/${conversationId}/summaries?page=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get(`/api/conversations/${conversationId}/summaries?limit=101`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/conversations/:conversationId/summaries/stats', () => {
    it('should get summary statistics', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/summaries/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('conversationId', conversationId);
      expect(response.body.data).toHaveProperty('totalSummaries');
      expect(response.body.data).toHaveProperty('activeSummaries');
      expect(response.body.data).toHaveProperty('totalTokens');
      expect(typeof response.body.data.totalSummaries).toBe('number');
    });
  });

  describe('POST /api/conversations/:conversationId/summaries/rolling-update', () => {
    let messageIds: string[];

    beforeEach(async () => {
      // Create initial summary
      await request(app)
        .post(`/api/conversations/${conversationId}/summarization`)
        .set('Authorization', `Bearer ${authToken}`);

      // Create new messages for rolling update
      const newMessages = await createTestMessages(conversationId, 3);
      messageIds = newMessages.map(msg => msg.id);
    });

    it('should update rolling summary with new messages', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/summaries/rolling-update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ messageIds })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('updatedMessageCount', messageIds.length);
    });

    it('should validate messageIds array', async () => {
      await request(app)
        .post(`/api/conversations/${conversationId}/summaries/rolling-update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ messageIds: [] })
        .expect(400);

      await request(app)
        .post(`/api/conversations/${conversationId}/summaries/rolling-update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ messageIds: ['invalid-id'] })
        .expect(400);
    });
  });

  describe('GET /api/summarization/config', () => {
    it('should get summarization configuration', async () => {
      const response = await request(app)
        .get('/api/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('config');
      expect(response.body.data.config).toHaveProperty('maxTokensBeforeSummarization');
      expect(response.body.data.config).toHaveProperty('summaryModel');
      expect(response.body.data.config).toHaveProperty('preserveRecentMessages');
      expect(response.body.data.config).toHaveProperty('maxSummaryTokens');
    });
  });

  describe('PUT /api/summarization/config', () => {
    it('should update summarization configuration', async () => {
      const updates = {
        maxTokensBeforeSummarization: 15000,
        preserveRecentMessages: 15,
        summaryModel: 'gpt-4',
      };

      const response = await request(app)
        .put('/api/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('updatedFields');
      expect(response.body.data.updatedFields).toEqual(Object.keys(updates));
    });

    it('should validate configuration values', async () => {
      await request(app)
        .put('/api/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ maxTokensBeforeSummarization: 500 }) // Too low
        .expect(400);

      await request(app)
        .put('/api/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ preserveRecentMessages: 0 }) // Too low
        .expect(400);

      await request(app)
        .put('/api/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ summaryModel: '' }) // Empty string
        .expect(400);
    });

    it('should reject empty updates', async () => {
      await request(app)
        .put('/api/summarization/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/summarization/prompts', () => {
    it('should get prompt templates', async () => {
      const response = await request(app)
        .get('/api/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('summaryPromptTemplate');
      expect(response.body.data).toHaveProperty('rollingSummaryPromptTemplate');
      expect(typeof response.body.data.summaryPromptTemplate).toBe('string');
      expect(typeof response.body.data.rollingSummaryPromptTemplate).toBe('string');
    });
  });

  describe('PUT /api/summarization/prompts', () => {
    it('should update prompt templates', async () => {
      const updates = {
        summaryPromptTemplate: 'New summary template: {{MESSAGES}} with {{CONTEXT}}',
        rollingSummaryPromptTemplate: 'New rolling template: {{EXISTING_SUMMARY}} + {{MESSAGES}}',
      };

      const response = await request(app)
        .put('/api/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('updatedTemplates');
      expect(response.body.data.updatedTemplates).toEqual(Object.keys(updates));
    });

    it('should validate prompt templates', async () => {
      await request(app)
        .put('/api/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ summaryPromptTemplate: '' }) // Empty string
        .expect(400);

      await request(app)
        .put('/api/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ summaryPromptTemplate: 'short' }) // Too short
        .expect(400);
    });

    it('should reject empty updates', async () => {
      await request(app)
        .put('/api/summarization/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /api/conversations/:conversationId/summaries', () => {
    beforeEach(async () => {
      // Create a summary to delete
      await request(app)
        .post(`/api/conversations/${conversationId}/summarization`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should delete conversation summaries', async () => {
      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/summaries`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('conversationId', conversationId);
      expect(response.body.data).toHaveProperty('deletedSummaries');
      expect(typeof response.body.data.deletedSummaries).toBe('number');
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent conversation', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app)
        .get(`/api/conversations/${nonExistentId}/summarization/check`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle unauthorized access to other user\'s conversation', async () => {
      // Create another user and conversation
      const otherUser = await createTestUser('otheruser');
      const otherConversation = await createTestConversation(otherUser.id);

      await request(app)
        .get(`/api/conversations/${otherConversation.id}/summarization/check`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should handle malformed requests gracefully', async () => {
      await request(app)
        .post(`/api/conversations/${conversationId}/summaries/rolling-update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalidField: 'value' })
        .expect(400);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large conversations efficiently', async () => {
      // Create a conversation with many messages
      const largeConversation = await createTestConversation(userId);
      await createTestMessages(largeConversation.id, 100, { longContent: true });

      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/conversations/${largeConversation.id}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(30000); // 30 seconds
      expect(response.body.data.summarizedMessageCount).toBeGreaterThan(0);
    });

    it('should handle conversations with mixed message types', async () => {
      const mixedConversation = await createTestConversation(userId);
      
      // Create messages with different roles and content types
      await createTestMessages(mixedConversation.id, 20, {
        mixedRoles: true,
        variableContent: true,
      });

      const response = await request(app)
        .post(`/api/conversations/${mixedConversation.id}/summarization`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.summary.content).toBeTruthy();
    });
  });
});