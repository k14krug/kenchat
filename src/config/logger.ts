import * as winston from 'winston';
import { environment } from './environment';

// Create logs directory if it doesn't exist
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const logDir = dirname(environment.logging.file);
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// Configure Winston logger
export const logger = winston.createLogger({
  level: environment.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'kenchat-api' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: environment.logging.file.replace('.log', '-error.log'),
      level: 'error',
    }),
    // Write all logs with importance level of `info` or less to combined log
    new winston.transports.File({
      filename: environment.logging.file,
    }),
  ],
});

// If we're not in production, log to the console as well
if (environment.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}
