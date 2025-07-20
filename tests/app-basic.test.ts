import request from 'supertest';
import express from 'express';
import { environment } from '../src/config/environment';

describe('Basic App Infrastructure', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create a minimal Express app for testing basic infrastructure
    app = express();
    
    // Basic middleware
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: environment.nodeEnv,
      });
    });

    // API info endpoint
    app.get('/api', (req, res) => {
      res.status(200).json({
        message: 'KenChat API is running',
        version: '1.0.0',
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        status: 'error',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString(),
      });
    });
  });

  describe('Environment Configuration', () => {
    it('should load environment configuration correctly', () => {
      expect(environment).toBeDefined();
      expect(environment.nodeEnv).toBeDefined();
      expect(environment.port).toBeDefined();
      expect(environment.database).toBeDefined();
      expect(environment.database.host).toBeDefined();
      expect(environment.database.port).toBeDefined();
    });

    it('should validate required configuration properties', () => {
      expect(typeof environment.nodeEnv).toBe('string');
      expect(typeof environment.port).toBe('number');
      expect(typeof environment.database.host).toBe('string');
      expect(typeof environment.database.port).toBe('number');
      expect(typeof environment.database.name).toBe('string');
    });
  });

  describe('Basic Express Server', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });

    it('should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'KenChat API is running');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Route GET /unknown-route not found');
    });
  });

  describe('JSON Parsing', () => {
    it('should parse JSON request bodies', async () => {
      // Create a new app instance for this test to avoid route conflicts
      const testApp = express();
      testApp.use(express.json());
      
      testApp.post('/test-json', (req, res) => {
        res.json({ received: req.body });
      });

      const testData = { test: 'data', number: 123 };
      
      const response = await request(testApp)
        .post('/test-json')
        .send(testData)
        .expect(200);

      expect(response.body.received).toEqual(testData);
    });
  });
});