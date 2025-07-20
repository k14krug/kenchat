import { Request, Response, NextFunction } from 'express';
import { PersonaService } from '../services/PersonaService';
import {
  CreatePersonaRequest,
  UpdatePersonaRequest,
  PaginationOptions,
  FilterOptions,
} from '../models';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { validateAndSanitize, paginationSchema, filterSchema } from '../utils/validation';
import Joi from 'joi';

export class PersonaController {
  private readonly personaService: PersonaService;

  constructor() {
    this.personaService = new PersonaService();
  }

  /**
   * Create a new persona
   */
  createPersona = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const personaData = req.body;

      const persona = await this.personaService.createPersona(userId, personaData);

      res.status(201).json({
        status: 'success',
        data: persona,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all personas for the authenticated user
   */
  getUserPersonas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      
      // Validate pagination and filter parameters
      const paginationOptions = validateAndSanitize(paginationSchema, req.query);
      const filterOptions = validateAndSanitize(filterSchema, req.query);

      const result = await this.personaService.getUserPersonas(
        userId,
        paginationOptions,
        filterOptions
      );

      res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get persona summaries for dropdowns
   */
  getPersonaSummaries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const summaries = await this.personaService.getPersonaSummaries(userId);

      res.status(200).json({
        status: 'success',
        data: summaries,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get persona by ID
   */
  getPersonaById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { personaId } = req.params;

      if (!personaId) {
        throw new ValidationError('Persona ID is required');
      }

      const persona = await this.personaService.getPersonaById(personaId, userId);

      res.status(200).json({
        status: 'success',
        data: persona,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update persona
   */
  updatePersona = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { personaId } = req.params;
      const updateData = req.body;

      if (!personaId) {
        throw new ValidationError('Persona ID is required');
      }

      const persona = await this.personaService.updatePersona(personaId, userId, updateData);

      res.status(200).json({
        status: 'success',
        data: persona,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete persona
   */
  deletePersona = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { personaId } = req.params;

      if (!personaId) {
        throw new ValidationError('Persona ID is required');
      }

      await this.personaService.deletePersona(personaId, userId);

      res.status(200).json({
        status: 'success',
        message: 'Persona deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get default persona for user
   */
  getDefaultPersona = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const defaultPersona = await this.personaService.getDefaultPersona(userId);

      if (!defaultPersona) {
        res.status(404).json({
          status: 'error',
          message: 'No default persona found',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: defaultPersona,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Set persona as default
   */
  setDefaultPersona = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { personaId } = req.params;

      if (!personaId) {
        throw new ValidationError('Persona ID is required');
      }

      const persona = await this.personaService.setDefaultPersona(personaId, userId);

      res.status(200).json({
        status: 'success',
        data: persona,
        message: 'Default persona updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Duplicate persona
   */
  duplicatePersona = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { personaId } = req.params;
      const { name } = req.body;

      if (!personaId) {
        throw new ValidationError('Persona ID is required');
      }

      const duplicatedPersona = await this.personaService.duplicatePersona(
        personaId,
        userId,
        name
      );

      res.status(201).json({
        status: 'success',
        data: duplicatedPersona,
        message: 'Persona duplicated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get persona usage statistics
   */
  getPersonaUsageStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const stats = await this.personaService.getPersonaUsageStats(userId);

      res.status(200).json({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Validate system prompt
   */
  validateSystemPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { systemPrompt } = req.body;

      if (!systemPrompt) {
        throw new ValidationError('System prompt is required');
      }

      const validation = this.personaService.validateSystemPrompt(systemPrompt);

      res.status(200).json({
        status: 'success',
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create default personas for new user
   */
  createDefaultPersonas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const personas = await this.personaService.createDefaultPersonas(userId);

      res.status(201).json({
        status: 'success',
        data: personas,
        message: 'Default personas created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Increment persona usage count (internal endpoint)
   */
  incrementUsageCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { personaId } = req.params;

      if (!personaId) {
        throw new ValidationError('Persona ID is required');
      }

      await this.personaService.incrementUsageCount(personaId, userId);

      res.status(200).json({
        status: 'success',
        message: 'Usage count incremented',
      });
    } catch (error) {
      next(error);
    }
  };
}