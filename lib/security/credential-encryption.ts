import crypto from 'crypto';

/**
 * Encryption result containing IV, encrypted data, and auth tag
 */
export interface EncryptionResult {
  iv: string;
  encryptedData: string;
  authTag: string;
}

/**
 * Encrypted credential format for database storage
 * Format: iv:encrypted_data:auth_tag (all base64 encoded)
 */
export type EncryptedCredential = string;

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

class CredentialEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialEncryptionError';
  }
}

/**
 * Gets the encryption key from environment variables
 * The key must be a 32-byte (256-bit) base64-encoded string
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (!key) {
    throw new CredentialEncryptionError(
      'CREDENTIAL_ENCRYPTION_KEY environment variable is not set'
    );
  }

  try {
    const keyBuffer = Buffer.from(key, 'base64');

    if (keyBuffer.length !== KEY_LENGTH) {
      throw new CredentialEncryptionError(
        `Encryption key must be ${KEY_LENGTH} bytes (256 bits). Current key is ${keyBuffer.length} bytes.`
      );
    }

    return keyBuffer;
  } catch (error) {
    if (error instanceof CredentialEncryptionError) {
      throw error;
    }
    throw new CredentialEncryptionError(
      'Invalid CREDENTIAL_ENCRYPTION_KEY format. Must be base64-encoded.'
    );
  }
}

/**
 * Validates that the encryption key is properly configured
 * Should be called at application startup
 *
 * @throws {CredentialEncryptionError} If key is missing or invalid
 *
 * @example
 * // In your app initialization
 * validateEncryptionKeyConfiguration();
 */
export function validateEncryptionKeyConfiguration(): void {
  getEncryptionKey();
}

/**
 * Generates a secure random encryption key for CREDENTIAL_ENCRYPTION_KEY
 * This is a utility function for initial setup - the key should be generated once
 * and stored securely in environment variables
 *
 * @returns Base64-encoded 256-bit encryption key
 *
 * @example
 * const key = generateEncryptionKey();
 * console.log('Add this to your .env file:');
 * console.log(`CREDENTIAL_ENCRYPTION_KEY=${key}`);
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Encrypts a credential (password, API key, etc.) using AES-256-GCM
 *
 * @param plaintext - The credential to encrypt
 * @returns Encrypted credential in format: iv:encrypted_data:auth_tag (base64 encoded)
 *
 * @throws {CredentialEncryptionError} If encryption fails or key is not configured
 *
 * @example
 * const password = "MySecurePassword123!";
 * const encrypted = encryptCredential(password);
 * // Returns: "xK8p2mL9q...==:aG3jK8n...==:pL9xN2m...=="
 */
export function encryptCredential(plaintext: string): EncryptedCredential {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:encrypted_data:auth_tag (all base64 encoded)
    return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
  } catch (error) {
    if (error instanceof CredentialEncryptionError) {
      throw error;
    }
    throw new CredentialEncryptionError(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypts an encrypted credential using AES-256-GCM
 *
 * @param encryptedCredential - Encrypted credential in format: iv:encrypted_data:auth_tag
 * @returns Decrypted plaintext credential
 *
 * @throws {CredentialEncryptionError} If decryption fails, auth tag is invalid, or format is incorrect
 *
 * @example
 * const encrypted = "xK8p2mL9q...==:aG3jK8n...==:pL9xN2m...==";
 * const password = decryptCredential(encrypted);
 * // Returns: "MySecurePassword123!"
 */
export function decryptCredential(encryptedCredential: EncryptedCredential): string {
  try {
    const key = getEncryptionKey();

    // Parse the encrypted credential format
    const parts = encryptedCredential.split(':');

    if (parts.length !== 3) {
      throw new CredentialEncryptionError(
        'Invalid encrypted credential format. Expected: iv:encrypted_data:auth_tag'
      );
    }

    const [ivBase64, encryptedData, authTagBase64] = parts;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    if (iv.length !== IV_LENGTH) {
      throw new CredentialEncryptionError(
        `Invalid IV length. Expected ${IV_LENGTH} bytes, got ${iv.length} bytes.`
      );
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new CredentialEncryptionError(
        `Invalid auth tag length. Expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length} bytes.`
      );
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (error instanceof CredentialEncryptionError) {
      throw error;
    }

    // Check if it's an authentication failure
    if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new CredentialEncryptionError(
        'Decryption failed: Authentication tag verification failed. Data may have been tampered with.'
      );
    }

    throw new CredentialEncryptionError(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parses an encrypted credential into its components (for inspection/debugging)
 *
 * @param encryptedCredential - Encrypted credential string
 * @returns Parsed encryption components
 *
 * @throws {CredentialEncryptionError} If format is invalid
 *
 * @example
 * const encrypted = encryptCredential("password");
 * const parts = parseEncryptedCredential(encrypted);
 * console.log(parts.iv); // Base64-encoded IV
 */
export function parseEncryptedCredential(
  encryptedCredential: EncryptedCredential
): EncryptionResult {
  const parts = encryptedCredential.split(':');

  if (parts.length !== 3) {
    throw new CredentialEncryptionError(
      'Invalid encrypted credential format. Expected: iv:encrypted_data:auth_tag'
    );
  }

  const [iv, encryptedData, authTag] = parts;

  return {
    iv,
    encryptedData,
    authTag,
  };
}

/**
 * Checks if a string is in valid encrypted credential format
 *
 * @param value - String to check
 * @returns True if the string appears to be a valid encrypted credential
 *
 * @example
 * isEncryptedCredential("plain_password"); // false
 * isEncryptedCredential("xK8p2...==:aG3j...==:pL9x...=="); // true
 */
export function isEncryptedCredential(value: string): boolean {
  try {
    parseEncryptedCredential(value);
    return true;
  } catch {
    return false;
  }
}
