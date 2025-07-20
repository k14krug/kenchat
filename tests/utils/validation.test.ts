import {
  passwordSchema,
  usernameSchema,
  emailSchema,
  registerSchema,
  loginSchema,
  sanitizeInput,
  validateAndSanitize
} from '../../src/utils/validation';
import {
  validPasswords,
  invalidPasswords,
  validUsernames,
  invalidUsernames,
  validEmails,
  invalidEmails
} from './testHelpers';

describe('Validation Utils', () => {
  describe('passwordSchema', () => {
    test('should validate strong passwords', () => {
      validPasswords.forEach(password => {
        const { error } = passwordSchema.validate(password);
        expect(error).toBeUndefined();
      });
    });

    test('should reject weak passwords', () => {
      invalidPasswords.forEach(password => {
        const { error } = passwordSchema.validate(password);
        expect(error).toBeDefined();
      });
    });

    test('should provide specific error messages', () => {
      const { error } = passwordSchema.validate('weak');
      expect(error?.details[0].message).toContain('Password must be at least 8 characters long');
    });
  });

  describe('usernameSchema', () => {
    test('should validate valid usernames', () => {
      validUsernames.forEach(username => {
        const { error } = usernameSchema.validate(username);
        expect(error).toBeUndefined();
      });
    });

    test('should reject invalid usernames', () => {
      invalidUsernames.forEach(username => {
        const { error } = usernameSchema.validate(username);
        expect(error).toBeDefined();
      });
    });
  });

  describe('emailSchema', () => {
    test('should validate valid emails', () => {
      validEmails.forEach(email => {
        const { error } = emailSchema.validate(email);
        expect(error).toBeUndefined();
      });
    });

    test('should reject invalid emails', () => {
      invalidEmails.forEach(email => {
        const { error } = emailSchema.validate(email);
        expect(error).toBeDefined();
      });
    });
  });

  describe('registerSchema', () => {
    test('should validate complete registration data', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!',
        first_name: 'Test',
        last_name: 'User'
      };

      const { error } = registerSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should validate registration data without optional fields', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const { error } = registerSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should reject registration data with missing required fields', () => {
      const invalidData = {
        username: 'testuser',
        // missing email and password
      };

      const { error } = registerSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('loginSchema', () => {
    test('should validate login data', () => {
      const validData = {
        username: 'testuser',
        password: 'password123'
      };

      const { error } = loginSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should reject login data with missing fields', () => {
      const invalidData = {
        username: 'testuser'
        // missing password
      };

      const { error } = loginSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('sanitizeInput', () => {
    test('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>test';
      const result = sanitizeInput(input);
      expect(result).toBe('test');
    });

    test('should remove dangerous characters', () => {
      const input = 'test<>&\'"';
      const result = sanitizeInput(input);
      expect(result).toBe('test');
    });

    test('should trim whitespace', () => {
      const input = '  test  ';
      const result = sanitizeInput(input);
      expect(result).toBe('test');
    });

    test('should handle non-string input', () => {
      const result = sanitizeInput(123 as any);
      expect(result).toBe('');
    });
  });

  describe('validateAndSanitize', () => {
    test('should validate and sanitize valid data', () => {
      const data = {
        username: '  testuser  ',
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const result = validateAndSanitize(registerSchema, data);
      expect(result.username).toBe('testuser'); // trimmed
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('TestPassword123!');
    });

    test('should throw error for invalid data', () => {
      const data = {
        username: 'ab', // too short
        email: 'invalid-email',
        password: 'weak'
      };

      expect(() => {
        validateAndSanitize(registerSchema, data);
      }).toThrow('Validation error:');
    });

    test('should strip unknown fields', () => {
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!',
        unknownField: 'should be removed'
      };

      const result = validateAndSanitize(registerSchema, data);
      expect(result).not.toHaveProperty('unknownField');
    });
  });
});