import { Router } from 'express';
import { AIController } from '../controllers/AIController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const aiController = new AIController();

// Apply authentication middleware to all AI routes
router.use(authMiddleware.authenticate);

/**
 * @route   POST /api/ai/generate
 * @desc    Generate AI response
 * @access  Private
 */
router.post('/generate', aiController.generateResponse);

/**
 * @route   GET /api/ai/models
 * @desc    Get available AI models
 * @access  Private
 */
router.get('/models', aiController.getModels);

/**
 * @route   GET /api/ai/models/:modelId
 * @desc    Get specific model information
 * @access  Private
 */
router.get('/models/:modelId', aiController.getModelInfo);

/**
 * @route   POST /api/ai/cost
 * @desc    Calculate cost for token usage
 * @access  Private
 */
router.post('/cost', aiController.calculateCost);

/**
 * @route   GET /api/ai/test
 * @desc    Test OpenAI connection
 * @access  Private
 */
router.get('/test', aiController.testConnection);

export default router;