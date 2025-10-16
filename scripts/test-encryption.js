#!/usr/bin/env node

/**
 * Test Encryption Key Script
 *
 * Verifies that the CREDENTIAL_ENCRYPTION_KEY is properly configured
 * and can encrypt/decrypt credentials successfully
 *
 * Usage:
 *   node scripts/test-encryption.js
 */

import crypto from 'crypto';
import { config } from 'dotenv';

// Load environment variables
config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function testEncryptionKey() {
  console.log('');
  console.log('='.repeat(60));
  console.log('Testing Credential Encryption Configuration');
  console.log('='.repeat(60));
  console.log('');

  // Check if key exists
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    console.log('❌ FAILED: CREDENTIAL_ENCRYPTION_KEY is not set');
    console.log('');
    process.exit(1);
  }

  console.log('✅ CREDENTIAL_ENCRYPTION_KEY is set');

  // Check key format
  let keyBuffer;
  try {
    keyBuffer = Buffer.from(key, 'base64');
    console.log('✅ Key is valid base64 format');
  } catch (error) {
    console.log('❌ FAILED: Key is not valid base64');
    console.log('');
    process.exit(1);
  }

  // Check key length
  if (keyBuffer.length !== KEY_LENGTH) {
    console.log(`❌ FAILED: Key must be ${KEY_LENGTH} bytes, got ${keyBuffer.length} bytes`);
    console.log('');
    process.exit(1);
  }

  console.log(`✅ Key length is correct (${KEY_LENGTH} bytes / 256 bits)`);

  // Test encryption/decryption
  const testPassword = 'TestPassword123!@#';

  try {
    // Encrypt
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    let encrypted = cipher.update(testPassword, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    const encryptedCredential = `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;

    console.log('✅ Encryption successful');

    // Decrypt
    const parts = encryptedCredential.split(':');
    const ivDecrypt = Buffer.from(parts[0], 'base64');
    const encryptedData = parts[1];
    const authTagDecrypt = Buffer.from(parts[2], 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivDecrypt);
    decipher.setAuthTag(authTagDecrypt);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    if (decrypted === testPassword) {
      console.log('✅ Decryption successful');
      console.log('✅ Encryption/Decryption cycle verified');
    } else {
      console.log('❌ FAILED: Decrypted value does not match original');
      process.exit(1);
    }
  } catch (error) {
    console.log(`❌ FAILED: Encryption test failed - ${error.message}`);
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ All encryption tests passed!');
  console.log('Your CREDENTIAL_ENCRYPTION_KEY is properly configured.');
  console.log('='.repeat(60));
  console.log('');
}

testEncryptionKey();
