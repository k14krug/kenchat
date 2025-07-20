import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from '../utils/errors';

/**
 * Middleware to handle express-validator validation results
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : error.type,
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    const validationError = new ValidationError('Validation failed');
    (validationError as any).details = errorMessages;
    
    return next(validationError);
  }

  next();
};