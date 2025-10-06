import crypto from 'crypto';

/**
 * Character pools for password generation
 */
const CHAR_POOLS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
} as const;

/**
 * Password strength result
 */
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
}

/**
 * Password generation options
 */
export interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSpecial?: boolean;
}

/**
 * Generates a cryptographically secure random password
 *
 * @param options - Password generation options
 * @returns Secure random password string
 *
 * @example
 * const password = generateSecurePassword(); // 16-char password with all character types
 * const customPassword = generateSecurePassword({ length: 20, includeSpecial: false });
 */
export function generateSecurePassword(options: PasswordOptions = {}): string {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSpecial = true,
  } = options;

  if (length < 8) {
    throw new Error('Password length must be at least 8 characters');
  }

  // Build character pool based on options
  let charPool = '';
  const requiredChars: string[] = [];

  if (includeUppercase) {
    charPool += CHAR_POOLS.uppercase;
    requiredChars.push(getRandomChar(CHAR_POOLS.uppercase));
  }
  if (includeLowercase) {
    charPool += CHAR_POOLS.lowercase;
    requiredChars.push(getRandomChar(CHAR_POOLS.lowercase));
  }
  if (includeNumbers) {
    charPool += CHAR_POOLS.numbers;
    requiredChars.push(getRandomChar(CHAR_POOLS.numbers));
  }
  if (includeSpecial) {
    charPool += CHAR_POOLS.special;
    requiredChars.push(getRandomChar(CHAR_POOLS.special));
  }

  if (charPool.length === 0) {
    throw new Error('At least one character type must be included');
  }

  // Generate remaining random characters
  const remainingLength = length - requiredChars.length;
  const randomChars: string[] = [];

  for (let i = 0; i < remainingLength; i++) {
    randomChars.push(getRandomChar(charPool));
  }

  // Combine required and random characters
  const allChars = [...requiredChars, ...randomChars];

  // Shuffle using Fisher-Yates algorithm with crypto random
  for (let i = allChars.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i + 1);
    [allChars[i], allChars[j]] = [allChars[j], allChars[i]];
  }

  return allChars.join('');
}

/**
 * Validates password strength against Google Workspace requirements
 *
 * @param password - Password to validate
 * @returns Password strength result with validation errors
 *
 * @example
 * const strength = validatePasswordStrength('MyP@ssw0rd123');
 * if (strength.isValid) {
 *   console.log(`Password strength: ${strength.score}/100`);
 * }
 */
export function validatePasswordStrength(password: string): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  // Check minimum length (Google Workspace requires 8, we recommend 16)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 8 && password.length < 12) {
    score += 15;
  } else if (password.length >= 12 && password.length < 16) {
    score += 20;
  } else {
    score += 25; // 16+ characters
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 15;
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 15;
  }

  // Check for numbers
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 15;
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 15;
  }

  // Bonus points for complexity
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.75) {
    score += 10; // High character diversity
  }

  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 10; // Repeated characters (e.g., 'aaa')
    errors.push('Password contains repeated character patterns');
  }

  if (/^[a-zA-Z]+$/.test(password) || /^[0-9]+$/.test(password)) {
    score -= 15; // Only letters or only numbers
  }

  // Ensure score is between 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    isValid: errors.length === 0,
    score,
    errors,
  };
}

/**
 * Gets a cryptographically random character from a character pool
 */
function getRandomChar(pool: string): string {
  const index = getRandomInt(0, pool.length);
  return pool[index];
}

/**
 * Gets a cryptographically random integer between min (inclusive) and max (exclusive)
 */
function getRandomInt(min: number, max: number): number {
  const range = max - min;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const threshold = maxValue - (maxValue % range);

  let randomValue: number;
  do {
    const randomBytes = crypto.randomBytes(bytesNeeded);
    randomValue = parseInt(randomBytes.toString('hex'), 16);
  } while (randomValue >= threshold);

  return min + (randomValue % range);
}
