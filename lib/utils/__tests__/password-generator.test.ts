import { describe, it, expect } from 'vitest';
import {
  generateSecurePassword,
  validatePasswordStrength,
  type PasswordStrength,
} from '../password-generator';

describe('generateSecurePassword', () => {
  describe('password generation', () => {
    it('should generate a password with default length of 16 characters', () => {
      const password = generateSecurePassword();
      expect(password).toHaveLength(16);
    });

    it('should generate a password with custom length', () => {
      const password = generateSecurePassword({ length: 20 });
      expect(password).toHaveLength(20);
    });

    it('should throw error for passwords shorter than 8 characters', () => {
      expect(() => generateSecurePassword({ length: 7 })).toThrow(
        'Password length must be at least 8 characters'
      );
    });

    it('should generate unique passwords on each call', () => {
      const passwords = new Set<string>();
      for (let i = 0; i < 100; i++) {
        passwords.add(generateSecurePassword());
      }
      expect(passwords.size).toBe(100);
    });
  });

  describe('character type requirements', () => {
    it('should include uppercase letters by default', () => {
      const password = generateSecurePassword();
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    it('should include lowercase letters by default', () => {
      const password = generateSecurePassword();
      expect(/[a-z]/.test(password)).toBe(true);
    });

    it('should include numbers by default', () => {
      const password = generateSecurePassword();
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it('should include special characters by default', () => {
      const password = generateSecurePassword();
      expect(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });

    it('should generate password without uppercase when disabled', () => {
      const password = generateSecurePassword({
        length: 16,
        includeUppercase: false,
      });
      expect(/[A-Z]/.test(password)).toBe(false);
      expect(/[a-z0-9!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });

    it('should generate password without special characters when disabled', () => {
      const password = generateSecurePassword({
        length: 16,
        includeSpecial: false,
      });
      expect(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)).toBe(false);
      expect(/[A-Za-z0-9]/.test(password)).toBe(true);
    });

    it('should throw error when all character types are disabled', () => {
      expect(() =>
        generateSecurePassword({
          includeUppercase: false,
          includeLowercase: false,
          includeNumbers: false,
          includeSpecial: false,
        })
      ).toThrow('At least one character type must be included');
    });
  });

  describe('character distribution', () => {
    it('should have good character distribution (not clustered)', () => {
      const password = generateSecurePassword({ length: 100 });

      // Count character types
      const uppercase = (password.match(/[A-Z]/g) || []).length;
      const lowercase = (password.match(/[a-z]/g) || []).length;
      const numbers = (password.match(/[0-9]/g) || []).length;
      const special = (password.match(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/g) || []).length;

      // Each type should be present and reasonably distributed
      expect(uppercase).toBeGreaterThan(5);
      expect(lowercase).toBeGreaterThan(5);
      expect(numbers).toBeGreaterThan(5);
      expect(special).toBeGreaterThan(5);

      // Total should equal password length
      expect(uppercase + lowercase + numbers + special).toBe(100);
    });

    it('should not have predictable patterns', () => {
      const passwords: string[] = [];
      for (let i = 0; i < 10; i++) {
        passwords.push(generateSecurePassword({ length: 16 }));
      }

      // Check that passwords don't start with the same character
      const firstChars = passwords.map((p) => p[0]);
      const uniqueFirstChars = new Set(firstChars);
      expect(uniqueFirstChars.size).toBeGreaterThan(5);
    });
  });
});

describe('validatePasswordStrength', () => {
  describe('minimum requirements', () => {
    it('should validate a strong password', () => {
      const result = validatePasswordStrength('MyP@ssw0rd123456');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(70);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePasswordStrength('P@ss1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('myp@ssw0rd123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('MYP@SSW0RD123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      const result = validatePasswordStrength('MyP@ssword!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      const result = validatePasswordStrength('MyPassword123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('password scoring', () => {
    it('should score longer passwords higher', () => {
      const short = validatePasswordStrength('MyP@ss1');
      const medium = validatePasswordStrength('MyP@ssw0rd12');
      const long = validatePasswordStrength('MyP@ssw0rd123456');

      expect(long.score).toBeGreaterThan(medium.score);
      expect(medium.score).toBeGreaterThan(short.score);
    });

    it('should give bonus for character diversity', () => {
      const diverse = validatePasswordStrength('Ab1!Cd2@Ef3#Gh4$');
      const repetitive = validatePasswordStrength('Aaaa1111!!!!Bbbb');

      expect(diverse.score).toBeGreaterThan(repetitive.score);
    });

    it('should penalize repeated character patterns', () => {
      const withPattern = validatePasswordStrength('Paaa1111!!!sword');
      expect(withPattern.errors).toContain('Password contains repeated character patterns');
      expect(withPattern.score).toBeLessThan(80);
    });

    it('should keep score between 0 and 100', () => {
      const tests = [
        'weak',
        'MyP@ssw0rd123456',
        'a',
        'VeryStr0ng!P@ssw0rd#2024$Secure',
      ];

      tests.forEach((password) => {
        const result = validatePasswordStrength(password);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Google Workspace compliance', () => {
    it('should accept minimum Google Workspace password', () => {
      const result = validatePasswordStrength('Abc123!@');
      expect(result.isValid).toBe(true);
    });

    it('should validate passwords generated by generateSecurePassword', () => {
      for (let i = 0; i < 20; i++) {
        const password = generateSecurePassword();
        const result = validatePasswordStrength(password);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.score).toBeGreaterThan(70);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = validatePasswordStrength('');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very long passwords', () => {
      const longPassword = 'A1!a' + 'b'.repeat(100) + 'C2@c';
      const result = validatePasswordStrength(longPassword);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle passwords with only allowed special characters', () => {
      const result = validatePasswordStrength('Pass123!@#$%^&*()');
      expect(result.isValid).toBe(true);
    });
  });
});
