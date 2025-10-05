/**
 * DMARC Record Generation Unit Tests (Task 3.6)
 *
 * Tests for DMARC record generation, policy validation, and progression rules
 */

import { describe, it, expect } from 'vitest';
import {
  generateDMARCRecord,
  buildDMARCRecordValue,
  validatePolicyProgression,
  getRecommendedDMARCPolicy,
  parseDMARCRecord,
  validateDMARCRecord,
  createDMARCDNSRecord,
  getDMARCSetupInstructions,
} from '../dmarc-generator';
import type { DMARCPolicy, DMARCGenerationConfig } from '@/lib/types/dns';

describe('DMARC Record Generation', () => {
  describe('generateDMARCRecord - Basic Generation', () => {
    it('should generate basic DMARC record with policy "none"', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(result.recordName).toBe('_dmarc.example.com');
      expect(result.recordType).toBe('TXT');
      expect(result.policy).toBe('none');
      expect(result.recordValue).toContain('v=DMARC1');
      expect(result.recordValue).toContain('p=none');
      expect(result.errors).toHaveLength(0);
    });

    it('should generate DMARC record with policy "quarantine"', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.policy).toBe('quarantine');
      expect(result.recordValue).toContain('p=quarantine');
    });

    it('should generate DMARC record with policy "reject"', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'reject',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.policy).toBe('reject');
      expect(result.recordValue).toContain('p=reject');
    });

    it('should generate DMARC record with aggregate report email', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
        aggregateReportEmail: 'dmarc@example.com',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.aggregateReportEmail).toBe('dmarc@example.com');
      expect(result.recordValue).toContain('rua=mailto:dmarc@example.com');
    });

    it('should generate DMARC record with forensic report email', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        forensicReportEmail: 'dmarc-forensic@example.com',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.forensicReportEmail).toBe('dmarc-forensic@example.com');
      expect(result.recordValue).toContain('ruf=mailto:dmarc-forensic@example.com');
    });

    it('should generate DMARC record with both aggregate and forensic emails', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
        aggregateReportEmail: 'dmarc@example.com',
        forensicReportEmail: 'dmarc-forensic@example.com',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.recordValue).toContain('rua=mailto:dmarc@example.com');
      expect(result.recordValue).toContain('ruf=mailto:dmarc-forensic@example.com');
    });
  });

  describe('generateDMARCRecord - Advanced Configuration', () => {
    it('should generate DMARC record with subdomain policy', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        subdomainPolicy: 'reject',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.subdomainPolicy).toBe('reject');
      expect(result.recordValue).toContain('sp=reject');
    });

    it('should generate DMARC record with percentage', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        percentage: 50,
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.percentage).toBe(50);
      expect(result.recordValue).toContain('pct=50');
    });

    it('should not include percentage tag when set to 100 (default)', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
        percentage: 100,
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.percentage).toBe(100);
      expect(result.recordValue).not.toContain('pct=');
    });

    it('should generate DMARC record with strict SPF alignment', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        spfAlignment: 's',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.spfAlignment).toBe('s');
      expect(result.recordValue).toContain('aspf=s');
    });

    it('should generate DMARC record with strict DKIM alignment', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        dkimAlignment: 's',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.dkimAlignment).toBe('s');
      expect(result.recordValue).toContain('adkim=s');
    });

    it('should not include alignment tags when relaxed (default)', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
        spfAlignment: 'r',
        dkimAlignment: 'r',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.spfAlignment).toBe('r');
      expect(result.dkimAlignment).toBe('r');
      expect(result.recordValue).not.toContain('aspf=');
      expect(result.recordValue).not.toContain('adkim=');
    });

    it('should generate complete DMARC record with all options', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        subdomainPolicy: 'reject',
        percentage: 75,
        aggregateReportEmail: 'dmarc@example.com',
        forensicReportEmail: 'dmarc-forensic@example.com',
        spfAlignment: 's',
        dkimAlignment: 's',
        reportingInterval: 3600,
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.recordValue).toContain('v=DMARC1');
      expect(result.recordValue).toContain('p=quarantine');
      expect(result.recordValue).toContain('sp=reject');
      expect(result.recordValue).toContain('pct=75');
      expect(result.recordValue).toContain('rua=mailto:dmarc@example.com');
      expect(result.recordValue).toContain('ruf=mailto:dmarc-forensic@example.com');
      expect(result.recordValue).toContain('aspf=s');
      expect(result.recordValue).toContain('adkim=s');
      expect(result.recordValue).toContain('ri=3600');
    });
  });

  describe('generateDMARCRecord - Validation', () => {
    it('should fail with invalid domain', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'invalid domain!',
        policy: 'none',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid domain: invalid domain!');
    });

    it('should fail with invalid policy', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'invalid' as DMARCPolicy,
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid DMARC policy'))).toBe(true);
    });

    it('should fail with invalid percentage (negative)', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
        percentage: -10,
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid percentage'))).toBe(true);
    });

    it('should fail with invalid percentage (over 100)', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
        percentage: 150,
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid percentage'))).toBe(true);
    });

    it('should fail with invalid email format', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
        aggregateReportEmail: 'not-an-email',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid aggregate report email'))).toBe(true);
    });

    it('should warn when no reporting email is provided', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('No aggregate report email'))).toBe(true);
    });

    it('should warn about reject policy with percentage < 100', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'reject',
        percentage: 50,
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('reject') && w.includes('percentage'))).toBe(true);
    });
  });

  describe('validatePolicyProgression', () => {
    it('should allow progression from none to quarantine', () => {
      const progression = validatePolicyProgression('none', 'quarantine');

      expect(progression.isValid).toBe(true);
      expect(progression.isSafe).toBe(true);
      expect(progression.warnings).toHaveLength(0);
    });

    it('should allow progression from none to reject but warn', () => {
      const progression = validatePolicyProgression('none', 'reject');

      expect(progression.isValid).toBe(true);
      expect(progression.isSafe).toBe(false);
      expect(progression.warnings.length).toBeGreaterThan(0);
      expect(progression.warnings.some(w => w.includes('not recommended'))).toBe(true);
    });

    it('should allow progression from quarantine to reject', () => {
      const progression = validatePolicyProgression('quarantine', 'reject');

      expect(progression.isValid).toBe(true);
      expect(progression.isSafe).toBe(true);
    });

    it('should warn about regression from quarantine to none', () => {
      const progression = validatePolicyProgression('quarantine', 'none');

      expect(progression.isValid).toBe(false);
      expect(progression.isSafe).toBe(false);
      expect(progression.warnings.some(w => w.includes('weakens'))).toBe(true);
    });

    it('should warn about regression from reject to quarantine', () => {
      const progression = validatePolicyProgression('reject', 'quarantine');

      expect(progression.isValid).toBe(false);
      expect(progression.isSafe).toBe(false);
      expect(progression.warnings.some(w => w.includes('not recommended'))).toBe(true);
    });

    it('should warn about regression from reject to none', () => {
      const progression = validatePolicyProgression('reject', 'none');

      expect(progression.isValid).toBe(false);
      expect(progression.isSafe).toBe(false);
      expect(progression.warnings.length).toBeGreaterThan(0);
    });

    it('should allow staying at current policy', () => {
      const progressionNone = validatePolicyProgression('none', 'none');
      const progressionQuarantine = validatePolicyProgression('quarantine', 'quarantine');
      const progressionReject = validatePolicyProgression('reject', 'reject');

      expect(progressionNone.isValid).toBe(true);
      expect(progressionQuarantine.isValid).toBe(true);
      expect(progressionReject.isValid).toBe(true);
    });
  });

  describe('getRecommendedDMARCPolicy', () => {
    it('should recommend "none" for domains without SPF or DKIM', () => {
      const recommendation = getRecommendedDMARCPolicy(60, false, false);

      expect(recommendation.policy).toBe('none');
      expect(recommendation.reason).toContain('authentication');
    });

    it('should recommend "none" for new domains (< 30 days)', () => {
      const recommendation = getRecommendedDMARCPolicy(15, true, true);

      expect(recommendation.policy).toBe('none');
      expect(recommendation.percentage).toBe(100);
      expect(recommendation.reason).toContain('New domain');
    });

    it('should recommend "quarantine" for 30-90 day old domains', () => {
      const recommendation = getRecommendedDMARCPolicy(45, true, true);

      expect(recommendation.policy).toBe('quarantine');
      expect(recommendation.reason).toContain('established');
    });

    it('should recommend "reject" for domains 90+ days old', () => {
      const recommendation = getRecommendedDMARCPolicy(120, true, true);

      expect(recommendation.policy).toBe('reject');
      expect(recommendation.reason).toContain('well-established');
    });

    it('should recommend "none" even for old domains without authentication', () => {
      const recommendation = getRecommendedDMARCPolicy(200, false, false);

      expect(recommendation.policy).toBe('none');
      expect(recommendation.reason).toContain('authentication');
    });
  });

  describe('buildDMARCRecordValue', () => {
    it('should build minimal DMARC record', () => {
      const record = buildDMARCRecordValue({
        policy: 'none',
      });

      expect(record).toBe('v=DMARC1; p=none');
    });

    it('should build DMARC record with all tags', () => {
      const record = buildDMARCRecordValue({
        policy: 'quarantine',
        subdomainPolicy: 'reject',
        percentage: 75,
        aggregateReportEmail: 'dmarc@example.com',
        forensicReportEmail: 'forensic@example.com',
        spfAlignment: 's',
        dkimAlignment: 's',
        reportingInterval: 3600,
      });

      expect(record).toContain('v=DMARC1');
      expect(record).toContain('p=quarantine');
      expect(record).toContain('sp=reject');
      expect(record).toContain('pct=75');
      expect(record).toContain('rua=mailto:dmarc@example.com');
      expect(record).toContain('ruf=mailto:forensic@example.com');
      expect(record).toContain('aspf=s');
      expect(record).toContain('adkim=s');
      expect(record).toContain('ri=3600');
    });

    it('should omit optional tags when using defaults', () => {
      const record = buildDMARCRecordValue({
        policy: 'none',
        percentage: 100,
        spfAlignment: 'r',
        dkimAlignment: 'r',
        reportingInterval: 86400,
      });

      expect(record).toBe('v=DMARC1; p=none');
      expect(record).not.toContain('pct=');
      expect(record).not.toContain('aspf=');
      expect(record).not.toContain('adkim=');
      expect(record).not.toContain('ri=');
    });
  });

  describe('parseDMARCRecord', () => {
    it('should parse basic DMARC record', () => {
      const record = 'v=DMARC1; p=none';
      const parsed = parseDMARCRecord(record);

      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe('DMARC1');
      expect(parsed?.policy).toBe('none');
      expect(parsed?.percentage).toBe(100);
      expect(parsed?.spfAlignment).toBe('r');
      expect(parsed?.dkimAlignment).toBe('r');
    });

    it('should parse complete DMARC record', () => {
      const record = 'v=DMARC1; p=quarantine; sp=reject; pct=75; rua=mailto:dmarc@example.com; ruf=mailto:forensic@example.com; aspf=s; adkim=s; ri=3600';
      const parsed = parseDMARCRecord(record);

      expect(parsed).not.toBeNull();
      expect(parsed?.policy).toBe('quarantine');
      expect(parsed?.subdomainPolicy).toBe('reject');
      expect(parsed?.percentage).toBe(75);
      expect(parsed?.aggregateReportEmail).toBe('dmarc@example.com');
      expect(parsed?.forensicReportEmail).toBe('forensic@example.com');
      expect(parsed?.spfAlignment).toBe('s');
      expect(parsed?.dkimAlignment).toBe('s');
      expect(parsed?.reportingInterval).toBe(3600);
    });

    it('should return null for invalid DMARC record (no version)', () => {
      const record = 'p=none';
      const parsed = parseDMARCRecord(record);

      expect(parsed).toBeNull();
    });

    it('should return null for invalid DMARC record (no policy)', () => {
      const record = 'v=DMARC1';
      const parsed = parseDMARCRecord(record);

      expect(parsed).toBeNull();
    });

    it('should handle whitespace in DMARC record', () => {
      const record = '  v=DMARC1  ;  p=none  ;  pct=100  ';
      const parsed = parseDMARCRecord(record);

      expect(parsed).not.toBeNull();
      expect(parsed?.policy).toBe('none');
      expect(parsed?.percentage).toBe(100);
    });
  });

  describe('validateDMARCRecord', () => {
    it('should validate correct DMARC record', () => {
      const record = 'v=DMARC1; p=none; rua=mailto:dmarc@example.com';
      const validation = validateDMARCRecord(record);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation for missing version', () => {
      const record = 'p=none';
      const validation = validateDMARCRecord(record);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('version'))).toBe(true);
    });

    it('should fail validation for missing policy', () => {
      const record = 'v=DMARC1';
      const validation = validateDMARCRecord(record);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('policy'))).toBe(true);
    });

    it('should warn about "none" policy', () => {
      const record = 'v=DMARC1; p=none';
      const validation = validateDMARCRecord(record);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some(w => w.includes('monitoring only'))).toBe(true);
    });

    it('should warn about no reporting emails', () => {
      const record = 'v=DMARC1; p=quarantine';
      const validation = validateDMARCRecord(record);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some(w => w.includes('reporting email'))).toBe(true);
    });

    it('should not warn when reporting email is present', () => {
      const record = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com';
      const validation = validateDMARCRecord(record);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.filter(w => w.includes('reporting email'))).toHaveLength(0);
    });
  });

  describe('createDMARCDNSRecord', () => {
    it('should create Cloudflare DNS record from DMARC result', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        aggregateReportEmail: 'dmarc@example.com',
      };

      const dmarcResult = await generateDMARCRecord(config);
      const dnsRecord = createDMARCDNSRecord(dmarcResult);

      expect(dnsRecord.name).toBe('_dmarc');
      expect(dnsRecord.type).toBe('TXT');
      expect(dnsRecord.content).toBe(dmarcResult.recordValue);
      expect(dnsRecord.ttl).toBe(3600);
    });

    it('should create DNS record with custom TTL', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'none',
      };

      const dmarcResult = await generateDMARCRecord(config);
      const dnsRecord = createDMARCDNSRecord(dmarcResult, 300);

      expect(dnsRecord.ttl).toBe(300);
    });
  });

  describe('getDMARCSetupInstructions', () => {
    it('should provide setup instructions for "none" policy', () => {
      const instructions = getDMARCSetupInstructions('example.com', 'none');

      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.some(i => i.includes('example.com'))).toBe(true);
      expect(instructions.some(i => i.includes('monitoring only'))).toBe(true);
    });

    it('should provide setup instructions for "quarantine" policy', () => {
      const instructions = getDMARCSetupInstructions('example.com', 'quarantine');

      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.some(i => i.includes('quarantine'))).toBe(true);
    });

    it('should provide setup instructions for "reject" policy', () => {
      const instructions = getDMARCSetupInstructions('example.com', 'reject');

      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.some(i => i.includes('reject'))).toBe(true);
      expect(instructions.some(i => i.includes('strongest protection'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long domain names', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'very.long.subdomain.with.many.levels.example.com',
        policy: 'none',
      };

      const result = await generateDMARCRecord(config);

      expect(result.success).toBe(true);
      expect(result.recordName).toBe('_dmarc.very.long.subdomain.with.many.levels.example.com');
    });

    it('should handle edge case percentage values', async () => {
      const config0: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        percentage: 0,
      };

      const config100: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        percentage: 100,
      };

      const result0 = await generateDMARCRecord(config0);
      const result100 = await generateDMARCRecord(config100);

      expect(result0.success).toBe(true);
      expect(result0.recordValue).toContain('pct=0');

      expect(result100.success).toBe(true);
      expect(result100.recordValue).not.toContain('pct='); // 100 is default, omitted
    });

    it('should track character count', async () => {
      const config: DMARCGenerationConfig = {
        domain: 'example.com',
        policy: 'quarantine',
        aggregateReportEmail: 'dmarc-reports@example.com',
      };

      const result = await generateDMARCRecord(config);

      expect(result.characterCount).toBe(result.recordValue.length);
      expect(result.characterCount).toBeGreaterThan(0);
    });
  });
});
