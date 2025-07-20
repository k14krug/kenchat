export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  intent?: string;
  customInstructions?: string;
  currentPersonaId?: string;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  totalCost: number;
  messages?: Message[];
  summaries?: Summary[];
}

export interface CreateConversationRequest {
  userId: string;
  title?: string;
  intent?: string;
  customInstructions?: string;
  currentPersonaId?: string;
}

export interface UpdateConversationRequest {
  title?: string;
  intent?: string;
  customInstructions?: string;
  currentPersonaId?: string;
  isArchived?: boolean;
}

export interface ConversationResponse {
  id: string;
  userId: string;
  title?: string;
  intent?: string;
  customInstructions?: string;
  currentPersonaId?: string;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  totalCost: number;
  messageCount?: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  summaries: Summary[];
}

// Import types from other models
import { Message } from './Message';
import { Summary } from './Summary';
