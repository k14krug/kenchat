import { Router } from 'express';
import { ConversationController } from '../controllers/ConversationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const conversationController = new ConversationController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Conversation CRUD operations
router.post('/', conversationController.createConversation);
router.get('/', conversationController.getConversations);
router.get('/search', conversationController.searchConversations);
router.get('/:id', conversationController.getConversation);
router.get('/:id/full', conversationController.getConversationWithMessages);
router.put('/:id', conversationController.updateConversation);
router.delete('/:id', conversationController.deleteConversation);

// Conversation management operations
router.put('/:id/intent', conversationController.updateIntent);
router.put('/:id/instructions', conversationController.updateCustomInstructions);
router.put('/:id/persona', conversationController.switchPersona);
router.put('/:id/archive', conversationController.archiveConversation);
router.put('/:id/unarchive', conversationController.unarchiveConversation);

// Message operations
router.post('/:id/messages', conversationController.addMessage);
router.get('/:id/messages', conversationController.getMessages);
router.get('/:id/messages/recent', conversationController.getRecentMessages);

// Statistics
router.get('/:id/stats', conversationController.getConversationStats);

export default router;