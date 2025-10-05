/**
 * MX Generator Tests (Task 3.7)
 *
 * Tests for MX record generation for Google Workspace
 */

import { describe, it, expect } from 'vitest';
import {
  generateGoogleWorkspaceMXRecord,
  createMXDNSRecord,
  createMXDNSRecords,
  validateDomain,
  validateMXConfiguration,
  getGoogleWorkspaceMXRecord,
  getGoogleWorkspaceMXInstructions,
  isGoogleWorkspaceMXRecord,
} from '../mx-generator';
import type { MXRecord } from '@/lib/types/dns';

describe('MX Generator', () => {
  describe('generateGoogleWorkspaceMXRecord', () => {
    it('should generate valid MX record for Google Workspace', async () => {
      const result = await generateGoogleWorkspaceMXRecord('example.com');

      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(result.recordType).toBe('MX');
      expect(result.records).toHaveLength(1);
      expect(result.records[0].priority).toBe(1);
      expect(result.records[0].exchange).toBe('smtp.google.com');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0); // Should have DNS propagation warning
    });

    it('should normalize domain to lowercase', async () => {
      const result = await generateGoogleWorkspaceMXRecord('EXAMPLE.COM');

      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
    });

    it('should handle subdomain correctly', async () => {
      const result = await generateGoogleWorkspaceMXRecord('mail.example.com');

      expect(result.success).toBe(true);
      expect(result.domain).toBe('mail.example.com');
      expect(result.records[0].exchange).toBe('smtp.google.com');
    });

    it('should reject invalid domain format', async () => {
      const result = await generateGoogleWorkspaceMXRecord('invalid domain!');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('invalid characters');
    });

    it('should reject empty domain', async () => {
      const result = await generateGoogleWorkspaceMXRecord('');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Domain is required');
    });

    it('should reject domain with special characters', async () => {
      const result = await generateGoogleWorkspaceMXRecord('test@example.com');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include generatedAt timestamp', async () => {
      const before = new Date();
      const result = await generateGoogleWorkspaceMXRecord('example.com');
      const after = new Date();

      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include DNS propagation warning', async () => {
      const result = await generateGoogleWorkspaceMXRecord('example.com');

      expect(result.warnings.some(w => w.includes('72 hours'))).toBe(true);
      expect(result.warnings.some(w => w.includes('old MX records'))).toBe(true);
    });
  });

  describe('createMXDNSRecord', () => {
    it('should create valid DNS record for Cloudflare', () => {
      const mxRecord: MXRecord = {
        priority: 1,
        exchange: 'smtp.google.com',
      };

      const dnsRecord = createMXDNSRecord(mxRecord);

      expect(dnsRecord.name).toBe('@');
      expect(dnsRecord.type).toBe('MX');
      expect(dnsRecord.priority).toBe(1);
      expect(dnsRecord.content).toBe('smtp.google.com');
      expect(dnsRecord.ttl).toBe(3600);
    });

    it('should use custom TTL when provided', () => {
      const mxRecord: MXRecord = {
        priority: 1,
        exchange: 'smtp.google.com',
      };

      const dnsRecord = createMXDNSRecord(mxRecord, 7200);

      expect(dnsRecord.ttl).toBe(7200);
    });

    it('should handle different priority values', () => {
      const mxRecord: MXRecord = {
        priority: 10,
        exchange: 'alt.mail.example.com',
      };

      const dnsRecord = createMXDNSRecord(mxRecord);

      expect(dnsRecord.priority).toBe(10);
      expect(dnsRecord.content).toBe('alt.mail.example.com');
    });
  });

  describe('createMXDNSRecords', () => {
    it('should create multiple DNS records', () => {
      const mxRecords: MXRecord[] = [
        { priority: 1, exchange: 'smtp.google.com' },
        { priority: 5, exchange: 'alt1.smtp.google.com' },
        { priority: 5, exchange: 'alt2.smtp.google.com' },
      ];

      const dnsRecords = createMXDNSRecords(mxRecords);

      expect(dnsRecords).toHaveLength(3);
      expect(dnsRecords[0].priority).toBe(1);
      expect(dnsRecords[1].priority).toBe(5);
      expect(dnsRecords[2].priority).toBe(5);
    });

    it('should apply same TTL to all records', () => {
      const mxRecords: MXRecord[] = [
        { priority: 1, exchange: 'smtp.google.com' },
        { priority: 5, exchange: 'alt1.smtp.google.com' },
      ];

      const dnsRecords = createMXDNSRecords(mxRecords, 1800);

      expect(dnsRecords.every(r => r.ttl === 1800)).toBe(true);
    });

    it('should handle empty array', () => {
      const dnsRecords = createMXDNSRecords([]);

      expect(dnsRecords).toHaveLength(0);
    });
  });

  describe('validateDomain', () => {
    it('should validate correct domain formats', () => {
      const validDomains = [
        'example.com',
        'subdomain.example.com',
        'deep.sub.example.com',
        'test-domain.com',
        'a.b.c.d.example.co.uk',
      ];

      for (const domain of validDomains) {
        const result = validateDomain(domain);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject invalid domain formats', () => {
      const invalidDomains = [
        '',
        ' ',
        'invalid domain',
        'domain@example.com',
        'http://example.com',
        'example..com',
        '.example.com',
        'example.com.',
        '-example.com',
        'example-.com',
      ];

      for (const domain of invalidDomains) {
        const result = validateDomain(domain);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject domains with invalid characters', () => {
      const result = validateDomain('test!domain.com');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
    });

    it('should provide helpful error messages', () => {
      const result = validateDomain('example..com');

      expect(result.errors[0]).toContain('Invalid domain format');
      expect(result.errors[0]).toContain('example.com');
    });
  });

  describe('validateMXConfiguration', () => {
    it('should validate correct MX configuration', () => {
      const records: MXRecord[] = [
        { priority: 1, exchange: 'smtp.google.com' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept multiple MX records', () => {
      const records: MXRecord[] = [
        { priority: 1, exchange: 'smtp.google.com' },
        { priority: 5, exchange: 'alt1.smtp.google.com' },
        { priority: 10, exchange: 'alt2.smtp.google.com' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty records array', () => {
      const result = validateMXConfiguration([]);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('At least one MX record'))).toBe(true);
    });

    it('should reject invalid priority values', () => {
      const records: MXRecord[] = [
        { priority: -1, exchange: 'smtp.google.com' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid MX priority'))).toBe(true);
    });

    it('should reject priority above 65535', () => {
      const records: MXRecord[] = [
        { priority: 70000, exchange: 'smtp.google.com' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid MX priority'))).toBe(true);
    });

    it('should reject empty exchange', () => {
      const records: MXRecord[] = [
        { priority: 1, exchange: '' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('exchange'))).toBe(true);
    });

    it('should reject invalid exchange format', () => {
      const records: MXRecord[] = [
        { priority: 1, exchange: 'invalid exchange!' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid MX exchange'))).toBe(true);
    });

    it('should warn about duplicate priorities', () => {
      const records: MXRecord[] = [
        { priority: 5, exchange: 'alt1.smtp.google.com' },
        { priority: 5, exchange: 'alt2.smtp.google.com' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('same priority'))).toBe(true);
    });

    it('should accept priority 0', () => {
      const records: MXRecord[] = [
        { priority: 0, exchange: 'smtp.google.com' },
      ];

      const result = validateMXConfiguration(records);

      expect(result.isValid).toBe(true);
    });
  });

  describe('getGoogleWorkspaceMXRecord', () => {
    it('should return correct Google Workspace MX record', () => {
      const record = getGoogleWorkspaceMXRecord();

      expect(record.priority).toBe(1);
      expect(record.exchange).toBe('smtp.google.com');
    });

    it('should return a new object (not reference)', () => {
      const record1 = getGoogleWorkspaceMXRecord();
      const record2 = getGoogleWorkspaceMXRecord();

      expect(record1).toEqual(record2);
      expect(record1).not.toBe(record2); // Different object instances
    });
  });

  describe('getGoogleWorkspaceMXInstructions', () => {
    it('should return setup instructions', () => {
      const instructions = getGoogleWorkspaceMXInstructions('example.com');

      expect(instructions.domain).toBe('example.com');
      expect(instructions.record.priority).toBe(1);
      expect(instructions.record.exchange).toBe('smtp.google.com');
      expect(instructions.instructions).toBeInstanceOf(Array);
      expect(instructions.instructions.length).toBeGreaterThan(0);
      expect(instructions.notes).toBeInstanceOf(Array);
      expect(instructions.notes.length).toBeGreaterThan(0);
    });

    it('should include priority and mail server in instructions', () => {
      const instructions = getGoogleWorkspaceMXInstructions('example.com');

      const instructionText = instructions.instructions.join(' ');
      expect(instructionText).toContain('Priority: 1');
      expect(instructionText).toContain('smtp.google.com');
    });

    it('should include DNS propagation time in instructions', () => {
      const instructions = getGoogleWorkspaceMXInstructions('example.com');

      const instructionText = instructions.instructions.join(' ');
      expect(instructionText).toContain('72 hours');
    });

    it('should include verification step', () => {
      const instructions = getGoogleWorkspaceMXInstructions('example.com');

      const instructionText = instructions.instructions.join(' ');
      expect(instructionText).toContain('dig MX example.com');
    });

    it('should include notes about modern configuration', () => {
      const instructions = getGoogleWorkspaceMXInstructions('example.com');

      const notesText = instructions.notes.join(' ');
      expect(notesText).toContain('2023');
      expect(notesText).toContain('one MX record');
    });

    it('should include notes about legacy configuration', () => {
      const instructions = getGoogleWorkspaceMXInstructions('example.com');

      const notesText = instructions.notes.join(' ');
      expect(notesText).toContain('aspmx.l.google.com');
      expect(notesText).toContain('5 MX records');
    });
  });

  describe('isGoogleWorkspaceMXRecord', () => {
    it('should recognize modern Google Workspace MX record', () => {
      const record: MXRecord = {
        priority: 1,
        exchange: 'smtp.google.com',
      };

      expect(isGoogleWorkspaceMXRecord(record)).toBe(true);
    });

    it('should recognize legacy Google Workspace MX records', () => {
      const legacyRecords: MXRecord[] = [
        { priority: 1, exchange: 'aspmx.l.google.com' },
        { priority: 5, exchange: 'alt1.aspmx.l.google.com' },
        { priority: 5, exchange: 'alt2.aspmx.l.google.com' },
        { priority: 10, exchange: 'alt3.aspmx.l.google.com' },
        { priority: 10, exchange: 'alt4.aspmx.l.google.com' },
      ];

      for (const record of legacyRecords) {
        expect(isGoogleWorkspaceMXRecord(record)).toBe(true);
      }
    });

    it('should handle uppercase domain', () => {
      const record: MXRecord = {
        priority: 1,
        exchange: 'SMTP.GOOGLE.COM',
      };

      expect(isGoogleWorkspaceMXRecord(record)).toBe(true);
    });

    it('should reject non-Google MX records', () => {
      const nonGoogleRecords: MXRecord[] = [
        { priority: 1, exchange: 'mail.example.com' },
        { priority: 10, exchange: 'mx.outlook.com' },
        { priority: 5, exchange: 'aspmx.l.yahoo.com' },
      ];

      for (const record of nonGoogleRecords) {
        expect(isGoogleWorkspaceMXRecord(record)).toBe(false);
      }
    });

    it('should recognize any google.com subdomain', () => {
      const record: MXRecord = {
        priority: 5,
        exchange: 'custom.google.com',
      };

      expect(isGoogleWorkspaceMXRecord(record)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should generate and convert to DNS records in one flow', async () => {
      const result = await generateGoogleWorkspaceMXRecord('example.com');
      expect(result.success).toBe(true);

      const dnsRecords = createMXDNSRecords(result.records);
      expect(dnsRecords).toHaveLength(1);
      expect(dnsRecords[0].name).toBe('@');
      expect(dnsRecords[0].type).toBe('MX');
      expect(dnsRecords[0].priority).toBe(1);
      expect(dnsRecords[0].content).toBe('smtp.google.com');
    });

    it('should validate generated records', async () => {
      const result = await generateGoogleWorkspaceMXRecord('example.com');
      expect(result.success).toBe(true);

      const validation = validateMXConfiguration(result.records);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should recognize generated records as Google Workspace', async () => {
      const result = await generateGoogleWorkspaceMXRecord('example.com');
      expect(result.success).toBe(true);

      for (const record of result.records) {
        expect(isGoogleWorkspaceMXRecord(record)).toBe(true);
      }
    });
  });
});
