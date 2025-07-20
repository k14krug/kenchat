import request from 'supertest';
import { app } from '../../src/app';

describe('Summarization API Basic Tests', () => {
  describe('GET /api/summarization/config', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/summarization/config')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
    });
  });

  describe('GET /api/summarization/prompts', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/summarization/prompts')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
    });
  });

  describe('Health check for summarization routes', () => {
    it('should have summarization routes registered', async () => {
      // This test verifies that the routes are properly registered
      // by checking that we get 401 (auth required) instead of 404 (not found)
      
      const endpoints = [
        '/api/summarization/config',
        '/api/summarization/prompts',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        
        // Should get 401 (unauthorized) not 404 (not found)
        expect(response.status).toBe(401);
        expect(response.status).not.toBe(404);
      }
    });

    it('should require authentication before validation', async () => {
      const response = await request(app)
        .get('/api/conversations/invalid-id/summarization/check')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
    });
  });
});