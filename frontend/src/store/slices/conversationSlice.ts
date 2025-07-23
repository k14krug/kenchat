import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { conversationAPI, chatAPI } from '../../services/api';

export interface Message {
  id: string;
  conversationId: string;
  personaId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string;
  tokenCount?: number;
  cost?: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  intent?: string;
  customInstructions?: string;
  currentPersonaId?: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  totalCost: number;
  messages?: Message[];
}

export interface ConversationState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;
}

const initialState: ConversationState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  isSending: false,
  error: null,
};

// Async thunks
export const fetchConversations = createAsyncThunk(
  'conversation/fetchConversations',
  async () => {
    const response = await conversationAPI.getConversations();
    return response;
  }
);

export const fetchConversation = createAsyncThunk(
  'conversation/fetchConversation',
  async (conversationId: string) => {
    const response = await conversationAPI.getConversation(conversationId);
    return response;
  }
);

export const createConversation = createAsyncThunk(
  'conversation/createConversation',
  async (data: { title?: string; intent?: string; customInstructions?: string }) => {
    const response = await conversationAPI.createConversation(data);
    return response;
  }
);

export const sendMessage = createAsyncThunk(
  'conversation/sendMessage',
  async ({ conversationId, content, personaId }: { 
    conversationId: string; 
    content: string; 
    personaId?: string; 
  }) => {
    const response = await conversationAPI.sendMessage(conversationId, content, personaId);
    return response;
  }
);

export const sendChatMessage = createAsyncThunk(
  'conversation/sendChatMessage',
  async ({ conversationId, content, personaId, model, options }: {
    conversationId: string;
    content: string;
    personaId?: string;
    model?: string;
    options?: any;
  }) => {
    const response = await chatAPI.generateResponse({
      conversationId,
      content,
      personaId,
      model,
      options,
    });
    return response;
  }
);

export const updateConversation = createAsyncThunk(
  'conversation/updateConversation',
  async ({ conversationId, updates }: { 
    conversationId: string; 
    updates: Partial<Conversation> 
  }) => {
    const response = await conversationAPI.updateConversation(conversationId, updates);
    return response;
  }
);

export const deleteConversation = createAsyncThunk(
  'conversation/deleteConversation',
  async (conversationId: string) => {
    await conversationAPI.deleteConversation(conversationId);
    return conversationId;
  }
);

const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentConversation: (state, action: PayloadAction<Conversation | null>) => {
      state.currentConversation = action.payload;
      state.messages = action.payload?.messages || [];
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {
      state.messages = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
      })
      // Fetch conversation
      .addCase(fetchConversation.pending, (state) => {
        state.isLoadingMessages = true;
        state.error = null;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.isLoadingMessages = false;
        state.currentConversation = action.payload;
        state.messages = action.payload.messages || [];
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.isLoadingMessages = false;
        state.error = action.error.message || 'Failed to fetch conversation';
      })
      // Create conversation
      .addCase(createConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations.unshift(action.payload);
        state.currentConversation = action.payload;
        state.messages = [];
      })
      .addCase(createConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create conversation';
      })
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isSending = false;
        // Add both user message and AI response
        if (Array.isArray(action.payload)) {
          state.messages.push(...action.payload);
        } else {
          state.messages.push(action.payload);
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.error.message || 'Failed to send message';
      })
      // Send chat message (enhanced with AI context)
      .addCase(sendChatMessage.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.isSending = false;
        // Add both user message and AI response
        state.messages.push(action.payload.userMessage);
        state.messages.push(action.payload.assistantMessage);
        
        // Update conversation cost if available
        if (state.currentConversation && action.payload.aiResponse.cost) {
          state.currentConversation.totalCost += action.payload.aiResponse.cost;
        }
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.error.message || 'Failed to send chat message';
      })
      // Update conversation
      .addCase(updateConversation.fulfilled, (state, action) => {
        const index = state.conversations.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.conversations[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      // Delete conversation
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.conversations = state.conversations.filter(c => c.id !== action.payload);
        if (state.currentConversation?.id === action.payload) {
          state.currentConversation = null;
          state.messages = [];
        }
      });
  },
});

export const { clearError, setCurrentConversation, addMessage, clearMessages } = conversationSlice.actions;
export default conversationSlice.reducer;