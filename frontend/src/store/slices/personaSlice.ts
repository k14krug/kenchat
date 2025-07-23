import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { personaAPI } from '../../services/api';

export interface Persona {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  personalityTraits?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  usageCount: number;
}

export interface PersonaState {
  personas: Persona[];
  currentPersona: Persona | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PersonaState = {
  personas: [],
  currentPersona: null,
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchPersonas = createAsyncThunk(
  'persona/fetchPersonas',
  async () => {
    const response = await personaAPI.getPersonas();
    return response;
  }
);

export const createPersona = createAsyncThunk(
  'persona/createPersona',
  async (data: {
    name: string;
    description?: string;
    systemPrompt: string;
    personalityTraits?: Record<string, any>;
    isDefault?: boolean;
  }) => {
    const response = await personaAPI.createPersona(data);
    return response;
  }
);

export const updatePersona = createAsyncThunk(
  'persona/updatePersona',
  async ({ personaId, updates }: { 
    personaId: string; 
    updates: Partial<Persona> 
  }) => {
    const response = await personaAPI.updatePersona(personaId, updates);
    return response;
  }
);

export const deletePersona = createAsyncThunk(
  'persona/deletePersona',
  async (personaId: string) => {
    await personaAPI.deletePersona(personaId);
    return personaId;
  }
);

const personaSlice = createSlice({
  name: 'persona',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentPersona: (state, action) => {
      state.currentPersona = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch personas
      .addCase(fetchPersonas.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPersonas.fulfilled, (state, action) => {
        state.isLoading = false;
        state.personas = action.payload;
        // Set default persona if none selected
        if (!state.currentPersona && action.payload.length > 0) {
          state.currentPersona = action.payload.find(p => p.isDefault) || action.payload[0];
        }
      })
      .addCase(fetchPersonas.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch personas';
      })
      // Create persona
      .addCase(createPersona.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPersona.fulfilled, (state, action) => {
        state.isLoading = false;
        state.personas.push(action.payload);
      })
      .addCase(createPersona.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create persona';
      })
      // Update persona
      .addCase(updatePersona.fulfilled, (state, action) => {
        const index = state.personas.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.personas[index] = action.payload;
        }
        if (state.currentPersona?.id === action.payload.id) {
          state.currentPersona = action.payload;
        }
      })
      // Delete persona
      .addCase(deletePersona.fulfilled, (state, action) => {
        state.personas = state.personas.filter(p => p.id !== action.payload);
        if (state.currentPersona?.id === action.payload) {
          state.currentPersona = state.personas.find(p => p.isDefault) || state.personas[0] || null;
        }
      });
  },
});

export const { clearError, setCurrentPersona } = personaSlice.actions;
export default personaSlice.reducer;