export interface UsageLog {
  id: number;
  userId: number;
  conversationId?: number;
  actionType: 'message_sent' | 'message_received' | 'summary_created' | 'persona_used';
  model?: string;
  tokensUsed: number;
  costUsd: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CreateUsageLogRequest {
  userId: number;
  conversationId?: number;
  actionType: 'message_sent' | 'message_received' | 'summary_created' | 'persona_used';
  model?: string;
  tokensUsed: number;
  costUsd: number;
  metadata?: Record<string, any>;
}

export interface UsageLogRow {
  id: number;
  user_id: number;
  conversation_id?: number;
  action_type: string;
  model?: string;
  tokens_used: number;
  cost_usd: string;
  metadata?: string;
  created_at: Date;
}

export interface CostLimitStatus {
  isWithinLimit: boolean;
  currentCost: number;
  limit?: number;
  warningThreshold?: number;
  isWarning: boolean;
}

export interface UsageStats {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  averageCostPerRequest: number;
  averageTokensPerRequest: number;
  modelBreakdown: ModelUsageBreakdown[];
}

export interface ModelUsageBreakdown {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
  percentage: number;
}

export interface CostReport {
  period: {
    start: Date;
    end: Date;
    type: 'daily' | 'weekly' | 'monthly';
  };
  summary: UsageStats;
  dailyBreakdown: DailyCostBreakdown[];
  conversationBreakdown: ConversationCostBreakdown[];
}

export interface DailyCostBreakdown {
  date: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface ConversationCostBreakdown {
  conversationId: number;
  conversationTitle?: string;
  cost: number;
  tokens: number;
  requests: number;
  lastActivity: Date;
}