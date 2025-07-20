export interface Summary {
  id: string;
  conversationId: string;
  content: string;
  messageRangeStart?: string;
  messageRangeEnd?: string;
  createdAt: Date;
  isActive: boolean;
  tokenCount?: number;
}

export interface CreateSummaryRequest {
  conversationId: string;
  content: string;
  messageRangeStart?: string;
  messageRangeEnd?: string;
  tokenCount?: number;
}

export interface UpdateSummaryRequest {
  content?: string;
  isActive?: boolean;
  tokenCount?: number;
}

export interface SummaryResponse {
  id: string;
  conversationId: string;
  content: string;
  messageRangeStart?: string;
  messageRangeEnd?: string;
  createdAt: Date;
  isActive: boolean;
  tokenCount?: number;
}

export interface SummaryWithMessages extends Summary {
  startMessage?: {
    id: string;
    content: string;
    createdAt: Date;
  };
  endMessage?: {
    id: string;
    content: string;
    createdAt: Date;
  };
}
