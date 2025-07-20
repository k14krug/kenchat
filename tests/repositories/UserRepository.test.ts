import { UserRepository } from '../../src/repositories/UserRepository';
import { DatabaseError, NotFoundError } from '../../src/utils/errors';
import { mockDb, createMockRow, createMockResult, resetMocks } from './setup';

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    resetMocks();
    userRepository = new UserRepository();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword'
      };

      const mockUser = createMockRow({
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        last_login: null
      });

      // Mock the INSERT operation
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);
      
      // Mock the SELECT operation to fetch the created user
      mockDb.execute.mockResolvedValueOnce([[mockUser], []]);

      const result = await userRepository.create(userData);

      expect(result).toEqual({
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        createdAt: mockUser.created_at,
        updatedAt: mockUser.updated_at,
        isActive: true,
        lastLogin: null
      });

      expect(mockDb.execute).toHaveBeenCalledTimes(2);
      expect(mockDb.execute).toHaveBeenNthCalledWith(1, 
        expect.stringContaining('INSERT INTO users'),
        ['test-uuid-123', 'testuser', 'test@example.com', 'hashedpassword']
      );
    });

    it('should handle duplicate username error', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword'
      };

      const duplicateError = new Error('Duplicate entry for username');
      mockDb.execute.mockRejectedValueOnce(duplicateError);

      await expect(userRepository.create(userData)).rejects.toThrow(DatabaseError);
      await expect(userRepository.create(userData)).rejects.toThrow('Username already exists');
    });

    it('should handle database insertion failure', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword'
      };

      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(userRepository.create(userData)).rejects.toThrow(DatabaseError);
      await expect(userRepository.create(userData)).rejects.toThrow('Failed to create user');
    });
  });

  describe('findById', () => {
    it('should find user by ID successfully', async () => {
      const mockUser = createMockRow({
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        last_login: null
      });

      mockDb.execute.mockResolvedValueOnce([[mockUser], []]);

      const result = await userRepository.findById('test-uuid-123');

      expect(result).toEqual({
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        createdAt: mockUser.created_at,
        updatedAt: mockUser.updated_at,
        isActive: true,
        lastLogin: null
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id = ?'),
        ['test-uuid-123']
      );
    });

    it('should return null when user not found', async () => {
      mockDb.execute.mockResolvedValueOnce([[], []]);

      const result = await userRepository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(userRepository.findById('test-id')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByUsername', () => {
    it('should find user by username successfully', async () => {
      const mockUser = createMockRow({
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        last_login: null
      });

      mockDb.execute.mockResolvedValueOnce([[mockUser], []]);

      const result = await userRepository.findByUsername('testuser');

      expect(result).toBeDefined();
      expect(result?.username).toBe('testuser');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE username = ? AND is_active = TRUE'),
        ['testuser']
      );
    });

    it('should return null when user not found', async () => {
      mockDb.execute.mockResolvedValueOnce([[], []]);

      const result = await userRepository.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user email successfully', async () => {
      const updateData = { email: 'newemail@example.com' };
      
      const mockUpdatedUser = createMockRow({
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'newemail@example.com',
        password_hash: 'hashedpassword',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        last_login: null
      });

      // Mock the UPDATE operation
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);
      
      // Mock the SELECT operation to fetch the updated user
      mockDb.execute.mockResolvedValueOnce([[mockUpdatedUser], []]);

      const result = await userRepository.update('test-uuid-123', updateData);

      expect(result.email).toBe('newemail@example.com');
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
      expect(mockDb.execute).toHaveBeenNthCalledWith(1,
        expect.stringContaining('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = TRUE'),
        ['newemail@example.com', 'test-uuid-123']
      );
    });

    it('should throw error when no fields to update', async () => {
      await expect(userRepository.update('test-id', {})).rejects.toThrow(DatabaseError);
      await expect(userRepository.update('test-id', {})).rejects.toThrow('No fields to update');
    });

    it('should throw NotFoundError when user not found', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(userRepository.update('nonexistent-id', { email: 'test@example.com' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('usernameExists', () => {
    it('should return true when username exists', async () => {
      mockDb.execute.mockResolvedValueOnce([[{ count: 1 }], []]);

      const result = await userRepository.usernameExists('testuser');

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM users WHERE username = ?'),
        ['testuser']
      );
    });

    it('should return false when username does not exist', async () => {
      mockDb.execute.mockResolvedValueOnce([[{ count: 0 }], []]);

      const result = await userRepository.usernameExists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('emailExists', () => {
    it('should return true when email exists', async () => {
      mockDb.execute.mockResolvedValueOnce([[{ count: 1 }], []]);

      const result = await userRepository.emailExists('test@example.com');

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM users WHERE email = ?'),
        ['test@example.com']
      );
    });

    it('should return false when email does not exist', async () => {
      mockDb.execute.mockResolvedValueOnce([[{ count: 0 }], []]);

      const result = await userRepository.emailExists('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);

      await userRepository.deactivate('test-uuid-123');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
        ['test-uuid-123']
      );
    });

    it('should throw NotFoundError when user not found', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(userRepository.deactivate('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(1), []]);

      await userRepository.updateLastLogin('test-uuid-123');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
        ['test-uuid-123']
      );
    });

    it('should not throw error if user not found (non-critical operation)', async () => {
      mockDb.execute.mockResolvedValueOnce([createMockResult(0), []]);

      await expect(userRepository.updateLastLogin('nonexistent-id')).resolves.not.toThrow();
    });
  });

  describe('toUserResponse', () => {
    it('should convert user to response format', () => {
      const user = {
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        lastLogin: null
      };

      const response = userRepository.toUserResponse(user);

      expect(response).toEqual({
        id: 'test-uuid-123',
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: null
      });

      // Should not include passwordHash
      expect(response).not.toHaveProperty('passwordHash');
    });
  });
});