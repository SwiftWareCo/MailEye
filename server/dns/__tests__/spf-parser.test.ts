/**
 * SPF Parser Unit Tests (Task 3.1)
 *
 * Tests for SPF record parsing, validation, and mechanism extraction
 */

import { describe, it, expect } from 'vitest';
import {
  parseSPFRecord,
  parseMechanism,
  extractIncludes,
  extractIPMechanisms,
  validateSPFSyntax,
  getSPFQualifier,
  triggersLookup,
  countDNSLookups,
} from '../spf-parser';

describe('SPF Parser', () => {
  describe('parseSPFRecord', () => {
    it('should parse basic Google Workspace SPF record', () => {
      const spf = 'v=spf1 include:_spf.google.com ~all';
      const result = parseSPFRecord('example.com', spf);

      expect(result.version).toBe('spf1');
      expect(result.includes).toEqual(['_spf.google.com']);
      expect(result.hasAll).toBe(true);
      expect(result.allQualifier).toBe('~');
      expect(result.mechanisms).toHaveLength(2);
    });

    it('should parse SPF with multiple includes', () => {
      const spf = 'v=spf1 include:_spf.google.com include:sendgrid.net include:smartlead.ai ~all';
      const result = parseSPFRecord('example.com', spf);

      expect(result.includes).toEqual([
        '_spf.google.com',
        'sendgrid.net',
        'smartlead.ai',
      ]);
      expect(result.mechanisms).toHaveLength(4); // 3 includes + ~all
    });

    it('should parse SPF with IP addresses', () => {
      const spf = 'v=spf1 ip4:192.168.1.1 ip4:10.0.0.0/24 ip6:2001:db8::/32 ~all';
      const result = parseSPFRecord('example.com', spf);

      expect(result.ipv4Addresses).toEqual(['192.168.1.1', '10.0.0.0/24']);
      expect(result.ipv6Addresses).toEqual(['2001:db8::/32']);
      expect(result.includes).toEqual([]);
    });

    it('should parse complex SPF with mixed mechanisms', () => {
      const spf = 'v=spf1 include:_spf.google.com ip4:192.168.1.1 a mx include:sendgrid.net ~all';
      const result = parseSPFRecord('example.com', spf);

      expect(result.includes).toEqual(['_spf.google.com', 'sendgrid.net']);
      expect(result.ipv4Addresses).toEqual(['192.168.1.1']);
      expect(result.mechanisms.some(m => m.type === 'a')).toBe(true);
      expect(result.mechanisms.some(m => m.type === 'mx')).toBe(true);
    });

    it('should handle SPF with -all (fail)', () => {
      const spf = 'v=spf1 include:_spf.google.com -all';
      const result = parseSPFRecord('example.com', spf);

      expect(result.allQualifier).toBe('-');
      expect(result.hasAll).toBe(true);
    });

    it('should handle SPF with +all (pass all - not recommended)', () => {
      const spf = 'v=spf1 include:_spf.google.com +all';
      const result = parseSPFRecord('example.com', spf);

      expect(result.allQualifier).toBe('+');
    });

    it('should throw error on invalid SPF (missing v=spf1)', () => {
      const invalidSpf = 'include:_spf.google.com ~all';

      expect(() => parseSPFRecord('example.com', invalidSpf)).toThrow(
        'Invalid SPF record for example.com: must start with "v=spf1"'
      );
    });

    it('should handle whitespace in SPF record', () => {
      const spf = '  v=spf1   include:_spf.google.com   ~all  ';
      const result = parseSPFRecord('example.com', spf);

      expect(result.includes).toEqual(['_spf.google.com']);
    });
  });

  describe('parseMechanism', () => {
    it('should parse include mechanism', () => {
      const result = parseMechanism('include:_spf.google.com');

      expect(result.type).toBe('include');
      expect(result.qualifier).toBe('+');
      expect(result.value).toBe('_spf.google.com');
      expect(result.raw).toBe('include:_spf.google.com');
    });

    it('should parse include with negative qualifier', () => {
      const result = parseMechanism('-include:spammers.com');

      expect(result.type).toBe('include');
      expect(result.qualifier).toBe('-');
      expect(result.value).toBe('spammers.com');
    });

    it('should parse ip4 mechanism', () => {
      const result = parseMechanism('ip4:192.168.1.1/24');

      expect(result.type).toBe('ip4');
      expect(result.value).toBe('192.168.1.1/24');
    });

    it('should parse ip6 mechanism', () => {
      const result = parseMechanism('ip6:2001:db8::/32');

      expect(result.type).toBe('ip6');
      expect(result.value).toBe('2001:db8::/32');
    });

    it('should parse "all" mechanism with softfail qualifier', () => {
      const result = parseMechanism('~all');

      expect(result.type).toBe('all');
      expect(result.qualifier).toBe('~');
      expect(result.value).toBeUndefined();
    });

    it('should parse simple "a" mechanism', () => {
      const result = parseMechanism('a');

      expect(result.type).toBe('a');
      expect(result.qualifier).toBe('+');
      expect(result.value).toBeUndefined();
    });

    it('should parse "mx" mechanism with domain', () => {
      const result = parseMechanism('mx:mail.example.com');

      expect(result.type).toBe('mx');
      expect(result.value).toBe('mail.example.com');
    });

    it('should parse mechanism with all qualifier types', () => {
      expect(parseMechanism('+include:allow.com').qualifier).toBe('+');
      expect(parseMechanism('-include:deny.com').qualifier).toBe('-');
      expect(parseMechanism('~include:softfail.com').qualifier).toBe('~');
      expect(parseMechanism('?include:neutral.com').qualifier).toBe('?');
    });
  });

  describe('extractIncludes', () => {
    it('should extract all includes from SPF record', () => {
      const spf = 'v=spf1 include:_spf.google.com include:sendgrid.net include:smartlead.ai ~all';
      const includes = extractIncludes(spf);

      expect(includes).toEqual([
        '_spf.google.com',
        'sendgrid.net',
        'smartlead.ai',
      ]);
    });

    it('should extract includes with different qualifiers', () => {
      const spf = 'v=spf1 +include:allow.com -include:deny.com ~include:softfail.com ~all';
      const includes = extractIncludes(spf);

      expect(includes).toEqual(['allow.com', 'deny.com', 'softfail.com']);
    });

    it('should return empty array when no includes present', () => {
      const spf = 'v=spf1 ip4:192.168.1.1 ~all';
      const includes = extractIncludes(spf);

      expect(includes).toEqual([]);
    });

    it('should handle includes with underscores and hyphens', () => {
      const spf = 'v=spf1 include:_spf.google.com include:mail-server.example.com ~all';
      const includes = extractIncludes(spf);

      expect(includes).toEqual(['_spf.google.com', 'mail-server.example.com']);
    });
  });

  describe('extractIPMechanisms', () => {
    it('should extract IPv4 addresses', () => {
      const spf = 'v=spf1 ip4:192.168.1.1 ip4:10.0.0.0/24 ~all';
      const result = extractIPMechanisms(spf);

      expect(result.ipv4).toEqual(['192.168.1.1', '10.0.0.0/24']);
      expect(result.ipv6).toEqual([]);
    });

    it('should extract IPv6 addresses', () => {
      const spf = 'v=spf1 ip6:2001:db8::/32 ip6:fe80::/10 ~all';
      const result = extractIPMechanisms(spf);

      expect(result.ipv4).toEqual([]);
      expect(result.ipv6).toEqual(['2001:db8::/32', 'fe80::/10']);
    });

    it('should extract both IPv4 and IPv6', () => {
      const spf = 'v=spf1 ip4:192.168.1.1 ip6:2001:db8::/32 ~all';
      const result = extractIPMechanisms(spf);

      expect(result.ipv4).toEqual(['192.168.1.1']);
      expect(result.ipv6).toEqual(['2001:db8::/32']);
    });

    it('should handle IP mechanisms with qualifiers', () => {
      const spf = 'v=spf1 +ip4:192.168.1.1 -ip6:2001:db8::/32 ~all';
      const result = extractIPMechanisms(spf);

      expect(result.ipv4).toEqual(['192.168.1.1']);
      expect(result.ipv6).toEqual(['2001:db8::/32']);
    });
  });

  describe('validateSPFSyntax', () => {
    it('should validate correct SPF record', () => {
      const spf = 'v=spf1 include:_spf.google.com ~all';
      const result = validateSPFSyntax(spf);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.lookupCount).toBe(1);
      expect(result.exceedsLookupLimit).toBe(false);
    });

    it('should detect missing v=spf1', () => {
      const spf = 'include:_spf.google.com ~all';
      const result = validateSPFSyntax(spf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SPF record must start with "v=spf1"');
    });

    it('should detect exceeding 10 DNS lookup limit', () => {
      const spf = 'v=spf1 ' +
        'include:spf1.com include:spf2.com include:spf3.com include:spf4.com ' +
        'include:spf5.com include:spf6.com include:spf7.com include:spf8.com ' +
        'include:spf9.com include:spf10.com include:spf11.com ~all';
      const result = validateSPFSyntax(spf);

      expect(result.isValid).toBe(false);
      expect(result.lookupCount).toBe(11);
      expect(result.exceedsLookupLimit).toBe(true);
      expect(result.errors.some(e => e.includes('10 DNS lookup limit'))).toBe(true);
    });

    it('should warn when approaching 10 lookup limit', () => {
      const spf = 'v=spf1 include:spf1.com include:spf2.com include:spf3.com ' +
        'include:spf4.com include:spf5.com include:spf6.com include:spf7.com ' +
        'include:spf8.com ~all';
      const result = validateSPFSyntax(spf);

      expect(result.isValid).toBe(true);
      expect(result.lookupCount).toBe(8);
      expect(result.warnings.some(w => w.includes('approaching 10 limit'))).toBe(true);
    });

    it('should detect 512 character limit exceeded', () => {
      const longSpf = 'v=spf1 ' + 'include:very-long-domain-name-that-exceeds-limits.com '.repeat(15) + '~all';
      const result = validateSPFSyntax(longSpf);

      expect(result.exceedsCharLimit).toBe(true);
      expect(result.characterCount).toBeGreaterThan(512);
      expect(result.errors.some(e => e.includes('512 character limit'))).toBe(true);
    });

    it('should warn when missing "all" mechanism', () => {
      const spf = 'v=spf1 include:_spf.google.com';
      const result = validateSPFSyntax(spf);

      expect(result.warnings.some(w => w.includes('"all" mechanism'))).toBe(true);
    });

    it('should warn about deprecated "ptr" mechanism', () => {
      const spf = 'v=spf1 ptr:example.com ~all';
      const result = validateSPFSyntax(spf);

      expect(result.warnings.some(w => w.includes('ptr'))).toBe(true);
    });

    it('should count a, mx, exists as DNS lookups', () => {
      const spf = 'v=spf1 a mx exists:verify.example.com ~all';
      const result = validateSPFSyntax(spf);

      expect(result.lookupCount).toBe(3); // a + mx + exists
    });

    it('should NOT count ip4, ip6, all as DNS lookups', () => {
      const spf = 'v=spf1 ip4:192.168.1.1 ip6:2001:db8::/32 ~all';
      const result = validateSPFSyntax(spf);

      expect(result.lookupCount).toBe(0); // No DNS lookups
    });
  });

  describe('getSPFQualifier', () => {
    it('should extract all qualifier types', () => {
      expect(getSPFQualifier('+include:allow.com')).toBe('+');
      expect(getSPFQualifier('-include:deny.com')).toBe('-');
      expect(getSPFQualifier('~include:softfail.com')).toBe('~');
      expect(getSPFQualifier('?include:neutral.com')).toBe('?');
    });

    it('should return + as default qualifier', () => {
      expect(getSPFQualifier('include:example.com')).toBe('+');
      expect(getSPFQualifier('a')).toBe('+');
      expect(getSPFQualifier('mx')).toBe('+');
    });
  });

  describe('triggersLookup', () => {
    it('should return true for mechanisms that trigger DNS lookup', () => {
      expect(triggersLookup('include')).toBe(true);
      expect(triggersLookup('a')).toBe(true);
      expect(triggersLookup('mx')).toBe(true);
      expect(triggersLookup('exists')).toBe(true);
      expect(triggersLookup('ptr')).toBe(true);
    });

    it('should return false for mechanisms that do NOT trigger DNS lookup', () => {
      expect(triggersLookup('ip4')).toBe(false);
      expect(triggersLookup('ip6')).toBe(false);
      expect(triggersLookup('all')).toBe(false);
    });
  });

  describe('countDNSLookups', () => {
    it('should count DNS lookups correctly', () => {
      const spf1 = 'v=spf1 include:_spf.google.com ~all';
      expect(countDNSLookups(spf1)).toBe(1);

      const spf2 = 'v=spf1 include:spf1.com include:spf2.com a mx ~all';
      expect(countDNSLookups(spf2)).toBe(4); // 2 includes + a + mx

      const spf3 = 'v=spf1 ip4:192.168.1.1 ip6:2001:db8::/32 ~all';
      expect(countDNSLookups(spf3)).toBe(0); // No lookups
    });
  });

  describe('Real-World SPF Records', () => {
    it('should parse Google Workspace SPF', () => {
      const spf = 'v=spf1 include:_spf.google.com ~all';
      const result = parseSPFRecord('example.com', spf);
      const validation = validateSPFSyntax(spf);

      expect(result.includes).toEqual(['_spf.google.com']);
      expect(validation.isValid).toBe(true);
      expect(validation.lookupCount).toBe(1);
    });

    it('should parse Smartlead + Google Workspace SPF', () => {
      const spf = 'v=spf1 include:_spf.google.com include:smartlead.ai ~all';
      const result = parseSPFRecord('example.com', spf);
      const validation = validateSPFSyntax(spf);

      expect(result.includes).toContain('_spf.google.com');
      expect(result.includes).toContain('smartlead.ai');
      expect(validation.lookupCount).toBe(2);
    });

    it('should detect problematic SPF with too many includes', () => {
      // Real-world example: company using many email services
      const spf = 'v=spf1 ' +
        'include:_spf.google.com ' +        // Google Workspace
        'include:sendgrid.net ' +           // SendGrid
        'include:servers.mcsv.net ' +       // Mailchimp
        'include:spf.protection.outlook.com ' + // Office 365
        'include:_spf.salesforce.com ' +    // Salesforce
        'include:mktomail.com ' +           // Marketo
        'include:smartlead.ai ' +           // Smartlead
        'include:_spf.atlassian.net ' +     // Jira/Confluence
        'include:mail.zendesk.com ' +       // Zendesk
        'include:amazonses.com ' +          // Amazon SES
        'include:_spf.hubspot.com ' +       // HubSpot
        '~all';

      const validation = validateSPFSyntax(spf);

      expect(validation.lookupCount).toBe(11);
      expect(validation.exceedsLookupLimit).toBe(true);
      expect(validation.errors.some(e => e.includes('SPF flattening required'))).toBe(true);
    });
  });
});
