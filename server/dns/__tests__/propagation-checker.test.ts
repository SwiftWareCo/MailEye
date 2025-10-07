/**
 * Tests for DNS Propagation Status Checker (Task 4.2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDNSPropagation,
  checkSPFPropagation,
  checkDKIMPropagation,
  checkDMARCPropagation,
  checkMXPropagation,
  checkTrackingDomainPropagation,
  calculateGlobalCoverage,
  checkAllDNSRecords,
  buildFullDomainName,
  determinePropagationStatusEnum,
  type DNSPropagationStatus,
} from '../propagation-checker';
import type { MultiServerQueryResult } from '@/lib/types/dns';

// Mock dns-query-service
vi.mock('../dns-query-service', () => ({
  queryDNSAcrossServers: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { queryDNSAcrossServers } from '../dns-query-service';

describe('DNS Propagation Status Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkDNSPropagation', () => {
    it('should check DNS propagation for fully propagated record', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: 'example.com',
        recordType: 'TXT',
        expectedValue: 'v=spf1 include:_spf.google.com ~all',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['v=spf1 include:_spf.google.com ~all'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
          {
            server: '8.8.4.4',
            provider: 'google',
            success: true,
            records: ['v=spf1 include:_spf.google.com ~all'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 120,
          },
          {
            server: '1.1.1.1',
            provider: 'cloudflare',
            success: true,
            records: ['v=spf1 include:_spf.google.com ~all'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 90,
          },
        ],
        propagationPercentage: 100,
        propagatedServers: 3,
        totalServers: 3,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkDNSPropagation(
        'example.com',
        'TXT',
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(result.isPropagated).toBe(true);
      expect(result.propagationPercentage).toBe(100);
      expect(result.serversWithCorrectValue).toHaveLength(3);
      expect(result.serversWithoutValue).toHaveLength(0);
      expect(result.serversWithWrongValue).toHaveLength(0);
    });

    it('should check DNS propagation for partially propagated record', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: 'example.com',
        recordType: 'TXT',
        expectedValue: 'v=spf1 include:_spf.google.com ~all',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['v=spf1 include:_spf.google.com ~all'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
          {
            server: '8.8.4.4',
            provider: 'google',
            success: false,
            records: [],
            matchesExpected: false,
            error: 'NXDOMAIN',
            queriedAt: new Date(),
            responseTime: 120,
          },
          {
            server: '1.1.1.1',
            provider: 'cloudflare',
            success: true,
            records: ['v=spf1 include:_spf.google.com ~all'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 90,
          },
        ],
        propagationPercentage: 67,
        propagatedServers: 2,
        totalServers: 3,
        isPropagated: false,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkDNSPropagation(
        'example.com',
        'TXT',
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(result.isPropagated).toBe(false);
      expect(result.propagationPercentage).toBe(67);
      expect(result.serversWithCorrectValue).toHaveLength(2);
      expect(result.serversWithoutValue).toHaveLength(1);
      expect(result.serversWithWrongValue).toHaveLength(0);
    });

    it('should categorize servers with wrong values', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: 'example.com',
        recordType: 'TXT',
        expectedValue: 'v=spf1 include:_spf.google.com ~all',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['v=spf1 include:_spf.google.com ~all'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
          {
            server: '8.8.4.4',
            provider: 'google',
            success: true,
            records: ['v=spf1 include:_spf.old.com ~all'], // Wrong value
            matchesExpected: false,
            queriedAt: new Date(),
            responseTime: 120,
          },
          {
            server: '1.1.1.1',
            provider: 'cloudflare',
            success: false,
            records: [],
            matchesExpected: false,
            error: 'NXDOMAIN',
            queriedAt: new Date(),
            responseTime: 90,
          },
        ],
        propagationPercentage: 33,
        propagatedServers: 1,
        totalServers: 3,
        isPropagated: false,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkDNSPropagation(
        'example.com',
        'TXT',
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(result.serversWithCorrectValue).toEqual(['8.8.8.8']);
      expect(result.serversWithWrongValue).toEqual(['8.8.4.4']);
      expect(result.serversWithoutValue).toEqual(['1.1.1.1']);
    });
  });

  describe('checkSPFPropagation', () => {
    it('should check SPF record propagation', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: 'example.com',
        recordType: 'TXT',
        expectedValue: 'v=spf1 include:_spf.google.com ~all',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['v=spf1 include:_spf.google.com ~all'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
        ],
        propagationPercentage: 100,
        propagatedServers: 1,
        totalServers: 1,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkSPFPropagation(
        'example.com',
        'v=spf1 include:_spf.google.com ~all'
      );

      expect(queryDNSAcrossServers).toHaveBeenCalledWith(
        'example.com',
        'TXT',
        'v=spf1 include:_spf.google.com ~all'
      );
      expect(result.domain).toBe('example.com');
      expect(result.recordType).toBe('TXT');
    });
  });

  describe('checkDKIMPropagation', () => {
    it('should check DKIM record propagation with selector', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: 'google._domainkey.example.com',
        recordType: 'TXT',
        expectedValue: 'v=DKIM1; k=rsa; p=MIIBIjANBgk...',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['v=DKIM1; k=rsa; p=MIIBIjANBgk...'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
        ],
        propagationPercentage: 100,
        propagatedServers: 1,
        totalServers: 1,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkDKIMPropagation(
        'example.com',
        'google',
        'v=DKIM1; k=rsa; p=MIIBIjANBgk...'
      );

      expect(queryDNSAcrossServers).toHaveBeenCalledWith(
        'google._domainkey.example.com',
        'TXT',
        'v=DKIM1; k=rsa; p=MIIBIjANBgk...'
      );
      expect(result.domain).toBe('google._domainkey.example.com');
    });
  });

  describe('checkDMARCPropagation', () => {
    it('should check DMARC record propagation', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: '_dmarc.example.com',
        recordType: 'TXT',
        expectedValue: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
        ],
        propagationPercentage: 100,
        propagatedServers: 1,
        totalServers: 1,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkDMARCPropagation(
        'example.com',
        'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com'
      );

      expect(queryDNSAcrossServers).toHaveBeenCalledWith(
        '_dmarc.example.com',
        'TXT',
        'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com'
      );
      expect(result.domain).toBe('_dmarc.example.com');
    });
  });

  describe('checkMXPropagation', () => {
    it('should check MX record propagation', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: 'example.com',
        recordType: 'MX',
        expectedValue: 'smtp.google.com',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['1 smtp.google.com'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
        ],
        propagationPercentage: 100,
        propagatedServers: 1,
        totalServers: 1,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkMXPropagation('example.com', 'smtp.google.com');

      expect(queryDNSAcrossServers).toHaveBeenCalledWith(
        'example.com',
        'MX',
        'smtp.google.com'
      );
      expect(result.recordType).toBe('MX');
    });
  });

  describe('checkTrackingDomainPropagation', () => {
    it('should check tracking domain CNAME propagation', async () => {
      const mockResult: MultiServerQueryResult = {
        domain: 'track.example.com',
        recordType: 'CNAME',
        expectedValue: 'open.sleadtrack.com',
        serverResults: [
          {
            server: '8.8.8.8',
            provider: 'google',
            success: true,
            records: ['open.sleadtrack.com'],
            matchesExpected: true,
            queriedAt: new Date(),
            responseTime: 100,
          },
        ],
        propagationPercentage: 100,
        propagatedServers: 1,
        totalServers: 1,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockResult);

      const result = await checkTrackingDomainPropagation(
        'track.example.com',
        'open.sleadtrack.com'
      );

      expect(queryDNSAcrossServers).toHaveBeenCalledWith(
        'track.example.com',
        'CNAME',
        'open.sleadtrack.com'
      );
      expect(result.recordType).toBe('CNAME');
    });
  });

  describe('calculateGlobalCoverage', () => {
    it('should calculate global coverage for multiple records', () => {
      const records: DNSPropagationStatus[] = [
        {
          domain: 'example.com',
          recordType: 'TXT',
          expectedValue: 'v=spf1 ...',
          isPropagated: true,
          propagationPercentage: 100,
          propagatedServers: 6,
          totalServers: 6,
          serversWithCorrectValue: ['8.8.8.8', '8.8.4.4'],
          serversWithoutValue: [],
          serversWithWrongValue: [],
          checkedAt: new Date(),
        },
        {
          domain: '_dmarc.example.com',
          recordType: 'TXT',
          expectedValue: 'v=DMARC1 ...',
          isPropagated: false,
          propagationPercentage: 67,
          propagatedServers: 4,
          totalServers: 6,
          serversWithCorrectValue: ['8.8.8.8', '8.8.4.4'],
          serversWithoutValue: ['1.1.1.1', '1.0.0.1'],
          serversWithWrongValue: [],
          checkedAt: new Date(),
        },
        {
          domain: 'example.com',
          recordType: 'MX',
          expectedValue: 'smtp.google.com',
          isPropagated: true,
          propagationPercentage: 100,
          propagatedServers: 6,
          totalServers: 6,
          serversWithCorrectValue: ['8.8.8.8', '8.8.4.4'],
          serversWithoutValue: [],
          serversWithWrongValue: [],
          checkedAt: new Date(),
        },
      ];

      const coverage = calculateGlobalCoverage(records);

      expect(coverage.totalRecords).toBe(3);
      expect(coverage.fullyPropagated).toBe(2);
      expect(coverage.partiallyPropagated).toBe(1);
      expect(coverage.notPropagated).toBe(0);
      expect(coverage.overallPercentage).toBe(89); // (100 + 67 + 100) / 3 = 89
    });

    it('should handle empty records array', () => {
      const coverage = calculateGlobalCoverage([]);

      expect(coverage.totalRecords).toBe(0);
      expect(coverage.fullyPropagated).toBe(0);
      expect(coverage.partiallyPropagated).toBe(0);
      expect(coverage.notPropagated).toBe(0);
      expect(coverage.overallPercentage).toBe(0);
    });

    it('should categorize not propagated records', () => {
      const records: DNSPropagationStatus[] = [
        {
          domain: 'example.com',
          recordType: 'TXT',
          isPropagated: false,
          propagationPercentage: 0,
          propagatedServers: 0,
          totalServers: 6,
          serversWithCorrectValue: [],
          serversWithoutValue: ['8.8.8.8', '8.8.4.4'],
          serversWithWrongValue: [],
          checkedAt: new Date(),
        },
      ];

      const coverage = calculateGlobalCoverage(records);

      expect(coverage.notPropagated).toBe(1);
      expect(coverage.partiallyPropagated).toBe(0);
      expect(coverage.fullyPropagated).toBe(0);
    });
  });

  describe('checkAllDNSRecords', () => {
    it('should check all DNS records in parallel', async () => {
      const mockSPFResult: MultiServerQueryResult = {
        domain: 'example.com',
        recordType: 'TXT',
        expectedValue: 'v=spf1 include:_spf.google.com ~all',
        serverResults: [],
        propagationPercentage: 100,
        propagatedServers: 6,
        totalServers: 6,
        isPropagated: true,
        queriedAt: new Date(),
      };

      const mockDKIMResult: MultiServerQueryResult = {
        domain: 'google._domainkey.example.com',
        recordType: 'TXT',
        expectedValue: 'v=DKIM1; k=rsa; p=...',
        serverResults: [],
        propagationPercentage: 100,
        propagatedServers: 6,
        totalServers: 6,
        isPropagated: true,
        queriedAt: new Date(),
      };

      const mockDMARCResult: MultiServerQueryResult = {
        domain: '_dmarc.example.com',
        recordType: 'TXT',
        expectedValue: 'v=DMARC1; p=quarantine',
        serverResults: [],
        propagationPercentage: 67,
        propagatedServers: 4,
        totalServers: 6,
        isPropagated: false,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers)
        .mockResolvedValueOnce(mockSPFResult)
        .mockResolvedValueOnce(mockDKIMResult)
        .mockResolvedValueOnce(mockDMARCResult);

      const coverage = await checkAllDNSRecords({
        domain: 'example.com',
        expectedSPF: 'v=spf1 include:_spf.google.com ~all',
        dkimSelector: 'google',
        expectedDKIM: 'v=DKIM1; k=rsa; p=...',
        expectedDMARC: 'v=DMARC1; p=quarantine',
      });

      expect(coverage.totalRecords).toBe(3);
      expect(coverage.fullyPropagated).toBe(2);
      expect(coverage.partiallyPropagated).toBe(1);
    });

    it('should skip unconfigured DNS records', async () => {
      const mockSPFResult: MultiServerQueryResult = {
        domain: 'example.com',
        recordType: 'TXT',
        expectedValue: 'v=spf1 include:_spf.google.com ~all',
        serverResults: [],
        propagationPercentage: 100,
        propagatedServers: 6,
        totalServers: 6,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockSPFResult);

      const coverage = await checkAllDNSRecords({
        domain: 'example.com',
        expectedSPF: 'v=spf1 include:_spf.google.com ~all',
        // No DKIM, DMARC, MX, or tracking domain configured
      });

      expect(coverage.totalRecords).toBe(1); // Only SPF checked
      expect(queryDNSAcrossServers).toHaveBeenCalledTimes(1);
    });

    it('should check tracking domain when configured', async () => {
      const mockTrackingResult: MultiServerQueryResult = {
        domain: 'track.example.com',
        recordType: 'CNAME',
        expectedValue: 'open.sleadtrack.com',
        serverResults: [],
        propagationPercentage: 100,
        propagatedServers: 6,
        totalServers: 6,
        isPropagated: true,
        queriedAt: new Date(),
      };

      vi.mocked(queryDNSAcrossServers).mockResolvedValue(mockTrackingResult);

      const coverage = await checkAllDNSRecords({
        domain: 'example.com',
        trackingDomain: 'track.example.com',
        expectedTrackingTarget: 'open.sleadtrack.com',
      });

      expect(coverage.totalRecords).toBe(1);
      expect(queryDNSAcrossServers).toHaveBeenCalledWith(
        'track.example.com',
        'CNAME',
        'open.sleadtrack.com'
      );
    });
  });

  describe('Database Integration Functions', () => {
    describe('buildFullDomainName', () => {
      it('should return base domain for @ notation', () => {
        expect(buildFullDomainName('@', 'example.com')).toBe('example.com');
      });

      it('should return base domain for empty string', () => {
        expect(buildFullDomainName('', 'example.com')).toBe('example.com');
      });

      it('should return base domain when recordName equals baseDomain', () => {
        expect(buildFullDomainName('example.com', 'example.com')).toBe('example.com');
      });

      it('should append subdomain to base domain', () => {
        expect(buildFullDomainName('_dmarc', 'example.com')).toBe('_dmarc.example.com');
        expect(buildFullDomainName('mail', 'example.com')).toBe('mail.example.com');
      });

      it('should return as-is when recordName already includes domain', () => {
        expect(buildFullDomainName('_dmarc.example.com', 'example.com')).toBe(
          '_dmarc.example.com'
        );
      });

      it('should handle DKIM selector format', () => {
        expect(buildFullDomainName('google._domainkey', 'example.com')).toBe(
          'google._domainkey.example.com'
        );
      });
    });

    describe('determinePropagationStatusEnum', () => {
      it('should return propagated for 100%', () => {
        expect(determinePropagationStatusEnum(100)).toBe('propagated');
      });

      it('should return propagating for 40-99%', () => {
        expect(determinePropagationStatusEnum(40)).toBe('propagating');
        expect(determinePropagationStatusEnum(50)).toBe('propagating');
        expect(determinePropagationStatusEnum(80)).toBe('propagating');
        expect(determinePropagationStatusEnum(99)).toBe('propagating');
      });

      it('should return pending for < 40%', () => {
        expect(determinePropagationStatusEnum(0)).toBe('pending');
        expect(determinePropagationStatusEnum(10)).toBe('pending');
        expect(determinePropagationStatusEnum(39)).toBe('pending');
      });
    });
  });
});
