import { Router } from 'express';
import { SummarizationController } from '../controllers/SummarizationController';
import { SummarizationService } from '../services/SummarizationService';
import { SummaryRepository } from '../repositories/SummaryRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { OpenAIService } from '../services/OpenAIService';
import { authenticateToken } from '../middleware/auth';
import { param } from 'express-validator';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Initialize dependencies
const summaryRepository = new SummaryRepository();
const messageRepository = new MessageRepository();
const openAIService = new OpenAIService();
const summarizationService = new SummarizationService(
  summaryRepository,
  messageRepository,
  openAIService
);
const summarizationController = new SummarizationController(
  summarizationService,
  summaryRepository
);

// Validation middleware
const validateConversationId = [
  param('conversationId')
    .isUUID()
    .withMessage('conversationId must be a valid UUID'),
];

// Apply authentication to all routes
router.use(authenticateToken);

// Conversation-specific summarization routes
router.get(
  '/conversations/:conversationId/summarization/check',
  validateConversationId,
  validateRequest,
  summarizationController.checkSummarizationNeeded
);

router.post(
  '/conversations/:conversationId/summarization',
  validateConversationId,
  validateRequest,
  summarizationController.summarizeConversation
);

router.get(
  '/conversations/:conversationId/context',
  validateConversationId,
  validateRequest,
  summarizationController.getConversationContext
);

// Global summarization configuration routes
router.get(
  '/summarization/config',
  summarizationController.getConfig
);

export default router;