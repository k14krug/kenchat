// Export all repository classes
export { BaseRepository } from './BaseRepository';
export { UserRepository } from './UserRepository';
export { ConversationRepository } from './ConversationRepository';
export { MessageRepository } from './MessageRepository';
export { PersonaRepository } from './PersonaRepository';
export { SummaryRepository } from './SummaryRepository';
export { UsageLogRepository } from './UsageLogRepository';

// Import for use in factory
import { UserRepository } from './UserRepository';
import { ConversationRepository } from './ConversationRepository';
import { MessageRepository } from './MessageRepository';
import { PersonaRepository } from './PersonaRepository';
import { SummaryRepository } from './SummaryRepository';
import { UsageLogRepository } from './UsageLogRepository';

// Repository factory for dependency injection
export class RepositoryFactory {
  private static userRepository: UserRepository;
  private static conversationRepository: ConversationRepository;
  private static messageRepository: MessageRepository;
  private static personaRepository: PersonaRepository;
  private static summaryRepository: SummaryRepository;
  private static usageLogRepository: UsageLogRepository;

  static getUserRepository(): UserRepository {
    if (!this.userRepository) {
      this.userRepository = new UserRepository();
    }
    return this.userRepository;
  }

  static getConversationRepository(): ConversationRepository {
    if (!this.conversationRepository) {
      this.conversationRepository = new ConversationRepository();
    }
    return this.conversationRepository;
  }

  static getMessageRepository(): MessageRepository {
    if (!this.messageRepository) {
      this.messageRepository = new MessageRepository();
    }
    return this.messageRepository;
  }

  static getPersonaRepository(): PersonaRepository {
    if (!this.personaRepository) {
      this.personaRepository = new PersonaRepository();
    }
    return this.personaRepository;
  }

  static getSummaryRepository(): SummaryRepository {
    if (!this.summaryRepository) {
      this.summaryRepository = new SummaryRepository();
    }
    return this.summaryRepository;
  }

  static getUsageLogRepository(): UsageLogRepository {
    if (!this.usageLogRepository) {
      this.usageLogRepository = new UsageLogRepository();
    }
    return this.usageLogRepository;
  }

  // Reset all repositories (useful for testing)
  static reset(): void {
    this.userRepository = undefined as any;
    this.conversationRepository = undefined as any;
    this.messageRepository = undefined as any;
    this.personaRepository = undefined as any;
    this.summaryRepository = undefined as any;
    this.usageLogRepository = undefined as any;
  }
}
