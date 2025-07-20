import {
  Message,
  Summary,
  CreateSummaryRequest,
  Conversation,
  TokenUsage,
} from '../models';
import { SummaryRepository } from '../repositories/SummaryRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { OpenAIService } from './OpenAIService';
import { logger } from '../config/logger';
import { DatabaseError, ValidationError, AIServiceError } from '../utils/errors';

export interface SummarizationConfig {
  maxTokensBeforeSummarization: number;
  summaryModel: string;
  preserveRecentMessages: number;
  maxSummaryTokens: number;
  summaryPromptTemplate: string;
  rollingSummaryPromptTemplate: string;
}

export interface SummarizationContext {
  conversation: Conversation;
  messages: Message[];
  existingSummary?: Summary;
  userTone?: string;
  userGoals?: string[];
  importantPhrases?: string[];
}

export interface SummarizationResult {
  summary: Summary;
  summarizedMessageIds: string[];
  preservedMessageIds: string[];
  tokensSaved: number;
  newTokenCount: number;
}

export class SummarizationService {
  private readonly config: SummarizationConfig;

  constructor(
    private summaryRepository: SummaryRepository,
    private messageRepository: MessageRepository,
    private openAIService: OpenAIService,
    config?: Partial<SummarizationConfig>
  ) {
    this.config = {
      maxTokensBeforeSummarization: 12000, // Start summarizing when approaching context limits
      summaryModel: 'gpt-4o-mini', // Use cost-effective model for summarization
      preserveRecentMessages: 10, // Keep last 10 messages unsummarized
      maxSummaryTokens: 2000, // Maximum tokens for summary
      summaryPromptTemplate: this.getDefaultSummaryPrompt(),
      rollingSummaryPromptTemplate: this.getDefaultRollingSummaryPrompt(),
      ...config,
    };
  }

  /**
   * Check if conversation needs summarization
   */
  async shouldSummarize(conversationId: string): Promise<boolean> {
    try {
      // Get conversation messages and calculate total tokens
      const messages = await this.messageRepository.findByConversationId(conversationId, {
        limit: 1000, // Get a large batch to analyze
        sortBy: 'created_at',
        sortOrder: 'ASC',
      });

      if (messages.data.length < 5) {
        // Don't summarize very short conversations
        return false;
      }

      // Calculate total token count
      const totalTokens = messages.data.reduce((total, message) => {
        return total + (message.tokenCount || this.openAIService.estimateTokenCount(message.content));
      }, 0);

      // Check if we're approaching token limits
      const needsSummarization = totalTokens > this.config.maxTokensBeforeSummarization;

      if (needsSummarization) {
        logger.info(`Conversation ${conversationId} needs summarization`, {
          totalTokens,
          messageCount: messages.data.length,
          threshold: this.config.maxTokensBeforeSummarization,
        });
      }

      return needsSummarization;
    } catch (error) {
      logger.error('Error checking if conversation needs summarization:', error);
      return false; // Default to not summarizing on error
    }
  }

  /**
   * Summarize conversation messages
   */
  async summarizeConversation(
    conversationId: string,
    userId: string
  ): Promise<SummarizationResult> {
    try {
      logger.info(`Starting summarization for conversation: ${conversationId}`);

      // Get all messages for the conversation
      const messagesResult = await this.messageRepository.findByConversationId(conversationId, {
        limit: 1000,
        sortBy: 'created_at',
        sortOrder: 'ASC',
      });

      const allMessages = messagesResult.data;

      if (allMessages.length === 0) {
        throw new ValidationError('No messages found for conversation');
      }

      // Get existing active summary
      const existingSummary = await this.summaryRepository.getLatestForConversation(conversationId);

      // Determine which messages to summarize
      const { messagesToSummarize, messagesToPreserve } = this.selectMessagesForSummarization(
        allMessages,
        existingSummary || undefined
      );

      if (messagesToSummarize.length === 0) {
        throw new ValidationError('No messages available for summarization');
      }

      // Build summarization context
      const context: SummarizationContext = {
        conversation: { id: conversationId, userId } as Conversation,
        messages: messagesToSummarize,
        existingSummary: existingSummary || undefined,
        ...this.extractUserContext(messagesToSummarize),
      };

      // Generate summary
      const summaryContent = existingSummary
        ? await this.generateRollingSummary(context)
        : await this.generateInitialSummary(context);

      // Calculate token counts
      const originalTokens = messagesToSummarize.reduce((total, msg) => {
        return total + (msg.tokenCount || this.openAIService.estimateTokenCount(msg.content));
      }, 0);

      const summaryTokens = this.openAIService.estimateTokenCount(summaryContent);

      // Create summary record
      const summaryData: CreateSummaryRequest = {
        conversationId,
        content: summaryContent,
        messageRangeStart: messagesToSummarize[0]?.id,
        messageRangeEnd: messagesToSummarize[messagesToSummarize.length - 1]?.id,
        tokenCount: summaryTokens,
      };

      // Save summary using rolling summary method (deactivates old summaries)
      const summary = await this.summaryRepository.createRollingSummary(summaryData);

      // Mark summarized messages
      await this.markMessagesAsSummarized(messagesToSummarize.map(m => m.id));

      const result: SummarizationResult = {
        summary,
        summarizedMessageIds: messagesToSummarize.map(m => m.id),
        preservedMessageIds: messagesToPreserve.map(m => m.id),
        tokensSaved: originalTokens - summaryTokens,
        newTokenCount: summaryTokens,
      };

      logger.info(`Summarization completed for conversation: ${conversationId}`, {
        summarizedMessages: result.summarizedMessageIds.length,
        preservedMessages: result.preservedMessageIds.length,
        tokensSaved: result.tokensSaved,
        summaryTokens: result.newTokenCount,
      });

      return result;
    } catch (error) {
      logger.error('Error summarizing conversation:', error);
      throw error;
    }
  }

  /**
   * Update rolling summary with new messages
   */
  async updateRollingSummary(
    conversationId: string,
    userId: string,
    newMessages: Message[]
  ): Promise<Summary> {
    try {
      logger.info(`Updating rolling summary for conversation: ${conversationId}`);

      // Get current active summary
      const currentSummary = await this.summaryRepository.getLatestForConversation(conversationId);
      if (!currentSummary) {
        throw new ValidationError('No existing summary found for rolling update');
      }

      // Build context for rolling summary
      const context: SummarizationContext = {
        conversation: { id: conversationId, userId } as Conversation,
        messages: newMessages,
        existingSummary: currentSummary || undefined,
        ...this.extractUserContext(newMessages),
      };

      // Generate updated summary
      const updatedSummaryContent = await this.generateRollingSummary(context);

      // Calculate new token count
      const summaryTokens = this.openAIService.estimateTokenCount(updatedSummaryContent);

      // Create new rolling summary
      const summaryData: CreateSummaryRequest = {
        conversationId,
        content: updatedSummaryContent,
        messageRangeStart: currentSummary.messageRangeStart,
        messageRangeEnd: newMessages[newMessages.length - 1]?.id,
        tokenCount: summaryTokens,
      };

      const updatedSummary = await this.summaryRepository.createRollingSummary(summaryData);

      // Mark new messages as summarized
      await this.markMessagesAsSummarized(newMessages.map(m => m.id));

      logger.info(`Rolling summary updated for conversation: ${conversationId}`, {
        newMessages: newMessages.length,
        summaryTokens,
      });

      return updatedSummary;
    } catch (error) {
      logger.error('Error updating rolling summary:', error);
      throw error;
    }
  }

  /**
   * Get conversation context for AI generation (summary + recent messages)
   */
  async getConversationContext(conversationId: string): Promise<{
    summary?: Summary;
    recentMessages: Message[];
    totalTokens: number;
  }> {
    try {
      // Get active summary
      const summary = await this.summaryRepository.getLatestForConversation(conversationId);

      // Get recent unsummarized messages
      const recentMessagesResult = await this.messageRepository.findByConversationId(
        conversationId,
        {
          limit: this.config.preserveRecentMessages * 2, // Get extra to filter
          sortBy: 'created_at',
          sortOrder: 'DESC',
        }
      );

      // Filter to only unsummarized messages or recent messages
      const recentMessages = recentMessagesResult.data
        .filter(msg => !msg.isSummarized)
        .slice(0, this.config.preserveRecentMessages)
        .reverse(); // Restore chronological order

      // Calculate total tokens
      const summaryTokens = summary
        ? summary.tokenCount || this.openAIService.estimateTokenCount(summary.content)
        : 0;

      const messageTokens = recentMessages.reduce((total, msg) => {
        return total + (msg.tokenCount || this.openAIService.estimateTokenCount(msg.content));
      }, 0);

      return {
        summary: summary || undefined,
        recentMessages,
        totalTokens: summaryTokens + messageTokens,
      };
    } catch (error) {
      logger.error('Error getting conversation context:', error);
      throw error;
    }
  }

  /**
   * Get and update summarization prompt template
   */
  getSummaryPromptTemplate(): string {
    return this.config.summaryPromptTemplate;
  }

  updateSummaryPromptTemplate(template: string): void {
    this.config.summaryPromptTemplate = template;
    logger.info('Summary prompt template updated');
  }

  getRollingSummaryPromptTemplate(): string {
    return this.config.rollingSummaryPromptTemplate;
  }

  updateRollingSummaryPromptTemplate(template: string): void {
    this.config.rollingSummaryPromptTemplate = template;
    logger.info('Rolling summary prompt template updated');
  }

  /**
   * Get summarization configuration
   */
  getConfig(): SummarizationConfig {
    return { ...this.config };
  }

  /**
   * Update summarization configuration
   */
  updateConfig(updates: Partial<SummarizationConfig>): void {
    Object.assign(this.config, updates);
    logger.info('Summarization configuration updated', updates);
  }

  // Private helper methods

  private selectMessagesForSummarization(
    allMessages: Message[],
    existingSummary?: Summary
  ): { messagesToSummarize: Message[]; messagesToPreserve: Message[] } {
    // Always preserve the most recent messages
    const preserveCount = this.config.preserveRecentMessages;
    const messagesToPreserve = allMessages.slice(-preserveCount);

    // If we have an existing summary, only summarize messages after the last summarized range
    let messagesToSummarize: Message[];

    if (existingSummary && existingSummary.messageRangeEnd) {
      // Find the index of the last summarized message
      const lastSummarizedIndex = allMessages.findIndex(
        msg => msg.id === existingSummary.messageRangeEnd
      );

      if (lastSummarizedIndex >= 0) {
        // Get messages between last summarized and recent messages to preserve
        const startIndex = lastSummarizedIndex + 1;
        const endIndex = allMessages.length - preserveCount;
        messagesToSummarize = allMessages.slice(startIndex, Math.max(startIndex, endIndex));
      } else {
        // Fallback: summarize all but recent messages
        messagesToSummarize = allMessages.slice(0, -preserveCount);
      }
    } else {
      // No existing summary: summarize all but recent messages
      messagesToSummarize = allMessages.slice(0, -preserveCount);
    }

    return { messagesToSummarize, messagesToPreserve };
  }

  private extractUserContext(messages: Message[]): {
    userTone?: string;
    userGoals?: string[];
    importantPhrases?: string[];
  } {
    // Extract user messages for context analysis
    const userMessages = messages.filter(msg => msg.role === 'user');

    if (userMessages.length === 0) {
      return {};
    }

    // Simple tone detection based on keywords and patterns
    const allUserText = userMessages.map(msg => msg.content).join(' ').toLowerCase();

    let userTone = 'neutral';
    if (allUserText.includes('frustrated') || allUserText.includes('annoyed') || allUserText.includes('!')) {
      userTone = 'frustrated';
    } else if (allUserText.includes('excited') || allUserText.includes('great') || allUserText.includes('awesome')) {
      userTone = 'excited';
    } else if (allUserText.includes('confused') || allUserText.includes('not sure') || allUserText.includes('?')) {
      userTone = 'uncertain';
    }

    // Extract potential goals (simple keyword matching)
    const goalKeywords = ['want to', 'need to', 'trying to', 'goal is', 'objective', 'plan to'];
    const userGoals: string[] = [];

    userMessages.forEach(msg => {
      goalKeywords.forEach(keyword => {
        if (msg.content.toLowerCase().includes(keyword)) {
          // Extract the sentence containing the goal
          const sentences = msg.content.split(/[.!?]/);
          const goalSentence = sentences.find(s => s.toLowerCase().includes(keyword));
          if (goalSentence && goalSentence.trim().length > 0) {
            userGoals.push(goalSentence.trim());
          }
        }
      });
    });

    // Extract important phrases (quoted text, emphasized text)
    const importantPhrases: string[] = [];
    const quotedTextRegex = /"([^"]+)"/g;
    const emphasizedTextRegex = /\*([^*]+)\*/g;

    userMessages.forEach(msg => {
      let match;
      while ((match = quotedTextRegex.exec(msg.content)) !== null) {
        importantPhrases.push(match[1]);
      }
      while ((match = emphasizedTextRegex.exec(msg.content)) !== null) {
        importantPhrases.push(match[1]);
      }
    });

    return {
      userTone: userTone !== 'neutral' ? userTone : undefined,
      userGoals: userGoals.length > 0 ? userGoals : undefined,
      importantPhrases: importantPhrases.length > 0 ? importantPhrases : undefined,
    };
  }

  private async generateInitialSummary(context: SummarizationContext): Promise<string> {
    const prompt = this.buildSummaryPrompt(context, false);

    try {
      const response = await this.openAIService.generateResponse(
        [{ role: 'user', content: prompt }],
        this.config.summaryModel,
        {
          maxTokens: this.config.maxSummaryTokens,
          temperature: 0.3, // Lower temperature for more consistent summaries
        }
      );

      return response.content;
    } catch (error) {
      logger.error('Error generating initial summary:', error);
      throw new AIServiceError('Failed to generate conversation summary');
    }
  }

  private async generateRollingSummary(context: SummarizationContext): Promise<string> {
    const prompt = this.buildSummaryPrompt(context, true);

    try {
      const response = await this.openAIService.generateResponse(
        [{ role: 'user', content: prompt }],
        this.config.summaryModel,
        {
          maxTokens: this.config.maxSummaryTokens,
          temperature: 0.3,
        }
      );

      return response.content;
    } catch (error) {
      logger.error('Error generating rolling summary:', error);
      throw new AIServiceError('Failed to generate rolling summary');
    }
  }

  private buildSummaryPrompt(context: SummarizationContext, isRolling: boolean): string {
    const template = isRolling
      ? this.config.rollingSummaryPromptTemplate
      : this.config.summaryPromptTemplate;

    // Format messages for the prompt
    const messagesText = context.messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    // Build context information
    const contextInfo = [];
    if (context.userTone) {
      contextInfo.push(`User tone: ${context.userTone}`);
    }
    if (context.userGoals && context.userGoals.length > 0) {
      contextInfo.push(`User goals: ${context.userGoals.join('; ')}`);
    }
    if (context.importantPhrases && context.importantPhrases.length > 0) {
      contextInfo.push(`Important phrases: "${context.importantPhrases.join('", "')}"`);
    }

    const contextString = contextInfo.length > 0 ? contextInfo.join('\n') : 'No specific context detected.';

    // Replace placeholders in template
    return template
      .replace('{{MESSAGES}}', messagesText)
      .replace('{{CONTEXT}}', contextString)
      .replace('{{EXISTING_SUMMARY}}', context.existingSummary?.content || 'No existing summary.')
      .replace('{{MESSAGE_COUNT}}', context.messages.length.toString());
  }

  private async markMessagesAsSummarized(messageIds: string[]): Promise<void> {
    try {
      await Promise.all(
        messageIds.map(id =>
          this.messageRepository.update(id, { isSummarized: true })
        )
      );
    } catch (error) {
      logger.error('Error marking messages as summarized:', error);
      // Don't throw here as the summary was created successfully
    }
  }

  private getDefaultSummaryPrompt(): string {
    return `You are tasked with creating a comprehensive summary of a conversation that preserves all important context, user goals, tone, and key information. This summary will be used to maintain conversation continuity.

CONVERSATION TO SUMMARIZE:
{{MESSAGES}}

CONTEXT INFORMATION:
{{CONTEXT}}

INSTRUCTIONS:
1. Create a detailed summary that captures:
   - The main topics and themes discussed
   - User's goals, requests, and unresolved questions
   - Key decisions, conclusions, or agreements reached
   - Important facts, data, or information shared
   - User's tone, emotions, and communication style
   - Any specific terminology, phrases, or preferences the user mentioned

2. Preserve the conversational flow and relationships between topics

3. Include specific details that would be important for continuing the conversation naturally

4. Maintain the user's voice and personality as expressed in their messages

5. Highlight any ongoing tasks, commitments, or follow-up items

6. Keep the summary detailed enough to maintain context but concise enough to be efficient

Create a comprehensive summary that would allow someone to continue this conversation seamlessly:`;
  }

  private getDefaultRollingSummaryPrompt(): string {
    return `You are updating an existing conversation summary with new messages. Create an updated summary that incorporates the new information while maintaining all important context from the previous summary.

EXISTING SUMMARY:
{{EXISTING_SUMMARY}}

NEW MESSAGES TO INCORPORATE:
{{MESSAGES}}

CONTEXT INFORMATION:
{{CONTEXT}}

INSTRUCTIONS:
1. Merge the new messages with the existing summary, maintaining chronological flow
2. Preserve all important information from the existing summary
3. Add new topics, decisions, and information from the recent messages
4. Update user goals or status if they have evolved
5. Maintain the user's tone and communication style
6. Ensure the updated summary remains comprehensive but efficient
7. Remove any redundant information while preserving key details
8. Keep the summary focused on information needed for conversation continuity

Create an updated comprehensive summary that incorporates both the existing context and new information:`;
  }
}