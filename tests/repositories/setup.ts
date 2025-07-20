import { jest } from '@jest/globals';

// Mock the database connection
export const mockDb = {
  execute: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn(),
  getConnection: jest.fn(),
  healthCheck: jest.fn(),
  isHealthy: jest.fn(),
  close: jest.fn()
};

// Mock the database module
jest.mock('../../src/database/connection', () => ({
  db: mockDb
}));

// Mock logger
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock crypto for UUID generation
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123')
}));

// Helper function to create mock database rows
export const createMockRow = (data: Record<string, any>) => {
  return data;
};

// Helper function to create mock result set
export const createMockResult = (affectedRows: number = 1, insertId?: number) => {
  return {
    affectedRows,
    insertId,
    changedRows: affectedRows,
    fieldCount: 0,
    info: '',
    serverStatus: 0,
    warningStatus: 0
  };
};

// Reset all mocks before each test
export const resetMocks = () => {
  jest.clearAllMocks();
  mockDb.execute.mockReset();
  mockDb.query.mockReset();
  mockDb.transaction.mockReset();
};