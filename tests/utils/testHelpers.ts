import { User, CreateUserRequest, UserResponse } from '../../src/models/User';
import bcrypt from 'bcryptjs';

export const createMockUser = (overrides: Partial<User> = {}): User => {
  return {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$2a$12$hashedpassword',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

export const createMockUserResponse = (overrides: Partial<UserResponse> = {}): UserResponse => {
  return {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

export const createMockCreateUserRequest = (overrides: Partial<CreateUserRequest> = {}): CreateUserRequest => {
  return {
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPassword123!',
    ...overrides
  };
};

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12);
};

export const mockJWTPayload = {
  userId: '1',
  username: 'testuser',
  email: 'test@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
};

export const mockRefreshTokenPayload = {
  userId: '1',
  tokenVersion: 1,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 604800
};

export const validPasswords = [
  'TestPassword123!',
  'MySecure@Pass1',
  'Complex$Password9'
];

export const invalidPasswords = [
  'short',
  'nouppercase123!',
  'NOLOWERCASE123!',
  'NoNumbers!',
  'NoSpecialChars123',
  'password',
  '123456789'
];

export const validUsernames = [
  'testuser',
  'user123',
  'validusername'
];

export const invalidUsernames = [
  'ab', // too short
  'a'.repeat(31), // too long
  'user@name', // special characters
  'user name' // spaces
];

export const validEmails = [
  'test@example.com',
  'user.name@domain.co.uk',
  'valid+email@test.org'
];

export const invalidEmails = [
  'invalid-email',
  '@domain.com',
  'user@',
  'user@domain',
  'a'.repeat(250) + '@domain.com' // too long
];

import { db } from '../../src/database/connection';
import { Conversation, Message } from '../../src/models';
import jwt from 'jsonwebtoken';
import { environment } from '../../src/config/environment';

// Database test helpers
export const createTestUser = async (username: string = 'testuser'): Promise<User> => {
  const hashedPassword = await hashPassword('testpassword');
  const userId = generateTestId();
  
  const query = `
    INSERT INTO users (id, username, password_hash, email, is_active)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  await db.execute(query, [
    userId,
    username,
    hashedPassword,
    `${username}@test.com`,
    true
  ]);

  return {
    id: userId,
    username,
    email: `${username}@test.com`,
    passwordHash: hashedPassword,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export const createTestConversation = async (userId: string): Promise<Conversation> => {
  const conversationId = generateTestId();
  
  const query = `
    INSERT INTO conversations (id, user_id, title, created_at, updated_at)
    VALUES (?, ?, ?, NOW(), NOW())
  `;
  
  await db.execute(query, [conversationId, userId, 'Test Conversation']);

  return {
    id: conversationId,
    userId,
    title: 'Test Conversation',
    createdAt: new Date(),
    updatedAt: new Date(),
    isArchived: false,
    totalCost: 0,
  };
};

export const createTestMessages = async (
  conversationId: string, 
  count: number,
  options: {
    longContent?: boolean;
    mixedRoles?: boolean;
    variableContent?: boolean;
  } = {}
): Promise<Message[]> => {
  const messages: Message[] = [];
  
  for (let i = 0; i < count; i++) {
    const messageId = generateTestId();
    let content = `Test message ${i + 1}`;
    let role: 'user' | 'assistant' | 'system' = 'user';
    let tokenCount = 50;

    if (options.longContent) {
      content = 'A'.repeat(2000); // Long content for high token count
      tokenCount = 500;
    }

    if (options.mixedRoles) {
      const roles: ('user' | 'assistant' | 'system')[] = ['user', 'assistant', 'system'];
      role = roles[i % roles.length];
    }

    if (options.variableContent) {
      const contents = [
        'Short message',
        'This is a medium length message with some more content to make it realistic.',
        'This is a very long message that contains a lot of text and information that would typically be found in a real conversation between a user and an AI assistant. It includes various topics and detailed explanations.',
      ];
      content = contents[i % contents.length];
      tokenCount = Math.floor(content.length / 4); // Rough token estimation
    }

    const query = `
      INSERT INTO messages (id, conversation_id, role, content, token_count, created_at, is_summarized)
      VALUES (?, ?, ?, ?, ?, NOW(), FALSE)
    `;
    
    await db.execute(query, [messageId, conversationId, role, content, tokenCount]);

    messages.push({
      id: messageId,
      conversationId,
      role,
      content,
      tokenCount,
      createdAt: new Date(),
      isSummarized: false,
    });
  }

  return messages;
};

export const getAuthToken = async (username: string, password: string): Promise<string> => {
  // This would typically make a request to the auth endpoint
  // For testing, we'll generate a token directly
  const user = await getUserByUsername(username);
  if (!user) {
    throw new Error('User not found');
  }

  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
  };

  return jwt.sign(payload, environment.jwt.secret, { expiresIn: '1h' });
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const query = 'SELECT * FROM users WHERE username = ?';
  const [rows] = await db.execute(query, [username]) as any[];
  
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const cleanupTestData = async (): Promise<void> => {
  // Clean up test data in reverse dependency order
  await db.execute('DELETE FROM summaries WHERE conversation_id LIKE "test-%"');
  await db.execute('DELETE FROM messages WHERE conversation_id LIKE "test-%"');
  await db.execute('DELETE FROM conversations WHERE id LIKE "test-%"');
  await db.execute('DELETE FROM users WHERE username LIKE "test%"');
};

export const generateTestId = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Mock data generators for specific test scenarios
export const createHighTokenConversation = async (userId: string): Promise<{
  conversation: Conversation;
  messages: Message[];
}> => {
  const conversation = await createTestConversation(userId);
  const messages = await createTestMessages(conversation.id, 20, { longContent: true });
  
  return { conversation, messages };
};

export const createMixedRoleConversation = async (userId: string): Promise<{
  conversation: Conversation;
  messages: Message[];
}> => {
  const conversation = await createTestConversation(userId);
  const messages = await createTestMessages(conversation.id, 15, { 
    mixedRoles: true,
    variableContent: true 
  });
  
  return { conversation, messages };
};

// Test assertion helpers
export const expectValidSummary = (summary: any): void => {
  expect(summary).toHaveProperty('id');
  expect(summary).toHaveProperty('conversationId');
  expect(summary).toHaveProperty('content');
  expect(summary).toHaveProperty('isActive');
  expect(summary).toHaveProperty('createdAt');
  expect(typeof summary.content).toBe('string');
  expect(summary.content.length).toBeGreaterThan(0);
};

export const expectValidPagination = (pagination: any): void => {
  expect(pagination).toHaveProperty('page');
  expect(pagination).toHaveProperty('limit');
  expect(pagination).toHaveProperty('total');
  expect(pagination).toHaveProperty('totalPages');
  expect(pagination).toHaveProperty('hasNext');
  expect(pagination).toHaveProperty('hasPrev');
  expect(typeof pagination.page).toBe('number');
  expect(typeof pagination.total).toBe('number');
};

export const cleanupTestUser = async (userId: string): Promise<void> => {
  // Clean up test data for a specific user
  await db.execute('DELETE FROM summaries WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)', [userId]);
  await db.execute('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)', [userId]);
  await db.execute('DELETE FROM conversations WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM personas WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM usage_logs WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM users WHERE id = ?', [userId]);
};

// Export as testHelpers object for easier importing
export const testHelpers = {
  createMockUser,
  createMockUserResponse,
  createMockCreateUserRequest,
  hashPassword,
  createTestUser,
  createTestConversation,
  createTestMessages,
  getAuthToken,
  getUserByUsername,
  cleanupTestData,
  cleanupTestUser,
  generateTestId,
  createHighTokenConversation,
  createMixedRoleConversation,
  expectValidSummary,
  expectValidPagination,
};