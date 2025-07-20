export interface Message {
  id: string;
  conversationId: string;
  personaId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string;
  tokenCount?: number;
  cost?: number;
  createdAt: Date;
  isSummarized: boolean;
  metadata?: Record<string, any>;
}

export interface CreateMessageRequest {
  conversationId: string;
  personaId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string;
  tokenCount?: number;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface UpdateMessageRequest {
  content?: string;
  isSummarized?: boolean;
  metadata?: Record<string, any>;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  personaId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string;
  tokenCount?: number;
  cost?: number;
  createdAt: Date;
  isSummarized: boolean;
  metadata?: Record<string, any>;
}

export interface MessageWithPersona extends Message {
  persona?: {
    id: string;
    name: string;
    description?: string;
  };
}

export type MessageRole = 'user' | 'assistant' | 'system';
