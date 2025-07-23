import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ValidationError } from '../utils/errors';

/**
 * Middleware to handle express-validator validation results
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : error.type,
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    const validationError = new ValidationError('Request validation failed');
    (validationError as any).details = errorMessages;
    
    return next(validationError);
  }

  next();
};

// Common validation rules
export const validateUUID = (field: string) => 
  param(field).isUUID().withMessage(`${field} must be a valid UUID`);

export const validatePaginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('SortBy must be a valid field name'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('SortOrder must be ASC or DESC'),
];

export const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

// User registration validation
export const validateUserRegistration = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
];

// User login validation
export const validateUserLogin = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Conversation validation
export const validateConversationCreation = [
  body('title')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Title must not exceed 255 characters')
    .trim(),
  body('intent')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Intent must not exceed 100 characters')
    .trim(),
  body('customInstructions')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Custom instructions must not exceed 5000 characters')
    .trim(),
  body('currentPersonaId')
    .optional()
    .isUUID()
    .withMessage('Persona ID must be a valid UUID'),
];

export const validateConversationUpdate = [
  body('title')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Title must not exceed 255 characters')
    .trim(),
  body('intent')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Intent must not exceed 100 characters')
    .trim(),
  body('customInstructions')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Custom instructions must not exceed 5000 characters')
    .trim(),
  body('currentPersonaId')
    .optional()
    .isUUID()
    .withMessage('Persona ID must be a valid UUID'),
  body('isArchived')
    .optional()
    .isBoolean()
    .withMessage('isArchived must be a boolean'),
];

// Message validation
export const validateMessageCreation = [
  body('role')
    .isIn(['user', 'assistant', 'system'])
    .withMessage('Role must be user, assistant, or system'),
  body('content')
    .isLength({ min: 1, max: 50000 })
    .withMessage('Content must be between 1 and 50000 characters')
    .trim(),
  body('personaId')
    .optional()
    .isUUID()
    .withMessage('Persona ID must be a valid UUID'),
  body('modelUsed')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Model name must not exceed 50 characters')
    .trim(),
  body('tokenCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Token count must be a non-negative integer'),
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost must be a non-negative number'),
];

// Persona validation
export const validatePersonaCreation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('systemPrompt')
    .isLength({ min: 10, max: 10000 })
    .withMessage('System prompt must be between 10 and 10000 characters')
    .trim(),
  body('personalityTraits')
    .optional()
    .isObject()
    .withMessage('Personality traits must be an object'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),
];

export const validatePersonaUpdate = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('systemPrompt')
    .optional()
    .isLength({ min: 10, max: 10000 })
    .withMessage('System prompt must be between 10 and 10000 characters')
    .trim(),
  body('personalityTraits')
    .optional()
    .isObject()
    .withMessage('Personality traits must be an object'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),
];

// AI model validation
export const validateAIGeneration = [
  body('prompt')
    .isLength({ min: 1, max: 50000 })
    .withMessage('Prompt must be between 1 and 50000 characters')
    .trim(),
  body('model')
    .isLength({ min: 1, max: 50 })
    .withMessage('Model must be specified and not exceed 50 characters')
    .trim(),
  body('maxTokens')
    .optional()
    .isInt({ min: 1, max: 4000 })
    .withMessage('Max tokens must be between 1 and 4000'),
  body('temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('Temperature must be between 0 and 2'),
];

export const validateCostCalculation = [
  body('model')
    .isLength({ min: 1, max: 50 })
    .withMessage('Model must be specified')
    .trim(),
  body('inputTokens')
    .isInt({ min: 0 })
    .withMessage('Input tokens must be a non-negative integer'),
  body('outputTokens')
    .isInt({ min: 0 })
    .withMessage('Output tokens must be a non-negative integer'),
];

// Search validation
export const validateSearchQuery = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Search query must be between 1 and 255 characters')
    .trim(),
  query('type')
    .optional()
    .isIn(['conversation', 'message', 'persona'])
    .withMessage('Search type must be conversation, message, or persona'),
];

// Cost tracking validation
export const validateCostReportQuery = [
  query('period')
    .isIn(['daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('Period must be daily, weekly, monthly, or yearly'),
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  query('conversationId')
    .optional()
    .isUUID()
    .withMessage('Conversation ID must be a valid UUID'),
];

// File upload validation (for future use)
export const validateFileUpload = [
  body('fileName')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('File name must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('File name contains invalid characters'),
  body('fileType')
    .optional()
    .isIn(['pdf', 'txt', 'doc', 'docx', 'md'])
    .withMessage('File type must be pdf, txt, doc, docx, or md'),
  body('fileSize')
    .optional()
    .isInt({ min: 1, max: 10485760 }) // 10MB max
    .withMessage('File size must be between 1 byte and 10MB'),
];

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    try {
      req.body = sanitizeObject(req.body);
    } catch (error) {
      // If sanitization fails, continue without sanitizing
      console.warn('Failed to sanitize request body:', error);
    }
  }

  // Skip query parameter sanitization as it's read-only
  // Query parameters should be validated by express-validator instead

  next();
};