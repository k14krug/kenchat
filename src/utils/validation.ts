import Joi from 'joi';

// Password validation schema with strength requirements
export const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'string.pattern.base':
      'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)',
    'any.required': 'Password is required',
  });

// Username validation schema
export const usernameSchema = Joi.string().alphanum().min(3).max(30).required().messages({
  'string.alphanum': 'Username must contain only alphanumeric characters',
  'string.min': 'Username must be at least 3 characters long',
  'string.max': 'Username must not exceed 30 characters',
  'any.required': 'Username is required',
});

// Email validation schema
export const emailSchema = Joi.string().email().max(255).required().messages({
  'string.email': 'Please provide a valid email address',
  'string.max': 'Email must not exceed 255 characters',
  'any.required': 'Email is required',
});

// User registration validation schema
export const registerSchema = Joi.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  first_name: Joi.string().max(255).optional().allow(''),
  last_name: Joi.string().max(255).optional().allow(''),
});

// User login validation schema
export const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    'any.required': 'Username is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// Refresh token validation schema
export const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

// UUID validation schema
export const uuidSchema = Joi.string().uuid().required().messages({
  'string.guid': 'Must be a valid UUID',
  'any.required': 'ID is required',
});

// Optional UUID validation schema
export const optionalUuidSchema = Joi.string().uuid().optional().allow(null).messages({
  'string.guid': 'Must be a valid UUID',
});

// Conversation validation schemas
export const createConversationSchema = Joi.object({
  userId: uuidSchema,
  title: Joi.string().max(255).optional().allow(''),
  intent: Joi.string().max(100).optional().allow(''),
  customInstructions: Joi.string().max(5000).optional().allow(''),
  currentPersonaId: optionalUuidSchema,
});

export const updateConversationSchema = Joi.object({
  title: Joi.string().max(255).optional().allow(''),
  intent: Joi.string().max(100).optional().allow(''),
  customInstructions: Joi.string().max(5000).optional().allow(''),
  currentPersonaId: optionalUuidSchema,
  isArchived: Joi.boolean().optional(),
});

// Message validation schemas
export const createMessageSchema = Joi.object({
  conversationId: uuidSchema,
  personaId: optionalUuidSchema,
  role: Joi.string().valid('user', 'assistant', 'system').required(),
  content: Joi.string().min(1).max(50000).required(),
  modelUsed: Joi.string().max(50).optional(),
  tokenCount: Joi.number().integer().min(0).optional(),
  cost: Joi.number().precision(4).min(0).optional(),
  metadata: Joi.object().optional(),
});

export const updateMessageSchema = Joi.object({
  content: Joi.string().min(1).max(50000).optional(),
  isSummarized: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
});

// Persona validation schemas
export const createPersonaSchema = Joi.object({
  userId: uuidSchema,
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(1000).optional().allow(''),
  systemPrompt: Joi.string().min(1).max(10000).required(),
  personalityTraits: Joi.object().optional(),
  isDefault: Joi.boolean().optional().default(false),
});

export const updatePersonaSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(1000).optional().allow(''),
  systemPrompt: Joi.string().min(1).max(10000).optional(),
  personalityTraits: Joi.object().optional(),
  isDefault: Joi.boolean().optional(),
});

// Summary validation schemas
export const createSummarySchema = Joi.object({
  conversationId: uuidSchema,
  content: Joi.string().min(1).max(20000).required(),
  messageRangeStart: optionalUuidSchema,
  messageRangeEnd: optionalUuidSchema,
  tokenCount: Joi.number().integer().min(0).optional(),
});

export const updateSummarySchema = Joi.object({
  content: Joi.string().min(1).max(20000).optional(),
  isActive: Joi.boolean().optional(),
  tokenCount: Joi.number().integer().min(0).optional(),
});

// Pagination validation schema
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
});

// Filter validation schema
export const filterSchema = Joi.object({
  search: Joi.string().max(255).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  isActive: Joi.boolean().optional(),
  isArchived: Joi.boolean().optional(),
});

// Input sanitization function
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags and potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags and content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .trim();
};

// Validate and sanitize user input
export const validateAndSanitize = <T>(schema: Joi.ObjectSchema<T>, data: any): T => {
  // First sanitize string inputs
  const sanitizedData = { ...data };

  Object.keys(sanitizedData).forEach(key => {
    if (typeof sanitizedData[key] === 'string') {
      sanitizedData[key] = sanitizeInput(sanitizedData[key]);
    }
  });

  // Then validate
  const { error, value } = schema.validate(sanitizedData, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    throw new Error(`Validation error: ${errorMessage}`);
  }

  return value;
};

// Specific validation functions for controllers
export const validatePagination = (query: any) => {
  return validateAndSanitize(paginationSchema, query);
};

export const validateConversationCreate = (data: any) => {
  return validateAndSanitize(createConversationSchema, data);
};

export const validateConversationUpdate = (data: any) => {
  return validateAndSanitize(updateConversationSchema, data);
};

export const validateMessageCreate = (data: any) => {
  return validateAndSanitize(createMessageSchema, data);
};

export const validateMessageUpdate = (data: any) => {
  return validateAndSanitize(updateMessageSchema, data);
};

export const validatePersonaCreate = (data: any) => {
  return validateAndSanitize(createPersonaSchema, data);
};

export const validatePersonaUpdate = (data: any) => {
  return validateAndSanitize(updatePersonaSchema, data);
};
