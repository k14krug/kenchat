import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../utils/jwt';
import { AuthService } from '../services/AuthService';
import { AuthenticationError, AuthorizationError, TokenError } from '../utils/errors';
import { JWTPayload, UserResponse } from '../models/User';
import { logger } from '../config/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserResponse;
      token?: string;
    }
  }
}

// Authenticated request interface for controllers
export interface AuthenticatedRequest extends Request {
  user: UserResponse;
  token: string;
}

export class AuthMiddleware {
  private readonly authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to authenticate requests using JWT tokens
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        throw new AuthenticationError('Access token is required');
      }

      // Verify token and get user data
      const user = await this.authService.verifyToken(token);

      // Attach user and token to request object
      req.user = user;
      req.token = token;

      next();
    } catch (error) {
      logger.debug('Authentication failed:', error);

      if (error instanceof TokenError || error instanceof AuthenticationError) {
        res.status(401).json({
          status: 'error',
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(401).json({
          status: 'error',
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed',
          timestamp: new Date().toISOString(),
        });
      }
    }
  };

  /**
   * Optional authentication middleware - doesn't fail if no token provided
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (token) {
        try {
          const user = await this.authService.verifyToken(token);
          req.user = user;
          req.token = token;
        } catch (error) {
          // Log but don't fail for optional authentication
          logger.debug('Optional authentication failed:', error);
        }
      }

      next();
    } catch (error) {
      // For optional auth, we continue even if there's an error
      logger.debug('Optional authentication error:', error);
      next();
    }
  };

  /**
   * Middleware to check if user has specific permissions
   * For now, this is a placeholder for future role-based access control
   */
  authorize = (requiredPermissions: string[] = []) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('Authentication required');
        }

        // For now, all authenticated users have access
        // In the future, you can implement role-based permissions here
        // Example:
        // const userPermissions = await this.getUserPermissions(req.user.id);
        // const hasPermission = requiredPermissions.every(permission =>
        //   userPermissions.includes(permission)
        // );
        //
        // if (!hasPermission) {
        //   throw new AuthorizationError('Insufficient permissions');
        // }

        next();
      } catch (error) {
        logger.debug('Authorization failed:', error);

        if (error instanceof AuthorizationError) {
          res.status(403).json({
            status: 'error',
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(401).json({
            status: 'error',
            code: 'AUTHENTICATION_ERROR',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          });
        }
      }
    };
  };

  /**
   * Middleware to ensure user can only access their own resources
   */
  requireOwnership = (userIdParam: string = 'userId') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('Authentication required');
        }

        const resourceUserId = req.params[userIdParam];

        if (!resourceUserId) {
          throw new AuthorizationError('Invalid user ID');
        }

        if (req.user.id !== resourceUserId) {
          throw new AuthorizationError('Access denied: You can only access your own resources');
        }

        next();
      } catch (error) {
        logger.debug('Ownership check failed:', error);

        if (error instanceof AuthorizationError) {
          res.status(403).json({
            status: 'error',
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(401).json({
            status: 'error',
            code: 'AUTHENTICATION_ERROR',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          });
        }
      }
    };
  };

  /**
   * Rate limiting middleware (basic implementation)
   */
  rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      const identifier = req.ip || 'unknown';
      const now = Date.now();

      const userRequests = requests.get(identifier);

      if (!userRequests || now > userRequests.resetTime) {
        // Reset or initialize counter
        requests.set(identifier, {
          count: 1,
          resetTime: now + windowMs,
        });
        next();
        return;
      }

      if (userRequests.count >= maxRequests) {
        res.status(429).json({
          status: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
        });
        return;
      }

      userRequests.count++;
      next();
    };
  };
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();

// Export commonly used methods for convenience
export const authenticateToken = authMiddleware.authenticate;
export const optionalAuth = authMiddleware.optionalAuthenticate;
export const authorize = authMiddleware.authorize;
export const requireOwnership = authMiddleware.requireOwnership;
export const rateLimit = authMiddleware.rateLimit;
