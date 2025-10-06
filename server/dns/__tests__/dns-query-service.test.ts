/**
 * DNS Query Service Tests (Task 4.1)
 *
 * Tests multi-server DNS query functionality for propagation verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Resolver } from 'dns';
import {
  queryTXTFromServer,
  queryMXFromServer,
  queryCNAMEFromServer,
  queryDNSRecordFromServer,
  calculatePropagationPercentage,
  queryDNSAcrossServers,
  PUBLIC_DNS_SERVERS,
} from '../dns-query-service';
import type { DNSServerQueryResult } from '@/lib/types/dns';

/**
 * DNS callback type for Node.js dns module
 */
type DnsCallback<T> = (err: NodeJS.ErrnoException | null, result: T) => void;

/**
 * Mock DNS Resolver interface
 */
interface MockResolver {
  setServers: ReturnType<typeof vi.fn>;
  resolveTxt: ReturnType<typeof vi.fn>;
  resolveMx: ReturnType<typeof vi.fn>;
  resolveCname: ReturnType<typeof vi.fn>;
}

// Mock dns module
vi.mock('dns', () => {
  const mockResolver: MockResolver = {
    setServers: vi.fn(),
    resolveTxt: vi.fn(),
    resolveMx: vi.fn(),
    resolveCname: vi.fn(),
  };

  return {
    Resolver: vi.fn(() => mockResolver),
  };
});

describe('DNS Query Service', () => {
  let mockResolver: MockResolver;

  beforeEach(() => {
    // Get mock resolver instance
    mockResolver = new Resolver() as unknown as MockResolver;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queryTXTFromServer', () => {
    it('should query TXT records from specific nameserver', async () => {
      const mockTxtRecords = [
        ['v=spf1 include:_spf.google.com ~all'],
        ['google-site-verification=abc123'],
      ];

      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callback(null, mockTxtRecords);
      });

      const result = await queryTXTFromServer('example.com', '8.8.8.8');

      expect(result.success).toBe(true);
      expect(result.server).toBe('8.8.8.8');
      expect(result.provider).toBe('google');
      expect(result.records).toHaveLength(2);
      expect(result.records[0]).toBe('v=spf1 include:_spf.google.com ~all');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle ENODATA (no TXT records)', async () => {
      const error = new Error('ENODATA') as NodeJS.ErrnoException;
      error.code = 'ENODATA';

      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callback(error, [] as unknown as string[][]);
      });

      const result = await queryTXTFromServer('example.com', '1.1.1.1');

      expect(result.success).toBe(false);
      expect(result.provider).toBe('cloudflare');
      expect(result.records).toHaveLength(0);
      expect(result.error).toBe('No TXT records found');
    });

    it('should handle DNS query timeout', async () => {
      mockResolver.resolveTxt.mockImplementation((_domain: string, _callback: DnsCallback<string[][]>) => {
        // Simulate timeout by never calling callback
        // The timeout in dns-query-service will reject the promise
      });

      const result = await queryTXTFromServer('example.com', '8.8.8.8');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 10000); // Increase test timeout to 10s to allow for DNS_QUERY_TIMEOUT (5s)
  });

  describe('queryMXFromServer', () => {
    it('should query MX records from specific nameserver', async () => {
      const mockMxRecords = [
        { priority: 1, exchange: 'aspmx.l.google.com' },
        { priority: 5, exchange: 'alt1.aspmx.l.google.com' },
      ];

      mockResolver.resolveMx.mockImplementation((domain: string, callback: DnsCallback<Array<{ priority: number; exchange: string }>>) => {
        callback(null, mockMxRecords);
      });

      const result = await queryMXFromServer('example.com', '208.67.222.222');

      expect(result.success).toBe(true);
      expect(result.server).toBe('208.67.222.222');
      expect(result.provider).toBe('opendns');
      expect(result.records).toHaveLength(2);
      expect(result.records[0]).toBe('1 aspmx.l.google.com');
      expect(result.records[1]).toBe('5 alt1.aspmx.l.google.com');
    });

    it('should handle no MX records found', async () => {
      const error = new Error('ENODATA') as NodeJS.ErrnoException;
      error.code = 'ENODATA';

      mockResolver.resolveMx.mockImplementation((domain: string, callback: DnsCallback<Array<{ priority: number; exchange: string }>>) => {
        callback(error, [] as Array<{ priority: number; exchange: string }>);
      });

      const result = await queryMXFromServer('example.com', '8.8.8.8');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No MX records found');
    });
  });

  describe('queryCNAMEFromServer', () => {
    it('should query CNAME records from specific nameserver', async () => {
      const mockCnameRecords = ['open.sleadtrack.com'];

      mockResolver.resolveCname.mockImplementation((domain: string, callback: DnsCallback<string[]>) => {
        callback(null, mockCnameRecords);
      });

      const result = await queryCNAMEFromServer('track.example.com', '1.0.0.1');

      expect(result.success).toBe(true);
      expect(result.server).toBe('1.0.0.1');
      expect(result.provider).toBe('cloudflare');
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toBe('open.sleadtrack.com');
    });

    it('should handle no CNAME records found', async () => {
      const error = new Error('ENODATA') as NodeJS.ErrnoException;
      error.code = 'ENODATA';

      mockResolver.resolveCname.mockImplementation((domain: string, callback: DnsCallback<string[]>) => {
        callback(error, [] as string[]);
      });

      const result = await queryCNAMEFromServer('example.com', '8.8.4.4');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No CNAME records found');
    });
  });

  describe('queryDNSRecordFromServer', () => {
    it('should route to TXT query function', async () => {
      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callback(null, [['v=spf1 ~all']]);
      });

      const result = await queryDNSRecordFromServer('example.com', 'TXT', '8.8.8.8');

      expect(result.success).toBe(true);
      expect(result.records[0]).toBe('v=spf1 ~all');
    });

    it('should route to MX query function', async () => {
      mockResolver.resolveMx.mockImplementation((domain: string, callback: DnsCallback<Array<{ priority: number; exchange: string }>>) => {
        callback(null, [{ priority: 10, exchange: 'mail.example.com' }]);
      });

      const result = await queryDNSRecordFromServer('example.com', 'MX', '1.1.1.1');

      expect(result.success).toBe(true);
      expect(result.records[0]).toBe('10 mail.example.com');
    });

    it('should route to CNAME query function', async () => {
      mockResolver.resolveCname.mockImplementation((domain: string, callback: DnsCallback<string[]>) => {
        callback(null, ['target.example.com']);
      });

      const result = await queryDNSRecordFromServer('www.example.com', 'CNAME', '8.8.8.8');

      expect(result.success).toBe(true);
      expect(result.records[0]).toBe('target.example.com');
    });
  });

  describe('calculatePropagationPercentage', () => {
    it('should return 100% when all servers have expected value', () => {
      const serverResults: DNSServerQueryResult[] = [
        {
          server: '8.8.8.8',
          provider: 'google',
          success: true,
          records: ['v=spf1 include:_spf.google.com ~all'],
          matchesExpected: false,
          queriedAt: new Date(),
          responseTime: 50,
        },
        {
          server: '1.1.1.1',
          provider: 'cloudflare',
          success: true,
          records: ['v=spf1 include:_spf.google.com ~all'],
          matchesExpected: false,
          queriedAt: new Date(),
          responseTime: 45,
        },
      ];

      const percentage = calculatePropagationPercentage(
        serverResults,
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(percentage).toBe(100);
    });

    it('should return 50% when half the servers have expected value', () => {
      const serverResults: DNSServerQueryResult[] = [
        {
          server: '8.8.8.8',
          provider: 'google',
          success: true,
          records: ['v=spf1 include:_spf.google.com ~all'],
          matchesExpected: false,
          queriedAt: new Date(),
          responseTime: 50,
        },
        {
          server: '1.1.1.1',
          provider: 'cloudflare',
          success: false,
          records: [],
          matchesExpected: false,
          error: 'No TXT records found',
          queriedAt: new Date(),
          responseTime: 45,
        },
      ];

      const percentage = calculatePropagationPercentage(
        serverResults,
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(percentage).toBe(50);
    });

    it('should return 0% when no servers have expected value', () => {
      const serverResults: DNSServerQueryResult[] = [
        {
          server: '8.8.8.8',
          provider: 'google',
          success: false,
          records: [],
          matchesExpected: false,
          error: 'No records found',
          queriedAt: new Date(),
          responseTime: 50,
        },
        {
          server: '1.1.1.1',
          provider: 'cloudflare',
          success: false,
          records: [],
          matchesExpected: false,
          error: 'No records found',
          queriedAt: new Date(),
          responseTime: 45,
        },
      ];

      const percentage = calculatePropagationPercentage(
        serverResults,
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(percentage).toBe(0);
    });

    it('should handle case-insensitive matching', () => {
      const serverResults: DNSServerQueryResult[] = [
        {
          server: '8.8.8.8',
          provider: 'google',
          success: true,
          records: ['V=SPF1 INCLUDE:_spf.google.com ~all'],
          matchesExpected: false,
          queriedAt: new Date(),
          responseTime: 50,
        },
      ];

      const percentage = calculatePropagationPercentage(
        serverResults,
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(percentage).toBe(100);
    });

    it('should return 0% when expectedValue is not provided', () => {
      const serverResults: DNSServerQueryResult[] = [
        {
          server: '8.8.8.8',
          provider: 'google',
          success: true,
          records: ['some record'],
          matchesExpected: false,
          queriedAt: new Date(),
          responseTime: 50,
        },
      ];

      const percentage = calculatePropagationPercentage(serverResults, undefined);

      expect(percentage).toBe(0);
    });
  });

  describe('queryDNSAcrossServers', () => {
    it('should query all 6 nameservers in parallel', async () => {
      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callback(null, [['v=spf1 ~all']]);
      });

      const result = await queryDNSAcrossServers('example.com', 'TXT', 'v=spf1 ~all');

      expect(result.domain).toBe('example.com');
      expect(result.recordType).toBe('TXT');
      expect(result.serverResults).toHaveLength(6); // 2 Google + 2 Cloudflare + 2 OpenDNS
      expect(result.totalServers).toBe(6);
    });

    it('should calculate 100% propagation when all servers have record', async () => {
      const spfRecord = 'v=spf1 include:_spf.google.com ~all';

      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callback(null, [[spfRecord]]);
      });

      const result = await queryDNSAcrossServers('example.com', 'TXT', spfRecord);

      expect(result.propagationPercentage).toBe(100);
      expect(result.propagatedServers).toBe(6);
      expect(result.isPropagated).toBe(true);
    });

    it('should calculate partial propagation correctly', async () => {
      const spfRecord = 'v=spf1 include:_spf.google.com ~all';
      let callCount = 0;

      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callCount++;
        // First 3 servers have record, next 3 don't
        if (callCount <= 3) {
          callback(null, [[spfRecord]]);
        } else {
          const error = new Error('ENODATA') as NodeJS.ErrnoException;
          error.code = 'ENODATA';
          callback(error, [] as unknown as string[][]);
        }
      });

      const result = await queryDNSAcrossServers('example.com', 'TXT', spfRecord);

      expect(result.propagationPercentage).toBe(50);
      expect(result.propagatedServers).toBe(3);
      expect(result.isPropagated).toBe(false);
    });

    it('should mark matchesExpected correctly for each server', async () => {
      const expectedSpf = 'v=spf1 include:_spf.google.com ~all';
      const differentSpf = 'v=spf1 -all';
      let callCount = 0;

      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callCount++;
        // Half have expected, half have different value
        if (callCount <= 3) {
          callback(null, [[expectedSpf]]);
        } else {
          callback(null, [[differentSpf]]);
        }
      });

      const result = await queryDNSAcrossServers('example.com', 'TXT', expectedSpf);

      const matchedServers = result.serverResults.filter((r) => r.matchesExpected);
      const notMatchedServers = result.serverResults.filter((r) => !r.matchesExpected);

      expect(matchedServers).toHaveLength(3);
      expect(notMatchedServers).toHaveLength(3);
    });

    it('should work without expectedValue (just query)', async () => {
      mockResolver.resolveTxt.mockImplementation((domain: string, callback: DnsCallback<string[][]>) => {
        callback(null, [['v=spf1 ~all']]);
      });

      const result = await queryDNSAcrossServers('example.com', 'TXT');

      expect(result.expectedValue).toBeUndefined();
      expect(result.propagationPercentage).toBe(0); // No expected value = 0%
      expect(result.serverResults).toHaveLength(6);
    });

    it('should query MX records across servers', async () => {
      const mxRecord = '1 aspmx.l.google.com';

      mockResolver.resolveMx.mockImplementation((domain: string, callback: DnsCallback<Array<{ priority: number; exchange: string }>>) => {
        callback(null, [{ priority: 1, exchange: 'aspmx.l.google.com' }]);
      });

      const result = await queryDNSAcrossServers('example.com', 'MX', mxRecord);

      expect(result.recordType).toBe('MX');
      expect(result.propagationPercentage).toBe(100);
    });

    it('should query CNAME records across servers', async () => {
      const cnameTarget = 'open.sleadtrack.com';

      mockResolver.resolveCname.mockImplementation((domain: string, callback: DnsCallback<string[]>) => {
        callback(null, [cnameTarget]);
      });

      const result = await queryDNSAcrossServers('track.example.com', 'CNAME', cnameTarget);

      expect(result.recordType).toBe('CNAME');
      expect(result.propagationPercentage).toBe(100);
    });
  });

  describe('PUBLIC_DNS_SERVERS constant', () => {
    it('should have all expected providers', () => {
      expect(PUBLIC_DNS_SERVERS).toHaveProperty('google');
      expect(PUBLIC_DNS_SERVERS).toHaveProperty('cloudflare');
      expect(PUBLIC_DNS_SERVERS).toHaveProperty('opendns');
    });

    it('should have 2 servers per provider', () => {
      expect(PUBLIC_DNS_SERVERS.google).toHaveLength(2);
      expect(PUBLIC_DNS_SERVERS.cloudflare).toHaveLength(2);
      expect(PUBLIC_DNS_SERVERS.opendns).toHaveLength(2);
    });

    it('should have correct Google DNS servers', () => {
      expect(PUBLIC_DNS_SERVERS.google).toContain('8.8.8.8');
      expect(PUBLIC_DNS_SERVERS.google).toContain('8.8.4.4');
    });

    it('should have correct Cloudflare DNS servers', () => {
      expect(PUBLIC_DNS_SERVERS.cloudflare).toContain('1.1.1.1');
      expect(PUBLIC_DNS_SERVERS.cloudflare).toContain('1.0.0.1');
    });

    it('should have correct OpenDNS servers', () => {
      expect(PUBLIC_DNS_SERVERS.opendns).toContain('208.67.222.222');
      expect(PUBLIC_DNS_SERVERS.opendns).toContain('208.67.220.220');
    });
  });
});
