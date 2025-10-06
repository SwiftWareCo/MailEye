/**
 * Unit tests for Cloudflare DNS Record Creation Service (Task 3.9)
 *
 * Tests cover:
 * - Batch DNS record creation
 * - Duplicate record detection and handling
 * - Database persistence
 * - Error handling and partial success scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDNSRecordsBatch,
  createSingleDNSRecord,
  updateDNSRecordStatus,
  getDNSRecordsForDomain,
  getDNSRecordsByPurpose,
  type BatchDNSRecordInput,
} from '../cloudflare-record-creator';

// Mock dependencies
vi.mock('@/lib/clients/cloudflare', () => ({
  createDNSRecord: vi.fn(),
  listDNSRecords: vi.fn(),
  deleteDNSRecord: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  dnsRecords: {},
  domains: {},
}));

describe('Cloudflare DNS Record Creation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDNSRecordsBatch', () => {
    it('should successfully create multiple DNS records', async () => {
      const { createDNSRecord, listDNSRecords } = await import(
        '@/lib/clients/cloudflare'
      );
      const { db } = await import('@/lib/db');

      // Mock no existing records (no duplicates)
      vi.mocked(listDNSRecords).mockResolvedValue([]);

      // Mock Cloudflare record creation
      vi.mocked(createDNSRecord)
        .mockResolvedValueOnce({ id: 'cf-record-1' } as Awaited<ReturnType<typeof createDNSRecord>>)
        .mockResolvedValueOnce({ id: 'cf-record-2' } as Awaited<ReturnType<typeof createDNSRecord>>);

      // Mock database insertion
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn()
          .mockResolvedValueOnce([{ id: 'db-record-1' }])
          .mockResolvedValueOnce([{ id: 'db-record-2' }]),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as unknown as ReturnType<typeof db.insert>);

      const input: BatchDNSRecordInput = {
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'TXT',
            name: '@',
            content: 'v=spf1 include:_spf.google.com ~all',
            purpose: 'spf',
          },
          {
            type: 'MX',
            name: '@',
            content: 'smtp.google.com',
            priority: 1,
            purpose: 'mx',
          },
        ],
      };

      const result = await createDNSRecordsBatch(input);

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
      expect(result.failedRecords).toBe(0);
      expect(result.skippedRecords).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].cloudflareRecordId).toBe('cf-record-1');
      expect(result.results[1].cloudflareRecordId).toBe('cf-record-2');
    });

    it('should skip duplicate records when skipDuplicates is true', async () => {
      const { listDNSRecords } = await import('@/lib/clients/cloudflare');

      // Mock existing duplicate record
      vi.mocked(listDNSRecords).mockResolvedValue([
        {
          type: 'TXT',
          name: '@',
          content: 'v=spf1 include:_spf.google.com ~all',
        },
      ] as Awaited<ReturnType<typeof listDNSRecords>>);

      const input: BatchDNSRecordInput = {
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'TXT',
            name: '@',
            content: 'v=spf1 include:_spf.google.com ~all',
            purpose: 'spf',
          },
        ],
        skipDuplicates: true,
      };

      const result = await createDNSRecordsBatch(input);

      expect(result.success).toBe(true);
      expect(result.skippedRecords).toBe(1);
      expect(result.successfulRecords).toBe(0);
      expect(result.results[0].skipped).toBe(true);
      expect(result.results[0].reason).toContain('already exists');
    });

    it('should fail duplicate records when skipDuplicates is false', async () => {
      const { listDNSRecords } = await import('@/lib/clients/cloudflare');

      // Mock existing duplicate record
      vi.mocked(listDNSRecords).mockResolvedValue([
        {
          type: 'TXT',
          name: '@',
          content: 'v=spf1 include:_spf.google.com ~all',
        },
      ] as Awaited<ReturnType<typeof listDNSRecords>>);

      const input: BatchDNSRecordInput = {
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'TXT',
            name: '@',
            content: 'v=spf1 include:_spf.google.com ~all',
            purpose: 'spf',
          },
        ],
        skipDuplicates: false,
      };

      const result = await createDNSRecordsBatch(input);

      expect(result.success).toBe(false);
      expect(result.failedRecords).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Duplicate');
    });

    it('should handle partial success (some records succeed, some fail)', async () => {
      const { createDNSRecord, listDNSRecords } = await import(
        '@/lib/clients/cloudflare'
      );
      const { db } = await import('@/lib/db');

      // Mock no existing records
      vi.mocked(listDNSRecords).mockResolvedValue([]);

      // Mock first record succeeds, second fails
      vi.mocked(createDNSRecord)
        .mockResolvedValueOnce({ id: 'cf-record-1' } as Awaited<ReturnType<typeof createDNSRecord>>)
        .mockRejectedValueOnce(new Error('Cloudflare API rate limit exceeded'));

      // Mock database insertion for successful record
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'db-record-1' }]),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as unknown as ReturnType<typeof db.insert>);

      const input: BatchDNSRecordInput = {
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'TXT',
            name: '@',
            content: 'v=spf1 ~all',
            purpose: 'spf',
          },
          {
            type: 'MX',
            name: '@',
            content: 'smtp.google.com',
            priority: 1,
            purpose: 'mx',
          },
        ],
      };

      const result = await createDNSRecordsBatch(input);

      expect(result.success).toBe(false); // Overall failed due to one failure
      expect(result.successfulRecords).toBe(1);
      expect(result.failedRecords).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('rate limit');
    });

    it('should handle database save failure after Cloudflare success', async () => {
      const { createDNSRecord, listDNSRecords } = await import(
        '@/lib/clients/cloudflare'
      );
      const { db } = await import('@/lib/db');

      // Mock no existing records
      vi.mocked(listDNSRecords).mockResolvedValue([]);

      // Mock Cloudflare success
      vi.mocked(createDNSRecord).mockResolvedValue({ id: 'cf-record-1' } as Awaited<ReturnType<typeof createDNSRecord>>);

      // Mock database failure
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockRejectedValue(new Error('Database connection timeout')),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as unknown as ReturnType<typeof db.insert>);

      const input: BatchDNSRecordInput = {
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'TXT',
            name: '@',
            content: 'v=spf1 ~all',
            purpose: 'spf',
          },
        ],
      };

      const result = await createDNSRecordsBatch(input);

      expect(result.success).toBe(false);
      expect(result.failedRecords).toBe(1);
      expect(result.results[0].cloudflareRecordId).toBe('cf-record-1'); // Cloudflare creation succeeded
      expect(result.results[0].databaseRecordId).toBeUndefined(); // Database save failed
      expect(result.results[0].error).toContain('Database error');
    });

    it('should handle listDNSRecords failure gracefully', async () => {
      const { createDNSRecord, listDNSRecords } = await import(
        '@/lib/clients/cloudflare'
      );
      const { db } = await import('@/lib/db');

      // Mock listDNSRecords failure
      vi.mocked(listDNSRecords).mockRejectedValue(
        new Error('Cloudflare API unavailable')
      );

      // Mock successful creation (should proceed despite list failure)
      vi.mocked(createDNSRecord).mockResolvedValue({ id: 'cf-record-1' } as Awaited<ReturnType<typeof createDNSRecord>>);

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'db-record-1' }]),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as unknown as ReturnType<typeof db.insert>);

      const input: BatchDNSRecordInput = {
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'TXT',
            name: '@',
            content: 'v=spf1 ~all',
            purpose: 'spf',
          },
        ],
      };

      const result = await createDNSRecordsBatch(input);

      // Should succeed despite list failure (duplicate detection skipped)
      expect(result.success).toBe(true);
      expect(result.successfulRecords).toBe(1);
      expect(result.errors).toContain(
        'Failed to fetch existing DNS records for duplicate detection'
      );
    });

    it('should create records with proper TTL and priority', async () => {
      const { createDNSRecord, listDNSRecords } = await import(
        '@/lib/clients/cloudflare'
      );
      const { db } = await import('@/lib/db');

      vi.mocked(listDNSRecords).mockResolvedValue([]);
      vi.mocked(createDNSRecord).mockResolvedValue({ id: 'cf-record-1' } as Awaited<ReturnType<typeof createDNSRecord>>);

      let capturedValues: unknown;
      const mockInsert = {
        values: vi.fn((vals: unknown) => {
          capturedValues = vals;
          return mockInsert;
        }),
        returning: vi.fn().mockResolvedValue([{ id: 'db-record-1' }]),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as unknown as ReturnType<typeof db.insert>);

      const input: BatchDNSRecordInput = {
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'MX',
            name: '@',
            content: 'smtp.google.com',
            ttl: 1800,
            priority: 10,
            purpose: 'mx',
            metadata: { customField: 'test-value' },
          },
        ],
      };

      await createDNSRecordsBatch(input);

      expect((capturedValues as Record<string, unknown>).ttl).toBe(1800);
      expect((capturedValues as Record<string, unknown>).priority).toBe(10);
      expect((capturedValues as Record<string, unknown>).purpose).toBe('mx');
      expect((capturedValues as Record<string, Record<string, unknown>>).metadata.customField).toBe('test-value');
      expect((capturedValues as Record<string, Record<string, unknown>>).metadata.cloudflareRecordId).toBe('cf-record-1');
    });
  });

  describe('createSingleDNSRecord', () => {
    it('should create a single DNS record using batch function', async () => {
      const { createDNSRecord, listDNSRecords } = await import(
        '@/lib/clients/cloudflare'
      );
      const { db } = await import('@/lib/db');

      vi.mocked(listDNSRecords).mockResolvedValue([]);
      vi.mocked(createDNSRecord).mockResolvedValue({ id: 'cf-record-1' } as Awaited<ReturnType<typeof createDNSRecord>>);

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'db-record-1' }]),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as unknown as ReturnType<typeof db.insert>);

      const result = await createSingleDNSRecord({
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        record: {
          type: 'TXT',
          name: '@',
          content: 'v=spf1 ~all',
          purpose: 'spf',
        },
      });

      expect(result.success).toBe(true);
      expect(result.cloudflareRecordId).toBe('cf-record-1');
      expect(result.databaseRecordId).toBe('db-record-1');
    });
  });

  describe('updateDNSRecordStatus', () => {
    it('should update DNS record status and propagation status', async () => {
      const { db } = await import('@/lib/db');

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdate as unknown as ReturnType<typeof db.update>);

      const result = await updateDNSRecordStatus(
        'record-123',
        'verified',
        'propagated'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'verified',
          propagationStatus: 'propagated',
        })
      );
    });

    it('should handle update errors', async () => {
      const { db } = await import('@/lib/db');

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database update failed')),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdate as unknown as ReturnType<typeof db.update>);

      const result = await updateDNSRecordStatus('record-123', 'verified');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database update failed');
    });
  });

  describe('getDNSRecordsForDomain', () => {
    it('should retrieve all DNS records for a domain', async () => {
      const { db } = await import('@/lib/db');

      const mockRecords = [
        { id: 'record-1', recordType: 'TXT', purpose: 'spf' },
        { id: 'record-2', recordType: 'MX', purpose: 'mx' },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockRecords),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as unknown as ReturnType<typeof db.select>);

      const records = await getDNSRecordsForDomain('domain-123');

      expect(records).toEqual(mockRecords);
      expect(mockSelect.from).toHaveBeenCalled();
      expect(mockSelect.where).toHaveBeenCalled();
    });
  });

  describe('getDNSRecordsByPurpose', () => {
    it('should retrieve DNS records filtered by purpose', async () => {
      const { db } = await import('@/lib/db');

      const mockRecords = [{ id: 'record-1', recordType: 'TXT', purpose: 'spf' }];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockRecords),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as unknown as ReturnType<typeof db.select>);

      const records = await getDNSRecordsByPurpose('domain-123', 'spf');

      expect(records).toEqual(mockRecords);
      expect(mockSelect.where).toHaveBeenCalled();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle empty records array', async () => {
      const { listDNSRecords } = await import('@/lib/clients/cloudflare');

      vi.mocked(listDNSRecords).mockResolvedValue([]);

      const result = await createDNSRecordsBatch({
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [],
      });

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(0);
      expect(result.successfulRecords).toBe(0);
      expect(result.failedRecords).toBe(0);
    });

    it('should handle unexpected errors during processing', async () => {
      const { listDNSRecords } = await import('@/lib/clients/cloudflare');

      // Mock listDNSRecords to throw unexpected error type
      vi.mocked(listDNSRecords).mockImplementation(() => {
        throw 'String error'; // Non-Error type
      });

      const result = await createDNSRecordsBatch({
        zoneId: 'zone-123',
        domainId: 'domain-456',
        apiToken: 'test-token',
        records: [
          {
            type: 'TXT',
            name: '@',
            content: 'test',
            purpose: 'custom',
          },
        ],
      });

      expect(result.errors).toContain(
        'Failed to fetch existing DNS records for duplicate detection'
      );
    });
  });
});
