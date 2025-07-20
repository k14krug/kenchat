export interface Persona {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  personalityTraits?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
  usageCount: number;
}

export interface CreatePersonaRequest {
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  personalityTraits?: Record<string, any>;
  isDefault?: boolean;
}

export interface UpdatePersonaRequest {
  name?: string;
  description?: string;
  systemPrompt?: string;
  personalityTraits?: Record<string, any>;
  isDefault?: boolean;
}

export interface PersonaResponse {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  personalityTraits?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
  usageCount: number;
}

export interface PersonaSummary {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  usageCount: number;
}
