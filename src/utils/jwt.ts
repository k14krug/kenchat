import jwt from 'jsonwebtoken';
import { environment } from '../config/environment';
import { JWTPayload, RefreshTokenPayload, AuthToken } from '../models/User';
import { TokenError } from './errors';
import { logger } from '../config/logger';

export class JWTService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor() {
    this.accessTokenSecret = environment.jwt.secret;
    this.refreshTokenSecret = environment.jwt.refreshSecret;
    this.accessTokenExpiresIn = environment.jwt.expiresIn;
    this.refreshTokenExpiresIn = environment.jwt.refreshExpiresIn;
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      return jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiresIn,
        issuer: 'kenchat-api',
        audience: 'kenchat-client',
      } as jwt.SignOptions);
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw new TokenError('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    try {
      return jwt.sign(payload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiresIn,
        issuer: 'kenchat-api',
        audience: 'kenchat-client',
      } as jwt.SignOptions);
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw new TokenError('Failed to generate refresh token');
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(userId: string, username: string, email?: string): AuthToken {
    try {
      const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId,
        username,
        email,
      };

      const refreshTokenPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
        userId,
        tokenVersion: 1, // Can be used for token invalidation
      };

      const accessToken = this.generateAccessToken(accessTokenPayload);
      const refreshToken = this.generateRefreshToken(refreshTokenPayload);

      // Calculate expires_in from the token
      const decodedToken = jwt.decode(accessToken) as JWTPayload;
      const expiresIn = decodedToken.exp ? decodedToken.exp - Math.floor(Date.now() / 1000) : 0;

      return {
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresIn: expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error('Error generating token pair:', error);
      throw new TokenError('Failed to generate authentication tokens');
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'kenchat-api',
        audience: 'kenchat-client',
      }) as JWTPayload;

      return payload;
    } catch (error) {
      logger.debug('Access token verification failed:', error);

      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Access token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid access token');
      } else {
        throw new TokenError('Token verification failed');
      }
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'kenchat-api',
        audience: 'kenchat-client',
      }) as RefreshTokenPayload;

      return payload;
    } catch (error) {
      logger.debug('Refresh token verification failed:', error);

      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Refresh token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid refresh token');
      } else {
        throw new TokenError('Refresh token verification failed');
      }
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return null;
      }

      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const jwtService = new JWTService();
