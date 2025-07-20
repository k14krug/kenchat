import jwt from 'jsonwebtoken';
import { JWTService } from '../../src/utils/jwt';
import { TokenError } from '../../src/utils/errors';
import { mockJWTPayload, mockRefreshTokenPayload } from './testHelpers';

// Mock environment
jest.mock('../../src/config/environment', () => ({
  environment: {
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

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    jwtService = new JWTService();
  });

  describe('generateAccessToken', () => {
    test('should generate a valid access token', () => {
      const payload = {
        userId: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      const token = jwtService.generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token structure
      const decoded = jwt.decode(token) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.iss).toBe('kenchat-api');
      expect(decoded.aud).toBe('kenchat-client');
    });
  });

  describe('generateRefreshToken', () => {
    test('should generate a valid refresh token', () => {
      const payload = {
        userId: 1,
        tokenVersion: 1
      };

      const token = jwtService.generateRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token structure
      const decoded = jwt.decode(token) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.tokenVersion).toBe(payload.tokenVersion);
    });
  });

  describe('generateTokenPair', () => {
    test('should generate both access and refresh tokens', () => {
      const tokens = jwtService.generateTokenPair(1, 'testuser', 'test@example.com');

      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('refresh_token');
      expect(tokens).toHaveProperty('expires_in');
      expect(tokens).toHaveProperty('token_type');
      expect(tokens.token_type).toBe('Bearer');
    });
  });

  describe('verifyAccessToken', () => {
    test('should verify a valid access token', () => {
      const payload = {
        userId: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      const token = jwtService.generateAccessToken(payload);
      const verified = jwtService.verifyAccessToken(token);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.username).toBe(payload.username);
      expect(verified.email).toBe(payload.email);
    });

    test('should throw error for invalid token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow(TokenError);
    });

    test('should throw error for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 1, username: 'test', email: 'test@example.com' },
        'test-secret-key-that-is-long-enough-for-testing',
        { expiresIn: '-1h', issuer: 'kenchat-api', audience: 'kenchat-client' }
      );

      expect(() => {
        jwtService.verifyAccessToken(expiredToken);
      }).toThrow(TokenError);
    });
  });

  describe('verifyRefreshToken', () => {
    test('should verify a valid refresh token', () => {
      const payload = {
        userId: 1,
        tokenVersion: 1
      };

      const token = jwtService.generateRefreshToken(payload);
      const verified = jwtService.verifyRefreshToken(token);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.tokenVersion).toBe(payload.tokenVersion);
    });

    test('should throw error for invalid refresh token', () => {
      expect(() => {
        jwtService.verifyRefreshToken('invalid-token');
      }).toThrow(TokenError);
    });
  });

  describe('extractTokenFromHeader', () => {
    test('should extract token from valid Bearer header', () => {
      const token = 'valid-jwt-token';
      const header = `Bearer ${token}`;

      const extracted = jwtService.extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    test('should return null for invalid header format', () => {
      expect(jwtService.extractTokenFromHeader('invalid-header')).toBeNull();
      expect(jwtService.extractTokenFromHeader('Basic token')).toBeNull();
      expect(jwtService.extractTokenFromHeader('')).toBeNull();
      expect(jwtService.extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    test('should return false for valid token', () => {
      const token = jwtService.generateAccessToken({
        userId: 1,
        username: 'test',
        email: 'test@example.com'
      });

      expect(jwtService.isTokenExpired(token)).toBe(false);
    });

    test('should return true for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 1 },
        'test-secret-key-that-is-long-enough-for-testing',
        { expiresIn: '-1h' }
      );

      expect(jwtService.isTokenExpired(expiredToken)).toBe(true);
    });

    test('should return true for invalid token', () => {
      expect(jwtService.isTokenExpired('invalid-token')).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    test('should return expiration date for valid token', () => {
      const token = jwtService.generateAccessToken({
        userId: 1,
        username: 'test',
        email: 'test@example.com'
      });

      const expiration = jwtService.getTokenExpiration(token);
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    test('should return null for invalid token', () => {
      expect(jwtService.getTokenExpiration('invalid-token')).toBeNull();
    });
  });

  describe('decodeToken', () => {
    test('should decode token without verification', () => {
      const payload = {
        userId: 1,
        username: 'test',
        email: 'test@example.com'
      };

      const token = jwtService.generateAccessToken(payload);
      const decoded = jwtService.decodeToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.email).toBe(payload.email);
    });

    test('should return null for invalid token', () => {
      expect(jwtService.decodeToken('invalid-token')).toBeNull();
    });
  });
});