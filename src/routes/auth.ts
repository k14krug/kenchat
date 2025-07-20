import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware } from '../middleware/auth';
import { environment } from '../config/environment';

const router = Router();
const authController = new AuthController();

// Apply rate limiting to auth routes
const authRateLimit = authMiddleware.rateLimit(
  environment.security.rateLimitMaxRequests,
  environment.security.rateLimitWindowMs
);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authRateLimit, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authRateLimit, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', authRateLimit, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware.authenticate, authController.logout);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authMiddleware.authenticate, authController.getProfile);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token validity
 * @access  Private
 */
router.get('/verify', authMiddleware.authenticate, authController.verifyToken);

/**
 * @route   POST /api/auth/check-password
 * @desc    Check password strength
 * @access  Public
 */
router.post('/check-password', authRateLimit, authController.checkPasswordStrength);

export default router;
