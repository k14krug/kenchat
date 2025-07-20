// Export all repository classes
export { BaseRepository } from './BaseRepository';
export { UserRepository } from './UserRepository';
export { ConversationRepository } from './ConversationRepository';
export { MessageRepository } from './MessageRepository';
export { PersonaRepository } from './PersonaRepository';
export { SummaryRepository } from './SummaryRepository';

// Repository factory for dependency injection
export class RepositoryFactory {
  private static userRepository: UserRepository;
  private static conversationRepository: ConversationRepository;
  private static messageRepository: MessageRepository;
  private static personaRepository: PersonaRepository;
  private static summaryRepository: SummaryRepository;

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

  // Reset all repositories (useful for testing)
  static reset(): void {
    this.userRepository = undefined as any;
    this.conversationRepository = undefined as any;
    this.messageRepository = undefined as any;
    this.personaRepository = undefined as any;
    this.summaryRepository = undefined as any;
  }
}
