import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { environment } from './config/environment';
import { logger } from './config/logger';
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import personaRoutes from './routes/personas';
import conversationRoutes from './routes/conversations';
import summarizationRoutes from './routes/summarization';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: environment.cors.origin,
      credentials: true,
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // HTTP request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.info(message.trim());
        },
      },
    }));
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: environment.nodeEnv,
      });
    });

    // API routes
    this.app.get('/api', (req: Request, res: Response) => {
      res.status(200).json({
        message: 'KenChat API is running',
        version: '1.0.0',
      });
    });

    // Authentication routes
    this.app.use('/api/auth', authRoutes);

    // AI routes
    this.app.use('/api/ai', aiRoutes);

    // Persona routes
    this.app.use('/api/personas', personaRoutes);

    // Conversation routes
    this.app.use('/api/conversations', conversationRoutes);

    // Summarization routes
    this.app.use('/api', summarizationRoutes);

    // 404 handler for undefined routes
    this.app.use(notFoundHandler);
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use(errorHandler);
  }

  public listen(): void {
    this.app.listen(environment.port, () => {
      logger.info(`Server is running on port ${environment.port}`);
      logger.info(`Environment: ${environment.nodeEnv}`);
    });
  }
}

// Export the class for instantiation in tests
export default App;

// Export an instance for use in integration tests
const appInstance = new App();
export const app = appInstance.app;