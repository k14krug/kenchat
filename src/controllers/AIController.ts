import { Request, Response, NextFunction } from 'express';
import { OpenAIService } from '../services/OpenAIService';
import { ChatMessage, AIOptions } from '../models/AI';
import { logger } from '../config/logger';
import { ValidationError } from '../utils/errors';
import Joi from 'joi';

export class AIController {
  private readonly openAIService: OpenAIService;

  constructor() {
    this.openAIService = new OpenAIService();
  }

  /**
   * Generate AI response
   */
  generateResponse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { messages, model, options } = this.validateGenerateRequest(req.body);

      const response = await this.openAIService.generateResponse(messages, model, options);

      res.status(200).json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get available models
   */
  getModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const models = this.openAIService.getAvailableModels();

      res.status(200).json({
        status: 'success',
        data: models,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get model information
   */
  getModelInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { modelId } = req.params;
      
      if (!modelId) {
        throw new ValidationError('Model ID is required');
      }

      const modelInfo = this.openAIService.getModelInfo(modelId);
      
      if (!modelInfo) {
        res.status(404).json({
          status: 'error',
          message: 'Model not found',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: modelInfo,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Calculate cost for token usage
   */
  calculateCost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { usage, model } = this.validateCostRequest(req.body);

      const cost = this.openAIService.calculateCost(usage, model);

      res.status(200).json({
        status: 'success',
        data: {
          cost,
          usage,
          model,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Test OpenAI connection
   */
  testConnection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isConnected = await this.openAIService.testConnection();

      res.status(200).json({
        status: 'success',
        data: {
          connected: isConnected,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Validate generate request
   */
  private validateGenerateRequest(body: any): {
    messages: ChatMessage[];
    model?: string;
    options?: AIOptions;
  } {
    const schema = Joi.object({
      messages: Joi.array()
        .items(
          Joi.object({
            role: Joi.string().valid('system', 'user', 'assistant').required(),
            content: Joi.string().required(),
          })
        )
        .min(1)
        .required(),
      model: Joi.string().optional(),
      options: Joi.object({
        temperature: Joi.number().min(0).max(2).optional(),
        maxTokens: Joi.number().min(1).optional(),
        topP: Joi.number().min(0).max(1).optional(),
        frequencyPenalty: Joi.number().min(-2).max(2).optional(),
        presencePenalty: Joi.number().min(-2).max(2).optional(),
        stop: Joi.array().items(Joi.string()).optional(),
        stream: Joi.boolean().optional(),
      }).optional(),
    });

    const { error, value } = schema.validate(body);
    if (error) {
      throw new ValidationError(`Invalid request: ${error.message}`);
    }

    return value;
  }

  /**
   * Validate cost calculation request
   */
  private validateCostRequest(body: any): {
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    model: string;
  } {
    const schema = Joi.object({
      usage: Joi.object({
        inputTokens: Joi.number().min(0).required(),
        outputTokens: Joi.number().min(0).required(),
        totalTokens: Joi.number().min(0).required(),
      }).required(),
      model: Joi.string().required(),
    });

    const { error, value } = schema.validate(body);
    if (error) {
      throw new ValidationError(`Invalid request: ${error.message}`);
    }

    return value;
  }
}