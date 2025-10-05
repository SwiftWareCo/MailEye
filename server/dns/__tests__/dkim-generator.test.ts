/**
 * DKIM Generator Tests (Task 3.5)
 *
 * Tests for DKIM TXT record generation for Google Workspace
 */

import { describe, it, expect } from 'vitest';
import {
  generateGoogleWorkspaceDKIM,
  buildDKIMRecordValue,
  splitDKIMRecordValue,
  formatSplitDKIMForDNS,
  validateDKIMRecord,
  createDKIMDNSRecord,
  getRecommendedDKIMSelector,
  getGoogleWorkspaceDKIMInstructions,
} from '../dkim-generator';

describe('DKIM Generator', () => {
  // Sample public keys for testing
  const shortPublicKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC'; // ~40 chars
  const mediumPublicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'; // ~200 chars
  const longPublicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + 'x'.repeat(300); // ~350 chars (exceeds 255 limit)

  describe('generateGoogleWorkspaceDKIM', () => {
    it('should generate valid DKIM record for Google Workspace', async () => {
      const result = await generateGoogleWorkspaceDKIM('example.com', shortPublicKey);

      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(result.selector).toBe('google');
      expect(result.recordName).toBe('google._domainkey.example.com');
      expect(result.recordType).toBe('TXT');
      expect(result.recordValue).toContain('v=DKIM1');
      expect(result.recordValue).toContain('k=rsa');
      expect(result.recordValue).toContain(`p=${shortPublicKey}`);
      expect(result.publicKey).toBe(shortPublicKey);
      expect(result.keyLength).toBe(2048);
      expect(result.errors).toHaveLength(0);
    });

    it('should use custom selector when provided', async () => {
      const result = await generateGoogleWorkspaceDKIM('example.com', shortPublicKey, {
        selector: 'custom',
      });

      expect(result.selector).toBe('custom');
      expect(result.recordName).toBe('custom._domainkey.example.com');
    });

    it('should detect when splitting is required for 255-char limit', async () => {
      const result = await generateGoogleWorkspaceDKIM('example.com', longPublicKey);

      expect(result.requiresSplitting).toBe(true);
      expect(result.splitValues).toBeDefined();
      expect(result.splitValues!.length).toBeGreaterThan(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('splitting');
    });

    it('should not split when record is under 255 characters', async () => {
      const result = await generateGoogleWorkspaceDKIM('example.com', shortPublicKey);

      expect(result.requiresSplitting).toBe(false);
      expect(result.characterCount).toBeLessThan(255);
    });

    it('should validate domain format', async () => {
      const result = await generateGoogleWorkspaceDKIM('invalid domain!', shortPublicKey);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid domain');
    });

    it('should validate public key format', async () => {
      const result = await generateGoogleWorkspaceDKIM('example.com', 'invalid-key!!!');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid DKIM public key');
    });

    it('should handle custom key length', async () => {
      const result = await generateGoogleWorkspaceDKIM('example.com', shortPublicKey, {
        keyLength: 4096,
      });

      expect(result.keyLength).toBe(4096);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Key length');
    });

    it('should disable splitting when splitForDNSLimit is false', async () => {
      const result = await generateGoogleWorkspaceDKIM('example.com', longPublicKey, {
        splitForDNSLimit: false,
      });

      expect(result.splitValues).toBeUndefined();
      expect(result.requiresSplitting).toBe(true); // Still detected
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('buildDKIMRecordValue', () => {
    it('should build valid DKIM record value', () => {
      const publicKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
      const recordValue = buildDKIMRecordValue(publicKey);

      expect(recordValue).toBe(`v=DKIM1; k=rsa; p=${publicKey}`);
    });

    it('should remove whitespace from public key', () => {
      const publicKeyWithSpaces = 'MIIB IjAN Bgkq hkiG 9w0B';
      const recordValue = buildDKIMRecordValue(publicKeyWithSpaces);

      expect(recordValue).toBe('v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0B');
      // Verify the public key portion has no spaces (after "p=")
      const publicKeyPart = recordValue.split('p=')[1];
      expect(publicKeyPart).not.toContain(' ');
    });

    it('should remove newlines from public key', () => {
      const publicKeyWithNewlines = 'MIIB\nIjAN\nBgkq\nhkiG\n9w0B';
      const recordValue = buildDKIMRecordValue(publicKeyWithNewlines);

      expect(recordValue).toBe('v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0B');
    });
  });

  describe('splitDKIMRecordValue', () => {
    it('should not split short records', () => {
      const shortRecord = 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
      const split = splitDKIMRecordValue(shortRecord);

      expect(split).toHaveLength(1);
      expect(split[0]).toBe(shortRecord);
    });

    it('should split long records into 255-char chunks', () => {
      const longRecord = 'v=DKIM1; k=rsa; p=' + 'x'.repeat(300);
      const split = splitDKIMRecordValue(longRecord);

      expect(split.length).toBeGreaterThan(1);
      expect(split[0].length).toBeLessThanOrEqual(255);
      expect(split[1].length).toBeLessThanOrEqual(255);

      // Verify recombining produces original
      const recombined = split.join('');
      expect(recombined).toBe(longRecord);
    });

    it('should handle exactly 255 characters', () => {
      const exactRecord = 'x'.repeat(255);
      const split = splitDKIMRecordValue(exactRecord);

      expect(split).toHaveLength(1);
      expect(split[0]).toBe(exactRecord);
    });

    it('should handle 256 characters (split into 2)', () => {
      const record256 = 'x'.repeat(256);
      const split = splitDKIMRecordValue(record256);

      expect(split).toHaveLength(2);
      expect(split[0]).toHaveLength(255);
      expect(split[1]).toHaveLength(1);
    });

    it('should handle very long records (500+ chars)', () => {
      const veryLongRecord = 'v=DKIM1; k=rsa; p=' + 'x'.repeat(500);
      const split = splitDKIMRecordValue(veryLongRecord);

      expect(split.length).toBeGreaterThanOrEqual(3);
      split.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(255);
      });
    });
  });

  describe('formatSplitDKIMForDNS', () => {
    it('should format split values with quotes', () => {
      const splitValues = ['v=DKIM1; k=rsa; p=MIIB', 'IjANBgkqhkiG9w0B', 'AQEFAAOCAQ8A'];
      const formatted = formatSplitDKIMForDNS(splitValues);

      expect(formatted).toBe('"v=DKIM1; k=rsa; p=MIIB" "IjANBgkqhkiG9w0B" "AQEFAAOCAQ8A"');
    });

    it('should handle single value', () => {
      const splitValues = ['v=DKIM1; k=rsa; p=short'];
      const formatted = formatSplitDKIMForDNS(splitValues);

      expect(formatted).toBe('"v=DKIM1; k=rsa; p=short"');
    });

    it('should handle empty array', () => {
      const formatted = formatSplitDKIMForDNS([]);
      expect(formatted).toBe('');
    });
  });

  describe('validateDKIMRecord', () => {
    it('should validate correct DKIM record', () => {
      const validRecord = 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
      const result = validateDKIMRecord(validRecord);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing version tag', () => {
      const invalidRecord = 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
      const result = validateDKIMRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('version tag'))).toBe(true);
    });

    it('should detect missing key type tag', () => {
      const invalidRecord = 'v=DKIM1; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';
      const result = validateDKIMRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('key type tag'))).toBe(true);
    });

    it('should detect missing public key tag', () => {
      const invalidRecord = 'v=DKIM1; k=rsa;';
      const result = validateDKIMRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('public key tag'))).toBe(true);
    });

    it('should detect empty public key value', () => {
      const invalidRecord = 'v=DKIM1; k=rsa; p=';
      const result = validateDKIMRecord(invalidRecord);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });

    it('should warn about very long records', () => {
      const longRecord = 'v=DKIM1; k=rsa; p=' + 'x'.repeat(600);
      const result = validateDKIMRecord(longRecord);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('very long');
    });

    it('should accept ed25519 keys', () => {
      const ed25519Record = 'v=DKIM1; k=ed25519; p=base64key';
      const result = validateDKIMRecord(ed25519Record);

      expect(result.isValid).toBe(true);
    });
  });

  describe('createDKIMDNSRecord', () => {
    it('should create DNS record object for Cloudflare', async () => {
      const dkimResult = await generateGoogleWorkspaceDKIM('example.com', shortPublicKey);
      const dnsRecord = createDKIMDNSRecord(dkimResult);

      expect(dnsRecord.name).toBe('google._domainkey');
      expect(dnsRecord.type).toBe('TXT');
      expect(dnsRecord.content).toContain('v=DKIM1');
      expect(dnsRecord.ttl).toBe(3600);
    });

    it('should use custom TTL', async () => {
      const dkimResult = await generateGoogleWorkspaceDKIM('example.com', shortPublicKey);
      const dnsRecord = createDKIMDNSRecord(dkimResult, 7200);

      expect(dnsRecord.ttl).toBe(7200);
    });

    it('should format split values for Cloudflare', async () => {
      const dkimResult = await generateGoogleWorkspaceDKIM('example.com', longPublicKey);
      const dnsRecord = createDKIMDNSRecord(dkimResult);

      expect(dnsRecord.content).toContain('"');
      expect(dnsRecord.content.split('"').length).toBeGreaterThan(2);
    });
  });

  describe('getRecommendedDKIMSelector', () => {
    it('should return "google" for Google Workspace', () => {
      const selector = getRecommendedDKIMSelector('google_workspace');
      expect(selector).toBe('google');
    });

    it('should return "selector1" for Microsoft 365', () => {
      const selector = getRecommendedDKIMSelector('microsoft365');
      expect(selector).toBe('selector1');
    });

    it('should return "default" for custom', () => {
      const selector = getRecommendedDKIMSelector('custom');
      expect(selector).toBe('default');
    });
  });

  describe('getGoogleWorkspaceDKIMInstructions', () => {
    it('should return setup instructions', () => {
      const instructions = getGoogleWorkspaceDKIMInstructions('example.com');

      expect(instructions).toBeInstanceOf(Array);
      expect(instructions.length).toBeGreaterThan(5);
      expect(instructions.some(i => i.includes('admin.google.com'))).toBe(true);
      expect(instructions.some(i => i.includes('example.com'))).toBe(true);
      expect(instructions.some(i => i.includes('2048 bits'))).toBe(true);
    });
  });

  describe('Integration: Full DKIM workflow', () => {
    it('should handle complete DKIM generation for Google Workspace', async () => {
      const domain = 'example.com';
      const publicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + 'x'.repeat(200);

      // Step 1: Generate DKIM record
      const dkimResult = await generateGoogleWorkspaceDKIM(domain, publicKey);

      expect(dkimResult.success).toBe(true);
      expect(dkimResult.requiresSplitting).toBe(true);

      // Step 2: Validate generated record
      const validation = validateDKIMRecord(dkimResult.recordValue);
      expect(validation.isValid).toBe(true);

      // Step 3: Create DNS record for Cloudflare
      const dnsRecord = createDKIMDNSRecord(dkimResult);

      expect(dnsRecord.name).toBe('google._domainkey');
      expect(dnsRecord.type).toBe('TXT');
      expect(dnsRecord.content).toContain('v=DKIM1');

      // Step 4: Verify split values are correct
      if (dkimResult.splitValues) {
        const formatted = formatSplitDKIMForDNS(dkimResult.splitValues);
        expect(formatted).toContain('"');

        // Each chunk should be ≤ 255 chars
        dkimResult.splitValues.forEach(chunk => {
          expect(chunk.length).toBeLessThanOrEqual(255);
        });
      }
    });

    it('should handle short keys without splitting', async () => {
      const domain = 'test.com';
      const publicKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC';

      const dkimResult = await generateGoogleWorkspaceDKIM(domain, publicKey);

      expect(dkimResult.success).toBe(true);
      expect(dkimResult.requiresSplitting).toBe(false);
      expect(dkimResult.splitValues).toBeUndefined();

      const dnsRecord = createDKIMDNSRecord(dkimResult);
      expect(dnsRecord.content).not.toContain('"');
    });
  });
});
