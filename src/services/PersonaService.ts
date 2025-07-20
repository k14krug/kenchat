import { PersonaRepository } from '../repositories/PersonaRepository';
import {
  Persona,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  PersonaResponse,
  PersonaSummary,
  PaginationOptions,
  FilterOptions,
} from '../models';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../utils/errors';
import { logger } from '../config/logger';
import { validateAndSanitize, createPersonaSchema, updatePersonaSchema } from '../utils/validation';

export class PersonaService {
  private readonly personaRepository: PersonaRepository;

  constructor() {
    this.personaRepository = new PersonaRepository();
  }

  /**
   * Create a new persona for a user
   */
  async createPersona(
    userId: string,
    personaData: Omit<CreatePersonaRequest, 'userId'>
  ): Promise<PersonaResponse> {
    try {
      // Validate input data
      const validatedData = validateAndSanitize(createPersonaSchema, personaData);

      // Check if persona name already exists for this user
      const existingPersonas = await this.personaRepository.findByUserId(userId, { limit: 1000 });
      const nameExists = existingPersonas.data.some(
        persona => persona.name.toLowerCase() === validatedData.name.toLowerCase()
      );

      if (nameExists) {
        throw new ConflictError('A persona with this name already exists');
      }

      // If this is the user's first persona, make it default
      const isFirstPersona = existingPersonas.data.length === 0;
      const createRequest: CreatePersonaRequest = {
        ...validatedData,
        userId,
        isDefault: validatedData.isDefault || isFirstPersona,
      };

      const persona = await this.personaRepository.create(createRequest);

      logger.info(`Persona created successfully for user ${userId}: ${persona.name}`);
      return this.personaRepository.toPersonaResponse(persona);
    } catch (error) {
      logger.error('Error creating persona:', error);
      throw error;
    }
  }

  /**
   * Update an existing persona
   */
  async updatePersona(
    personaId: string,
    userId: string,
    personaData: UpdatePersonaRequest
  ): Promise<PersonaResponse> {
    try {
      // Validate input data
      const validatedData = validateAndSanitize(updatePersonaSchema, personaData);

      // Verify ownership
      const belongsToUser = await this.personaRepository.belongsToUser(personaId, userId);
      if (!belongsToUser) {
        throw new NotFoundError('Persona not found');
      }

      // Check for name conflicts if name is being updated
      if (validatedData.name) {
        const existingPersonas = await this.personaRepository.findByUserId(userId, { limit: 1000 });
        const nameExists = existingPersonas.data.some(
          persona =>
            persona.id !== personaId &&
            persona.name.toLowerCase() === validatedData.name!.toLowerCase()
        );

        if (nameExists) {
          throw new ConflictError('A persona with this name already exists');
        }
      }

      const updatedPersona = await this.personaRepository.update(personaId, validatedData);

      logger.info(`Persona updated successfully: ${personaId}`);
      return this.personaRepository.toPersonaResponse(updatedPersona);
    } catch (error) {
      logger.error('Error updating persona:', error);
      throw error;
    }
  }

  /**
   * Get persona by ID (with ownership check)
   */
  async getPersonaById(personaId: string, userId: string): Promise<PersonaResponse> {
    try {
      const persona = await this.personaRepository.findById(personaId);
      if (!persona) {
        throw new NotFoundError('Persona not found');
      }

      // Check ownership
      if (persona.userId !== userId) {
        throw new NotFoundError('Persona not found');
      }

      return this.personaRepository.toPersonaResponse(persona);
    } catch (error) {
      logger.error('Error getting persona by ID:', error);
      throw error;
    }
  }

  /**
   * Get all personas for a user with pagination and filtering
   */
  async getUserPersonas(
    userId: string,
    options: PaginationOptions = {},
    filters: FilterOptions = {}
  ) {
    try {
      const result = await this.personaRepository.findByUserId(userId, options, filters);

      return {
        ...result,
        data: result.data.map(persona => this.personaRepository.toPersonaResponse(persona)),
      };
    } catch (error) {
      logger.error('Error getting user personas:', error);
      throw error;
    }
  }

  /**
   * Get persona summaries for dropdowns/selection
   */
  async getPersonaSummaries(userId: string): Promise<PersonaSummary[]> {
    try {
      return await this.personaRepository.getPersonaSummaries(userId);
    } catch (error) {
      logger.error('Error getting persona summaries:', error);
      throw error;
    }
  }

  /**
   * Get default persona for user
   */
  async getDefaultPersona(userId: string): Promise<PersonaResponse | null> {
    try {
      const defaultPersona = await this.personaRepository.findDefaultByUserId(userId);
      if (!defaultPersona) {
        return null;
      }

      return this.personaRepository.toPersonaResponse(defaultPersona);
    } catch (error) {
      logger.error('Error getting default persona:', error);
      throw error;
    }
  }

  /**
   * Set a persona as default for user
   */
  async setDefaultPersona(personaId: string, userId: string): Promise<PersonaResponse> {
    try {
      // Verify ownership
      const belongsToUser = await this.personaRepository.belongsToUser(personaId, userId);
      if (!belongsToUser) {
        throw new NotFoundError('Persona not found');
      }

      const updatedPersona = await this.personaRepository.update(personaId, { isDefault: true });

      logger.info(`Default persona set for user ${userId}: ${personaId}`);
      return this.personaRepository.toPersonaResponse(updatedPersona);
    } catch (error) {
      logger.error('Error setting default persona:', error);
      throw error;
    }
  }

  /**
   * Delete a persona
   */
  async deletePersona(personaId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const persona = await this.personaRepository.findById(personaId);
      if (!persona) {
        throw new NotFoundError('Persona not found');
      }

      if (persona.userId !== userId) {
        throw new NotFoundError('Persona not found');
      }

      // Check if this is the only persona for the user
      const userPersonas = await this.personaRepository.findByUserId(userId, { limit: 2 });
      if (userPersonas.data.length === 1) {
        throw new ValidationError('Cannot delete the last persona. Users must have at least one persona.');
      }

      await this.personaRepository.deleteWithReferences(personaId, userId);

      logger.info(`Persona deleted successfully: ${personaId}`);
    } catch (error) {
      logger.error('Error deleting persona:', error);
      throw error;
    }
  }

  /**
   * Increment usage count for a persona
   */
  async incrementUsageCount(personaId: string, userId: string): Promise<void> {
    try {
      // Verify ownership (optional check for performance)
      const belongsToUser = await this.personaRepository.belongsToUser(personaId, userId);
      if (!belongsToUser) {
        logger.warn(`Attempted to increment usage for non-owned persona: ${personaId} by user ${userId}`);
        return;
      }

      await this.personaRepository.incrementUsageCount(personaId);
    } catch (error) {
      logger.error('Error incrementing persona usage count:', error);
      // Don't throw error for this non-critical operation
    }
  }

  /**
   * Get persona usage statistics for a user
   */
  async getPersonaUsageStats(userId: string): Promise<{
    totalPersonas: number;
    defaultPersona: PersonaSummary | null;
    mostUsedPersona: PersonaSummary | null;
    totalUsage: number;
  }> {
    try {
      const personas = await this.personaRepository.getPersonaSummaries(userId);
      
      const totalPersonas = personas.length;
      const defaultPersona = personas.find(p => p.isDefault) || null;
      const mostUsedPersona = personas.reduce((prev, current) => 
        (prev.usageCount > current.usageCount) ? prev : current
      );
      const totalUsage = personas.reduce((sum, persona) => sum + persona.usageCount, 0);

      return {
        totalPersonas,
        defaultPersona,
        mostUsedPersona: totalUsage > 0 ? mostUsedPersona : null,
        totalUsage,
      };
    } catch (error) {
      logger.error('Error getting persona usage stats:', error);
      throw error;
    }
  }

  /**
   * Create default system personas for new users
   */
  async createDefaultPersonas(userId: string): Promise<PersonaResponse[]> {
    try {
      const defaultPersonas = [
        {
          name: 'Assistant',
          description: 'A helpful and knowledgeable AI assistant',
          systemPrompt: 'You are a helpful, knowledgeable, and friendly AI assistant. Provide clear, accurate, and helpful responses to user questions and requests.',
          isDefault: true,
        },
        {
          name: 'Creative Writer',
          description: 'A creative writing companion for stories and content',
          systemPrompt: 'You are a creative writing assistant. Help users with storytelling, creative writing, brainstorming ideas, and developing engaging content. Be imaginative and inspiring.',
        },
        {
          name: 'Code Reviewer',
          description: 'A technical assistant focused on programming and code review',
          systemPrompt: 'You are a senior software engineer and code reviewer. Help users with programming questions, code review, debugging, and best practices. Be technical, precise, and constructive.',
        },
      ];

      const createdPersonas: PersonaResponse[] = [];

      for (const personaData of defaultPersonas) {
        try {
          const persona = await this.createPersona(userId, personaData);
          createdPersonas.push(persona);
        } catch (error) {
          logger.warn(`Failed to create default persona "${personaData.name}" for user ${userId}:`, error);
        }
      }

      logger.info(`Created ${createdPersonas.length} default personas for user ${userId}`);
      return createdPersonas;
    } catch (error) {
      logger.error('Error creating default personas:', error);
      throw error;
    }
  }

  /**
   * Validate persona system prompt
   */
  validateSystemPrompt(systemPrompt: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!systemPrompt || systemPrompt.trim().length === 0) {
      errors.push('System prompt is required');
    }

    if (systemPrompt.length < 10) {
      errors.push('System prompt must be at least 10 characters long');
    }

    if (systemPrompt.length > 4000) {
      errors.push('System prompt must not exceed 4000 characters');
    }

    // Check for potentially harmful instructions
    const harmfulPatterns = [
      /ignore.*(previous|above|system).*(instruction|prompt)/i,
      /forget.*(previous|above|system).*(instruction|prompt)/i,
      /act as if you are/i,
      /pretend to be/i,
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(systemPrompt)) {
        errors.push('System prompt contains potentially harmful instructions');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Duplicate a persona
   */
  async duplicatePersona(
    personaId: string,
    userId: string,
    newName?: string
  ): Promise<PersonaResponse> {
    try {
      const originalPersona = await this.getPersonaById(personaId, userId);
      
      const duplicateName = newName || `${originalPersona.name} (Copy)`;
      
      const duplicateData = {
        name: duplicateName,
        description: originalPersona.description,
        systemPrompt: originalPersona.systemPrompt,
        personalityTraits: originalPersona.personalityTraits,
        isDefault: false, // Duplicates are never default
      };

      return await this.createPersona(userId, duplicateData);
    } catch (error) {
      logger.error('Error duplicating persona:', error);
      throw error;
    }
  }
}