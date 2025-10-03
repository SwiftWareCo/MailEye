/**
 * SPF IP Address Resolution Unit Tests (Task 3.3)
 *
 * Tests for IP extraction and caching from SPF includes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveAllIPsFromSPF,
  clearIPResolutionCache,
  getIPResolutionCacheStats,
  hasResolvedIPs,
  getTotalIPCount,
} from '../spf-ip-resolver';
import * as spfLookupResolver from '../spf-lookup-resolver';

// Mock SPF Lookup Resolver
vi.mock('../spf-lookup-resolver', () => ({
  resolveSPFRecord: vi.fn(),
}));

describe('SPF IP Address Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearIPResolutionCache(); // Clear cache before each test
  });

  describe('resolveAllIPsFromSPF - Basic Resolution', () => {
    it('should resolve IPs from simple SPF record', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        spfRecord: 'v=spf1 ip4:192.168.1.1 ip6:2001:db8::/32 ~all',
        ipv4Addresses: ['192.168.1.1'],
        ipv6Addresses: ['2001:db8::/32'],
        includeChains: [],
        totalLookups: 0,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.domain).toBe('example.com');
      expect(result.totalIPv4Count).toBe(0); // No includes, so no resolved includes
      expect(result.totalIPv6Count).toBe(0);
      expect(result.resolvedIncludes).toHaveLength(0);
    });

    it('should resolve IPs from single include', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        spfRecord: 'v=spf1 include:_spf.google.com ~all',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            spfRecord: 'v=spf1 ip4:216.239.32.0/19 ip4:64.233.160.0/19 ~all',
            ipv4: ['216.239.32.0/19', '64.233.160.0/19'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 1,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.domain).toBe('example.com');
      expect(result.totalIPv4Count).toBe(2);
      expect(result.totalIPv6Count).toBe(0);
      expect(result.resolvedIncludes).toHaveLength(1);
      expect(result.resolvedIncludes[0].domain).toBe('_spf.google.com');
      expect(result.resolvedIncludes[0].ipv4).toContain('216.239.32.0/19');
      expect(result.resolvedIncludes[0].ipv4).toContain('64.233.160.0/19');
    });

    it('should resolve IPs from multiple includes', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        spfRecord: 'v=spf1 include:_spf.google.com include:sendgrid.net ~all',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
          {
            domain: 'sendgrid.net',
            depth: 0,
            ipv4: ['167.89.0.0/17', '168.245.0.0/16'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 2,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.totalIPv4Count).toBe(3);
      expect(result.resolvedIncludes).toHaveLength(2);
      expect(result.resolvedIncludes[0].domain).toBe('_spf.google.com');
      expect(result.resolvedIncludes[1].domain).toBe('sendgrid.net');
      expect(result.resolvedIncludes[1].ipv4).toContain('167.89.0.0/17');
      expect(result.resolvedIncludes[1].ipv4).toContain('168.245.0.0/16');
    });

    it('should handle IPv6 addresses when enabled', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: ['2001:4860:4000::/36', '2404:6800:4000::/36'],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 1,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com', { includeIPv6: true });

      expect(result.totalIPv4Count).toBe(1);
      expect(result.totalIPv6Count).toBe(2);
      expect(result.resolvedIncludes[0].ipv6).toContain('2001:4860:4000::/36');
      expect(result.resolvedIncludes[0].ipv6).toContain('2404:6800:4000::/36');
    });

    it('should exclude IPv6 when disabled', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: [], // Should be empty when includeIPv6: false
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 1,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com', { includeIPv6: false });

      expect(result.totalIPv6Count).toBe(0);
    });
  });

  describe('resolveAllIPsFromSPF - Nested Includes', () => {
    it('should flatten nested includes into single ResolvedInclude', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            lookupCount: 3, // 1 for this + 2 for nested
            nestedIncludes: [
              {
                domain: '_netblocks.google.com',
                depth: 1,
                ipv4: ['64.233.160.0/19'],
                ipv6: [],
                lookupCount: 1,
                nestedIncludes: [],
                circular: false,
              },
              {
                domain: '_netblocks2.google.com',
                depth: 1,
                ipv4: ['66.102.0.0/20'],
                ipv6: [],
                lookupCount: 1,
                nestedIncludes: [],
                circular: false,
              },
            ],
            circular: false,
          },
        ],
        totalLookups: 3,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.resolvedIncludes).toHaveLength(1);
      expect(result.resolvedIncludes[0].domain).toBe('_spf.google.com');
      // Should contain all IPs from nested includes
      expect(result.resolvedIncludes[0].ipv4).toContain('216.239.32.0/19');
      expect(result.resolvedIncludes[0].ipv4).toContain('64.233.160.0/19');
      expect(result.resolvedIncludes[0].ipv4).toContain('66.102.0.0/20');
      expect(result.totalIPv4Count).toBe(3);
    });

    it('should deduplicate IPs from nested includes', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['192.168.1.1'],
            ipv6: [],
            lookupCount: 2,
            nestedIncludes: [
              {
                domain: '_netblocks.google.com',
                depth: 1,
                ipv4: ['192.168.1.1'], // Duplicate IP
                ipv6: [],
                lookupCount: 1,
                nestedIncludes: [],
                circular: false,
              },
            ],
            circular: false,
          },
        ],
        totalLookups: 2,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      // Should deduplicate
      expect(result.totalIPv4Count).toBe(1);
      expect(result.resolvedIncludes[0].ipv4.filter(ip => ip === '192.168.1.1')).toHaveLength(1);
    });
  });

  describe('resolveAllIPsFromSPF - Error Handling', () => {
    it('should propagate errors from SPF resolution', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [],
        totalLookups: 0,
        exceedsLimit: false,
        errors: ['No SPF record found for example.com'],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.errors).toContain('No SPF record found for example.com');
    });

    it('should propagate warnings from SPF resolution', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 8,
        exceedsLimit: false,
        errors: [],
        warnings: ['SPF record has 8 DNS lookups (approaching 10 limit)'],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.warnings).toContain('SPF record has 8 DNS lookups (approaching 10 limit)');
    });

    it('should include error from failed include', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: 'nonexistent.com',
            depth: 0,
            ipv4: [],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            error: 'No SPF record found',
            circular: false,
          },
        ],
        totalLookups: 1,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.resolvedIncludes[0].error).toBe('No SPF record found');
    });
  });

  describe('Caching', () => {
    it('should cache resolution results', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 1,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      // First call - should hit DNS
      await resolveAllIPsFromSPF('example.com');

      // Second call - should use cache
      await resolveAllIPsFromSPF('example.com');

      // Should only call resolveSPFRecord once
      expect(spfLookupResolver.resolveSPFRecord).toHaveBeenCalledTimes(1);
    });

    it('should respect cache disable option', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValue({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [],
        totalLookups: 0,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      // First call with cache disabled
      await resolveAllIPsFromSPF('example.com', { useCache: false });

      // Second call with cache disabled
      await resolveAllIPsFromSPF('example.com', { useCache: false });

      // Should call resolveSPFRecord twice (cache disabled)
      expect(spfLookupResolver.resolveSPFRecord).toHaveBeenCalledTimes(2);
    });

    it('should track cache statistics', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValue({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [],
        totalLookups: 0,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      clearIPResolutionCache(); // Start fresh

      await resolveAllIPsFromSPF('example.com');
      await resolveAllIPsFromSPF('test.com');

      const stats = getIPResolutionCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.domains).toContain('example.com');
      expect(stats.domains).toContain('test.com');
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });

    it('should check if domain has resolved IPs', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValue({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [],
        totalLookups: 0,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      expect(hasResolvedIPs('example.com')).toBe(false);

      await resolveAllIPsFromSPF('example.com');

      expect(hasResolvedIPs('example.com')).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    it('should get total IP count', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19', '64.233.160.0/19'],
            ipv6: ['2001:4860:4000::/36'],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 1,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const count = await getTotalIPCount('example.com');

      expect(count.ipv4).toBe(2);
      expect(count.ipv6).toBe(1);
      expect(count.total).toBe(3);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle Google Workspace SPF resolution', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'example.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            lookupCount: 3,
            nestedIncludes: [
              {
                domain: '_netblocks.google.com',
                depth: 1,
                ipv4: ['64.233.160.0/19', '66.102.0.0/20'],
                ipv6: [],
                lookupCount: 1,
                nestedIncludes: [],
                circular: false,
              },
              {
                domain: '_netblocks2.google.com',
                depth: 1,
                ipv4: ['66.249.80.0/20', '72.14.192.0/18'],
                ipv6: [],
                lookupCount: 1,
                nestedIncludes: [],
                circular: false,
              },
            ],
            circular: false,
          },
        ],
        totalLookups: 3,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('example.com');

      expect(result.resolvedIncludes).toHaveLength(1);
      expect(result.resolvedIncludes[0].domain).toBe('_spf.google.com');
      expect(result.totalIPv4Count).toBe(5); // All Google IP ranges combined
      expect(result.lookupCount).toBe(3);
    });

    it('should handle multiple email services', async () => {
      vi.mocked(spfLookupResolver.resolveSPFRecord).mockResolvedValueOnce({
        domain: 'company.com',
        ipv4Addresses: [],
        ipv6Addresses: [],
        includeChains: [
          {
            domain: '_spf.google.com',
            depth: 0,
            ipv4: ['216.239.32.0/19'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
          {
            domain: 'sendgrid.net',
            depth: 0,
            ipv4: ['167.89.0.0/17', '168.245.0.0/16'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
          {
            domain: 'smartlead.ai',
            depth: 0,
            ipv4: ['203.0.113.0/24'],
            ipv6: [],
            lookupCount: 1,
            nestedIncludes: [],
            circular: false,
          },
        ],
        totalLookups: 3,
        exceedsLimit: false,
        errors: [],
        warnings: [],
        resolvedAt: new Date(),
      });

      const result = await resolveAllIPsFromSPF('company.com');

      expect(result.resolvedIncludes).toHaveLength(3);
      expect(result.totalIPv4Count).toBe(4);
      expect(result.resolvedIncludes.map(i => i.domain)).toEqual([
        '_spf.google.com',
        'sendgrid.net',
        'smartlead.ai',
      ]);
    });
  });
});
