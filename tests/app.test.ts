import request from 'supertest';
import App from '../src/app';

describe('App', () => {
  let app: App;

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'test_db';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_password';
    process.env.OPENAI_API_KEY = 'test_key';
    process.env.JWT_SECRET = 'test_jwt_secret_key_at_least_32_characters_long';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_at_least_32_characters_long';
    
    app = new App();
  });

  describe('Health Check', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('API Endpoint', () => {
    it('should return API information', async () => {
      const response = await request(app.app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'KenChat API is running');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app.app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Route GET /unknown-route not found');
    });
  });
});