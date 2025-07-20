import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../src/middleware/auth';
import { AuthService } from '../../src/services/AuthService';
import { jwtService } from '../../src/utils/jwt';
import { 
  AuthenticationError, 
  AuthorizationError, 
  TokenError 
} from '../../src/utils/errors';
import { createMockUserResponse } from '../utils/testHelpers';

// Mock dependencies
jest.mock('../../src/services/AuthService');
jest.mock('../../src/utils/jwt');

// Mock logger
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockJwtService: jest.Mocked<typeof jwtService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    authMiddleware = new AuthMiddleware();
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    mockJwtService = jwtService as jest.Mocked<typeof jwtService>;
    
    // Replace the service instance
    (authMiddleware as any).authService = mockAuthService;

    mockRequest = {
      headers: {},
      params: {},
      user: undefined,
      token: undefined,
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    test('should authenticate user with valid token', async () => {
      const mockUser = createMockUserResponse();
      const token = 'valid-jwt-token';

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockJwtService.extractTokenFromHeader.mockReturnValueOnce(token);
      mockAuthService.verifyToken.mockResolvedValueOnce(mockUser);

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.token).toBe(token);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should return 401 when no token provided', async () => {
      mockRequest.headers = {};
      mockJwtService.extractTokenFromHeader.mockReturnValueOnce(null);

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'AUTHENTICATION_ERROR',
          message: 'Access token is required'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 for invalid token', async () => {
      const token = 'invalid-jwt-token';

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockJwtService.extractTokenFromHeader.mockReturnValueOnce(token);
      mockAuthService.verifyToken.mockRejectedValueOnce(
        new TokenError('Invalid token')
      );

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'TOKEN_ERROR',
          message: 'Invalid token'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle unexpected errors', async () => {
      const token = 'valid-jwt-token';

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockJwtService.extractTokenFromHeader.mockReturnValueOnce(token);
      mockAuthService.verifyToken.mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      await authMiddleware.authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed'
        })
      );
    });
  });

  describe('optionalAuthenticate', () => {
    test('should authenticate user when valid token provided', async () => {
      const mockUser = createMockUserResponse();
      const token = 'valid-jwt-token';

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockJwtService.extractTokenFromHeader.mockReturnValueOnce(token);
      mockAuthService.verifyToken.mockResolvedValueOnce(mockUser);

      await authMiddleware.optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.token).toBe(token);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should continue without authentication when no token provided', async () => {
      mockRequest.headers = {};
      mockJwtService.extractTokenFromHeader.mockReturnValueOnce(null);

      await authMiddleware.optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should continue when token verification fails', async () => {
      const token = 'invalid-jwt-token';

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockJwtService.extractTokenFromHeader.mockReturnValueOnce(token);
      mockAuthService.verifyToken.mockRejectedValueOnce(
        new TokenError('Invalid token')
      );

      await authMiddleware.optionalAuthenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    test('should authorize authenticated user', async () => {
      const mockUser = createMockUserResponse();
      mockRequest.user = mockUser;

      const authorizeMiddleware = authMiddleware.authorize([]);

      await authorizeMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should return 401 when user not authenticated', async () => {
      mockRequest.user = undefined;

      const authorizeMiddleware = authMiddleware.authorize([]);

      await authorizeMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    test('should allow access to own resources', async () => {
      const mockUser = createMockUserResponse({ id: 1 });
      mockRequest.user = mockUser;
      mockRequest.params = { userId: '1' };

      const ownershipMiddleware = authMiddleware.requireOwnership();

      await ownershipMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should deny access to other users resources', async () => {
      const mockUser = createMockUserResponse({ id: 1 });
      mockRequest.user = mockUser;
      mockRequest.params = { userId: '2' };

      const ownershipMiddleware = authMiddleware.requireOwnership();

      await ownershipMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied: You can only access your own resources'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 when user not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { userId: '1' };

      const ownershipMiddleware = authMiddleware.requireOwnership();

      await ownershipMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 403 for invalid user ID', async () => {
      const mockUser = createMockUserResponse({ id: 1 });
      mockRequest.user = mockUser;
      mockRequest.params = { userId: 'invalid' };

      const ownershipMiddleware = authMiddleware.requireOwnership();

      await ownershipMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'AUTHORIZATION_ERROR',
          message: 'Invalid user ID'
        })
      );
    });
  });

  describe('rateLimit', () => {
    test('should allow requests within limit', () => {
      const rateLimitMiddleware = authMiddleware.rateLimit(10, 60000);

      rateLimitMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should block requests exceeding limit', () => {
      const rateLimitMiddleware = authMiddleware.rateLimit(1, 60000);

      // First request should pass
      rateLimitMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request should be blocked
      jest.clearAllMocks();
      rateLimitMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});