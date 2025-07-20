import { AuthService } from '../../src/services/AuthService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { jwtService } from '../../src/utils/jwt';
import { 
  AuthenticationError, 
  ConflictError, 
  ValidationError,
  TokenError 
} from '../../src/utils/errors';
import { 
  createMockUser, 
  createMockCreateUserRequest, 
  createMockUserResponse,
  hashPassword 
} from '../utils/testHelpers';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../../src/repositories/UserRepository');
jest.mock('../../src/utils/jwt');
jest.mock('../../src/config/environment', () => ({
  environment: {
    security: {
      bcryptRounds: 12
    },
    database: {
      host: 'localhost',
      port: 3306,
      name: 'test',
      user: 'test',
      password: 'test',
      connectionLimit: 10
    },
    jwt: {
      secret: 'test-secret-key-that-is-long-enough-for-testing',
      refreshSecret: 'test-refresh-secret-key-that-is-long-enough',
      expiresIn: '1h',
      refreshExpiresIn: '7d'
    },
    logging: {
      level: 'info',
      file: 'logs/test.log'
    }
  }
}));

// Mock logger
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockJwtService: jest.Mocked<typeof jwtService>;

  beforeEach(() => {
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockJwtService = jwtService as jest.Mocked<typeof jwtService>;
    authService = new AuthService();
    
    // Replace the repository instance
    (authService as any).userRepository = mockUserRepository;
    
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      const userData = createMockCreateUserRequest();
      const mockUser = createMockUser();
      const mockUserResponse = createMockUserResponse();
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockUserRepository.findByUsername.mockResolvedValueOnce(null);
      mockUserRepository.findByEmail.mockResolvedValueOnce(null);
      mockUserRepository.create.mockResolvedValueOnce(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValueOnce(undefined);
      mockUserRepository.toUserResponse.mockReturnValueOnce(mockUserResponse);
      mockJwtService.generateTokenPair.mockReturnValueOnce(mockTokens);

      const result = await authService.register(userData);

      expect(result.user).toEqual(mockUserResponse);
      expect(result.tokens).toEqual(mockTokens);
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(userData.username);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    test('should throw ConflictError when username already exists', async () => {
      const userData = createMockCreateUserRequest();
      const existingUser = createMockUser();

      mockUserRepository.findByUsername.mockResolvedValueOnce(existingUser);

      await expect(authService.register(userData)).rejects.toThrow(ConflictError);
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    test('should throw ConflictError when email already exists', async () => {
      const userData = createMockCreateUserRequest();
      const existingUser = createMockUser();

      mockUserRepository.findByUsername.mockResolvedValueOnce(null);
      mockUserRepository.findByEmail.mockResolvedValueOnce(existingUser);

      await expect(authService.register(userData)).rejects.toThrow(ConflictError);
    });

    test('should validate and sanitize input data', async () => {
      const userData = {
        ...createMockCreateUserRequest(),
        username: '  testuser  ', // with whitespace
        password: 'weak' // invalid password
      };

      await expect(authService.register(userData)).rejects.toThrow();
    });
  });

  describe('login', () => {
    test('should login user successfully', async () => {
      const loginData = { username: 'testuser', password: 'TestPassword123!' };
      const mockUser = createMockUser({
        password_hash: await hashPassword('TestPassword123!')
      });
      const mockUserResponse = createMockUserResponse();
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockUserRepository.findByUsername.mockResolvedValueOnce(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValueOnce(undefined);
      mockUserRepository.toUserResponse.mockReturnValueOnce(mockUserResponse);
      mockJwtService.generateTokenPair.mockReturnValueOnce(mockTokens);

      // Mock bcrypt.compare to return true
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

      const result = await authService.login(loginData);

      expect(result.user).toEqual(mockUserResponse);
      expect(result.tokens).toEqual(mockTokens);
    });

    test('should throw AuthenticationError for invalid username', async () => {
      const loginData = { username: 'nonexistent', password: 'password' };

      mockUserRepository.findByUsername.mockResolvedValueOnce(null);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
    });

    test('should throw AuthenticationError for invalid password', async () => {
      const loginData = { username: 'testuser', password: 'wrongpassword' };
      const mockUser = createMockUser();

      mockUserRepository.findByUsername.mockResolvedValueOnce(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false as never);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
    });

    test('should throw AuthenticationError for inactive user', async () => {
      const loginData = { username: 'testuser', password: 'TestPassword123!' };
      const mockUser = createMockUser({ is_active: false });

      mockUserRepository.findByUsername.mockResolvedValueOnce(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('refreshToken', () => {
    test('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockUser = createMockUser();
      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockJwtService.verifyRefreshToken.mockReturnValueOnce({
        userId: 1,
        tokenVersion: 1
      });
      mockUserRepository.findById.mockResolvedValueOnce(mockUser);
      mockJwtService.generateTokenPair.mockReturnValueOnce(mockTokens);

      const result = await authService.refreshToken(refreshToken);

      expect(result).toEqual(mockTokens);
    });

    test('should throw TokenError for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockJwtService.verifyRefreshToken.mockImplementationOnce(() => {
        throw new TokenError('Invalid refresh token');
      });

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(TokenError);
    });

    test('should throw TokenError when user not found', async () => {
      const refreshToken = 'valid-refresh-token';

      mockJwtService.verifyRefreshToken.mockReturnValueOnce({
        userId: 999,
        tokenVersion: 1
      });
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(TokenError);
    });
  });

  describe('verifyToken', () => {
    test('should verify token and return user data', async () => {
      const token = 'valid-access-token';
      const mockUser = createMockUser();
      const mockUserResponse = createMockUserResponse();

      mockJwtService.verifyAccessToken.mockReturnValueOnce({
        userId: 1,
        username: 'testuser',
        email: 'test@example.com'
      });
      mockUserRepository.findById.mockResolvedValueOnce(mockUser);
      mockUserRepository.toUserResponse.mockReturnValueOnce(mockUserResponse);

      const result = await authService.verifyToken(token);

      expect(result).toEqual(mockUserResponse);
    });

    test('should throw TokenError for invalid token', async () => {
      const token = 'invalid-token';

      mockJwtService.verifyAccessToken.mockImplementationOnce(() => {
        throw new TokenError('Invalid token');
      });

      await expect(authService.verifyToken(token)).rejects.toThrow(TokenError);
    });
  });

  describe('validatePasswordStrength', () => {
    test('should validate strong passwords', () => {
      const strongPassword = 'StrongPassword123!';
      const result = authService.validatePasswordStrength(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject weak passwords', () => {
      const weakPassword = 'weak';
      const result = authService.validatePasswordStrength(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should reject common passwords', () => {
      const commonPassword = 'password';
      const result = authService.validatePasswordStrength(commonPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common, please choose a stronger password');
    });

    test('should check all password requirements', () => {
      const testCases = [
        { password: 'short', expectedErrors: ['Password must be at least 8 characters long'] },
        { password: 'nouppercase123!', expectedErrors: ['Password must contain at least one uppercase letter'] },
        { password: 'NOLOWERCASE123!', expectedErrors: ['Password must contain at least one lowercase letter'] },
        { password: 'NoNumbers!', expectedErrors: ['Password must contain at least one number'] },
        { password: 'NoSpecialChars123', expectedErrors: ['Password must contain at least one special character (@$!%*?&)'] }
      ];

      testCases.forEach(({ password, expectedErrors }) => {
        const result = authService.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expectedErrors.forEach(error => {
          expect(result.errors).toContain(error);
        });
      });
    });
  });

  describe('logout', () => {
    test('should logout user successfully', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findById.mockResolvedValueOnce(mockUser);

      await expect(authService.logout(1)).resolves.toBeUndefined();
    });

    test('should not throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(authService.logout(999)).resolves.toBeUndefined();
    });
  });

  describe('getUserById', () => {
    test('should get user by ID successfully', async () => {
      const mockUser = createMockUser();
      const mockUserResponse = createMockUserResponse();

      mockUserRepository.findById.mockResolvedValueOnce(mockUser);
      mockUserRepository.toUserResponse.mockReturnValueOnce(mockUserResponse);

      const result = await authService.getUserById(1);

      expect(result).toEqual(mockUserResponse);
    });

    test('should throw AuthenticationError when user not found', async () => {
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(authService.getUserById(999)).rejects.toThrow(AuthenticationError);
    });
  });
});