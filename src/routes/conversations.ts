import { Router } from 'express';
import { ConversationController } from '../controllers/ConversationController';
import { authenticateToken } from '../middleware/auth';
import { 
  validateConversationCreation,
  validateConversationUpdate,
  validateMessageCreation,
  validateUUID,
  validatePaginationQuery,
  validateSearchQuery,
  handleValidationErrors,
  sanitizeInput
} from '../middleware/requestValidation';

const router = Router();
const conversationController = new ConversationController();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(sanitizeInput);

// Conversation CRUD operations
router.post('/', 
  validateConversationCreation, 
  handleValidationErrors, 
  conversationController.createConversation
);

router.get('/', 
  validatePaginationQuery, 
  handleValidationErrors, 
  conversationController.getConversations
);

router.get('/search', 
  validateSearchQuery, 
  validatePaginationQuery, 
  handleValidationErrors, 
  conversationController.searchConversations
);

router.get('/:id', 
  validateUUID('id'), 
  handleValidationErrors, 
  conversationController.getConversation
);

router.get('/:id/full', 
  validateUUID('id'), 
  handleValidationErrors, 
  conversationController.getConversationWithMessages
);

router.put('/:id', 
  validateUUID('id'), 
  validateConversationUpdate, 
  handleValidationErrors, 
  conversationController.updateConversation
);

router.delete('/:id', 
  validateUUID('id'), 
  handleValidationErrors, 
  conversationController.deleteConversation
);

// Conversation management operations
router.put('/:id/intent', conversationController.updateIntent);
router.put('/:id/instructions', conversationController.updateCustomInstructions);
router.put('/:id/persona', conversationController.switchPersona);
router.put('/:id/archive', conversationController.archiveConversation);
router.put('/:id/unarchive', conversationController.unarchiveConversation);

// Message operations
router.post('/:id/messages', 
  validateUUID('id'), 
  validateMessageCreation, 
  handleValidationErrors, 
  conversationController.addMessage
);

router.get('/:id/messages', 
  validateUUID('id'), 
  validatePaginationQuery, 
  handleValidationErrors, 
  conversationController.getMessages
);

router.get('/:id/messages/recent', 
  validateUUID('id'), 
  handleValidationErrors, 
  conversationController.getRecentMessages
);

// Statistics
router.get('/:id/stats', conversationController.getConversationStats);

export default router;