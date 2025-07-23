import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();
const chatController = new ChatController();

// Apply authentication to all chat routes
router.use(authenticateToken);

// Apply rate limiting to chat generation endpoints
const chatRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per user
  message: 'Too many chat requests, please try again later',
});

// Chat generation routes
router.post('/generate', chatRateLimit, chatController.generateResponse);
router.post('/generate/stream', chatRateLimit, chatController.generateStreamingResponse);

// Model information routes
router.get('/models', chatController.getModels);
router.get('/models/:modelId', chatController.getModelInfo);

export default router;