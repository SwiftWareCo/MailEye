/**
 * SPF Record Flattening Unit Tests (Task 3.4)
 *
 * Tests for SPF flattening, character limit validation, and database storage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  flattenSPFRecord,
  storeFlattenedSPF,
  getFlattenedSPF,
  analyzeFlatteningBenefit,
} from '../spf-flattener';
import * as spfIPResolver from '../spf-ip-resolver';
import type { SPFFlatteningConfig } from '@/lib/types/dns';

// Mock SPF IP Resolver
vi.mock('../spf-ip-resolver', () => ({
  resolveAllIPsFromSPF: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}));

describe('SPF Record Flattening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('flattenSPFRecord - Basic Flattening', () => {
    it('should flatten SPF with single include', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19', '64.233.160.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 2,
        totalIPv6Count: 0,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.google.com ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.success).toBe(true);
      expect(result.flattenedRecord).toBe('v=spf1 ip4:216.239.32.0/19 ip4:64.233.160.0/19 ~all');
      expect(result.lookupCountBefore).toBe(1);
      expect(result.lookupCountAfter).toBe(0);
      expect(result.ipv4Addresses).toHaveLength(2);
      expect(result.characterCount).toBeLessThan(512);
    });

    it('should flatten SPF with multiple includes', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
          {
            domain: 'sendgrid.net',
            ipv4: ['167.89.0.0/17', '168.245.0.0/16'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 3,
        totalIPv6Count: 0,
        lookupCount: 2,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.google.com include:sendgrid.net ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.success).toBe(true);
      expect(result.flattenedRecord).toContain('ip4:216.239.32.0/19');
      expect(result.flattenedRecord).toContain('ip4:167.89.0.0/17');
      expect(result.flattenedRecord).toContain('ip4:168.245.0.0/16');
      expect(result.ipv4Addresses).toHaveLength(3);
      expect(result.lookupCountAfter).toBe(0);
    });

    it('should include IPv6 addresses when enabled', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: ['2001:4860:4000::/36', '2404:6800:4000::/36'],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 1,
        totalIPv6Count: 2,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.google.com ~all',
        ipv6Support: true,
      };

      const result = await flattenSPFRecord(config);

      expect(result.success).toBe(true);
      expect(result.flattenedRecord).toContain('ip4:216.239.32.0/19');
      expect(result.flattenedRecord).toContain('ip6:2001:4860:4000::/36');
      expect(result.flattenedRecord).toContain('ip6:2404:6800:4000::/36');
      expect(result.ipv6Addresses).toHaveLength(2);
    });

    it('should preserve original "all" qualifier', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 1,
        totalIPv6Count: 0,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.google.com -all', // Strict fail
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toMatch(/-all$/);
    });
  });

  describe('flattenSPFRecord - Preserve Includes', () => {
    it('should preserve specific includes when requested', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
          {
            domain: 'sendgrid.net',
            ipv4: ['167.89.0.0/17'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 2,
        totalIPv6Count: 0,
        lookupCount: 2,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.google.com include:sendgrid.net ~all',
        preserveIncludes: ['sendgrid.net'],
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toContain('include:sendgrid.net');
      expect(result.flattenedRecord).toContain('ip4:216.239.32.0/19');
      expect(result.flattenedRecord).not.toContain('ip4:167.89.0.0/17');
    });

    it('should preserve include qualifiers', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: 'trusted.com',
            ipv4: ['192.168.1.0/24'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 1,
        totalIPv6Count: 0,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 ~include:trusted.com ~all',
        preserveIncludes: ['trusted.com'],
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toContain('~include:trusted.com');
    });
  });

  describe('flattenSPFRecord - Remove Includes', () => {
    it('should remove specific includes when requested', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
          {
            domain: 'old-service.com',
            ipv4: ['203.0.113.0/24'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 2,
        totalIPv6Count: 0,
        lookupCount: 2,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.google.com include:old-service.com ~all',
        removeIncludes: ['old-service.com'],
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toContain('ip4:216.239.32.0/19');
      expect(result.flattenedRecord).not.toContain('old-service.com');
      expect(result.flattenedRecord).not.toContain('203.0.113.0/24');
    });
  });

  describe('flattenSPFRecord - Additional Includes', () => {
    it('should add additional includes', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 1,
        totalIPv6Count: 0,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.google.com ~all',
        additionalIncludes: ['smartlead.ai'],
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toContain('include:smartlead.ai');
      expect(result.flattenedRecord).toContain('ip4:216.239.32.0/19');
    });
  });

  describe('flattenSPFRecord - Character Limit Validation', () => {
    it('should warn when approaching 512-character limit', async () => {
      // Create many IP addresses to approach limit
      const manyIPs = Array.from({ length: 20 }, (_, i) => `192.168.${i}.0/24`);

      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.bigservice.com',
            ipv4: manyIPs,
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 20,
        totalIPv6Count: 0,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.bigservice.com ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      // Should warn if approaching 512 chars (>461 chars = 90% of 512)
      if (result.characterCount > 461) {
        expect(result.warnings.some(w => w.includes('approaching 512-character limit'))).toBe(true);
      }
    });

    it('should error when exceeding 512-character limit', async () => {
      // Create too many IP addresses
      const tooManyIPs = Array.from({ length: 50 }, (_, i) => `192.168.${i % 256}.${i}/24`);

      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.huge.com',
            ipv4: tooManyIPs,
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 50,
        totalIPv6Count: 0,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:_spf.huge.com ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      if (result.characterCount > 512) {
        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('exceeds 512-character limit'))).toBe(true);
      }
    });
  });

  describe('flattenSPFRecord - IP Deduplication', () => {
    it('should deduplicate IP addresses', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: 'service1.com',
            ipv4: ['192.168.1.1', '192.168.1.2'],
            ipv6: [],
            nestedLookups: 1,
          },
          {
            domain: 'service2.com',
            ipv4: ['192.168.1.1', '192.168.1.3'], // 192.168.1.1 is duplicate
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 3,
        totalIPv6Count: 0,
        lookupCount: 2,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 include:service1.com include:service2.com ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      // Should have only 3 unique IPs
      expect(result.ipv4Addresses).toHaveLength(3);
      expect(result.ipv4Addresses.filter(ip => ip === '192.168.1.1')).toHaveLength(1);
    });
  });

  describe('flattenSPFRecord - Non-Include Mechanisms', () => {
    it('should preserve "a" mechanism', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 1,
        totalIPv6Count: 0,
        lookupCount: 2, // 1 include + 1 "a"
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 a include:_spf.google.com ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toContain(' a ');
      expect(result.lookupCountAfter).toBe(1); // Only "a" remains
    });

    it('should preserve "mx" mechanism', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [],
        totalIPv4Count: 0,
        totalIPv6Count: 0,
        lookupCount: 1, // "mx" lookup
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'example.com',
        originalSPF: 'v=spf1 mx ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toContain(' mx ');
    });
  });

  describe('analyzeFlatteningBenefit', () => {
    it('should recommend flattening when exceeding 10 lookups', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: Array.from({ length: 11 }, (_, i) => ({
          domain: `spf${i}.com`,
          ipv4: ['192.168.1.1'],
          ipv6: [],
          nestedLookups: 1,
        })),
        totalIPv4Count: 11,
        totalIPv6Count: 0,
        lookupCount: 11,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const analysis = await analyzeFlatteningBenefit('example.com');

      expect(analysis.shouldFlatten).toBe(true);
      expect(analysis.reason).toContain('exceeds 10-lookup limit');
      expect(analysis.estimatedLookupReduction).toBe(11);
    });

    it('should recommend flattening when approaching 10 lookups', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: Array.from({ length: 8 }, (_, i) => ({
          domain: `spf${i}.com`,
          ipv4: ['192.168.1.1'],
          ipv6: [],
          nestedLookups: 1,
        })),
        totalIPv4Count: 8,
        totalIPv6Count: 0,
        lookupCount: 8,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const analysis = await analyzeFlatteningBenefit('example.com');

      expect(analysis.shouldFlatten).toBe(true);
      expect(analysis.reason).toContain('approaching lookup limit');
    });

    it('should not recommend flattening for minimal lookups', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 1,
        totalIPv6Count: 0,
        lookupCount: 1,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const analysis = await analyzeFlatteningBenefit('example.com');

      expect(analysis.shouldFlatten).toBe(false);
      expect(analysis.reason).toContain('minimal lookups');
    });

    it('should not recommend flattening when character limit would be exceeded', async () => {
      // Simulate many IPs that would exceed limit
      const manyIPs = Array.from({ length: 60 }, (_, i) => `192.168.${i % 256}.${i}/24`);

      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'example.com',
        resolvedIncludes: [
          {
            domain: '_spf.huge.com',
            ipv4: manyIPs,
            ipv6: [],
            nestedLookups: 11,
          },
        ],
        totalIPv4Count: 60,
        totalIPv6Count: 0,
        lookupCount: 11,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const analysis = await analyzeFlatteningBenefit('example.com');

      // Even though lookups exceed 10, should not recommend if char limit exceeded
      if (analysis.estimatedCharacterCount > 512) {
        expect(analysis.shouldFlatten).toBe(false);
        expect(analysis.reason).toContain('exceed 512-character limit');
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle Google Workspace + SendGrid flattening', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'company.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19', '64.233.160.0/19', '66.102.0.0/20'],
            ipv6: [],
            nestedLookups: 3,
          },
          {
            domain: 'sendgrid.net',
            ipv4: ['167.89.0.0/17', '168.245.0.0/16'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 5,
        totalIPv6Count: 0,
        lookupCount: 4,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'company.com',
        originalSPF: 'v=spf1 include:_spf.google.com include:sendgrid.net ~all',
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.success).toBe(true);
      expect(result.lookupCountBefore).toBe(4);
      expect(result.lookupCountAfter).toBe(0);
      expect(result.ipv4Addresses).toHaveLength(5);
    });

    it('should handle partial flattening (preserve one service)', async () => {
      vi.mocked(spfIPResolver.resolveAllIPsFromSPF).mockResolvedValueOnce({
        domain: 'company.com',
        resolvedIncludes: [
          {
            domain: '_spf.google.com',
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            nestedLookups: 3,
          },
          {
            domain: 'smartlead.ai',
            ipv4: ['203.0.113.0/24'],
            ipv6: [],
            nestedLookups: 1,
          },
        ],
        totalIPv4Count: 2,
        totalIPv6Count: 0,
        lookupCount: 4,
        resolvedAt: new Date(),
        errors: [],
        warnings: [],
      });

      const config: SPFFlatteningConfig = {
        domain: 'company.com',
        originalSPF: 'v=spf1 include:_spf.google.com include:smartlead.ai ~all',
        preserveIncludes: ['smartlead.ai'], // Keep Smartlead as include
        ipv6Support: false,
      };

      const result = await flattenSPFRecord(config);

      expect(result.flattenedRecord).toContain('include:smartlead.ai');
      expect(result.flattenedRecord).toContain('ip4:216.239.32.0/19');
      expect(result.lookupCountAfter).toBe(1); // Only smartlead.ai include remains
    });
  });
});
