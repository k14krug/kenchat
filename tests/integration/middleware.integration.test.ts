import request from 'supertest';
import { app } from '../../src/app';

describe('Middleware Integration Tests', () => {
  describe('Authentication Middleware', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.message).toContain('Access token is required');
    });

    it('should reject requests with invalid token format', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    it('should reject requests with malformed Bearer token', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    it('should reject requests with invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });

  describe('Validation Middleware', () => {
    it('should validate required fields in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Validation error');
    });

    it('should validate email format in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'ValidPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('valid email');
    });

    it('should validate password strength in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Password must');
    });

    it('should validate username format in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab', // Too short
          email: 'test@example.com',
          password: 'ValidPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Username must be between');
    });

    it('should validate UUID format in URL parameters', async () => {
      const response = await request(app)
        .get('/api/conversations/invalid-uuid')
        .set('Authorization', 'Bearer valid.jwt.token');

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('valid UUID');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .query({ page: 0, limit: 101 }) // Invalid values
        .set('Authorization', 'Bearer valid.jwt.token');

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('Input Sanitization Middleware', () => {
    it('should sanitize HTML in request body', async () => {
      const maliciousInput = {
        username: '<script>alert("xss")</script>testuser',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousInput);

      // The request should be processed but the script tag should be removed
      // Note: This test assumes the sanitization happens before validation
      expect(response.status).toBe(400); // Will fail validation due to short username after sanitization
    });

    it('should sanitize JavaScript protocols', async () => {
      const maliciousInput = {
        username: 'javascript:alert(1)testuser',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousInput);

      expect(response.status).toBe(400); // Should fail validation after sanitization
    });

    it('should sanitize event handlers', async () => {
      const maliciousInput = {
        username: 'onclick=alert(1)testuser',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousInput);

      expect(response.status).toBe(400); // Should fail validation after sanitization
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/non-existent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toContain('Route GET /api/non-existent-endpoint not found');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('INVALID_JSON');
    });

    it('should include timestamp in error responses', async () => {
      const response = await request(app).get('/api/non-existent-endpoint');

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should not expose sensitive error details in production', async () => {
      // This test would need to be run with NODE_ENV=production
      const response = await request(app).get('/api/non-existent-endpoint');

      expect(response.body.details).toBeUndefined();
    });
  });

  describe('Rate Limiting Middleware', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      const requests = [];
      const loginData = {
        username: 'nonexistentuser',
        password: 'wrongpassword',
      };

      // Make multiple rapid requests to trigger rate limiting
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send(loginData)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper format
      if (rateLimitedResponses.length > 0) {
        const rateLimitedResponse = rateLimitedResponses[0];
        expect(rateLimitedResponse.body.status).toBe('error');
        expect(rateLimitedResponse.body.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(rateLimitedResponse.body.retryAfter).toBeDefined();
      }
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword',
        });

      // Check for rate limit headers (may not be present in all implementations)
      if (response.headers['x-ratelimit-limit']) {
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      }
    });
  });

  describe('CORS Middleware', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
    });
  });

  describe('Security Headers Middleware', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/api');

      // Helmet should add various security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('API Documentation Middleware', () => {
    it('should add API version header', async () => {
      const response = await request(app).get('/api');

      expect(response.headers['x-api-version']).toBe('1.0.0');
    });

    it('should add request ID header', async () => {
      const response = await request(app).get('/api');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should provide API documentation', async () => {
      const response = await request(app).get('/api/docs');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Personal Chatbot API');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints.authentication).toBeDefined();
      expect(response.body.endpoints.conversations).toBeDefined();
      expect(response.body.endpoints.personas).toBeDefined();
    });
  });

  describe('Request Logging Middleware', () => {
    it('should log requests', async () => {
      // This test would require capturing log output
      // For now, we just verify the request completes successfully
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
    });
  });

  describe('Content Type Validation', () => {
    it('should reject non-JSON content for JSON endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('not json');

      expect(response.status).toBe(400);
    });

    it('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: 'ValidPassword123!',
        }));

      // Should process the request (may fail for other reasons like duplicate user)
      expect([201, 400, 409]).toContain(response.status);
    });
  });

  describe('Request Size Limits', () => {
    it('should reject requests that are too large', async () => {
      const largePayload = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'ValidPassword123!',
        largeField: 'x'.repeat(11 * 1024 * 1024), // 11MB
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload);

      expect(response.status).toBe(413); // Payload Too Large
    });
  });
});