import { ConversationRepository } from '../../src/repositories/ConversationRepository';
import { DatabaseError, NotFoundError } from '../../src/utils/errors';
import { mockDb, createMockRow, createMockResult, resetMocks } from './setup';

describe('ConversationRepository', () => {
  let conversationRepository: ConversationRepository;

  beforeEach(() => {
    resetMocks();
    conversationRepository = new ConversationRepository();
  });

  describe('create', () => {
    it('should create a new conversation successfully', async () => {
      const conversationData = {
        userId: 'user-123',
        title: 'Test Conversation',
        intent: 'general',
        customInstructions: 'Be helpful',
        currentPersonaId: 'persona-123'
      };

      const mockConversation = createMockRow({
        id: 'test-uuid-123',
        user_id: 'user-123',
        title: 'Test Conversation',
        intent: 'general',
        custom_instructions: 'Be helpful',
        current_persona_id: 'persona-123',
        created_at: new Date(),
        updated_at: new Date(),
        is_archived: false,
        total_cost: 0
      });

      // Mock the INSERT operation
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);
      
      // Mock the SELECT operation to fetch the created conversation
      mockDb.execute.mockResolvedValueOnce([[mockConversation], []]);

      const result = await conversationRepository.create(conversationData);

      expect(result).toEqual({
        id: 'test-uuid-123',
        userId: 'user-123',
        title: 'Test Conversation',
        intent: 'general',
        customInstructions: 'Be helpful',
        currentPersonaId: 'persona-123',
        createdAt: mockConversation.created_at,
        updatedAt: mockConversation.updated_at,
        isArchived: false,
        totalCost: 0
      });

      expect(mockDb.execute).toHaveBeenCalledTimes(2);
      expect(mockDb.execute).toHaveBeenNthCalledWith(1,
        expect.stringContaining('INSERT INTO conversations'),
        ['test-uuid-123', 'user-123', 'Test Conversation', 'general', 'Be helpful', 'persona-123']
      );
    });

    it('should create conversation with minimal data', async () => {
      const conversationData = {
        userId: 'user-123'
      };

      const mockConversation = createMockRow({
        id: 'test-uuid-123',
        user_id: 'user-123',
        title: null,
        intent: null,
        custom_instructions: null,
        current_persona_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_archived: false,
        total_cost: 0
      });

      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);
      mockDb.execute.mockResolvedValueOnce([[mockConversation], []]);

      const result = await conversationRepository.create(conversationData);

      expect(result.userId).toBe('user-123');
      expect(result.title).toBeUndefined();
      expect(result.intent).toBeUndefined();
    });

    it('should handle database insertion failure', async () => {
      const conversationData = { userId: 'user-123' };

      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(conversationRepository.create(conversationData)).rejects.toThrow(DatabaseError);
    });
  });

  describe('update', () => {
    it('should update conversation successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        intent: 'updated-intent',
        isArchived: true
      };

      const mockUpdatedConversation = createMockRow({
        id: 'test-uuid-123',
        user_id: 'user-123',
        title: 'Updated Title',
        intent: 'updated-intent',
        custom_instructions: null,
        current_persona_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_archived: true,
        total_cost: 0
      });

      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);
      mockDb.execute.mockResolvedValueOnce([[mockUpdatedConversation], []]);

      const result = await conversationRepository.update('test-uuid-123', updateData);

      expect(result.title).toBe('Updated Title');
      expect(result.intent).toBe('updated-intent');
      expect(result.isArchived).toBe(true);

      expect(mockDb.execute).toHaveBeenNthCalledWith(1,
        expect.stringContaining('UPDATE conversations SET title = ?, intent = ?, is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
        ['Updated Title', 'updated-intent', true, 'test-uuid-123']
      );
    });

    it('should throw error when no fields to update', async () => {
      await expect(conversationRepository.update('test-id', {})).rejects.toThrow(DatabaseError);
    });

    it('should throw NotFoundError when conversation not found', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(conversationRepository.update('nonexistent-id', { title: 'New Title' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('findByUserId', () => {
    it('should find conversations by user ID with pagination', async () => {
      const mockConversations = [
        createMockRow({
          id: 'conv-1',
          user_id: 'user-123',
          title: 'Conversation 1',
          intent: 'general',
          custom_instructions: null,
          current_persona_id: null,
          created_at: new Date(),
          updated_at: new Date(),
          is_archived: false,
          total_cost: 5.50,
          message_count: 10
        }),
        createMockRow({
          id: 'conv-2',
          user_id: 'user-123',
          title: 'Conversation 2',
          intent: 'coding',
          custom_instructions: 'Help with code',
          current_persona_id: 'persona-123',
          created_at: new Date(),
          updated_at: new Date(),
          is_archived: false,
          total_cost: 2.25,
          message_count: 5
        })
      ];

      // Mock count query
      mockDb.execute.mockResolvedValueOnce([[{ total: 2 }], []]);
      
      // Mock data query
      mockDb.execute.mockResolvedValueOnce([mockConversations, []]);

      const result = await conversationRepository.findByUserId('user-123', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.data[0].messageCount).toBe(10);
      expect(result.data[1].messageCount).toBe(5);
    });

    it('should apply search filter', async () => {
      mockDb.execute.mockResolvedValueOnce([[{ total: 1 }], []]);
      mockDb.execute.mockResolvedValueOnce([[createMockRow({
        id: 'conv-1',
        user_id: 'user-123',
        title: 'Coding Help',
        message_count: 3
      })], []]);

      const result = await conversationRepository.findByUserId(
        'user-123',
        { page: 1, limit: 20 },
        { search: 'coding' }
      );

      expect(mockDb.execute).toHaveBeenNthCalledWith(2,
        expect.stringContaining('(title LIKE ? OR intent LIKE ? OR custom_instructions LIKE ?)'),
        expect.arrayContaining(['user-123', '%coding%', '%coding%', '%coding%'])
      );
    });

    it('should apply archive filter', async () => {
      mockDb.execute.mockResolvedValueOnce([[{ total: 0 }], []]);
      mockDb.execute.mockResolvedValueOnce([[], []]);

      await conversationRepository.findByUserId(
        'user-123',
        { page: 1, limit: 20 },
        { isArchived: true }
      );

      expect(mockDb.execute).toHaveBeenNthCalledWith(2,
        expect.stringContaining('is_archived = ?'),
        expect.arrayContaining(['user-123', true])
      );
    });
  });

  describe('findWithMessages', () => {
    it('should find conversation with messages and summaries', async () => {
      const mockConversation = createMockRow({
        id: 'conv-123',
        user_id: 'user-123',
        title: 'Test Conversation',
        intent: 'general',
        custom_instructions: null,
        current_persona_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_archived: false,
        total_cost: 0
      });

      const mockMessages = [
        createMockRow({
          id: 'msg-1',
          conversation_id: 'conv-123',
          persona_id: null,
          role: 'user',
          content: 'Hello',
          model_used: null,
          token_count: null,
          cost: null,
          created_at: new Date(),
          is_summarized: false,
          metadata: null,
          persona_name: null
        })
      ];

      const mockSummaries = [
        createMockRow({
          id: 'sum-1',
          conversation_id: 'conv-123',
          content: 'Summary of conversation',
          message_range_start: null,
          message_range_end: null,
          created_at: new Date(),
          is_active: true,
          token_count: 50
        })
      ];

      // Mock conversation query
      mockDb.execute.mockResolvedValueOnce([[mockConversation], []]);
      
      // Mock messages query
      mockDb.execute.mockResolvedValueOnce([mockMessages, []]);
      
      // Mock summaries query
      mockDb.execute.mockResolvedValueOnce([mockSummaries, []]);

      const result = await conversationRepository.findWithMessages('conv-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('conv-123');
      expect(result?.messages).toHaveLength(1);
      expect(result?.summaries).toHaveLength(1);
      expect(result?.messages[0].content).toBe('Hello');
      expect(result?.summaries[0].content).toBe('Summary of conversation');
    });

    it('should return null when conversation not found', async () => {
      mockDb.execute.mockResolvedValueOnce([[], []]);

      const result = await conversationRepository.findWithMessages('nonexistent', 'user-123');

      expect(result).toBeNull();
    });

    it('should return null when user does not own conversation', async () => {
      const mockConversation = createMockRow({
        id: 'conv-123',
        user_id: 'other-user',
        title: 'Test Conversation'
      });

      mockDb.execute.mockResolvedValueOnce([[mockConversation], []]);

      const result = await conversationRepository.findWithMessages('conv-123', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('updateTotalCost', () => {
    it('should update conversation total cost', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);

      await conversationRepository.updateTotalCost('conv-123', 2.50);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET total_cost = total_cost + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
        [2.50, 'conv-123']
      );
    });

    it('should throw NotFoundError when conversation not found', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(conversationRepository.updateTotalCost('nonexistent', 2.50))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('setArchiveStatus', () => {
    it('should archive conversation successfully', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);

      await conversationRepository.setArchiveStatus('conv-123', 'user-123', true);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
        [true, 'conv-123', 'user-123']
      );
    });

    it('should unarchive conversation successfully', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);

      await conversationRepository.setArchiveStatus('conv-123', 'user-123', false);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
        [false, 'conv-123', 'user-123']
      );
    });

    it('should throw NotFoundError when conversation not found or not owned', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(conversationRepository.setArchiveStatus('nonexistent', 'user-123', true))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteWithRelatedData', () => {
    it('should delete conversation and related data in transaction', async () => {
      const mockConnection = {
        execute: jest.fn()
      };

      // Mock transaction
      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });

      // Mock ownership check
      mockConnection.execute.mockResolvedValueOnce([[{ user_id: 'user-123' }], []]);
      
      // Mock delete operations
      mockConnection.execute.mockResolvedValueOnce([createMockResult(2), []]); // summaries
      mockConnection.execute.mockResolvedValueOnce([createMockResult(5), []]); // messages
      mockConnection.execute.mockResolvedValueOnce([createMockResult(3), []]); // usage_logs
      mockConnection.execute.mockResolvedValueOnce([createMockResult(1), []]); // conversation

      await conversationRepository.deleteWithRelatedData('conv-123', 'user-123');

      expect(mockConnection.execute).toHaveBeenCalledTimes(5);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(1,
        'SELECT user_id FROM conversations WHERE id = ?',
        ['conv-123']
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(2,
        'DELETE FROM summaries WHERE conversation_id = ?',
        ['conv-123']
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(5,
        'DELETE FROM conversations WHERE id = ?',
        ['conv-123']
      );
    });

    it('should throw NotFoundError when conversation not found', async () => {
      const mockConnection = {
        execute: jest.fn()
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });

      mockConnection.execute.mockResolvedValueOnce([[], []]);

      await expect(conversationRepository.deleteWithRelatedData('nonexistent', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user does not own conversation', async () => {
      const mockConnection = {
        execute: jest.fn()
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });

      mockConnection.execute.mockResolvedValueOnce([[{ user_id: 'other-user' }], []]);

      await expect(conversationRepository.deleteWithRelatedData('conv-123', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('toConversationResponse', () => {
    it('should convert conversation to response format', () => {
      const conversation = {
        id: 'conv-123',
        userId: 'user-123',
        title: 'Test Conversation',
        intent: 'general',
        customInstructions: 'Be helpful',
        currentPersonaId: 'persona-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        isArchived: false,
        totalCost: 5.50
      };

      const response = conversationRepository.toConversationResponse(conversation, 10);

      expect(response).toEqual({
        id: 'conv-123',
        userId: 'user-123',
        title: 'Test Conversation',
        intent: 'general',
        customInstructions: 'Be helpful',
        currentPersonaId: 'persona-123',
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        isArchived: false,
        totalCost: 5.50,
        messageCount: 10
      });
    });
  });
});