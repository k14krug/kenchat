export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication specific errors
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class TokenError extends AppError {
  constructor(message: string = 'Invalid or expired token') {
    super(message, 401, 'TOKEN_ERROR');
  }
}

// AI Service specific errors
export class AIServiceError extends AppError {
  constructor(message: string = 'AI service error') {
    super(message, 500, 'AI_SERVICE_ERROR');
  }
}

export class AIRateLimitError extends AppError {
  constructor(message: string = 'AI service rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'AI_RATE_LIMIT_ERROR');
    if (retryAfter) {
      (this as any).retryAfter = retryAfter;
    }
  }
}

export class AIInvalidModelError extends AppError {
  constructor(message: string = 'Invalid AI model specified') {
    super(message, 400, 'AI_INVALID_MODEL_ERROR');
  }
}

export class AIQuotaExceededError extends AppError {
  constructor(message: string = 'AI service quota exceeded') {
    super(message, 402, 'AI_QUOTA_EXCEEDED_ERROR');
  }
}

export class AINetworkError extends AppError {
  constructor(message: string = 'AI service network error') {
    super(message, 503, 'AI_NETWORK_ERROR');
  }
}

// Error response interface
export interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}
