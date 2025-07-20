import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { CreateUserRequest, LoginRequest } from '../models/User';
import { ValidationError, AuthenticationError, ConflictError, AppError } from '../utils/errors';
import { validateAndSanitize, refreshTokenSchema } from '../utils/validation';
import { logger } from '../config/logger';

export class AuthController {
  private readonly authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register a new user
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData: CreateUserRequest = req.body;

      // Additional password strength validation
      const passwordValidation = this.authService.validatePasswordStrength(userData.password);
      if (!passwordValidation.isValid) {
        throw new ValidationError(
          `Password validation failed: ${passwordValidation.errors.join(', ')}`
        );
      }

      const result = await this.authService.register(userData);

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
        timestamp: new Date().toISOString(),
      });

      logger.info(`User registration successful: ${result.user.username}`);
    } catch (error) {
      logger.error('Registration controller error:', error);
      next(error);
    }
  };

  /**
   * Login user
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const result = await this.authService.login(loginData);

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
        timestamp: new Date().toISOString(),
      });

      logger.info(`User login successful: ${result.user.username}`);
    } catch (error) {
      logger.error('Login controller error:', error);
      next(error);
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = validateAndSanitize(refreshTokenSchema, req.body);
      const tokens = await this.authService.refreshToken(validatedData.refresh_token);

      res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: {
          tokens,
        },
        timestamp: new Date().toISOString(),
      });

      logger.info('Token refresh successful');
    } catch (error) {
      logger.error('Token refresh controller error:', error);
      next(error);
    }
  };

  /**
   * Logout user
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user) {
        await this.authService.logout(req.user.id);
      }

      res.status(200).json({
        status: 'success',
        message: 'Logout successful',
        timestamp: new Date().toISOString(),
      });

      logger.info(`User logout successful: ${req.user?.username || 'unknown'}`);
    } catch (error) {
      logger.error('Logout controller error:', error);
      next(error);
    }
  };

  /**
   * Get current user profile
   */
  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const user = await this.authService.getUserById(req.user.id);

      res.status(200).json({
        status: 'success',
        message: 'Profile retrieved successfully',
        data: {
          user,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get profile controller error:', error);
      next(error);
    }
  };

  /**
   * Verify token endpoint
   */
  verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Invalid token');
      }

      res.status(200).json({
        status: 'success',
        message: 'Token is valid',
        data: {
          user: req.user,
          valid: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Token verification controller error:', error);
      next(error);
    }
  };

  /**
   * Password strength check endpoint
   */
  checkPasswordStrength = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { password } = req.body;

      if (!password || typeof password !== 'string') {
        throw new ValidationError('Password is required');
      }

      const validation = this.authService.validatePasswordStrength(password);

      res.status(200).json({
        status: 'success',
        message: 'Password strength checked',
        data: {
          isValid: validation.isValid,
          errors: validation.errors,
          strength: this.calculatePasswordStrength(password),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Password strength check controller error:', error);
      next(error);
    }
  };

  /**
   * Calculate password strength score
   */
  private calculatePasswordStrength(password: string): { score: number; level: string } {
    let score = 0;

    // Length bonus
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety bonus
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[@$!%*?&]/.test(password)) score += 1;

    // Additional complexity bonus
    if (/[^a-zA-Z0-9@$!%*?&]/.test(password)) score += 1;

    let level: string;
    if (score <= 2) {
      level = 'weak';
    } else if (score <= 4) {
      level = 'fair';
    } else if (score <= 6) {
      level = 'good';
    } else {
      level = 'strong';
    }

    return { score, level };
  }
}
