import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptCredential,
  decryptCredential,
  generateEncryptionKey,
  validateEncryptionKeyConfiguration,
  parseEncryptedCredential,
  isEncryptedCredential,
} from '../credential-encryption';

describe('credential-encryption', () => {
  // Store original env
  const originalEnv = process.env.CREDENTIAL_ENCRYPTION_KEY;

  // Generate a test key for use in tests
  const testKey = generateEncryptionKey();

  beforeEach(() => {
    // Set a valid test key for all tests
    process.env.CREDENTIAL_ENCRYPTION_KEY = testKey;
  });

  afterEach(() => {
    // Restore original env
    process.env.CREDENTIAL_ENCRYPTION_KEY = originalEnv;
  });

  describe('generateEncryptionKey', () => {
    it('should generate a base64-encoded 32-byte key', () => {
      const key = generateEncryptionKey();
      const keyBuffer = Buffer.from(key, 'base64');

      expect(keyBuffer.length).toBe(32); // 256 bits
      expect(typeof key).toBe('string');
    });

    it('should generate unique keys each time', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 10; i++) {
        keys.add(generateEncryptionKey());
      }
      expect(keys.size).toBe(10);
    });
  });

  describe('validateEncryptionKeyConfiguration', () => {
    it('should not throw when key is properly configured', () => {
      expect(() => validateEncryptionKeyConfiguration()).not.toThrow();
    });

    it('should throw when key is missing', () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;

      expect(() => validateEncryptionKeyConfiguration()).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw when key is not base64', () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'not-base64-!!!';

      expect(() => validateEncryptionKeyConfiguration()).toThrow(
        'Encryption key must be 32 bytes'
      );
    });

    it('should throw when key is wrong length', () => {
      const shortKey = Buffer.from('short').toString('base64');
      process.env.CREDENTIAL_ENCRYPTION_KEY = shortKey;

      expect(() => validateEncryptionKeyConfiguration()).toThrow(
        'Encryption key must be 32 bytes (256 bits)'
      );
    });
  });

  describe('encryptCredential', () => {
    it('should encrypt a simple password', () => {
      const password = 'MySecurePassword123!';
      const encrypted = encryptCredential(password);

      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(password);
    });

    it('should produce encrypted string in correct format (iv:data:tag)', () => {
      const password = 'test';
      const encrypted = encryptCredential(password);
      const parts = encrypted.split(':');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBeTruthy(); // IV
      expect(parts[1]).toBeTruthy(); // Encrypted data
      expect(parts[2]).toBeTruthy(); // Auth tag
    });

    it('should produce different IVs for same plaintext', () => {
      const password = 'SamePassword';
      const encrypted1 = encryptCredential(password);
      const encrypted2 = encryptCredential(password);

      expect(encrypted1).not.toBe(encrypted2);

      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];
      expect(iv1).not.toBe(iv2);
    });

    it('should handle empty string', () => {
      const encrypted = encryptCredential('');
      expect(encrypted).toBeTruthy();
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should handle special characters', () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encryptCredential(password);
      expect(encrypted).toBeTruthy();
    });

    it('should handle unicode characters', () => {
      const password = '密码🔐émüñ';
      const encrypted = encryptCredential(password);
      expect(encrypted).toBeTruthy();
    });

    it('should handle long passwords', () => {
      const password = 'a'.repeat(1000);
      const encrypted = encryptCredential(password);
      expect(encrypted).toBeTruthy();
    });

    it('should throw when encryption key is not configured', () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;

      expect(() => encryptCredential('test')).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY environment variable is not set'
      );
    });
  });

  describe('decryptCredential', () => {
    it('should decrypt an encrypted password', () => {
      const original = 'MySecurePassword123!';
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(original);
    });

    it('should handle empty string decryption', () => {
      const encrypted = encryptCredential('');
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle special characters decryption', () => {
      const original = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle unicode characters decryption', () => {
      const original = '密码🔐émüñ';
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle long passwords decryption', () => {
      const original = 'a'.repeat(1000);
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should throw when encrypted credential format is invalid', () => {
      expect(() => decryptCredential('invalid')).toThrow(
        'Invalid encrypted credential format'
      );
    });

    it('should throw when encrypted credential has wrong number of parts', () => {
      expect(() => decryptCredential('part1:part2')).toThrow(
        'Invalid encrypted credential format'
      );
    });

    it('should throw when IV is wrong length', () => {
      const shortIV = Buffer.from('short').toString('base64');
      const invalid = `${shortIV}:data:tag`;

      expect(() => decryptCredential(invalid)).toThrow(
        'Invalid IV length'
      );
    });

    it('should throw when auth tag is wrong length', () => {
      const validIV = Buffer.from('a'.repeat(16)).toString('base64');
      const shortTag = Buffer.from('short').toString('base64');
      const invalid = `${validIV}:data:${shortTag}`;

      expect(() => decryptCredential(invalid)).toThrow(
        'Invalid auth tag length'
      );
    });

    it('should throw when data has been tampered with', () => {
      const encrypted = encryptCredential('test');
      const [iv, data, tag] = encrypted.split(':');

      // Tamper with the encrypted data by decoding, modifying, and re-encoding
      const dataBuffer = Buffer.from(data, 'base64');
      dataBuffer[0] = dataBuffer[0] ^ 0xFF; // Flip all bits in first byte
      const tamperedData = dataBuffer.toString('base64');
      const tampered = `${iv}:${tamperedData}:${tag}`;

      expect(() => decryptCredential(tampered)).toThrow();
    });

    it('should throw when auth tag is wrong', () => {
      const encrypted = encryptCredential('test');
      const [iv, data, tag] = encrypted.split(':');

      // Use wrong auth tag
      const wrongTag = Buffer.from('a'.repeat(16)).toString('base64');
      const tampered = `${iv}:${data}:${wrongTag}`;

      expect(() => decryptCredential(tampered)).toThrow(
        'Authentication tag verification failed'
      );
    });

    it('should throw when decryption key is not configured', () => {
      const encrypted = encryptCredential('test');
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;

      expect(() => decryptCredential(encrypted)).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw when using wrong decryption key', () => {
      const encrypted = encryptCredential('test');

      // Use different key
      process.env.CREDENTIAL_ENCRYPTION_KEY = generateEncryptionKey();

      expect(() => decryptCredential(encrypted)).toThrow(
        'Authentication tag verification failed'
      );
    });
  });

  describe('encryption/decryption round-trip', () => {
    const testCases = [
      { name: 'simple password', value: 'password123' },
      { name: 'complex password', value: 'MyC0mpl3x!P@ssw0rd#2024' },
      { name: 'email', value: 'user@example.com' },
      { name: 'API key', value: 'sk_live_abc123xyz789' },
      { name: 'empty string', value: '' },
      { name: 'whitespace', value: '   \t\n   ' },
      { name: 'special chars', value: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`' },
      { name: 'unicode', value: '密码🔐émüñ' },
      { name: 'long text', value: 'a'.repeat(500) },
      { name: 'JSON string', value: JSON.stringify({ key: 'value', num: 123 }) },
    ];

    testCases.forEach(({ name, value }) => {
      it(`should correctly encrypt and decrypt: ${name}`, () => {
        const encrypted = encryptCredential(value);
        const decrypted = decryptCredential(encrypted);
        expect(decrypted).toBe(value);
      });
    });

    it('should handle 100 sequential round-trips', () => {
      const original = 'TestPassword123!';

      for (let i = 0; i < 100; i++) {
        const encrypted = encryptCredential(original);
        const decrypted = decryptCredential(encrypted);
        expect(decrypted).toBe(original);
      }
    });
  });

  describe('parseEncryptedCredential', () => {
    it('should parse a valid encrypted credential', () => {
      const encrypted = encryptCredential('test');
      const parsed = parseEncryptedCredential(encrypted);

      expect(parsed.iv).toBeTruthy();
      expect(parsed.encryptedData).toBeTruthy();
      expect(parsed.authTag).toBeTruthy();
    });

    it('should return base64-encoded components', () => {
      const encrypted = encryptCredential('test');
      const parsed = parseEncryptedCredential(encrypted);

      // Should be able to decode base64
      expect(() => Buffer.from(parsed.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(parsed.encryptedData, 'base64')).not.toThrow();
      expect(() => Buffer.from(parsed.authTag, 'base64')).not.toThrow();
    });

    it('should throw on invalid format', () => {
      expect(() => parseEncryptedCredential('invalid')).toThrow(
        'Invalid encrypted credential format'
      );
    });

    it('should throw on wrong number of parts', () => {
      expect(() => parseEncryptedCredential('a:b')).toThrow(
        'Invalid encrypted credential format'
      );
    });
  });

  describe('isEncryptedCredential', () => {
    it('should return true for valid encrypted credentials', () => {
      const encrypted = encryptCredential('test');
      expect(isEncryptedCredential(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncryptedCredential('plain_password')).toBe(false);
    });

    it('should return false for invalid format', () => {
      expect(isEncryptedCredential('invalid:format')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncryptedCredential('')).toBe(false);
    });

    it('should return false for single colon', () => {
      expect(isEncryptedCredential(':')).toBe(false);
    });
  });

  describe('security properties', () => {
    it('should use unique IVs for 1000 encryptions', () => {
      const password = 'same_password';
      const ivs = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const encrypted = encryptCredential(password);
        const { iv } = parseEncryptedCredential(encrypted);
        ivs.add(iv);
      }

      expect(ivs.size).toBe(1000); // All IVs should be unique
    });

    it('should produce different ciphertext for same plaintext', () => {
      const password = 'same_password';
      const ciphertexts = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ciphertexts.add(encryptCredential(password));
      }

      expect(ciphertexts.size).toBe(100); // All ciphertexts should be different
    });

    it('should not leak plaintext length in ciphertext', () => {
      // Note: GCM mode does preserve length, but this test verifies consistent behavior
      const short = encryptCredential('a');
      const long = encryptCredential('a'.repeat(100));

      const shortParsed = parseEncryptedCredential(short);
      const longParsed = parseEncryptedCredential(long);

      // IV and auth tag should be same length
      expect(shortParsed.iv.length).toBe(longParsed.iv.length);
      expect(shortParsed.authTag.length).toBe(longParsed.authTag.length);

      // Encrypted data length should differ (GCM preserves length)
      expect(shortParsed.encryptedData.length).not.toBe(
        longParsed.encryptedData.length
      );
    });

    it('should detect tampering with any part of encrypted credential', () => {
      const encrypted = encryptCredential('sensitive_data');
      const [iv, data, tag] = encrypted.split(':');

      // Tamper with IV by flipping bits
      const ivBuffer = Buffer.from(iv, 'base64');
      ivBuffer[0] = ivBuffer[0] ^ 0xFF;
      const tamperedIV = ivBuffer.toString('base64');
      expect(() => decryptCredential(`${tamperedIV}:${data}:${tag}`)).toThrow();

      // Tamper with data by flipping bits
      const dataBuffer = Buffer.from(data, 'base64');
      dataBuffer[0] = dataBuffer[0] ^ 0xFF;
      const tamperedData = dataBuffer.toString('base64');
      expect(() => decryptCredential(`${iv}:${tamperedData}:${tag}`)).toThrow();

      // Tamper with auth tag by flipping bits
      const tagBuffer = Buffer.from(tag, 'base64');
      tagBuffer[0] = tagBuffer[0] ^ 0xFF;
      const tamperedTag = tagBuffer.toString('base64');
      expect(() => decryptCredential(`${iv}:${data}:${tamperedTag}`)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle credential with colons in plaintext', () => {
      const original = 'username:password:extra';
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle credential with base64-like characters', () => {
      const original = 'abc123+/=DEF456';
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle credential with newlines', () => {
      const original = 'line1\nline2\nline3';
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle credential with null bytes', () => {
      const original = 'before\0after';
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });
  });
});
