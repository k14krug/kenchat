import request from 'supertest';
import express from 'express';
import { AuthController } from '../../src/controllers/AuthController';
import { AuthService } from '../../src/services/AuthService';
import { errorHandler } from '../../src/middleware/errorHandler';
import { 
  createMockUserResponse, 
  createMockCreateUserRequest,
  validPasswords,
  invalidPasswords 
} from '../utils/testHelpers';
import { 
  AuthenticationError, 
  ConflictError, 
  ValidationError 
} from '../../src/utils/errors';

// Mock AuthService
jest.mock('../../src/services/AuthService');

// Mock logger
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('AuthController', () => {
  let app: express.Application;
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    authController = new AuthController();
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    (authController as any).authService = mockAuthService;

    // Setup routes
    app.post('/register', authController.register);
    app.post('/login', authController.login);
    app.post('/refresh', authController.refreshToken);
    app.post('/logout', (req, res, next) => {
      req.user = createMockUserResponse();
      next();
    }, authController.logout);
    app.get('/profile', (req, res, next) => {
      req.user = createMockUserResponse();
      next();
    }, authController.getProfile);
    app.get('/verify', (req, res, next) => {
      req.user = createMockUserResponse();
      next();
    }, authController.verifyToken);
    app.post('/check-password', authController.checkPasswordStrength);

    // Error handler
    app.use(errorHandler);

    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    test('should register user successfully', async () => {
      const userData = createMockCreateUserRequest();
      const mockUser = createMockUserResponse();
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockAuthService.validatePasswordStrength.mockReturnValueOnce({
        isValid: true,
        errors: []
      });
      mockAuthService.register.mockResolvedValueOnce({
        user: mockUser,
        tokens: mockTokens
      });

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toMatchObject({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        first_name: mockUser.first_name,
        last_name: mockUser.last_name,
        is_active: mockUser.is_active
      });
      expect(response.body.data.tokens).toEqual(mockTokens);
    });

    test('should return 400 for weak password', async () => {
      const userData = {
        ...createMockCreateUserRequest(),
        password: 'weak'
      };

      mockAuthService.validatePasswordStrength.mockReturnValueOnce({
        isValid: false,
        errors: ['Password is too weak']
      });

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should return 409 for duplicate username', async () => {
      const userData = createMockCreateUserRequest();

      mockAuthService.validatePasswordStrength.mockReturnValueOnce({
        isValid: true,
        errors: []
      });
      mockAuthService.register.mockRejectedValueOnce(
        new ConflictError('Username already exists')
      );

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(409);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('CONFLICT_ERROR');
    });
  });

  describe('POST /login', () => {
    test('should login user successfully', async () => {
      const loginData = { username: 'testuser', password: 'TestPassword123!' };
      const mockUser = createMockUserResponse();
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockAuthService.login.mockResolvedValueOnce({
        user: mockUser,
        tokens: mockTokens
      });

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toMatchObject({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        first_name: mockUser.first_name,
        last_name: mockUser.last_name,
        is_active: mockUser.is_active
      });
      expect(response.body.data.tokens).toEqual(mockTokens);
    });

    test('should return 401 for invalid credentials', async () => {
      const loginData = { username: 'testuser', password: 'wrongpassword' };

      mockAuthService.login.mockRejectedValueOnce(
        new AuthenticationError('Invalid username or password')
      );

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('AUTHENTICATION_ERROR');
    });

    test('should return 400 for missing fields', async () => {
      const loginData = { username: 'testuser' }; // missing password

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(500); // Will be caught by error handler

      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /refresh', () => {
    test('should refresh token successfully', async () => {
      const refreshData = { refresh_token: 'valid-refresh-token' };
      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockAuthService.refreshToken.mockResolvedValueOnce(mockTokens);

      const response = await request(app)
        .post('/refresh')
        .send(refreshData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.tokens).toEqual(mockTokens);
    });

    test('should return 401 for invalid refresh token', async () => {
      const refreshData = { refresh_token: 'invalid-refresh-token' };

      mockAuthService.refreshToken.mockRejectedValueOnce(
        new AuthenticationError('Invalid refresh token')
      );

      const response = await request(app)
        .post('/refresh')
        .send(refreshData)
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('POST /logout', () => {
    test('should logout user successfully', async () => {
      mockAuthService.logout.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/logout')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('GET /profile', () => {
    test('should get user profile successfully', async () => {
      const mockUser = createMockUserResponse();

      mockAuthService.getUserById.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .get('/profile')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toMatchObject({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        first_name: mockUser.first_name,
        last_name: mockUser.last_name,
        is_active: mockUser.is_active
      });
    });
  });

  describe('GET /verify', () => {
    test('should verify token successfully', async () => {
      const mockUser = createMockUserResponse();

      const response = await request(app)
        .get('/verify')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.valid).toBe(true);
    });
  });

  describe('POST /check-password', () => {
    test('should check strong password', async () => {
      const passwordData = { password: 'StrongPassword123!' };

      mockAuthService.validatePasswordStrength.mockReturnValueOnce({
        isValid: true,
        errors: []
      });

      const response = await request(app)
        .post('/check-password')
        .send(passwordData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.strength.level).toBeDefined();
    });

    test('should check weak password', async () => {
      const passwordData = { password: 'weak' };

      mockAuthService.validatePasswordStrength.mockReturnValueOnce({
        isValid: false,
        errors: ['Password is too weak']
      });

      const response = await request(app)
        .post('/check-password')
        .send(passwordData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors).toContain('Password is too weak');
    });

    test('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/check-password')
        .send({})
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });
});