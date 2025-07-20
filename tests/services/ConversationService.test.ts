import { ConversationService } from '../../src/services/ConversationService';
import { ConversationRepository } from '../../src/repositories/ConversationRepository';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { PersonaRepository } from '../../src/repositories/PersonaRepository';
import { ValidationError, NotFoundError } from '../../src/utils/errors';

// Mock the repositories
jest.mock('../../src/repositories/ConversationRepository');
jest.mock('../../src/repositories/MessageRepository');
jest.mock('../../src/repositories/PersonaRepository');

describe('ConversationService', () => {
    let conversationService: ConversationService;
    let mockConversationRepository: jest.Mocked<ConversationRepository>;
    let mockMessageRepository: jest.Mocked<MessageRepository>;
    let mockPersonaRepository: jest.Mocked<PersonaRepository>;

    beforeEach(() => {
        // Create mocked instances
        mockConversationRepository = new ConversationRepository() as jest.Mocked<ConversationRepository>;
        mockMessageRepository = new MessageRepository() as jest.Mocked<MessageRepository>;
        mockPersonaRepository = new PersonaRepository() as jest.Mocked<PersonaRepository>;

        // Create service instance with mocked dependencies
        conversationService = new ConversationService(
            mockConversationRepository,
            mockMessageRepository,
            mockPersonaRepository
        );

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('createConversation', () => {
        it('should create a conversation successfully', async () => {
            const userId = 'user-123';
            const conversationData = {
                title: 'Test Conversation',
                intent: 'general',
                customInstructions: 'Be helpful'
            };

            const mockConversation = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                intent: 'general',
                customInstructions: 'Be helpful',
                currentPersonaId: undefined,
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            };

            const mockResponse = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                intent: 'general',
                customInstructions: 'Be helpful',
                currentPersonaId: undefined,
                createdAt: mockConversation.createdAt,
                updatedAt: mockConversation.updatedAt,
                isArchived: false,
                totalCost: 0
            };

            mockConversationRepository.create.mockResolvedValue(mockConversation);
            mockConversationRepository.toConversationResponse.mockReturnValue(mockResponse);

            const result = await conversationService.createConversation(userId, conversationData);

            expect(mockConversationRepository.create).toHaveBeenCalledWith({
                ...conversationData,
                userId
            });
            expect(result).toEqual(mockResponse);
        });

        it('should validate persona ownership when creating conversation with persona', async () => {
            const userId = 'user-123';
            const conversationData = {
                title: 'Test Conversation',
                currentPersonaId: 'persona-123'
            };

            const mockPersona = {
                id: 'persona-123',
                userId: 'user-123',
                name: 'Test Persona',
                systemPrompt: 'Test prompt',
                createdAt: new Date(),
                updatedAt: new Date(),
                isDefault: false,
                usageCount: 0
            };

            mockPersonaRepository.findById.mockResolvedValue(mockPersona);
            mockConversationRepository.create.mockResolvedValue({
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                currentPersonaId: 'persona-123',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            });
            mockConversationRepository.toConversationResponse.mockReturnValue({
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                currentPersonaId: 'persona-123',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            });

            await conversationService.createConversation(userId, conversationData);

            expect(mockPersonaRepository.findById).toHaveBeenCalledWith('persona-123');
        });

        it('should throw ValidationError when persona does not belong to user', async () => {
            const userId = 'user-123';
            const conversationData = {
                title: 'Test Conversation',
                currentPersonaId: 'persona-123'
            };

            const mockPersona = {
                id: 'persona-123',
                userId: 'other-user',
                name: 'Test Persona',
                systemPrompt: 'Test prompt',
                createdAt: new Date(),
                updatedAt: new Date(),
                isDefault: false,
                usageCount: 0
            };

            mockPersonaRepository.findById.mockResolvedValue(mockPersona);

            await expect(conversationService.createConversation(userId, conversationData))
                .rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError when persona not found', async () => {
            const userId = 'user-123';
            const conversationData = {
                title: 'Test Conversation',
                currentPersonaId: 'nonexistent-persona'
            };

            mockPersonaRepository.findById.mockResolvedValue(null);

            await expect(conversationService.createConversation(userId, conversationData))
                .rejects.toThrow(ValidationError);
        });
    });

    describe('getUserConversations', () => {
        it('should get user conversations with pagination', async () => {
            const userId = 'user-123';
            const options = { page: 1, limit: 20 };
            const filters = { search: 'test' };

            const mockResult = {
                data: [
                    {
                        id: 'conv-1',
                        userId: 'user-123',
                        title: 'Conversation 1',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        isArchived: false,
                        totalCost: 0,
                        messageCount: 5
                    }
                ],
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false
                }
            };

            const mockResponse = {
                id: 'conv-1',
                userId: 'user-123',
                title: 'Conversation 1',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0,
                messageCount: 5
            };

            mockConversationRepository.findByUserId.mockResolvedValue(mockResult);
            mockConversationRepository.toConversationResponse.mockReturnValue(mockResponse);

            const result = await conversationService.getUserConversations(userId, options, filters);

            expect(mockConversationRepository.findByUserId).toHaveBeenCalledWith(userId, options, filters);
            expect(result.data).toHaveLength(1);
            expect(result.pagination).toEqual(mockResult.pagination);
        });
    });

    describe('getConversation', () => {
        it('should get conversation by ID with user isolation', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';

            const mockConversation = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            };

            const mockResponse = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                createdAt: mockConversation.createdAt,
                updatedAt: mockConversation.updatedAt,
                isArchived: false,
                totalCost: 0
            };

            mockConversationRepository.findById.mockResolvedValue(mockConversation);
            mockConversationRepository.toConversationResponse.mockReturnValue(mockResponse);

            const result = await conversationService.getConversation(conversationId, userId);

            expect(mockConversationRepository.findById).toHaveBeenCalledWith(conversationId);
            expect(result).toEqual(mockResponse);
        });

        it('should throw NotFoundError when conversation not found', async () => {
            const conversationId = 'nonexistent';
            const userId = 'user-123';

            mockConversationRepository.findById.mockResolvedValue(null);

            await expect(conversationService.getConversation(conversationId, userId))
                .rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError when user does not own conversation', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';

            const mockConversation = {
                id: 'conv-123',
                userId: 'other-user',
                title: 'Test Conversation',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            };

            mockConversationRepository.findById.mockResolvedValue(mockConversation);

            await expect(conversationService.getConversation(conversationId, userId))
                .rejects.toThrow(NotFoundError);
        });
    });

    describe('updateConversation', () => {
        it('should update conversation with user isolation', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';
            const updateData = { title: 'Updated Title' };

            const mockExistingConversation = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Old Title',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            };

            const mockUpdatedConversation = {
                ...mockExistingConversation,
                title: 'Updated Title'
            };

            const mockResponse = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Updated Title',
                createdAt: mockUpdatedConversation.createdAt,
                updatedAt: mockUpdatedConversation.updatedAt,
                isArchived: false,
                totalCost: 0
            };

            mockConversationRepository.findById.mockResolvedValue(mockExistingConversation);
            mockConversationRepository.update.mockResolvedValue(mockUpdatedConversation);
            mockConversationRepository.toConversationResponse.mockReturnValue(mockResponse);

            const result = await conversationService.updateConversation(conversationId, userId, updateData);

            expect(mockConversationRepository.findById).toHaveBeenCalledWith(conversationId);
            expect(mockConversationRepository.update).toHaveBeenCalledWith(conversationId, updateData);
            expect(result).toEqual(mockResponse);
        });

        it('should validate persona ownership when updating persona', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';
            const updateData = { currentPersonaId: 'persona-123' };

            const mockExistingConversation = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            };

            const mockPersona = {
                id: 'persona-123',
                userId: 'user-123',
                name: 'Test Persona',
                systemPrompt: 'Test prompt',
                createdAt: new Date(),
                updatedAt: new Date(),
                isDefault: false,
                usageCount: 0
            };

            mockConversationRepository.findById.mockResolvedValue(mockExistingConversation);
            mockPersonaRepository.findById.mockResolvedValue(mockPersona);
            mockConversationRepository.update.mockResolvedValue(mockExistingConversation);
            mockConversationRepository.toConversationResponse.mockReturnValue({
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            });

            await conversationService.updateConversation(conversationId, userId, updateData);

            expect(mockPersonaRepository.findById).toHaveBeenCalledWith('persona-123');
        });
    });

    describe('addMessage', () => {
        it('should add message to conversation with user isolation', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';
            const messageData = {
                role: 'user' as const,
                content: 'Hello world',
                cost: 0.01
            };

            const mockConversation = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            };

            const mockMessage = {
                id: 'msg-123',
                conversationId: 'conv-123',
                role: 'user' as const,
                content: 'Hello world',
                createdAt: new Date(),
                isSummarized: false,
                cost: 0.01
            };

            mockConversationRepository.findById.mockResolvedValue(mockConversation);
            mockMessageRepository.create.mockResolvedValue(mockMessage);
            mockConversationRepository.updateTotalCost.mockResolvedValue();

            const result = await conversationService.addMessage(conversationId, userId, messageData);

            expect(mockConversationRepository.findById).toHaveBeenCalledWith(conversationId);
            expect(mockMessageRepository.create).toHaveBeenCalledWith({
                ...messageData,
                conversationId
            });
            expect(mockConversationRepository.updateTotalCost).toHaveBeenCalledWith(conversationId, 0.01);
            expect(result).toEqual(mockMessage);
        });

        it('should validate persona ownership when adding message with persona', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';
            const messageData = {
                role: 'assistant' as const,
                content: 'Hello!',
                personaId: 'persona-123'
            };

            const mockConversation = {
                id: 'conv-123',
                userId: 'user-123',
                title: 'Test Conversation',
                createdAt: new Date(),
                updatedAt: new Date(),
                isArchived: false,
                totalCost: 0
            };

            const mockPersona = {
                id: 'persona-123',
                userId: 'user-123',
                name: 'Test Persona',
                systemPrompt: 'Test prompt',
                createdAt: new Date(),
                updatedAt: new Date(),
                isDefault: false,
                usageCount: 0
            };

            const mockMessage = {
                id: 'msg-123',
                conversationId: 'conv-123',
                personaId: 'persona-123',
                role: 'assistant' as const,
                content: 'Hello!',
                createdAt: new Date(),
                isSummarized: false
            };

            mockConversationRepository.findById.mockResolvedValue(mockConversation);
            mockPersonaRepository.findById.mockResolvedValue(mockPersona);
            mockMessageRepository.create.mockResolvedValue(mockMessage);

            await conversationService.addMessage(conversationId, userId, messageData);

            expect(mockPersonaRepository.findById).toHaveBeenCalledWith('persona-123');
        });

        it('should throw NotFoundError when conversation not found', async () => {
            const conversationId = 'nonexistent';
            const userId = 'user-123';
            const messageData = {
                role: 'user' as const,
                content: 'Hello world'
            };

            mockConversationRepository.findById.mockResolvedValue(null);

            await expect(conversationService.addMessage(conversationId, userId, messageData))
                .rejects.toThrow(NotFoundError);
        });
    });

    describe('searchConversations', () => {
        it('should search conversations by query', async () => {
            const userId = 'user-123';
            const searchQuery = 'test query';
            const options = { page: 1, limit: 20 };

            const mockResult = {
                data: [],
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                }
            };

            mockConversationRepository.findByUserId.mockResolvedValue(mockResult);

            const result = await conversationService.searchConversations(userId, searchQuery, options);

            expect(mockConversationRepository.findByUserId).toHaveBeenCalledWith(
                userId,
                options,
                { search: searchQuery }
            );
            expect(result).toEqual({
                data: [],
                pagination: mockResult.pagination
            });
        });
    });

    describe('setArchiveStatus', () => {
        it('should archive conversation', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';

            mockConversationRepository.setArchiveStatus.mockResolvedValue();

            await conversationService.setArchiveStatus(conversationId, userId, true);

            expect(mockConversationRepository.setArchiveStatus).toHaveBeenCalledWith(
                conversationId,
                userId,
                true
            );
        });

        it('should unarchive conversation', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';

            mockConversationRepository.setArchiveStatus.mockResolvedValue();

            await conversationService.setArchiveStatus(conversationId, userId, false);

            expect(mockConversationRepository.setArchiveStatus).toHaveBeenCalledWith(
                conversationId,
                userId,
                false
            );
        });
    });

    describe('deleteConversation', () => {
        it('should delete conversation with user isolation', async () => {
            const conversationId = 'conv-123';
            const userId = 'user-123';

            mockConversationRepository.deleteWithRelatedData.mockResolvedValue();

            await conversationService.deleteConversation(conversationId, userId);

            expect(mockConversationRepository.deleteWithRelatedData).toHaveBeenCalledWith(
                conversationId,
                userId
            );
        });
    });
});