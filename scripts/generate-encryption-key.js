#!/usr/bin/env node

/**
 * Generate Encryption Key Script
 *
 * Generates a secure 256-bit encryption key for CREDENTIAL_ENCRYPTION_KEY
 *
 * Usage:
 *   node scripts/generate-encryption-key.js
 *
 * Output:
 *   Prints the encryption key to console in the format needed for .env file
 */

import crypto from 'crypto';

const KEY_LENGTH = 32; // 256 bits

function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

// Generate the key
const key = generateEncryptionKey();

console.log('');
console.log('='.repeat(60));
console.log('Generated Credential Encryption Key');
console.log('='.repeat(60));
console.log('');
console.log('Add this line to your .env file:');
console.log('');
console.log(`CREDENTIAL_ENCRYPTION_KEY=${key}`);
console.log('');
console.log('⚠️  IMPORTANT SECURITY NOTES:');
console.log('  - Never commit this key to version control');
console.log('  - Store it securely (password manager, secrets vault)');
console.log('  - Do NOT change this key once set (existing passwords will be unreadable)');
console.log('  - Add the same key to production environment variables');
console.log('');
console.log('='.repeat(60));
console.log('');
