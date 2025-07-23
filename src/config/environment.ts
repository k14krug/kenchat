import { config } from 'dotenv';
import * as Joi from 'joi';

// Load environment variables from .env file
config();

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // Database configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_CONNECTION_LIMIT: Joi.number().default(10),

  // OpenAI API configuration
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_ORGANIZATION: Joi.string().allow('').optional(),

  // JWT configuration
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Security configuration
  BCRYPT_ROUNDS: Joi.number().default(12),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Logging configuration
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE: Joi.string().default('logs/app.log'),

  // CORS configuration
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Cost tracking configuration
  COST_TRACKING_ENABLED: Joi.boolean().default(true),
  COST_TRACKING_DAILY_LIMIT: Joi.number().optional(),
  COST_TRACKING_WEEKLY_LIMIT: Joi.number().optional(),
  COST_TRACKING_MONTHLY_LIMIT: Joi.number().optional(),
  COST_TRACKING_WARNING_THRESHOLD: Joi.number().min(0).max(100).default(80),
  COST_TRACKING_ALERT_WEBHOOK_URL: Joi.string().uri().optional(),
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    connectionLimit: number;
  };
  openai: {
    apiKey: string;
    organization?: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  security: {
    bcryptRounds: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  logging: {
    level: string;
    file: string;
  };
  cors: {
    origin: string;
  };
  costTracking: {
    enabled: boolean;
    dailyLimit?: number;
    weeklyLimit?: number;
    monthlyLimit?: number;
    warningThreshold: number;
    alertWebhookUrl?: string;
  };
}

export const environment: EnvironmentConfig = {
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  database: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    connectionLimit: envVars.DB_CONNECTION_LIMIT,
  },
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    organization: envVars.OPENAI_ORGANIZATION,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    rateLimitWindowMs: envVars.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE,
  },
  cors: {
    origin: envVars.CORS_ORIGIN,
  },
  costTracking: {
    enabled: envVars.COST_TRACKING_ENABLED,
    dailyLimit: envVars.COST_TRACKING_DAILY_LIMIT,
    weeklyLimit: envVars.COST_TRACKING_WEEKLY_LIMIT,
    monthlyLimit: envVars.COST_TRACKING_MONTHLY_LIMIT,
    warningThreshold: envVars.COST_TRACKING_WARNING_THRESHOLD,
    alertWebhookUrl: envVars.COST_TRACKING_ALERT_WEBHOOK_URL,
  },
};
