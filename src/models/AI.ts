export interface AIModel {
  id: string;
  name: string;
  description: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  maxTokens: number;
  capabilities: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  cost: number;
  finishReason: string;
  id: string;
  created: number;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: ChatMessage[];
  model: string;
  options?: AIOptions;
}

// OpenAI model pricing (as of 2024 - should be updated regularly)
export const MODEL_PRICING: Record<string, { input: number; output: number; maxTokens: number }> = {
  'gpt-4o': {
    input: 0.005, // $5.00 per 1M tokens
    output: 0.015, // $15.00 per 1M tokens
    maxTokens: 128000,
  },
  'gpt-4o-mini': {
    input: 0.00015, // $0.15 per 1M tokens
    output: 0.0006, // $0.60 per 1M tokens
    maxTokens: 128000,
  },
  'gpt-4-turbo': {
    input: 0.01, // $10.00 per 1M tokens
    output: 0.03, // $30.00 per 1M tokens
    maxTokens: 128000,
  },
  'gpt-4': {
    input: 0.03, // $30.00 per 1M tokens
    output: 0.06, // $60.00 per 1M tokens
    maxTokens: 8192,
  },
  'gpt-3.5-turbo': {
    input: 0.0005, // $0.50 per 1M tokens
    output: 0.0015, // $1.50 per 1M tokens
    maxTokens: 16385,
  },
};

export const SUPPORTED_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most advanced multimodal model with high intelligence and efficiency',
    inputCostPer1kTokens: MODEL_PRICING['gpt-4o'].input,
    outputCostPer1kTokens: MODEL_PRICING['gpt-4o'].output,
    maxTokens: MODEL_PRICING['gpt-4o'].maxTokens,
    capabilities: ['text', 'vision', 'function-calling', 'json-mode'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Affordable and intelligent small model for fast, lightweight tasks',
    inputCostPer1kTokens: MODEL_PRICING['gpt-4o-mini'].input,
    outputCostPer1kTokens: MODEL_PRICING['gpt-4o-mini'].output,
    maxTokens: MODEL_PRICING['gpt-4o-mini'].maxTokens,
    capabilities: ['text', 'vision', 'function-calling', 'json-mode'],
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'Previous generation flagship model with vision capabilities',
    inputCostPer1kTokens: MODEL_PRICING['gpt-4-turbo'].input,
    outputCostPer1kTokens: MODEL_PRICING['gpt-4-turbo'].output,
    maxTokens: MODEL_PRICING['gpt-4-turbo'].maxTokens,
    capabilities: ['text', 'vision', 'function-calling', 'json-mode'],
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'High-intelligence flagship model for complex, multi-step tasks',
    inputCostPer1kTokens: MODEL_PRICING['gpt-4'].input,
    outputCostPer1kTokens: MODEL_PRICING['gpt-4'].output,
    maxTokens: MODEL_PRICING['gpt-4'].maxTokens,
    capabilities: ['text', 'function-calling'],
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast, inexpensive model for simple tasks',
    inputCostPer1kTokens: MODEL_PRICING['gpt-3.5-turbo'].input,
    outputCostPer1kTokens: MODEL_PRICING['gpt-3.5-turbo'].output,
    maxTokens: MODEL_PRICING['gpt-3.5-turbo'].maxTokens,
    capabilities: ['text', 'function-calling'],
  },
];