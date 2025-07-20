# Design Document

## Overview

The Personal Chatbot Application is a standalone web-based system that provides persistent, multi-user conversations with AI personas using OpenAI's API. The application features intelligent conversation summarization, cost tracking, and extensible architecture for future enhancements. Built for WSL2 environment with MariaDB on Raspberry Pi, it emphasizes security, performance, and user experience.

## Architecture

### High-Level Architecture

The application follows a layered architecture pattern:

```
┌─────────────────────────────────────────┐
│           Frontend (React/Vue)          │
├─────────────────────────────────────────┤
│              API Layer                  │
│         (Express.js/FastAPI)            │
├─────────────────────────────────────────┤
│            Business Logic               │
│    (Services & Controllers)             │
├─────────────────────────────────────────┤
│           Data Access Layer             │
│         (Repository Pattern)            │
├─────────────────────────────────────────┤
│        Database (MariaDB)               │
│     External APIs (OpenAI)              │
└─────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js for REST API
- **Database:** MariaDB with connection pooling
- **ORM:** Prisma or TypeORM for type-safe database operations
- **Authentication:** JWT tokens with bcrypt password hashing
- **Validation:** Joi or Zod for request validation
- **Testing:** Jest with supertest for API testing

**Frontend:**
- **Framework:** React with TypeScript
- **State Management:** Redux Toolkit or Zustand
- **UI Components:** Material-UI or Tailwind CSS
- **Real-time:** Socket.io for live updates
- **HTTP Client:** Axios with interceptors

**Infrastructure:**
- **Database:** MariaDB 10.6+ on Raspberry Pi
- **Environment:** WSL2 Ubuntu
- **Process Management:** PM2 for production
- **Logging:** Winston with structured logging

## Components and Interfaces

### Core Components

#### 1. Authentication Service
```typescript
interface AuthService {
  register(username: string, password: string): Promise<User>
  login(username: string, password: string): Promise<AuthToken>
  validateToken(token: string): Promise<User>
  logout(token: string): Promise<void>
  refreshToken(refreshToken: string): Promise<AuthToken>
}
```

#### 2. Conversation Manager
```typescript
interface ConversationManager {
  createConversation(userId: string, title?: string): Promise<Conversation>
  getConversations(userId: string): Promise<Conversation[]>
  getConversation(conversationId: string, userId: string): Promise<Conversation>
  updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation>
  deleteConversation(conversationId: string, userId: string): Promise<void>
  addMessage(conversationId: string, message: Message): Promise<Message>
}
```

#### 3. AI Service
```typescript
interface AIService {
  generateResponse(prompt: string, model: string, options: AIOptions): Promise<AIResponse>
  calculateCost(tokens: TokenUsage, model: string): Promise<number>
  validateModel(model: string): boolean
  getAvailableModels(): Promise<AIModel[]>
}
```

#### 4. Summarization Engine
```typescript
interface SummarizationEngine {
  shouldSummarize(conversation: Conversation): boolean
  summarizeConversation(messages: Message[], existingSummary?: string): Promise<Summary>
  updateRollingSummary(currentSummary: Summary, newMessages: Message[]): Promise<Summary>
  getSummarizationPrompt(): string
  updateSummarizationPrompt(prompt: string): Promise<void>
}
```

#### 5. Persona Manager
```typescript
interface PersonaManager {
  createPersona(userId: string, persona: CreatePersonaRequest): Promise<Persona>
  getPersonas(userId: string): Promise<Persona[]>
  updatePersona(personaId: string, updates: Partial<Persona>): Promise<Persona>
  deletePersona(personaId: string, userId: string): Promise<void>
  getPersonaPrompt(personaId: string): Promise<string>
}
```

#### 6. Cost Tracker
```typescript
interface CostTracker {
  recordUsage(userId: string, conversationId: string, usage: TokenUsage, cost: number): Promise<void>
  getUserCosts(userId: string, period: TimePeriod): Promise<CostSummary>
  getConversationCost(conversationId: string): Promise<number>
  checkCostLimits(userId: string): Promise<CostLimitStatus>
}
```

### Database Schema Design

#### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email)
);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255),
  intent VARCHAR(100),
  custom_instructions TEXT,
  current_persona_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE,
  total_cost DECIMAL(10,4) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (current_persona_id) REFERENCES personas(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_updated_at (updated_at),
  INDEX idx_intent (intent)
);
```

#### Messages Table
```sql
CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  persona_id VARCHAR(36),
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  model_used VARCHAR(50),
  token_count INT,
  cost DECIMAL(8,4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_summarized BOOLEAN DEFAULT FALSE,
  metadata JSON,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_created_at (created_at),
  INDEX idx_role (role)
);
```

#### Personas Table
```sql
CREATE TABLE personas (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  personality_traits JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_default BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_name (name)
);
```

#### Summaries Table
```sql
CREATE TABLE summaries (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  message_range_start VARCHAR(36),
  message_range_end VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  token_count INT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_range_start) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (message_range_end) REFERENCES messages(id) ON DELETE SET NULL,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_created_at (created_at)
);
```

#### Cost Tracking Table
```sql
CREATE TABLE usage_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  conversation_id VARCHAR(36) NOT NULL,
  message_id VARCHAR(36),
  model_used VARCHAR(50) NOT NULL,
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  cost DECIMAL(8,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_created_at (created_at),
  INDEX idx_model_used (model_used)
);
```

## Data Models

### Core Data Models

```typescript
interface User {
  id: string
  username: string
  email?: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
  lastLogin?: Date
}

interface Conversation {
  id: string
  userId: string
  title?: string
  intent?: string
  customInstructions?: string
  currentPersonaId?: string
  createdAt: Date
  updatedAt: Date
  isArchived: boolean
  totalCost: number
  messages?: Message[]
  summaries?: Summary[]
}

interface Message {
  id: string
  conversationId: string
  personaId?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  modelUsed?: string
  tokenCount?: number
  cost?: number
  createdAt: Date
  isSummarized: boolean
  metadata?: Record<string, any>
}

interface Persona {
  id: string
  userId: string
  name: string
  description?: string
  systemPrompt: string
  personalityTraits?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  isDefault: boolean
  usageCount: number
}

interface Summary {
  id: string
  conversationId: string
  content: string
  messageRangeStart?: string
  messageRangeEnd?: string
  createdAt: Date
  isActive: boolean
  tokenCount?: number
}

interface AIModel {
  id: string
  name: string
  description: string
  inputCostPer1kTokens: number
  outputCostPer1kTokens: number
  maxTokens: number
  capabilities: string[]
}

interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface CostSummary {
  totalCost: number
  totalTokens: number
  conversationCount: number
  period: TimePeriod
  breakdown: CostBreakdown[]
}
```

## Error Handling

### Error Classification

1. **Client Errors (4xx)**
   - Authentication failures
   - Validation errors
   - Resource not found
   - Permission denied

2. **Server Errors (5xx)**
   - Database connection failures
   - OpenAI API failures
   - Internal processing errors

3. **External Service Errors**
   - OpenAI API rate limits
   - Network connectivity issues
   - Service unavailable

### Error Handling Strategy

```typescript
class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
    public isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// Error handling middleware
const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      code: error.code,
      message: error.message
    })
  }
  
  // Log unexpected errors
  logger.error('Unexpected error:', error)
  
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  })
}
```

### OpenAI API Error Handling

```typescript
class OpenAIService {
  async generateResponse(prompt: string, model: string): Promise<AIResponse> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }]
      })
      
      return this.processResponse(response)
    } catch (error) {
      if (error.status === 429) {
        // Rate limit - implement exponential backoff
        await this.handleRateLimit(error)
        return this.generateResponse(prompt, model) // Retry
      } else if (error.status === 401) {
        throw new AppError('Invalid OpenAI API key', 401, 'INVALID_API_KEY')
      } else if (error.status >= 500) {
        throw new AppError('OpenAI service unavailable', 503, 'SERVICE_UNAVAILABLE')
      }
      
      throw new AppError('Failed to generate response', 500, 'AI_GENERATION_FAILED')
    }
  }
}
```

## Testing Strategy

### Unit Testing Approach

1. **Service Layer Testing**
   - Mock external dependencies (OpenAI API, database)
   - Test business logic in isolation
   - Validate error handling scenarios

2. **Repository Layer Testing**
   - Use in-memory database for testing
   - Test CRUD operations
   - Validate data integrity constraints

3. **API Layer Testing**
   - Integration tests with test database
   - Authentication and authorization testing
   - Request/response validation

### Test Structure

```typescript
// Example test structure
describe('ConversationService', () => {
  let conversationService: ConversationService
  let mockRepository: jest.Mocked<ConversationRepository>
  let mockAIService: jest.Mocked<AIService>

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockAIService = createMockAIService()
    conversationService = new ConversationService(mockRepository, mockAIService)
  })

  describe('createConversation', () => {
    it('should create a new conversation with default settings', async () => {
      // Test implementation
    })

    it('should handle database errors gracefully', async () => {
      // Test error scenarios
    })
  })
})
```

### Integration Testing

- Database integration tests with test MariaDB instance
- OpenAI API integration tests with mock responses
- End-to-end user workflow testing
- Performance testing for summarization and large conversations

## Security Considerations

### Authentication & Authorization

1. **Password Security**
   - bcrypt with salt rounds ≥ 12
   - Password strength requirements
   - Account lockout after failed attempts

2. **Session Management**
   - JWT tokens with short expiration
   - Refresh token rotation
   - Secure cookie settings

3. **API Security**
   - Rate limiting per user/IP
   - Input validation and sanitization
   - SQL injection prevention via ORM

### Data Protection

1. **Encryption at Rest**
   - Database-level encryption for sensitive fields
   - Encrypted configuration files
   - Secure API key storage

2. **Encryption in Transit**
   - HTTPS/TLS for all communications
   - Secure database connections
   - Certificate validation

### Privacy & Compliance

1. **Data Minimization**
   - Store only necessary user data
   - Regular cleanup of old conversations
   - User data export/deletion capabilities

2. **Audit Logging**
   - Authentication events
   - Data access patterns
   - Administrative actions

This design provides a robust foundation for the personal chatbot application while maintaining flexibility for future enhancements like document upload functionality.