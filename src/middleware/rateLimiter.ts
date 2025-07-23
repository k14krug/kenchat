import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}

export const rateLimiter = (options: RateLimiterOptions) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000),
    },
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use user ID if available, otherwise fall back to IP
      return req.user?.id || req.ip || 'unknown';
    }),
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Pre-configured rate limiters for common use cases
export const authRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
});

export const apiRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many API requests, please try again later',
});

export const chatRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 chat requests per minute
  message: 'Too many chat requests, please try again later',
});