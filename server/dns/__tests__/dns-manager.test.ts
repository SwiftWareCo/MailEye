/**
 * Unit tests for DNS Configuration Orchestrator (Task 3.10)
 *
 * Tests cover:
 * - Complete DNS setup workflow
 * - Individual generator integration
 * - Error handling at each step
 * - Database record verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupEmailDNS,
  verifyDNSConfiguration,
  type DNSSetupConfig,
} from '../dns-manager';
import type { DNSRecordInput } from '../cloudflare-record-creator';

// Mock all DNS generator modules
vi.mock('../spf-flattener', () => ({
  flattenSPFRecord: vi.fn(),
}));

vi.mock('../dkim-generator', () => ({
  generateDKIMRecord: vi.fn(),
}));

vi.mock('../dmarc-generator', () => ({
  generateDMARCRecord: vi.fn(),
}));

vi.mock('../mx-generator', () => ({
  generateGoogleWorkspaceMXRecord: vi.fn(),
  createMXDNSRecords: vi.fn(),
}));

vi.mock('../tracking-domain-setup', () => ({
  generateTrackingDomainCNAME: vi.fn(),
}));

vi.mock('../cloudflare-record-creator', () => ({
  createDNSRecordsBatch: vi.fn(),
  getDNSRecordsForDomain: vi.fn(),
}));

describe('DNS Configuration Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setupEmailDNS - Google Workspace', () => {
    it('should set up complete DNS configuration for Google Workspace', async () => {
      const { flattenSPFRecord } = await import('../spf-flattener');
      const { generateDKIMRecord } = await import('../dkim-generator');
      const { generateDMARCRecord } = await import('../dmarc-generator');
      const { generateGoogleWorkspaceMXRecord, createMXDNSRecords } = await import('../mx-generator');
      const { createDNSRecordsBatch } = await import(
        '../cloudflare-record-creator'
      );

      // Mock SPF generation
      vi.mocked(flattenSPFRecord).mockResolvedValue({
        success: true,
        flattenedRecord: 'v=spf1 include:_spf.google.com ~all',
        originalRecord: 'v=spf1 include:_spf.google.com ~all',
        lookupCountBefore: 1,
        lookupCountAfter: 1,
        ipv4Addresses: [],
        ipv6Addresses: [],
        resolvedIncludes: [],
        characterCount: 44,
        errors: [],
        warnings: [],
        timestamp: new Date(),
      });

      // Mock DKIM generation
      vi.mocked(generateDKIMRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        selector: 'google',
        recordName: 'google._domainkey.example.com',
        recordType: 'TXT',
        recordValue: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBA...',
        publicKey: 'MIGfMA0GCSqGSIb3DQEBA...',
        keyLength: 2048,
        characterCount: 150,
        requiresSplitting: false,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      // Mock DMARC generation
      vi.mocked(generateDMARCRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordName: '_dmarc.example.com',
        recordType: 'TXT',
        recordValue: 'v=DMARC1; p=none; rua=mailto:dmarc@example.com',
        policy: 'none',
        percentage: 100,
        spfAlignment: 'r',
        dkimAlignment: 'r',
        characterCount: 53,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      // Mock MX generation
      vi.mocked(generateGoogleWorkspaceMXRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordType: 'MX',
        records: [
          {
            priority: 1,
            exchange: 'smtp.google.com',
          },
        ],
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      // Mock MX DNS record conversion
      vi.mocked(createMXDNSRecords).mockReturnValue([
        {
          name: '@',
          type: 'MX',
          priority: 1,
          content: 'smtp.google.com',
          ttl: 3600,
        },
      ]);

      // Mock batch creation
      vi.mocked(createDNSRecordsBatch).mockResolvedValue({
        success: true,
        totalRecords: 4,
        successfulRecords: 4,
        failedRecords: 0,
        skippedRecords: 0,
        results: [
          { success: true, cloudflareRecordId: 'cf-1', databaseRecordId: 'db-1' },
          { success: true, cloudflareRecordId: 'cf-2', databaseRecordId: 'db-2' },
          { success: true, cloudflareRecordId: 'cf-3', databaseRecordId: 'db-3' },
          { success: true, cloudflareRecordId: 'cf-4', databaseRecordId: 'db-4' },
        ],
        errors: [],
      });

      const config: DNSSetupConfig = {
        domain: 'example.com',
        domainId: 'domain-123',
        zoneId: 'zone-456',
        apiToken: 'test-token',
        emailPlatform: 'google-workspace',
        dmarcPolicy: 'none',
        dmarcReportEmail: 'dmarc@example.com',
        existingSPFRecord: 'v=spf1 include:_spf.google.com ~all',
      };

      const result = await setupEmailDNS(config);

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(4);
      expect(result.recordsFailed).toBe(0);
      expect(result.spf?.success).toBe(true);
      expect(result.dkim?.success).toBe(true);
      expect(result.dmarc?.success).toBe(true);
      expect(result.mx?.success).toBe(true);

      // Verify all generators were called
      expect(flattenSPFRecord).toHaveBeenCalled();
      expect(generateDKIMRecord).toHaveBeenCalled();
      expect(generateDMARCRecord).toHaveBeenCalled();
      expect(generateGoogleWorkspaceMXRecord).toHaveBeenCalled();
      expect(createDNSRecordsBatch).toHaveBeenCalled();
    });

    it('should set up DNS with tracking domain enabled', async () => {
      const { flattenSPFRecord } = await import('../spf-flattener');
      const { generateDKIMRecord } = await import('../dkim-generator');
      const { generateDMARCRecord } = await import('../dmarc-generator');
      const { generateGoogleWorkspaceMXRecord } = await import('../mx-generator');
      const { generateTrackingDomainCNAME } = await import(
        '../tracking-domain-setup'
      );
      const { createDNSRecordsBatch } = await import(
        '../cloudflare-record-creator'
      );

      // Mock all generators
      vi.mocked(flattenSPFRecord).mockResolvedValue({
        success: true,
        flattenedRecord: 'v=spf1 include:_spf.google.com ~all',
        originalRecord: 'v=spf1 include:_spf.google.com ~all',
        lookupCountBefore: 1,
        lookupCountAfter: 1,
        ipv4Addresses: [],
        ipv6Addresses: [],
        resolvedIncludes: [],
        characterCount: 44,
        errors: [],
        warnings: [],
        timestamp: new Date(),
      });

      vi.mocked(generateDKIMRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        selector: 'google',
        recordName: 'google._domainkey.example.com',
        recordType: 'TXT',
        recordValue: 'v=DKIM1; k=rsa; p=...',
        publicKey: 'publickey...',
        keyLength: 2048,
        characterCount: 150,
        requiresSplitting: false,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateDMARCRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordName: '_dmarc.example.com',
        recordType: 'TXT',
        recordValue: 'v=DMARC1; p=none',
        policy: 'none',
        percentage: 100,
        spfAlignment: 'r',
        dkimAlignment: 'r',
        characterCount: 21,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateGoogleWorkspaceMXRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordType: 'MX',
        records: [{ priority: 1, exchange: 'smtp.google.com' }],
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateTrackingDomainCNAME).mockResolvedValue({
        success: true,
        domain: 'example.com',
        trackingSubdomain: 'track',
        fullTrackingDomain: 'track.example.com',
        trackingURL: 'http://track.example.com',
        cnameTarget: 'open.sleadtrack.com',
        dnsRecord: {
          name: 'track',
          type: 'CNAME',
          content: 'open.sleadtrack.com',
          ttl: 3600,
          proxied: false,
        },
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(createDNSRecordsBatch).mockResolvedValue({
        success: true,
        totalRecords: 5,
        successfulRecords: 5,
        failedRecords: 0,
        skippedRecords: 0,
        results: [],
        errors: [],
      });

      const config: DNSSetupConfig = {
        domain: 'example.com',
        domainId: 'domain-123',
        zoneId: 'zone-456',
        apiToken: 'test-token',
        emailPlatform: 'google-workspace',
        dmarcPolicy: 'none',
        existingSPFRecord: 'v=spf1 include:_spf.google.com ~all',
        enableTracking: true,
        trackingSubdomain: 'track',
        trackingProvider: 'smartlead',
      };

      const result = await setupEmailDNS(config);

      expect(result.success).toBe(true);
      expect(result.tracking?.success).toBe(true);
      expect(result.tracking?.recordsCreated).toBe(1);
      expect(generateTrackingDomainCNAME).toHaveBeenCalledWith({
        domain: 'example.com',
        trackingSubdomain: 'track',
        provider: 'smartlead',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle SPF generation failure', async () => {
      const { flattenSPFRecord } = await import('../spf-flattener');
      const { generateDKIMRecord } = await import('../dkim-generator');
      const { generateDMARCRecord } = await import('../dmarc-generator');
      const { generateGoogleWorkspaceMXRecord } = await import('../mx-generator');
      const { createDNSRecordsBatch } = await import(
        '../cloudflare-record-creator'
      );

      // Mock SPF failure
      vi.mocked(flattenSPFRecord).mockResolvedValue({
        success: false,
        flattenedRecord: '',
        originalRecord: '',
        lookupCountBefore: 0,
        lookupCountAfter: 0,
        ipv4Addresses: [],
        ipv6Addresses: [],
        resolvedIncludes: [],
        characterCount: 0,
        errors: ['SPF lookup limit exceeded'],
        warnings: [],
        timestamp: new Date(),
      });

      // Mock other generators succeeding
      vi.mocked(generateDKIMRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        selector: 'google',
        recordName: 'google._domainkey.example.com',
        recordType: 'TXT',
        recordValue: 'v=DKIM1...',
        publicKey: 'publickey...',
        keyLength: 2048,
        characterCount: 150,
        requiresSplitting: false,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateDMARCRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordName: '_dmarc.example.com',
        recordType: 'TXT',
        recordValue: 'v=DMARC1; p=none',
        policy: 'none',
        percentage: 100,
        spfAlignment: 'r',
        dkimAlignment: 'r',
        characterCount: 21,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateGoogleWorkspaceMXRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordType: 'MX',
        records: [{ priority: 1, exchange: 'smtp.google.com' }],
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(createDNSRecordsBatch).mockResolvedValue({
        success: true,
        totalRecords: 3,
        successfulRecords: 3,
        failedRecords: 0,
        skippedRecords: 0,
        results: [],
        errors: [],
      });

      const config: DNSSetupConfig = {
        domain: 'example.com',
        domainId: 'domain-123',
        zoneId: 'zone-456',
        apiToken: 'test-token',
        emailPlatform: 'google-workspace',
        existingSPFRecord: 'v=spf1 include:_spf.google.com ~all',
      };

      const result = await setupEmailDNS(config);

      expect(result.spf?.success).toBe(false);
      expect(result.spf?.errors).toContain('SPF lookup limit exceeded');
      expect(result.dkim?.success).toBe(true);
      expect(result.dmarc?.success).toBe(true);
      expect(result.mx?.success).toBe(true);
    });

    it('should handle batch creation failure', async () => {
      const { flattenSPFRecord } = await import('../spf-flattener');
      const { generateDKIMRecord } = await import('../dkim-generator');
      const { generateDMARCRecord } = await import('../dmarc-generator');
      const { generateGoogleWorkspaceMXRecord } = await import('../mx-generator');
      const { createDNSRecordsBatch } = await import(
        '../cloudflare-record-creator'
      );

      // Mock all generators succeeding
      vi.mocked(flattenSPFRecord).mockResolvedValue({
        success: true,
        flattenedRecord: 'v=spf1 include:_spf.google.com ~all',
        errors: [],
        warnings: [],
        originalRecord: 'v=spf1 include:_spf.google.com ~all',
        lookupCountBefore: 1,
        lookupCountAfter: 1,
        ipv4Addresses: [],
        ipv6Addresses: [],
        resolvedIncludes: [],
        characterCount: 44,
        timestamp: new Date(),
      });

      vi.mocked(generateDKIMRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        selector: 'google',
        recordName: 'google._domainkey.example.com',
        recordType: 'TXT',
        recordValue: 'v=DKIM1...',
        publicKey: 'publickey...',
        keyLength: 2048,
        characterCount: 150,
        requiresSplitting: false,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateDMARCRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordName: '_dmarc.example.com',
        recordType: 'TXT',
        recordValue: 'v=DMARC1; p=none',
        policy: 'none',
        percentage: 100,
        spfAlignment: 'r',
        dkimAlignment: 'r',
        characterCount: 21,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateGoogleWorkspaceMXRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordType: 'MX',
        records: [{ priority: 1, exchange: 'smtp.google.com' }],
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      // Mock batch creation failure
      vi.mocked(createDNSRecordsBatch).mockResolvedValue({
        success: false,
        totalRecords: 4,
        successfulRecords: 2,
        failedRecords: 2,
        skippedRecords: 0,
        results: [],
        errors: ['Cloudflare API rate limit exceeded'],
      });

      const config: DNSSetupConfig = {
        domain: 'example.com',
        domainId: 'domain-123',
        zoneId: 'zone-456',
        apiToken: 'test-token',
        emailPlatform: 'google-workspace',
        existingSPFRecord: 'v=spf1 include:_spf.google.com ~all',
      };

      const result = await setupEmailDNS(config);

      expect(result.success).toBe(false);
      expect(result.recordsCreated).toBe(2);
      expect(result.recordsFailed).toBe(2);
      expect(result.errors).toContain('Cloudflare API rate limit exceeded');
    });

    it('should handle generator exception gracefully', async () => {
      const { flattenSPFRecord } = await import('../spf-flattener');
      const { generateDKIMRecord } = await import('../dkim-generator');
      const { generateDMARCRecord } = await import('../dmarc-generator');
      const { generateGoogleWorkspaceMXRecord } = await import('../mx-generator');
      const { createDNSRecordsBatch } = await import(
        '../cloudflare-record-creator'
      );

      // Mock SPF throwing exception
      vi.mocked(flattenSPFRecord).mockRejectedValue(
        new Error('DNS lookup timeout')
      );

      // Mock other generators succeeding
      vi.mocked(generateDKIMRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        selector: 'google',
        recordName: 'google._domainkey.example.com',
        recordType: 'TXT',
        recordValue: 'v=DKIM1...',
        publicKey: 'publickey...',
        keyLength: 2048,
        characterCount: 150,
        requiresSplitting: false,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateDMARCRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordName: '_dmarc.example.com',
        recordType: 'TXT',
        recordValue: 'v=DMARC1; p=none',
        policy: 'none',
        percentage: 100,
        spfAlignment: 'r',
        dkimAlignment: 'r',
        characterCount: 21,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateGoogleWorkspaceMXRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordType: 'MX',
        records: [{ priority: 1, exchange: 'smtp.google.com' }],
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(createDNSRecordsBatch).mockResolvedValue({
        success: true,
        totalRecords: 3,
        successfulRecords: 3,
        failedRecords: 0,
        skippedRecords: 0,
        results: [],
        errors: [],
      });

      const config: DNSSetupConfig = {
        domain: 'example.com',
        domainId: 'domain-123',
        zoneId: 'zone-456',
        apiToken: 'test-token',
        emailPlatform: 'google-workspace',
        existingSPFRecord: 'v=spf1 include:_spf.google.com ~all',
      };

      const result = await setupEmailDNS(config);

      expect(result.spf?.success).toBe(false);
      expect(result.spf?.errors).toEqual(['SPF generation error: DNS lookup timeout']);
      expect(result.dkim?.success).toBe(true);
      expect(result.dmarc?.success).toBe(true);
      expect(result.mx?.success).toBe(true);
    });
  });

  describe('Custom Email Platform', () => {
    it('should support custom MX records for custom email platforms', async () => {
      const { flattenSPFRecord } = await import('../spf-flattener');
      const { generateDKIMRecord } = await import('../dkim-generator');
      const { generateDMARCRecord } = await import('../dmarc-generator');
      const { createDNSRecordsBatch } = await import(
        '../cloudflare-record-creator'
      );

      // Mock generators
      vi.mocked(flattenSPFRecord).mockResolvedValue({
        success: true,
        flattenedRecord: 'v=spf1 ~all',
        originalRecord: 'v=spf1 include:_spf.google.com ~all',
        lookupCountBefore: 1,
        lookupCountAfter: 0,
        ipv4Addresses: [],
        ipv6Addresses: [],
        resolvedIncludes: [],
        characterCount: 12,
        errors: [],
        warnings: [],
        timestamp: new Date(),
      });

      vi.mocked(generateDKIMRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        selector: 'default',
        recordName: 'default._domainkey.example.com',
        recordType: 'TXT',
        recordValue: 'v=DKIM1; p=',
        publicKey: '',
        keyLength: 0,
        characterCount: 0,
        requiresSplitting: false,
        warnings: ['DKIM generation not yet implemented for custom'],
        errors: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateDMARCRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordName: '_dmarc.example.com',
        recordType: 'TXT',
        recordValue: 'v=DMARC1; p=none',
        policy: 'none',
        percentage: 100,
        spfAlignment: 'r',
        dkimAlignment: 'r',
        characterCount: 21,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      let capturedRecords: DNSRecordInput[];
      vi.mocked(createDNSRecordsBatch).mockImplementation(async (input) => {
        capturedRecords = input.records;
        return {
          success: true,
          totalRecords: input.records.length,
          successfulRecords: input.records.length,
          failedRecords: 0,
          skippedRecords: 0,
          results: [],
          errors: [],
        };
      });

      const config: DNSSetupConfig = {
        domain: 'example.com',
        domainId: 'domain-123',
        zoneId: 'zone-456',
        apiToken: 'test-token',
        emailPlatform: 'custom',
        customMXRecords: [
          { priority: 10, server: 'mail1.custom.com' },
          { priority: 20, server: 'mail2.custom.com' },
        ],
        existingSPFRecord: 'v=spf1 ~all',
      };

      const result = await setupEmailDNS(config);

      expect(result.success).toBe(true);
      expect(result.mx?.success).toBe(true);
      expect(result.mx?.recordsCreated).toBe(2);

      // Verify custom MX records were created
      const mxRecords = capturedRecords!.filter((r) => r.type === 'MX');
      expect(mxRecords).toHaveLength(2);
      expect(mxRecords[0].content).toBe('mail1.custom.com');
      expect(mxRecords[0].priority).toBe(10);
      expect(mxRecords[1].content).toBe('mail2.custom.com');
      expect(mxRecords[1].priority).toBe(20);
    });
  });

  describe('verifyDNSConfiguration', () => {
    it('should verify complete DNS configuration', async () => {
      const { getDNSRecordsForDomain } = await import(
        '../cloudflare-record-creator'
      );

      vi.mocked(getDNSRecordsForDomain).mockResolvedValue([
        { id: '1', domainId: 'domain-123', purpose: 'spf', recordType: 'TXT', name: '@', value: 'v=spf1 ~all', ttl: 3600, priority: null, status: 'active', lastCheckedAt: null, propagationStatus: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', domainId: 'domain-123', purpose: 'dkim', recordType: 'TXT', name: 'google._domainkey', value: 'v=DKIM1...', ttl: 3600, priority: null, status: 'active', lastCheckedAt: null, propagationStatus: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '3', domainId: 'domain-123', purpose: 'dmarc', recordType: 'TXT', name: '_dmarc', value: 'v=DMARC1; p=none', ttl: 3600, priority: null, status: 'active', lastCheckedAt: null, propagationStatus: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '4', domainId: 'domain-123', purpose: 'mx', recordType: 'MX', name: '@', value: 'smtp.google.com', ttl: 3600, priority: 1, status: 'active', lastCheckedAt: null, propagationStatus: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '5', domainId: 'domain-123', purpose: 'tracking', recordType: 'CNAME', name: 'track', value: 'open.sleadtrack.com', ttl: 3600, priority: null, status: 'active', lastCheckedAt: null, propagationStatus: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await verifyDNSConfiguration('domain-123');

      expect(result.success).toBe(true);
      expect(result.spfConfigured).toBe(true);
      expect(result.dkimConfigured).toBe(true);
      expect(result.dmarcConfigured).toBe(true);
      expect(result.mxConfigured).toBe(true);
      expect(result.trackingConfigured).toBe(true);
      expect(result.missingRecords).toHaveLength(0);
    });

    it('should detect missing DNS records', async () => {
      const { getDNSRecordsForDomain } = await import(
        '../cloudflare-record-creator'
      );

      vi.mocked(getDNSRecordsForDomain).mockResolvedValue([
        { id: '1', domainId: 'domain-123', purpose: 'spf', recordType: 'TXT', name: '@', value: 'v=spf1 ~all', ttl: 3600, priority: null, status: 'active', lastCheckedAt: null, propagationStatus: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', domainId: 'domain-123', purpose: 'mx', recordType: 'MX', name: '@', value: 'smtp.google.com', ttl: 3600, priority: 1, status: 'active', lastCheckedAt: null, propagationStatus: null, metadata: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await verifyDNSConfiguration('domain-123');

      expect(result.success).toBe(false);
      expect(result.spfConfigured).toBe(true);
      expect(result.dkimConfigured).toBe(false);
      expect(result.dmarcConfigured).toBe(false);
      expect(result.mxConfigured).toBe(true);
      expect(result.trackingConfigured).toBe(false);
      expect(result.missingRecords).toEqual(['DKIM', 'DMARC']);
    });
  });

  describe('SPF Include Platform Detection', () => {
    it('should add Google Workspace SPF includes', async () => {
      const { generateDKIMRecord } = await import('../dkim-generator');
      const { generateDMARCRecord } = await import('../dmarc-generator');
      const { generateGoogleWorkspaceMXRecord } = await import('../mx-generator');
      const { createDNSRecordsBatch } = await import(
        '../cloudflare-record-creator'
      );

      // Mock minimal responses
      vi.mocked(generateDKIMRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        selector: 'google',
        recordName: 'google._domainkey.example.com',
        recordType: 'TXT',
        recordValue: 'v=DKIM1; p=test',
        publicKey: 'test',
        keyLength: 2048,
        characterCount: 20,
        requiresSplitting: false,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
      });

      vi.mocked(generateDMARCRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordName: '_dmarc.example.com',
        recordType: 'TXT',
        recordValue: 'v=DMARC1; p=none',
        policy: 'none',
        percentage: 100,
        errors: [],
        warnings: [],
        generatedAt: new Date(),
        spfAlignment: 'r',
        dkimAlignment: 'r',
        characterCount: 53,
      });

      vi.mocked(generateGoogleWorkspaceMXRecord).mockResolvedValue({
        success: true,
        domain: 'example.com',
        recordType: 'MX',
        records: [],
        generatedAt: new Date(),
        errors: [],
        warnings: [],
      });

      let capturedRecords: DNSRecordInput[];
      vi.mocked(createDNSRecordsBatch).mockImplementation(async (input) => {
        capturedRecords = input.records;
        return {
          success: true,
          totalRecords: input.records.length,
          successfulRecords: input.records.length,
          failedRecords: 0,
          skippedRecords: 0,
          results: [],
          errors: [],
        };
      });

      const config: DNSSetupConfig = {
        domain: 'example.com',
        domainId: 'domain-123',
        zoneId: 'zone-456',
        apiToken: 'test-token',
        emailPlatform: 'google-workspace',
      };

      await setupEmailDNS(config);

      const spfRecord = capturedRecords!.find((r) => r.purpose === 'spf');
      expect(spfRecord).toBeDefined();
      expect(spfRecord?.content).toContain('include:_spf.google.com');
    });
  });
});
