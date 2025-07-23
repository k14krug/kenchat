import request from 'supertest';
import { app } from '../../src/app';
import { testHelpers } from '../utils/testHelpers';

describe('Complete API Integration Tests', () => {
  let testUser: any;
  let authToken: string;
  let testConversation: any;
  let testPersona: any;
  let testMessage: any;

  beforeAll(async () => {
    // Create a test user for all tests
    const userData = {
      username: 'apitest_' + Date.now(),
      email: 'apitest@example.com',
      password: 'TestPassword123!',
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    if (registerResponse.status === 201) {
      testUser = registerResponse.body.data.user;
      authToken = registerResponse.body.data.tokens.accessToken;
    } else {
      throw new Error('Failed to create test user: ' + JSON.stringify(registerResponse.body));
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) {
      await testHelpers.cleanupTestUser(testUser.id);
    }
  });

  // Helper function for authenticated requests
  const authenticatedRequest = (method: 'get' | 'post' | 'put' | 'delete', url: string) => {
    return request(app)[method](url).set('Authorization', `Bearer ${authToken}`);
  };

  describe('Complete User Journey', () => {
    it('should complete a full user workflow', async () => {
      // 1. Create a persona
      const personaData = {
        name: 'Test Assistant',
        description: 'A helpful test assistant for API testing',
        systemPrompt: 'You are a helpful assistant designed for API testing. Be concise and helpful.',
        personalityTraits: { helpful: true, concise: true },
      };

      const personaResponse = await authenticatedRequest('post', '/api/personas')
        .send(personaData);

      expect(personaResponse.status).toBe(201);
      expect(personaResponse.body.status).toBe('success');
      testPersona = personaResponse.body.data;

      // 2. Create a conversation
      const conversationData = {
        title: 'API Test Conversation',
        intent: 'testing',
        customInstructions: 'Please be thorough in your testing responses.',
        currentPersonaId: testPersona.id,
      };

      const conversationResponse = await authenticatedRequest('post', '/api/conversations')
        .send(conversationData);

      expect(conversationResponse.status).toBe(201);
      expect(conversationResponse.body.success).toBe(true);
      testConversation = conversationResponse.body.data;

      // 3. Add a message to the conversation
      const messageData = {
        role: 'user',
        content: 'Hello, this is a test message for the API integration test.',
        personaId: testPersona.id,
      };

      const messageResponse = await authenticatedRequest('post', `/api/conversations/${testConversation.id}/messages`)
        .send(messageData);

      expect(messageResponse.status).toBe(201);
      expect(messageResponse.body.success).toBe(true);
      testMessage = messageResponse.body.data;

      // 4. Retrieve the conversation with messages
      const fullConversationResponse = await authenticatedRequest('get', `/api/conversations/${testConversation.id}/full`);

      expect(fullConversationResponse.status).toBe(200);
      expect(fullConversationResponse.body.success).toBe(true);
      expect(fullConversationResponse.body.data.messages).toHaveLength(1);

      // 5. Update the conversation
      const updateData = {
        title: 'Updated API Test Conversation',
        intent: 'updated-testing',
      };

      const updateResponse = await authenticatedRequest('put', `/api/conversations/${testConversation.id}`)
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.title).toBe(updateData.title);

      // 6. Get user's conversations
      const conversationsResponse = await authenticatedRequest('get', '/api/conversations');

      expect(conversationsResponse.status).toBe(200);
      expect(conversationsResponse.body.success).toBe(true);
      expect(conversationsResponse.body.data).toBeInstanceOf(Array);
      expect(conversationsResponse.body.data.length).toBeGreaterThan(0);

      // 7. Get user's personas
      const personasResponse = await authenticatedRequest('get', '/api/personas');

      expect(personasResponse.status).toBe(200);
      expect(personasResponse.body.status).toBe('success');
      expect(personasResponse.body.data).toBeInstanceOf(Array);
      expect(personasResponse.body.data.length).toBeGreaterThan(0);

      // 8. Check cost tracking
      const costStatsResponse = await authenticatedRequest('get', '/api/cost-tracking/stats')
        .query({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        });

      expect(costStatsResponse.status).toBe(200);
      expect(costStatsResponse.body.status).toBe('success');

      // 9. Get AI models
      const modelsResponse = await authenticatedRequest('get', '/api/ai/models');

      expect(modelsResponse.status).toBe(200);
      expect(modelsResponse.body.status).toBe('success');
      expect(modelsResponse.body.data).toBeInstanceOf(Array);

      // 10. Calculate cost
      const costData = {
        model: 'gpt-3.5-turbo',
        inputTokens: 100,
        outputTokens: 50,
      };

      const costResponse = await authenticatedRequest('post', '/api/ai/cost')
        .send(costData);

      expect(costResponse.status).toBe(200);
      expect(costResponse.body.status).toBe('success');
      expect(costResponse.body.data.totalCost).toBeDefined();
    });
  });

  describe('Data Consistency and Relationships', () => {
    it('should maintain data consistency across related entities', async () => {
      // Verify conversation belongs to the correct user
      const conversationResponse = await authenticatedRequest('get', `/api/conversations/${testConversation.id}`);
      expect(conversationResponse.body.data.userId).toBe(testUser.id);

      // Verify message belongs to the correct conversation
      const messagesResponse = await authenticatedRequest('get', `/api/conversations/${testConversation.id}/messages`);
      expect(messagesResponse.body.data[0].conversationId).toBe(testConversation.id);

      // Verify persona belongs to the correct user
      const personaResponse = await authenticatedRequest('get', `/api/personas/${testPersona.id}`);
      expect(personaResponse.body.data.userId).toBe(testUser.id);
    });

    it('should prevent access to other users data', async () => {
      // Create another user
      const otherUserData = {
        username: 'otheruser_' + Date.now(),
        email: 'other@example.com',
        password: 'OtherPassword123!',
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherAuthToken = otherUserResponse.body.data.tokens.accessToken;

      // Try to access first user's conversation with second user's token
      const unauthorizedResponse = await request(app)
        .get(`/api/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${otherAuthToken}`);

      expect(unauthorizedResponse.status).toBe(404); // Should not find the conversation
    });
  });

  describe('Pagination and Filtering', () => {
    it('should handle pagination correctly', async () => {
      // Test pagination with conversations
      const page1Response = await authenticatedRequest('get', '/api/conversations')
        .query({ page: 1, limit: 1 });

      expect(page1Response.status).toBe(200);
      expect(page1Response.body.pagination).toBeDefined();
      expect(page1Response.body.pagination.page).toBe(1);
      expect(page1Response.body.pagination.limit).toBe(1);

      // Test pagination with personas
      const personasPage1Response = await authenticatedRequest('get', '/api/personas')
        .query({ page: 1, limit: 5 });

      expect(personasPage1Response.status).toBe(200);
      expect(personasPage1Response.body.pagination).toBeDefined();
    });

    it('should handle search and filtering', async () => {
      // Search conversations
      const searchResponse = await authenticatedRequest('get', '/api/conversations/search')
        .query({ q: 'API Test', page: 1, limit: 10 });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.success).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent resource IDs', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      
      const response = await authenticatedRequest('get', `/api/conversations/${fakeUUID}`);
      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });

    it('should handle malformed UUIDs', async () => {
      const response = await authenticatedRequest('get', '/api/conversations/invalid-uuid');
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('valid UUID');
    });

    it('should handle empty request bodies where data is required', async () => {
      const response = await authenticatedRequest('post', '/api/personas').send({});
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });

    it('should handle oversized request bodies', async () => {
      const oversizedData = {
        name: 'Test Persona',
        systemPrompt: 'x'.repeat(15000), // Exceeds 10000 char limit
      };

      const response = await authenticatedRequest('post', '/api/personas')
        .send(oversizedData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('Response Format Consistency', () => {
    it('should have consistent success response format', async () => {
      const response = await authenticatedRequest('get', '/api/conversations');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);
    });

    it('should have consistent error response format', async () => {
      const response = await request(app).get('/api/conversations'); // No auth

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.status).toBe('error');
    });

    it('should include pagination metadata for paginated responses', async () => {
      const response = await authenticatedRequest('get', '/api/conversations')
        .query({ page: 1, limit: 5 });

      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });
  });

  describe('API Documentation', () => {
    it('should provide comprehensive API documentation', async () => {
      const response = await request(app).get('/api/docs');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Personal Chatbot API');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints.authentication).toBeDefined();
      expect(response.body.endpoints.conversations).toBeDefined();
      expect(response.body.endpoints.personas).toBeDefined();
      expect(response.body.endpoints.ai).toBeDefined();
      expect(response.body.endpoints.costTracking).toBeDefined();
      expect(response.body.errorCodes).toBeDefined();
      expect(response.body.responseFormat).toBeDefined();
    });

    it('should include API version in headers', async () => {
      const response = await request(app).get('/api');

      expect(response.headers['x-api-version']).toBe('1.0.0');
    });
  });

  describe('Performance and Limits', () => {
    it('should handle concurrent requests', async () => {
      const requests = [];
      
      for (let i = 0; i < 5; i++) {
        requests.push(authenticatedRequest('get', '/api/conversations'));
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should respect rate limits', async () => {
      // This test would need to be adjusted based on actual rate limit settings
      const requests = [];
      
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({ username: 'nonexistent', password: 'wrong' })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      // Some requests should be rate limited
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Features', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/api');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should sanitize input to prevent XSS', async () => {
      const maliciousData = {
        title: '<script>alert("xss")</script>Clean Title',
        intent: '<img src="x" onerror="alert(1)">clean intent',
      };

      const response = await authenticatedRequest('put', `/api/conversations/${testConversation.id}`)
        .send(maliciousData);

      if (response.status === 200) {
        expect(response.body.data.title).not.toContain('<script>');
        expect(response.body.data.intent).not.toContain('<img');
      }
    });

    it('should validate content types', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('not json');

      expect(response.status).toBe(400);
    });
  });
});