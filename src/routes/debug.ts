import { Router } from 'express';
import { SummarizationDebugController } from '../controllers/SummarizationDebugController';
import { SummarizationService } from '../services/SummarizationService';
import { SummaryRepository } from '../repositories/SummaryRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { OpenAIService } from '../services/OpenAIService';
import { authenticateToken } from '../middleware/auth';
import { param, body } from 'express-validator';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Initialize dependencies
const summaryRepository = new SummaryRepository();
const messageRepository = new MessageRepository();
const conversationRepository = new ConversationRepository();
const openAIService = new OpenAIService();
const summarizationService = new SummarizationService(
  summaryRepository,
  messageRepository,
  openAIService
);

const debugController = new SummarizationDebugController(
  summarizationService,
  summaryRepository,
  messageRepository,
  conversationRepository
);

// Validation middleware
const validateConversationId = [
  param('conversationId')
    .isUUID()
    .withMessage('conversationId must be a valid UUID'),
];

const validateTestSummaryRequest = [
  body('customPrompt')
    .optional()
    .isString()
    .isLength({ min: 10 })
    .withMessage('Custom prompt must be at least 10 characters long'),
  body('useRollingPrompt')
    .optional()
    .isBoolean()
    .withMessage('useRollingPrompt must be a boolean'),
  body('messageIds')
    .optional()
    .isArray()
    .withMessage('messageIds must be an array')
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every((id: any) => typeof id === 'string');
      }
      return true;
    })
    .withMessage('All messageIds must be strings'),
];

const validatePromptUpdate = [
  body('initialPrompt')
    .optional()
    .isString()
    .isLength({ min: 10 })
    .withMessage('Initial prompt must be at least 10 characters long'),
  body('rollingPrompt')
    .optional()
    .isString()
    .isLength({ min: 10 })
    .withMessage('Rolling prompt must be at least 10 characters long'),
];

const validateConfigUpdate = [
  body('maxTokensBeforeSummarization')
    .optional()
    .isInt({ min: 1000, max: 50000 })
    .withMessage('maxTokensBeforeSummarization must be between 1000 and 50000'),
  body('summaryModel')
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage('summaryModel must be a non-empty string'),
  body('preserveRecentMessages')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('preserveRecentMessages must be between 1 and 50'),
  body('maxSummaryTokens')
    .optional()
    .isInt({ min: 100, max: 10000 })
    .withMessage('maxSummaryTokens must be between 100 and 10000'),
];

// Apply authentication to all debug routes
router.use(authenticateToken);

// Debug routes for summarization
router.get(
  '/conversations/:conversationId/summarization',
  validateConversationId,
  validateRequest,
  debugController.getDebugData
);

router.post(
  '/conversations/:conversationId/test-summary',
  validateConversationId,
  validateTestSummaryRequest,
  validateRequest,
  debugController.testSummarization
);

// Global debug routes for prompts and configuration
router.get(
  '/summarization/prompts',
  debugController.getPrompts
);

router.put(
  '/summarization/prompts',
  validatePromptUpdate,
  validateRequest,
  debugController.updatePrompts
);

router.put(
  '/summarization/config',
  validateConfigUpdate,
  validateRequest,
  debugController.updateConfig
);

export default router;