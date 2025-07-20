import { Router } from 'express';
import { PersonaController } from '../controllers/PersonaController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const personaController = new PersonaController();

// Apply authentication middleware to all persona routes
router.use(authMiddleware.authenticate);

/**
 * @route   POST /api/personas
 * @desc    Create a new persona
 * @access  Private
 */
router.post('/', personaController.createPersona);

/**
 * @route   GET /api/personas
 * @desc    Get all personas for the authenticated user
 * @access  Private
 */
router.get('/', personaController.getUserPersonas);

/**
 * @route   GET /api/personas/summaries
 * @desc    Get persona summaries for dropdowns
 * @access  Private
 */
router.get('/summaries', personaController.getPersonaSummaries);

/**
 * @route   GET /api/personas/default
 * @desc    Get default persona for user
 * @access  Private
 */
router.get('/default', personaController.getDefaultPersona);

/**
 * @route   GET /api/personas/stats
 * @desc    Get persona usage statistics
 * @access  Private
 */
router.get('/stats', personaController.getPersonaUsageStats);

/**
 * @route   POST /api/personas/default-setup
 * @desc    Create default personas for new user
 * @access  Private
 */
router.post('/default-setup', personaController.createDefaultPersonas);

/**
 * @route   POST /api/personas/validate-prompt
 * @desc    Validate system prompt
 * @access  Private
 */
router.post('/validate-prompt', personaController.validateSystemPrompt);

/**
 * @route   GET /api/personas/:personaId
 * @desc    Get persona by ID
 * @access  Private
 */
router.get('/:personaId', personaController.getPersonaById);

/**
 * @route   PUT /api/personas/:personaId
 * @desc    Update persona
 * @access  Private
 */
router.put('/:personaId', personaController.updatePersona);

/**
 * @route   DELETE /api/personas/:personaId
 * @desc    Delete persona
 * @access  Private
 */
router.delete('/:personaId', personaController.deletePersona);

/**
 * @route   POST /api/personas/:personaId/set-default
 * @desc    Set persona as default
 * @access  Private
 */
router.post('/:personaId/set-default', personaController.setDefaultPersona);

/**
 * @route   POST /api/personas/:personaId/duplicate
 * @desc    Duplicate persona
 * @access  Private
 */
router.post('/:personaId/duplicate', personaController.duplicatePersona);

/**
 * @route   POST /api/personas/:personaId/increment-usage
 * @desc    Increment persona usage count (internal)
 * @access  Private
 */
router.post('/:personaId/increment-usage', personaController.incrementUsageCount);

export default router;