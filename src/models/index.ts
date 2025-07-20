// Export all model interfaces and types
export * from './User';
export * from './Conversation';
export * from './Message';
export * from './Persona';
export * from './Summary';
export * from './AI';

// Common types used across models
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterOptions {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  isArchived?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  maxTokens: number;
  capabilities: string[];
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  conversationCount: number;
  period: TimePeriod;
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  date: string;
  cost: number;
  tokens: number;
  conversationCount: number;
}

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
