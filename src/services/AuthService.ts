import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository';
import { jwtService } from '../utils/jwt';
import { CreateUserRequest, LoginRequest, AuthToken, User, UserResponse } from '../models/User';
import { AuthenticationError, ConflictError, ValidationError, TokenError } from '../utils/errors';
import { environment } from '../config/environment';
import { logger } from '../config/logger';
import { validateAndSanitize, registerSchema, loginSchema } from '../utils/validation';

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly bcryptRounds: number;

  constructor() {
    this.userRepository = new UserRepository();
    this.bcryptRounds = environment.security.bcryptRounds;
  }

  /**
   * Register a new user
   */
  async register(userData: CreateUserRequest): Promise<{ user: UserResponse; tokens: AuthToken }> {
    try {
      // Validate and sanitize input
      const validatedData = validateAndSanitize(registerSchema, userData);

      // Check if username already exists
      const existingUserByUsername = await this.userRepository.findByUsername(
        validatedData.username
      );
      if (existingUserByUsername) {
        throw new ConflictError('Username already exists');
      }

      // Check if email already exists
      const existingUserByEmail = await this.userRepository.findByEmail(validatedData.email);
      if (existingUserByEmail) {
        throw new ConflictError('Email already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(validatedData.password);

      // Create user
      const newUser = await this.userRepository.create({
        ...validatedData,
        password_hash: passwordHash,
      });

      // Generate tokens
      const tokens = jwtService.generateTokenPair(newUser.id, newUser.username, newUser.email);

      // Update last login
      await this.userRepository.updateLastLogin(newUser.id);

      logger.info(`User registered successfully: ${newUser.username}`);

      return {
        user: this.userRepository.toUserResponse(newUser),
        tokens,
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(loginData: LoginRequest): Promise<{ user: UserResponse; tokens: AuthToken }> {
    try {
      // Validate and sanitize input
      const validatedData = validateAndSanitize(loginSchema, loginData);

      // Find user by username
      const user = await this.userRepository.findByUsername(validatedData.username);
      if (!user) {
        throw new AuthenticationError('Invalid username or password');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(validatedData.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid username or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Generate tokens
      const tokens = jwtService.generateTokenPair(user.id, user.username, user.email);

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      logger.info(`User logged in successfully: ${user.username}`);

      return {
        user: this.userRepository.toUserResponse(user),
        tokens,
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      // Verify refresh token
      const payload = jwtService.verifyRefreshToken(refreshToken);

      // Find user
      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new TokenError('User not found');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new TokenError('Account is deactivated');
      }

      // Generate new token pair
      const tokens = jwtService.generateTokenPair(user.id, user.username, user.email);

      logger.info(`Token refreshed for user: ${user.username}`);

      return tokens;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Logout user (token invalidation would be handled by client or token blacklist)
   */
  async logout(userId: string): Promise<void> {
    try {
      // In a more sophisticated implementation, you might:
      // 1. Add token to blacklist
      // 2. Update user's token version
      // 3. Clear server-side sessions

      // For now, we'll just log the logout
      const user = await this.userRepository.findById(userId);
      if (user) {
        logger.info(`User logged out: ${user.username}`);
      }
    } catch (error) {
      logger.error('Logout failed:', error);
      // Don't throw error for logout failures
    }
  }

  /**
   * Verify user token and return user data
   */
  async verifyToken(token: string): Promise<UserResponse> {
    try {
      // Verify token
      const payload = jwtService.verifyAccessToken(token);

      // Find user
      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new TokenError('User not found');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new TokenError('Account is deactivated');
      }

      return this.userRepository.toUserResponse(user);
    } catch (error) {
      logger.error('Token verification failed:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      return this.userRepository.toUserResponse(user);
    } catch (error) {
      logger.error('Get user by ID failed:', error);
      throw error;
    }
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.bcryptRounds);
    } catch (error) {
      logger.error('Password hashing failed:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Validate password strength (additional check beyond Joi validation)
   */
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common, please choose a stronger password');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
