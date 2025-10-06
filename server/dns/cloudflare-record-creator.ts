/**
 * Cloudflare DNS Record Creation Service (Task 3.9)
 *
 * Handles bulk DNS record creation via Cloudflare API with:
 * - Batch record creation support
 * - Duplicate record detection and handling
 * - Database persistence of created records
 * - Error handling with partial success support
 *
 * @example
 * const result = await createDNSRecordsBatch({
 *   zoneId: 'cloudflare-zone-id',
 *   domainId: 'database-domain-id',
 *   records: [spfRecord, dkimRecord, dmarcRecord, mxRecord],
 *   apiToken: 'cloudflare-api-token'
 * });
 */

import { createDNSRecord, listDNSRecords } from '@/lib/clients/cloudflare';
import { db } from '@/lib/db';
import { dnsRecords } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * DNS record input for batch creation
 */
export interface DNSRecordInput {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  purpose?: 'spf' | 'dkim' | 'dmarc' | 'mx' | 'tracking' | 'custom';
  metadata?: Record<string, unknown>;
}

/**
 * Batch DNS record creation input
 */
export interface BatchDNSRecordInput {
  zoneId: string;
  domainId: string;
  apiToken: string;
  records: DNSRecordInput[];
  skipDuplicates?: boolean; // If true, skip duplicate records instead of failing
}

/**
 * Single record creation result
 */
export interface DNSRecordResult {
  success: boolean;
  record?: DNSRecordInput;
  cloudflareRecordId?: string;
  databaseRecordId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Batch DNS record creation result
 */
export interface BatchDNSRecordResult {
  success: boolean;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  results: DNSRecordResult[];
  errors: string[];
}

/**
 * Create multiple DNS records in Cloudflare and persist to database
 *
 * Handles batch creation with partial success support. If some records
 * fail, the successful ones are still saved to the database.
 *
 * @param input - Batch DNS record creation input
 * @returns Batch creation result with individual record statuses
 *
 * @example
 * const result = await createDNSRecordsBatch({
 *   zoneId: 'zone-123',
 *   domainId: 'domain-456',
 *   apiToken: 'token',
 *   records: [
 *     { type: 'TXT', name: '@', content: 'v=spf1 include:_spf.google.com ~all', purpose: 'spf' },
 *     { type: 'MX', name: '@', content: 'smtp.google.com', priority: 1, purpose: 'mx' }
 *   ]
 * });
 */
export async function createDNSRecordsBatch(
  input: BatchDNSRecordInput
): Promise<BatchDNSRecordResult> {
  const { zoneId, domainId, apiToken, records, skipDuplicates = true } = input;

  const results: DNSRecordResult[] = [];
  const errors: string[] = [];

  // Step 1: Fetch existing DNS records from Cloudflare to detect duplicates
  let existingRecords: Array<{ type: string; name: string; content: string }> = [];

  try {
    const cloudflareRecords = await listDNSRecords(apiToken, zoneId);
    existingRecords = (cloudflareRecords as Array<{ type: string; name: string; content?: string }>)
      .filter((r) => r.content !== undefined)
      .map((r) => ({
        type: r.type,
        name: r.name,
        content: r.content as string,
      }));
  } catch (error) {
    console.error('Error fetching existing DNS records:', error);
    errors.push('Failed to fetch existing DNS records for duplicate detection');
  }

  // Step 2: Process each record
  for (const record of records) {
    try {
      // Check for duplicates
      const isDuplicate = existingRecords.some(
        (existing) =>
          existing.type === record.type &&
          existing.name === record.name &&
          existing.content === record.content
      );

      if (isDuplicate) {
        if (skipDuplicates) {
          results.push({
            success: true,
            record,
            skipped: true,
            reason: 'Record already exists in Cloudflare',
          });
          continue;
        } else {
          results.push({
            success: false,
            record,
            error: 'Duplicate record exists in Cloudflare',
          });
          errors.push(
            `Duplicate: ${record.type} record "${record.name}" already exists`
          );
          continue;
        }
      }

      // Step 3: Create DNS record in Cloudflare
      let cloudflareRecordId: string | undefined;

      try {
        const cloudflareRecord = await createDNSRecord(apiToken, zoneId, {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          priority: record.priority,
          proxied: record.proxied,
        });

        cloudflareRecordId = cloudflareRecord.id;
      } catch (cloudflareError) {
        console.error('Cloudflare DNS creation error:', cloudflareError);
        const errorMessage =
          cloudflareError instanceof Error
            ? cloudflareError.message
            : 'Unknown Cloudflare error';

        results.push({
          success: false,
          record,
          error: `Cloudflare API error: ${errorMessage}`,
        });
        errors.push(
          `Failed to create ${record.type} record "${record.name}": ${errorMessage}`
        );
        continue;
      }

      // Step 4: Save DNS record to database
      let databaseRecordId: string | undefined;

      try {
        const [dbRecord] = await db
          .insert(dnsRecords)
          .values({
            domainId,
            recordType: record.type,
            name: record.name,
            value: record.content,
            ttl: record.ttl || 3600,
            priority: record.priority || null,
            status: 'active',
            propagationStatus: 'pending',
            purpose: record.purpose || 'custom',
            metadata: {
              cloudflareRecordId,
              createdVia: 'batch_creation',
              ...record.metadata,
            },
          })
          .returning();

        databaseRecordId = dbRecord.id;
      } catch (dbError) {
        console.error('Database DNS record save error:', dbError);
        const errorMessage =
          dbError instanceof Error ? dbError.message : 'Unknown database error';

        results.push({
          success: false,
          record,
          cloudflareRecordId,
          error: `Database error: ${errorMessage}`,
        });
        errors.push(
          `Created in Cloudflare but failed to save to database: ${record.type} "${record.name}"`
        );
        continue;
      }

      // Step 5: Success
      results.push({
        success: true,
        record,
        cloudflareRecordId,
        databaseRecordId,
      });
    } catch (unexpectedError) {
      console.error('Unexpected error processing DNS record:', unexpectedError);
      const errorMessage =
        unexpectedError instanceof Error
          ? unexpectedError.message
          : 'Unknown error';

      results.push({
        success: false,
        record,
        error: `Unexpected error: ${errorMessage}`,
      });
      errors.push(
        `Failed to process ${record.type} record "${record.name}": ${errorMessage}`
      );
    }
  }

  // Step 6: Calculate statistics
  const successfulRecords = results.filter((r) => r.success && !r.skipped).length;
  const failedRecords = results.filter((r) => !r.success).length;
  const skippedRecords = results.filter((r) => r.skipped).length;

  return {
    success: failedRecords === 0,
    totalRecords: records.length,
    successfulRecords,
    failedRecords,
    skippedRecords,
    results,
    errors,
  };
}

/**
 * Create a single DNS record in Cloudflare and persist to database
 *
 * Simplified wrapper for single record creation.
 *
 * @param input - Single DNS record input with zone and domain IDs
 * @returns Creation result
 *
 * @example
 * const result = await createSingleDNSRecord({
 *   zoneId: 'zone-123',
 *   domainId: 'domain-456',
 *   apiToken: 'token',
 *   record: { type: 'TXT', name: '@', content: 'v=spf1 ~all', purpose: 'spf' }
 * });
 */
export async function createSingleDNSRecord(input: {
  zoneId: string;
  domainId: string;
  apiToken: string;
  record: DNSRecordInput;
}): Promise<DNSRecordResult> {
  const batchResult = await createDNSRecordsBatch({
    zoneId: input.zoneId,
    domainId: input.domainId,
    apiToken: input.apiToken,
    records: [input.record],
    skipDuplicates: true,
  });

  return batchResult.results[0];
}

/**
 * Delete a DNS record from both Cloudflare and database
 *
 * @param databaseRecordId - Database DNS record ID
 * @param apiToken - Cloudflare API token
 * @returns Deletion result
 */
export async function deleteDNSRecord(
  databaseRecordId: string,
  apiToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Get record from database
    const [record] = await db
      .select()
      .from(dnsRecords)
      .where(eq(dnsRecords.id, databaseRecordId));

    if (!record) {
      return {
        success: false,
        error: 'DNS record not found in database',
      };
    }

    // Step 2: Delete from Cloudflare if cloudflareRecordId exists
    const cloudflareRecordId = (record.metadata as Record<string, unknown>)?.cloudflareRecordId as string | undefined;

    if (cloudflareRecordId) {
      try {
        const { deleteDNSRecord: deleteFromCloudflare } = await import(
          '@/lib/clients/cloudflare'
        );

        // Get zone ID from domain
        const { domains } = await import('@/lib/db/schema');
        const [domain] = await db
          .select()
          .from(domains)
          .where(eq(domains.id, record.domainId));

        if (domain?.cloudflareZoneId) {
          await deleteFromCloudflare(
            apiToken,
            domain.cloudflareZoneId,
            cloudflareRecordId
          );
        }
      } catch (cloudflareError) {
        console.error('Failed to delete from Cloudflare:', cloudflareError);
        // Continue with database deletion even if Cloudflare deletion fails
      }
    }

    // Step 3: Delete from database
    await db.delete(dnsRecords).where(eq(dnsRecords.id, databaseRecordId));

    return { success: true };
  } catch (error) {
    console.error('Error deleting DNS record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update DNS record status in database
 *
 * Used for tracking propagation status and verification.
 *
 * @param recordId - Database DNS record ID
 * @param status - New record status
 * @param propagationStatus - New propagation status
 * @returns Update result
 */
export async function updateDNSRecordStatus(
  recordId: string,
  status?: string,
  propagationStatus?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: {
      updatedAt: Date;
      lastCheckedAt: Date;
      status?: string;
      propagationStatus?: string;
    } = {
      updatedAt: new Date(),
      lastCheckedAt: new Date(),
    };

    if (status) {
      updates.status = status;
    }

    if (propagationStatus) {
      updates.propagationStatus = propagationStatus;
    }

    await db.update(dnsRecords).set(updates).where(eq(dnsRecords.id, recordId));

    return { success: true };
  } catch (error) {
    console.error('Error updating DNS record status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all DNS records for a domain
 *
 * @param domainId - Database domain ID
 * @returns Array of DNS records
 */
export async function getDNSRecordsForDomain(domainId: string) {
  return await db
    .select()
    .from(dnsRecords)
    .where(eq(dnsRecords.domainId, domainId));
}

/**
 * Get DNS records by purpose (e.g., all SPF records)
 *
 * @param domainId - Database domain ID
 * @param purpose - Record purpose filter
 * @returns Array of DNS records matching the purpose
 */
export async function getDNSRecordsByPurpose(
  domainId: string,
  purpose: string
) {
  return await db
    .select()
    .from(dnsRecords)
    .where(and(eq(dnsRecords.domainId, domainId), eq(dnsRecords.purpose, purpose)));
}
