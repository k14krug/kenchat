import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to add API documentation headers and metadata
 */
export const addApiDocumentation = (req: Request, res: Response, next: NextFunction): void => {
  // Add API version header
  res.setHeader('X-API-Version', '1.0.0');
  
  // Add rate limit headers if available
  if ((req as any).rateLimit) {
    res.setHeader('X-RateLimit-Limit', (req as any).rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', (req as any).rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', (req as any).rateLimit.reset);
  }
  
  // Add request ID for tracing
  const requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Generate a unique request ID
 */
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * API documentation endpoint
 */
export const getApiDocumentation = (req: Request, res: Response): void => {
  const documentation = {
    name: 'Personal Chatbot API',
    version: '1.0.0',
    description: 'REST API for personal chatbot with AI personas and conversation management',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      authentication: {
        'POST /auth/register': {
          description: 'Register a new user',
          access: 'Public',
          rateLimit: '10 requests per 15 minutes',
          body: {
            username: 'string (3-30 chars, alphanumeric)',
            email: 'string (valid email)',
            password: 'string (8+ chars, mixed case, numbers, special chars)'
          }
        },
        'POST /auth/login': {
          description: 'Login user',
          access: 'Public',
          rateLimit: '10 requests per 15 minutes',
          body: {
            username: 'string',
            password: 'string'
          }
        },
        'POST /auth/logout': {
          description: 'Logout user',
          access: 'Private',
          headers: {
            Authorization: 'Bearer <token>'
          }
        },
        'GET /auth/profile': {
          description: 'Get current user profile',
          access: 'Private',
          headers: {
            Authorization: 'Bearer <token>'
          }
        }
      },
      conversations: {
        'POST /conversations': {
          description: 'Create a new conversation',
          access: 'Private',
          body: {
            title: 'string (optional, max 255 chars)',
            intent: 'string (optional, max 100 chars)',
            customInstructions: 'string (optional, max 5000 chars)',
            currentPersonaId: 'UUID (optional)'
          }
        },
        'GET /conversations': {
          description: 'Get user conversations with pagination',
          access: 'Private',
          query: {
            page: 'number (optional, default 1)',
            limit: 'number (optional, 1-100, default 20)',
            sortBy: 'string (optional)',
            sortOrder: 'ASC|DESC (optional, default DESC)'
          }
        },
        'GET /conversations/:id': {
          description: 'Get specific conversation',
          access: 'Private',
          params: {
            id: 'UUID'
          }
        },
        'PUT /conversations/:id': {
          description: 'Update conversation',
          access: 'Private',
          params: {
            id: 'UUID'
          },
          body: {
            title: 'string (optional)',
            intent: 'string (optional)',
            customInstructions: 'string (optional)',
            isArchived: 'boolean (optional)'
          }
        },
        'DELETE /conversations/:id': {
          description: 'Delete conversation',
          access: 'Private',
          params: {
            id: 'UUID'
          }
        }
      },
      messages: {
        'POST /conversations/:id/messages': {
          description: 'Add message to conversation',
          access: 'Private',
          params: {
            id: 'UUID (conversation ID)'
          },
          body: {
            role: 'user|assistant|system',
            content: 'string (1-50000 chars)',
            personaId: 'UUID (optional)',
            modelUsed: 'string (optional)',
            tokenCount: 'number (optional)',
            cost: 'number (optional)'
          }
        },
        'GET /conversations/:id/messages': {
          description: 'Get conversation messages',
          access: 'Private',
          params: {
            id: 'UUID (conversation ID)'
          },
          query: {
            page: 'number (optional)',
            limit: 'number (optional)'
          }
        }
      },
      personas: {
        'POST /personas': {
          description: 'Create a new persona',
          access: 'Private',
          body: {
            name: 'string (1-100 chars)',
            description: 'string (optional, max 1000 chars)',
            systemPrompt: 'string (10-10000 chars)',
            personalityTraits: 'object (optional)',
            isDefault: 'boolean (optional)'
          }
        },
        'GET /personas': {
          description: 'Get user personas',
          access: 'Private',
          query: {
            page: 'number (optional)',
            limit: 'number (optional)'
          }
        },
        'GET /personas/:personaId': {
          description: 'Get specific persona',
          access: 'Private',
          params: {
            personaId: 'UUID'
          }
        },
        'PUT /personas/:personaId': {
          description: 'Update persona',
          access: 'Private',
          params: {
            personaId: 'UUID'
          },
          body: {
            name: 'string (optional)',
            description: 'string (optional)',
            systemPrompt: 'string (optional)',
            personalityTraits: 'object (optional)'
          }
        },
        'DELETE /personas/:personaId': {
          description: 'Delete persona',
          access: 'Private',
          params: {
            personaId: 'UUID'
          }
        }
      },
      ai: {
        'POST /ai/generate': {
          description: 'Generate AI response',
          access: 'Private',
          body: {
            prompt: 'string (1-50000 chars)',
            model: 'string (1-50 chars)',
            maxTokens: 'number (optional, 1-4000)',
            temperature: 'number (optional, 0-2)'
          }
        },
        'GET /ai/models': {
          description: 'Get available AI models',
          access: 'Private'
        },
        'POST /ai/cost': {
          description: 'Calculate cost for token usage',
          access: 'Private',
          body: {
            model: 'string',
            inputTokens: 'number (non-negative)',
            outputTokens: 'number (non-negative)'
          }
        }
      },
      costTracking: {
        'GET /cost-tracking/stats': {
          description: 'Get user usage statistics',
          access: 'Private',
          query: {
            startDate: 'ISO 8601 date (optional)',
            endDate: 'ISO 8601 date (optional)'
          }
        },
        'GET /cost-tracking/report': {
          description: 'Generate cost report',
          access: 'Private',
          query: {
            period: 'daily|weekly|monthly|yearly',
            date: 'ISO 8601 date (optional)',
            conversationId: 'UUID (optional)'
          }
        },
        'GET /cost-tracking/limits': {
          description: 'Check cost limits',
          access: 'Private'
        }
      }
    },
    errorCodes: {
      400: 'Bad Request - Invalid input or validation error',
      401: 'Unauthorized - Authentication required or invalid token',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Resource not found',
      409: 'Conflict - Resource already exists',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Server error occurred',
      503: 'Service Unavailable - External service unavailable'
    },
    responseFormat: {
      success: {
        status: 'success',
        message: 'string',
        data: 'object|array',
        timestamp: 'ISO 8601 date',
        pagination: 'object (for paginated responses)'
      },
      error: {
        status: 'error',
        code: 'string',
        message: 'string',
        timestamp: 'ISO 8601 date',
        details: 'object (optional, development only)'
      }
    },
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer <token>',
      tokenExpiry: '1 hour',
      refreshToken: 'Available for token refresh'
    },
    rateLimiting: {
      authEndpoints: '10 requests per 15 minutes',
      generalEndpoints: '100 requests per 15 minutes',
      headers: {
        'X-RateLimit-Limit': 'Request limit',
        'X-RateLimit-Remaining': 'Remaining requests',
        'X-RateLimit-Reset': 'Reset timestamp'
      }
    }
  };

  res.status(200).json(documentation);
};