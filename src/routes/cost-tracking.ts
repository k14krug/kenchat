import { Router } from 'express';
import { CostTrackingController } from '../controllers/CostTrackingController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { query, param } from 'express-validator';
import { 
  validateCostReportQuery,
  validateDateRange,
  validatePaginationQuery,
  validateUUID,
  handleValidationErrors,
  sanitizeInput
} from '../middleware/requestValidation';

const router = Router();
const costTrackingController = new CostTrackingController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(sanitizeInput);

/**
 * @route GET /api/cost-tracking/stats
 * @desc Get user's usage statistics
 * @access Private
 */
router.get('/stats',
  validateDateRange,
  handleValidationErrors,
  costTrackingController.getUserUsageStats
);

/**
 * @route GET /api/cost-tracking/report
 * @desc Generate cost report for user
 * @access Private
 */
router.get('/report',
  validateCostReportQuery,
  handleValidationErrors,
  costTrackingController.generateCostReport
);

/**
 * @route GET /api/cost-tracking/limits
 * @desc Check user's cost limit status
 * @access Private
 */
router.get('/limits', costTrackingController.checkCostLimits);

/**
 * @route GET /api/cost-tracking/conversation/:conversationId
 * @desc Get conversation cost
 * @access Private
 */
router.get('/conversation/:conversationId',
  validateUUID('conversationId'),
  handleValidationErrors,
  costTrackingController.getConversationCost
);

/**
 * @route GET /api/cost-tracking/logs
 * @desc Get user's usage logs with pagination
 * @access Private
 */
router.get('/logs',
  validatePaginationQuery,
  validateDateRange,
  [
    query('actionType')
      .optional()
      .isIn(['message_sent', 'message_received', 'summary_created', 'persona_used'])
      .withMessage('actionType must be a valid action type'),
    query('conversationId')
      .optional()
      .isUUID()
      .withMessage('conversationId must be a valid UUID'),
  ],
  handleValidationErrors,
  costTrackingController.getUserUsageLogs
);

/**
 * @route GET /api/cost-tracking/pricing
 * @desc Get current pricing information
 * @access Private
 */
router.get('/pricing', costTrackingController.getPricingInfo);

export default router;