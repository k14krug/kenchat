import { Request, Response, NextFunction } from 'express';
import { OpenAIService } from '../services/OpenAIService';
import { ConversationService } from '../services/ConversationService';
import { PersonaService } from '../services/PersonaService';
import { SummarizationService } from '../services/SummarizationService';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { PersonaRepository } from '../repositories/PersonaRepository';
import { SummaryRepository } from '../repositories/SummaryRepository';
import { ChatMessage, AIOptions } from '../models/AI';
import { ValidationError, NotFoundError, AIServiceError } from '../utils/errors';
import { logger } from '../config/logger';
import Joi from 'joi';

export class ChatController {
  private readonly openAIService: OpenAIService;
  private readonly conversationService: ConversationService;
  private readonly personaService: PersonaService;
  private readonly summarizationService: SummarizationService;

  constructor() {
    const conversationRepository = new ConversationRepository();
    const messageRepository = new MessageRepository();
    const personaRepository = new PersonaRepository();
    const summaryRepository = new SummaryRepository();

    this.openAIService = new OpenAIService();
    this.conversationService = new ConversationService(
      conversationRepository,
      messageRepository,
      personaRepository
    );
    this.personaService = new PersonaService();
    this.summarizationService = new SummarizationService(
      summaryRepository,
      messageRepository,
      this.openAIService
    );
  }

  /**
   * Generate AI response with persona and context integration
   */
  generateResponse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const { conversationId, content, personaId, model, options } = this.validateChatRequest(req.body);

      // Verify conversation ownership
      const conversation = await this.conversationService.getConversation(conversationId, userId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      // Get persona if specified
      let persona = null;
      if (personaId) {
        try {
          persona = await this.personaService.getPersonaById(personaId, userId);
        } catch (error) {
          throw new ValidationError('Invalid persona ID or persona does not belong to user');
        }
      }

      // Add user message to conversation
      const userMessage = await this.conversationService.addMessage(conversationId, userId, {
        role: 'user',
        content,
        personaId,
      });

      // Build context for AI response
      const context = await this.buildConversationContext(conversationId, userId, persona);

      // Generate AI response
      const aiResponse = await this.generateAIResponse(
        context,
        userId,
        conversationId,
        model,
        options
      );

      // Add AI response to conversation
      const assistantMessage = await this.conversationService.addMessage(conversationId, userId, {
        role: 'assistant',
        content: aiResponse.content,
        personaId,
        modelUsed: aiResponse.model,
        tokenCount: aiResponse.usage.totalTokens,
        cost: aiResponse.cost,
      });

      // Check if summarization is needed
      await this.checkAndSummarizeIfNeeded(conversationId, userId);

      res.status(200).json({
        success: true,
        data: {
          userMessage,
          assistantMessage,
          aiResponse: {
            model: aiResponse.model,
            usage: aiResponse.usage,
            cost: aiResponse.cost,
            finishReason: aiResponse.finishReason,
          },
        },
      });
    } catch (error) {
      logger.error('Error generating AI response:', error);
      next(error);
    }
  };

  /**
   * Generate streaming AI response
   */
  generateStreamingResponse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const { conversationId, content, personaId, model, options } = this.validateChatRequest(req.body);

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // Send initial status
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting generation...' })}\n\n`);

      try {
        // Verify conversation ownership
        const conversation = await this.conversationService.getConversation(conversationId, userId);
        if (!conversation) {
          throw new NotFoundError('Conversation not found');
        }

        // Get persona if specified
        let persona = null;
        if (personaId) {
          try {
            persona = await this.personaService.getPersonaById(personaId, userId);
          } catch (error) {
            throw new ValidationError('Invalid persona ID or persona does not belong to user');
          }
        }

        // Add user message
        const userMessage = await this.conversationService.addMessage(conversationId, userId, {
          role: 'user',
          content,
          personaId,
        });

        res.write(`data: ${JSON.stringify({ type: 'user_message', data: userMessage })}\n\n`);

        // Build context
        const context = await this.buildConversationContext(conversationId, userId, persona);

        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Generating response...' })}\n\n`);

        // For now, generate non-streaming response (streaming would require OpenAI streaming API)
        const aiResponse = await this.generateAIResponse(
          context,
          userId,
          conversationId,
          model,
          { ...options, stream: false }
        );

        // Simulate streaming by sending chunks
        const chunks = this.chunkText(aiResponse.content, 50);
        let accumulatedContent = '';

        for (let i = 0; i < chunks.length; i++) {
          accumulatedContent += chunks[i];
          res.write(`data: ${JSON.stringify({
            type: 'content_chunk',
            data: {
              chunk: chunks[i],
              accumulated: accumulatedContent,
              isComplete: i === chunks.length - 1,
            },
          })}\n\n`);

          // Add small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Add AI response to conversation
        const assistantMessage = await this.conversationService.addMessage(conversationId, userId, {
          role: 'assistant',
          content: aiResponse.content,
          personaId,
          modelUsed: aiResponse.model,
          tokenCount: aiResponse.usage.totalTokens,
          cost: aiResponse.cost,
        });

        res.write(`data: ${JSON.stringify({
          type: 'assistant_message',
          data: {
            message: assistantMessage,
            aiResponse: {
              model: aiResponse.model,
              usage: aiResponse.usage,
              cost: aiResponse.cost,
              finishReason: aiResponse.finishReason,
            },
          },
        })}\n\n`);

        // Check if summarization is needed
        await this.checkAndSummarizeIfNeeded(conversationId, userId);

        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code || 'UNKNOWN_ERROR',
          },
        })}\n\n`);
      }

      res.end();
    } catch (error) {
      logger.error('Error in streaming response:', error);
      next(error);
    }
  };

  /**
   * Get available AI models
   */
  getModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const models = this.openAIService.getAvailableModels();

      res.status(200).json({
        success: true,
        data: models,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get model information
   */
  getModelInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { modelId } = req.params;

      if (!modelId) {
        throw new ValidationError('Model ID is required');
      }

      const modelInfo = this.openAIService.getModelInfo(modelId);

      if (!modelInfo) {
        throw new NotFoundError('Model not found');
      }

      res.status(200).json({
        success: true,
        data: modelInfo,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Build conversation context with persona and summarization
   */
  private async buildConversationContext(
    conversationId: string,
    userId: string,
    persona: any = null
  ): Promise<ChatMessage[]> {
    const context: ChatMessage[] = [];

    // Add system message with persona if specified
    if (persona) {
      context.push({
        role: 'system',
        content: persona.systemPrompt,
      });
    }

    // Get conversation details for custom instructions
    const conversation = await this.conversationService.getConversation(conversationId, userId);

    // Add custom instructions if present
    if (conversation.customInstructions) {
      context.push({
        role: 'system',
        content: `User's custom instructions: ${conversation.customInstructions}`,
      });
    }

    // Add intent context if present
    if (conversation.intent) {
      context.push({
        role: 'system',
        content: `Current conversation intent: ${conversation.intent}`,
      });
    }

    // Get conversation context (recent messages + summaries)
    const conversationContext = await this.summarizationService.getConversationContext(
      conversationId
    );

    // Add summary if available
    if (conversationContext.summary) {
      context.push({
        role: 'system',
        content: `Previous conversation summary: ${conversationContext.summary.content}`,
      });
    }

    // Add recent messages
    conversationContext.recentMessages.forEach(message => {
      context.push({
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content,
      });
    });

    return context;
  }

  /**
   * Generate AI response with proper type conversion
   */
  private async generateAIResponse(
    context: ChatMessage[],
    userId: string,
    conversationId: string,
    model?: string,
    options?: AIOptions
  ) {
    // For now, use the basic generateResponse method to avoid type conflicts
    // In a real implementation, we'd need to align the type system across services
    return await this.openAIService.generateResponse(
      context,
      model,
      options
    );
  }

  /**
   * Check if summarization is needed and perform it
   */
  private async checkAndSummarizeIfNeeded(conversationId: string, userId: string): Promise<void> {
    try {
      const conversation = await this.conversationService.getConversationWithMessages(conversationId, userId);

      const shouldSummarize = await this.summarizationService.shouldSummarize(conversationId);
      if (shouldSummarize) {
        await this.summarizationService.summarizeConversation(conversationId, userId);
        logger.info(`Conversation summarized: ${conversationId}`);
      }
    } catch (error) {
      logger.error('Error checking summarization:', error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Chunk text for simulated streaming
   */
  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Validate chat request
   */
  private validateChatRequest(body: any): {
    conversationId: string;
    content: string;
    personaId?: string;
    model?: string;
    options?: AIOptions;
  } {
    const schema = Joi.object({
      conversationId: Joi.string().required(),
      content: Joi.string().min(1).required(),
      personaId: Joi.string().optional(),
      model: Joi.string().optional(),
      options: Joi.object({
        temperature: Joi.number().min(0).max(2).optional(),
        maxTokens: Joi.number().min(1).optional(),
        topP: Joi.number().min(0).max(1).optional(),
        frequencyPenalty: Joi.number().min(-2).max(2).optional(),
        presencePenalty: Joi.number().min(-2).max(2).optional(),
        stop: Joi.array().items(Joi.string()).optional(),
      }).optional(),
    });

    const { error, value } = schema.validate(body);
    if (error) {
      throw new ValidationError(`Invalid request: ${error.message}`);
    }

    return value;
  }
}