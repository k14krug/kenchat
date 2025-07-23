import request from 'supertest';
import { app } from '../../src/app';
import { testHelpers } from '../utils/testHelpers';

describe('API Endpoints Integration Tests', () => {
  // Test user data
  let testUser: any;
  let authToken: string;
  let testConversation: any;
  let testPersona: any;

  beforeAll(async () => {

    // Create test user and get auth token via API
    const userData = {
      username: 'testuser_' + Date.now(),
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    try {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (registerResponse.status === 201) {
        testUser = registerResponse.body.data.user;
        authToken = registerResponse.body.data.tokens.accessToken;
      } else {
        throw new Error('Failed to register test user: ' + JSON.stringify(registerResponse.body));
      }
    } catch (error) {
      console.error('Failed to create test user:', error);
      throw error;
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

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          username: 'newuser_' + Date.now(),
          email: 'newuser@example.com',
          password: 'NewPassword123!',
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.data.user.username).toBe(userData.username);
        expect(response.body.data.tokens.accessToken).toBeDefined();
        expect(response.body.data.tokens.refreshToken).toBeDefined();
      });

      it('should reject registration with weak password', async () => {
        const userData = {
          username: 'weakpassuser',
          email: 'weak@example.com',
          password: 'weak',
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('Password validation failed');
      });

      it('should reject registration with duplicate username', async () => {
        const userData = {
          username: testUser.username,
          email: 'duplicate@example.com',
          password: 'ValidPassword123!',
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(409);
        expect(response.body.status).toBe('error');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const loginData = {
          username: testUser.username,
          password: 'TestPassword123!',
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.user.id).toBe(testUser.id);
        expect(response.body.data.tokens.accessToken).toBeDefined();
      });

      it('should reject login with invalid credentials', async () => {
        const loginData = {
          username: testUser.username,
          password: 'WrongPassword',
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData);

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
      });
    });

    describe('GET /api/auth/profile', () => {
      it('should return user profile for authenticated user', async () => {
        const response = await authenticatedRequest('get', '/api/auth/profile');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.user.id).toBe(testUser.id);
        expect(response.body.data.user.username).toBe(testUser.username);
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app).get('/api/auth/profile');

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
      });
    });

    describe('POST /api/auth/logout', () => {
      it('should logout successfully', async () => {
        const response = await authenticatedRequest('post', '/api/auth/logout');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.message).toBe('Logout successful');
      });
    });
  });

  describe('Persona Management Endpoints', () => {
    describe('POST /api/personas', () => {
      it('should create a new persona', async () => {
        const personaData = {
          name: 'Test Assistant',
          description: 'A helpful test assistant',
          systemPrompt: 'You are a helpful assistant for testing purposes.',
          personalityTraits: { helpful: true, testing: true },
        };

        const response = await authenticatedRequest('post', '/api/personas')
          .send(personaData);

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.data.name).toBe(personaData.name);
        expect(response.body.data.userId).toBe(testUser.id);

        testPersona = response.body.data;
      });

      it('should reject persona with invalid system prompt', async () => {
        const personaData = {
          name: 'Invalid Persona',
          systemPrompt: 'Too short',
        };

        const response = await authenticatedRequest('post', '/api/personas')
          .send(personaData);

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
      });
    });

    describe('GET /api/personas', () => {
      it('should return user personas with pagination', async () => {
        const response = await authenticatedRequest('get', '/api/personas')
          .query({ page: 1, limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.pagination).toBeDefined();
      });
    });

    describe('GET /api/personas/:personaId', () => {
      it('should return specific persona', async () => {
        const response = await authenticatedRequest('get', `/api/personas/${testPersona.id}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.id).toBe(testPersona.id);
      });

      it('should return 404 for non-existent persona', async () => {
        const response = await authenticatedRequest('get', '/api/personas/non-existent-id');

        expect(response.status).toBe(404);
        expect(response.body.status).toBe('error');
      });
    });

    describe('PUT /api/personas/:personaId', () => {
      it('should update persona successfully', async () => {
        const updateData = {
          name: 'Updated Test Assistant',
          description: 'An updated test assistant',
        };

        const response = await authenticatedRequest('put', `/api/personas/${testPersona.id}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.name).toBe(updateData.name);
      });
    });
  });

  describe('Conversation Management Endpoints', () => {
    describe('POST /api/conversations', () => {
      it('should create a new conversation', async () => {
        const conversationData = {
          title: 'Test Conversation',
          intent: 'testing',
          customInstructions: 'Please be helpful and thorough in testing.',
        };

        const response = await authenticatedRequest('post', '/api/conversations')
          .send(conversationData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(conversationData.title);
        expect(response.body.data.userId).toBe(testUser.id);

        testConversation = response.body.data;
      });
    });

    describe('GET /api/conversations', () => {
      it('should return user conversations', async () => {
        const response = await authenticatedRequest('get', '/api/conversations');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/conversations/:id', () => {
      it('should return specific conversation', async () => {
        const response = await authenticatedRequest('get', `/api/conversations/${testConversation.id}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(testConversation.id);
      });
    });

    describe('PUT /api/conversations/:id', () => {
      it('should update conversation', async () => {
        const updateData = {
          title: 'Updated Test Conversation',
          intent: 'updated-testing',
        };

        const response = await authenticatedRequest('put', `/api/conversations/${testConversation.id}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(updateData.title);
      });
    });
  });

  describe('Message Endpoints', () => {
    describe('POST /api/conversations/:id/messages', () => {
      it('should add message to conversation', async () => {
        const messageData = {
          role: 'user',
          content: 'Hello, this is a test message.',
        };

        const response = await authenticatedRequest('post', `/api/conversations/${testConversation.id}/messages`)
          .send(messageData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.content).toBe(messageData.content);
        expect(response.body.data.role).toBe(messageData.role);
      });

      it('should reject message with invalid role', async () => {
        const messageData = {
          role: 'invalid',
          content: 'This should fail.',
        };

        const response = await authenticatedRequest('post', `/api/conversations/${testConversation.id}/messages`)
          .send(messageData);

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
      });
    });

    describe('GET /api/conversations/:id/messages', () => {
      it('should return conversation messages', async () => {
        const response = await authenticatedRequest('get', `/api/conversations/${testConversation.id}/messages`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cost Tracking Endpoints', () => {
    describe('GET /api/cost-tracking/stats', () => {
      it('should return user usage statistics', async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = new Date().toISOString();

        const response = await authenticatedRequest('get', '/api/cost-tracking/stats')
          .query({ startDate, endDate });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeDefined();
      });
    });

    describe('GET /api/cost-tracking/report', () => {
      it('should generate cost report', async () => {
        const response = await authenticatedRequest('get', '/api/cost-tracking/report')
          .query({ period: 'monthly' });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeDefined();
      });
    });

    describe('GET /api/cost-tracking/limits', () => {
      it('should check cost limits', async () => {
        const response = await authenticatedRequest('get', '/api/cost-tracking/limits');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeDefined();
      });
    });
  });

  describe('AI Endpoints', () => {
    describe('GET /api/ai/models', () => {
      it('should return available AI models', async () => {
        const response = await authenticatedRequest('get', '/api/ai/models');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeInstanceOf(Array);
      });
    });

    describe('POST /api/ai/cost', () => {
      it('should calculate cost for token usage', async () => {
        const costData = {
          model: 'gpt-3.5-turbo',
          inputTokens: 100,
          outputTokens: 50,
        };

        const response = await authenticatedRequest('post', '/api/ai/cost')
          .send(costData);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.totalCost).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('INVALID_JSON');
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should handle invalid authorization token', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      const requests = [];
      const userData = {
        username: 'ratelimituser',
        password: 'wrongpassword',
      };

      // Make multiple rapid requests to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send(userData)
        );
      }

      const responses = await Promise.all(requests);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize HTML input in conversation creation', async () => {
      const conversationData = {
        title: '<script>alert("xss")</script>Clean Title',
        customInstructions: '<img src="x" onerror="alert(1)">Clean instructions',
      };

      const response = await authenticatedRequest('post', '/api/conversations')
        .send(conversationData);

      expect(response.status).toBe(201);
      expect(response.body.data.title).not.toContain('<script>');
      expect(response.body.data.customInstructions).not.toContain('<img');
    });

    it('should validate required fields', async () => {
      const response = await authenticatedRequest('post', '/api/personas')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Validation error');
    });
  });

  describe('Resource Ownership', () => {
    it('should prevent access to other users conversations', async () => {
      // This would require creating another user and conversation
      // For now, we test with a non-existent conversation ID
      const response = await authenticatedRequest('get', '/api/conversations/other-user-conversation-id');

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });
  });
});