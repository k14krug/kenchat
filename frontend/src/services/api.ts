import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { User } from '../store/slices/authSlice';
import { Conversation, Message } from '../store/slices/conversationSlice';
import { Persona } from '../store/slices/personaSlice';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API response interfaces
interface AuthResponse {
  user: User;
  token: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

// Auth API
export const authAPI = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      username,
      password,
    });
    return response.data.data;
  },

  register: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', {
      username,
      password,
    });
    return response.data.data;
  },

  validateToken: async (token: string): Promise<{ user: User }> => {
    const response = await api.get<ApiResponse<{ user: User }>>('/auth/validate', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

// Conversation API
export const conversationAPI = {
  getConversations: async (): Promise<Conversation[]> => {
    const response = await api.get<ApiResponse<Conversation[]>>('/conversations');
    return response.data.data;
  },

  getConversation: async (conversationId: string): Promise<Conversation> => {
    const response = await api.get<ApiResponse<Conversation>>(`/conversations/${conversationId}`);
    return response.data.data;
  },

  createConversation: async (data: {
    title?: string;
    intent?: string;
    customInstructions?: string;
  }): Promise<Conversation> => {
    const response = await api.post<ApiResponse<Conversation>>('/conversations', data);
    return response.data.data;
  },

  updateConversation: async (
    conversationId: string,
    updates: Partial<Conversation>
  ): Promise<Conversation> => {
    const response = await api.put<ApiResponse<Conversation>>(
      `/conversations/${conversationId}`,
      updates
    );
    return response.data.data;
  },

  deleteConversation: async (conversationId: string): Promise<void> => {
    await api.delete(`/conversations/${conversationId}`);
  },

  sendMessage: async (
    conversationId: string,
    content: string,
    personaId?: string
  ): Promise<Message[]> => {
    const response = await api.post<ApiResponse<Message[]>>(
      `/conversations/${conversationId}/messages`,
      {
        content,
        personaId,
      }
    );
    return response.data.data;
  },
};

// Persona API
export const personaAPI = {
  getPersonas: async (): Promise<Persona[]> => {
    const response = await api.get<ApiResponse<Persona[]>>('/personas');
    return response.data.data;
  },

  createPersona: async (data: {
    name: string;
    description?: string;
    systemPrompt: string;
    personalityTraits?: Record<string, any>;
    isDefault?: boolean;
  }): Promise<Persona> => {
    const response = await api.post<ApiResponse<Persona>>('/personas', data);
    return response.data.data;
  },

  updatePersona: async (personaId: string, updates: Partial<Persona>): Promise<Persona> => {
    const response = await api.put<ApiResponse<Persona>>(`/personas/${personaId}`, updates);
    return response.data.data;
  },

  deletePersona: async (personaId: string): Promise<void> => {
    await api.delete(`/personas/${personaId}`);
  },
};

// Chat API (Enhanced AI generation with context)
export const chatAPI = {
  generateResponse: async (data: {
    conversationId: string;
    content: string;
    personaId?: string;
    model?: string;
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      stop?: string[];
    };
  }): Promise<{
    userMessage: Message;
    assistantMessage: Message;
    aiResponse: {
      model: string;
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
      cost: number;
      finishReason: string;
    };
  }> => {
    const response = await api.post<ApiResponse<any>>('/chat/generate', data);
    return response.data.data;
  },

  generateStreamingResponse: (data: {
    conversationId: string;
    content: string;
    personaId?: string;
    model?: string;
    options?: any;
  }): EventSource => {
    const token = localStorage.getItem('token');
    const url = new URL('/api/chat/generate/stream', api.defaults.baseURL);
    
    const eventSource = new EventSource(url.toString());
    
    // Send the request data via POST (this is a simplified approach)
    // In a real implementation, you'd need to handle this differently
    // as EventSource doesn't support POST data directly
    fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    return eventSource;
  },

  getModels: async (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    maxTokens: number;
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
    capabilities: string[];
  }>> => {
    const response = await api.get<ApiResponse<any>>('/chat/models');
    return response.data.data;
  },

  getModelInfo: async (modelId: string): Promise<{
    id: string;
    name: string;
    description: string;
    maxTokens: number;
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
    capabilities: string[];
  }> => {
    const response = await api.get<ApiResponse<any>>(`/chat/models/${modelId}`);
    return response.data.data;
  },
};

// Cost tracking API
export const costAPI = {
  getUserCosts: async (period: 'day' | 'week' | 'month'): Promise<any> => {
    const response = await api.get<ApiResponse<any>>(`/costs?period=${period}`);
    return response.data.data;
  },

  getConversationCost: async (conversationId: string): Promise<number> => {
    const response = await api.get<ApiResponse<{ cost: number }>>(
      `/conversations/${conversationId}/cost`
    );
    return response.data.data.cost;
  },
};

export default api;