import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorResponse } from '../utils/errors';
import { logger } from '../config/logger';
import { environment } from '../config/environment';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Log the error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle known application errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  }
  // Handle validation errors from Joi or other sources
  else if (error.message.includes('Validation error:')) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  }
  // Handle database constraint errors
  else if (error.message.includes('Duplicate entry')) {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  }
  // Handle database connection errors
  else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    statusCode = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'Database service unavailable';
  }
  // Handle JSON parsing errors
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }
  // Handle other known error types
  else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  }

  // In development, include error details
  if (environment.nodeEnv === 'development') {
    details = {
      stack: error.stack,
      originalError: error.message,
    };
  }

  const errorResponse: ErrorResponse = {
    status: 'error',
    code,
    message,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    errorResponse.details = details;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const errorResponse: ErrorResponse = {
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(errorResponse);
};

/**
 * Async error wrapper to catch async errors in route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
