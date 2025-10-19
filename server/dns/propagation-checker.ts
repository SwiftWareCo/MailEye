/**
 * DNS Propagation Status Checker (Task 4.2)
 *
 * Checks DNS record propagation status across global nameservers
 * and calculates global coverage percentage. Uses the dns-query-service
 * to query multiple nameservers in parallel.
 *
 * This service provides high-level propagation status checks for:
 * - SPF records (TXT)
 * - DKIM records (TXT)
 * - DMARC records (TXT)
 * - MX records
 * - CNAME records (tracking domains)
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { dnsRecords } from '@/lib/db/schema/dns-records';
import { queryDNSAcrossServers } from './dns-query-service';
import type {
  MultiServerQueryResult,
  DNSPropagationStatus as DNSPropagationStatusType,
} from '@/lib/types/dns';

/**
 * Propagation status for a DNS record
 */
export interface DNSPropagationStatus {
  domain: string;
  recordType: 'TXT' | 'MX' | 'CNAME';
  expectedValue?: string;
  isPropagated: boolean;
  propagationPercentage: number;
  propagatedServers: number;
  totalServers: number;
  serversWithCorrectValue: string[];
  serversWithoutValue: string[];
  serversWithWrongValue: string[];
  checkedAt: Date;
}

/**
 * Global propagation coverage across multiple DNS records
 */
export interface GlobalPropagationCoverage {
  overallPercentage: number;
  totalRecords: number;
  fullyPropagated: number;
  partiallyPropagated: number;
  notPropagated: number;
  records: DNSPropagationStatus[];
  checkedAt: Date;
}

/**
 * Check DNS propagation status for a single record
 *
 * @param domain - Domain to check (e.g., "example.com" or "_dmarc.example.com")
 * @param recordType - Type of DNS record
 * @param expectedValue - Expected record value (optional)
 * @returns Propagation status with server breakdown
 */
export async function checkDNSPropagation(
  domain: string,
  recordType: 'TXT' | 'MX' | 'CNAME',
  expectedValue?: string
): Promise<DNSPropagationStatus> {
  const queryResult: MultiServerQueryResult = await queryDNSAcrossServers(
    domain,
    recordType,
    expectedValue
  );

  // Categorize servers by their status
  const serversWithCorrectValue: string[] = [];
  const serversWithoutValue: string[] = [];
  const serversWithWrongValue: string[] = [];

  for (const serverResult of queryResult.serverResults) {
    if (serverResult.matchesExpected && serverResult.success) {
      serversWithCorrectValue.push(serverResult.server);
    } else if (!serverResult.success || serverResult.records.length === 0) {
      serversWithoutValue.push(serverResult.server);
    } else {
      // Has records, but they don't match expected value
      serversWithWrongValue.push(serverResult.server);
    }
  }

  return {
    domain,
    recordType,
    expectedValue,
    isPropagated: queryResult.isPropagated,
    propagationPercentage: queryResult.propagationPercentage,
    propagatedServers: queryResult.propagatedServers,
    totalServers: queryResult.totalServers,
    serversWithCorrectValue,
    serversWithoutValue,
    serversWithWrongValue,
    checkedAt: queryResult.queriedAt,
  };
}

/**
 * Check SPF record propagation
 *
 * @param domain - Root domain (e.g., "example.com")
 * @param expectedSPF - Expected SPF record value (optional)
 * @returns SPF propagation status
 */
export async function checkSPFPropagation(
  domain: string,
  expectedSPF?: string
): Promise<DNSPropagationStatus> {
  return checkDNSPropagation(domain, 'TXT', expectedSPF);
}

/**
 * Check DKIM record propagation
 *
 * @param domain - Root domain (e.g., "example.com")
 * @param selector - DKIM selector (e.g., "google", "default")
 * @param expectedDKIM - Expected DKIM record value (optional)
 * @returns DKIM propagation status
 */
export async function checkDKIMPropagation(
  domain: string,
  selector: string,
  expectedDKIM?: string
): Promise<DNSPropagationStatus> {
  const dkimDomain = `${selector}._domainkey.${domain}`;
  return checkDNSPropagation(dkimDomain, 'TXT', expectedDKIM);
}

/**
 * Check DMARC record propagation
 *
 * @param domain - Root domain (e.g., "example.com")
 * @param expectedDMARC - Expected DMARC record value (optional)
 * @returns DMARC propagation status
 */
export async function checkDMARCPropagation(
  domain: string,
  expectedDMARC?: string
): Promise<DNSPropagationStatus> {
  const dmarcDomain = `_dmarc.${domain}`;
  return checkDNSPropagation(dmarcDomain, 'TXT', expectedDMARC);
}

/**
 * Check MX record propagation
 *
 * @param domain - Root domain (e.g., "example.com")
 * @param expectedMX - Expected MX server hostname (optional)
 * @returns MX propagation status
 */
export async function checkMXPropagation(
  domain: string,
  expectedMX?: string
): Promise<DNSPropagationStatus> {
  return checkDNSPropagation(domain, 'MX', expectedMX);
}

/**
 * Check tracking domain CNAME propagation
 *
 * @param trackingDomain - Full tracking domain (e.g., "track.example.com")
 * @param expectedTarget - Expected CNAME target (e.g., "open.sleadtrack.com")
 * @returns CNAME propagation status
 */
export async function checkTrackingDomainPropagation(
  trackingDomain: string,
  expectedTarget?: string
): Promise<DNSPropagationStatus> {
  return checkDNSPropagation(trackingDomain, 'CNAME', expectedTarget);
}

/**
 * Calculate global propagation coverage across multiple DNS records
 *
 * This aggregates propagation status for all DNS records (SPF, DKIM, DMARC, MX, CNAME)
 * and calculates overall propagation percentage.
 *
 * @param records - Array of DNS propagation statuses to aggregate
 * @returns Global propagation coverage summary
 *
 * @example
 * const spfStatus = await checkSPFPropagation('example.com', 'v=spf1 ...');
 * const dmarcStatus = await checkDMARCPropagation('example.com', 'v=DMARC1 ...');
 * const coverage = calculateGlobalCoverage([spfStatus, dmarcStatus]);
 * // coverage.overallPercentage = 85 (if both are 85% propagated)
 */
export function calculateGlobalCoverage(
  records: DNSPropagationStatus[]
): GlobalPropagationCoverage {
  if (records.length === 0) {
    return {
      overallPercentage: 0,
      totalRecords: 0,
      fullyPropagated: 0,
      partiallyPropagated: 0,
      notPropagated: 0,
      records: [],
      checkedAt: new Date(),
    };
  }

  // Calculate overall percentage (average of all records)
  const totalPercentage = records.reduce(
    (sum, record) => sum + record.propagationPercentage,
    0
  );
  const overallPercentage = Math.round(totalPercentage / records.length);

  // Categorize records by propagation status
  let fullyPropagated = 0;
  let partiallyPropagated = 0;
  let notPropagated = 0;

  for (const record of records) {
    if (record.propagationPercentage === 100) {
      fullyPropagated++;
    } else if (record.propagationPercentage > 0) {
      partiallyPropagated++;
    } else {
      notPropagated++;
    }
  }

  return {
    overallPercentage,
    totalRecords: records.length,
    fullyPropagated,
    partiallyPropagated,
    notPropagated,
    records,
    checkedAt: new Date(),
  };
}

/**
 * Check all DNS records for a domain (SPF, DKIM, DMARC, MX, tracking)
 *
 * This is a convenience function that checks all common DNS records
 * and returns a global propagation coverage summary.
 *
 * @param config - Configuration for DNS propagation check
 * @returns Global propagation coverage for all DNS records
 *
 * @example
 * const coverage = await checkAllDNSRecords({
 *   domain: 'example.com',
 *   expectedSPF: 'v=spf1 include:_spf.google.com ~all',
 *   dkimSelector: 'google',
 *   expectedDKIM: 'v=DKIM1; k=rsa; p=...',
 *   expectedDMARC: 'v=DMARC1; p=quarantine; ...',
 *   expectedMX: 'smtp.google.com',
 *   trackingDomain: 'track.example.com',
 *   expectedTrackingTarget: 'open.sleadtrack.com',
 * });
 *
 * console.log(`Overall propagation: ${coverage.overallPercentage}%`);
 * console.log(`Fully propagated: ${coverage.fullyPropagated}/${coverage.totalRecords}`);
 */
export async function checkAllDNSRecords(config: {
  domain: string;
  expectedSPF?: string;
  dkimSelector?: string;
  expectedDKIM?: string;
  expectedDMARC?: string;
  expectedMX?: string;
  trackingDomain?: string;
  expectedTrackingTarget?: string;
}): Promise<GlobalPropagationCoverage> {
  const checks: Promise<DNSPropagationStatus>[] = [];

  // Check SPF
  if (config.expectedSPF) {
    checks.push(checkSPFPropagation(config.domain, config.expectedSPF));
  }

  // Check DKIM
  if (config.dkimSelector && config.expectedDKIM) {
    checks.push(
      checkDKIMPropagation(
        config.domain,
        config.dkimSelector,
        config.expectedDKIM
      )
    );
  }

  // Check DMARC
  if (config.expectedDMARC) {
    checks.push(checkDMARCPropagation(config.domain, config.expectedDMARC));
  }

  // Check MX
  if (config.expectedMX) {
    checks.push(checkMXPropagation(config.domain, config.expectedMX));
  }

  // Check tracking domain CNAME
  if (config.trackingDomain && config.expectedTrackingTarget) {
    checks.push(
      checkTrackingDomainPropagation(
        config.trackingDomain,
        config.expectedTrackingTarget
      )
    );
  }

  // Execute all checks in parallel
  const results = await Promise.all(checks);

  // Calculate global coverage
  return calculateGlobalCoverage(results);
}

/**
 * Database Integration Functions
 * These functions fetch DNS records from the database and update their propagation status
 */

/**
 * DNS record info from database
 */
export interface DNSRecordInfo {
  id: string;
  domainId: string;
  recordType: string;
  name: string;
  value: string;
}

/**
 * Build full domain name for DNS query
 * Handles @ notation and subdomain prefixes
 */
export function buildFullDomainName(
  recordName: string,
  baseDomain: string
): string {
  // If recordName is '@' or empty, use base domain
  if (recordName === '@' || recordName === '' || recordName === baseDomain) {
    return baseDomain;
  }

  // If recordName already includes the domain, return as-is
  if (recordName.endsWith(`.${baseDomain}`)) {
    return recordName;
  }

  // Otherwise, append recordName to domain
  return `${recordName}.${baseDomain}`;
}

/**
 * Determine propagation status enum based on percentage
 */
export function determinePropagationStatusEnum(
  propagationPercentage: number
): DNSPropagationStatusType {
  if (propagationPercentage >= 100) {
    return 'propagated';
  } else if (propagationPercentage >= 40) {
    return 'propagating';
  } else if (propagationPercentage > 0) {
    return 'pending';
  } else {
    return 'pending';
  }
}

/**
 * Check propagation for a single DNS record from database
 */
export async function checkRecordPropagationFromDB(
  recordId: string,
  baseDomain: string
): Promise<DNSPropagationStatus & { recordId: string }> {
  // Fetch record from database
  const [record] = await db
    .select({
      id: dnsRecords.id,
      domainId: dnsRecords.domainId,
      recordType: dnsRecords.recordType,
      name: dnsRecords.name,
      value: dnsRecords.value,
    })
    .from(dnsRecords)
    .where(eq(dnsRecords.id, recordId));

  if (!record) {
    throw new Error(`DNS record ${recordId} not found`);
  }

  // Only check supported record types
  if (
    record.recordType !== 'TXT' &&
    record.recordType !== 'MX' &&
    record.recordType !== 'CNAME'
  ) {
    throw new Error(
      `Record type ${record.recordType} not supported for propagation checking`
    );
  }

  // Build full domain and check propagation
  const fullDomain = buildFullDomainName(record.name, baseDomain);
  const propagationStatus = await checkDNSPropagation(
    fullDomain,
    record.recordType as 'TXT' | 'MX' | 'CNAME',
    record.value
  );

  return {
    ...propagationStatus,
    recordId: record.id,
  };
}

/**
 * Check propagation for all DNS records of a domain from database
 */
export async function checkDomainPropagationFromDB(
  domainId: string,
  baseDomain: string
): Promise<GlobalPropagationCoverage & { domainId: string }> {
  // Fetch all active DNS records for this domain
  const records = await db
    .select({
      id: dnsRecords.id,
      domainId: dnsRecords.domainId,
      recordType: dnsRecords.recordType,
      name: dnsRecords.name,
      value: dnsRecords.value,
    })
    .from(dnsRecords)
    .where(and(eq(dnsRecords.domainId, domainId), eq(dnsRecords.status, 'active')));

  // Filter to only supported record types
  const supportedRecords = records.filter(
    (record) =>
      record.recordType === 'TXT' ||
      record.recordType === 'MX' ||
      record.recordType === 'CNAME'
  );

  // Check propagation for each record
  const propagationResults = await Promise.all(
    supportedRecords.map(async (record) => {
      const fullDomain = buildFullDomainName(record.name, baseDomain);
      return checkDNSPropagation(
        fullDomain,
        record.recordType as 'TXT' | 'MX' | 'CNAME',
        record.value
      );
    })
  );

  // Calculate global coverage
  const coverage = calculateGlobalCoverage(propagationResults);

  return {
    ...coverage,
    domainId,
  };
}

/**
 * Update DNS record propagation status in database
 * Note: Schema doesn't have propagationStatus/lastCheckedAt fields yet
 * This function is ready for when schema is updated
 *
 * @param recordId - DNS record ID
 * @param propagationPercentage - Propagation percentage (0-100) - currently unused
 * @param checkedAt - When the check was performed - currently unused
 */
export async function updateRecordPropagationStatus(
  recordId: string,
  propagationPercentage: number,
  checkedAt: Date
): Promise<void> {
  // Silence unused variable warnings - these will be used when schema is updated
  void propagationPercentage;
  void checkedAt;

  // const propagationStatus = determinePropagationStatusEnum(propagationPercentage);

  // TODO: Add propagationStatus and lastCheckedAt to dns_records schema
  // For now, just update the updatedAt timestamp
  await db
    .update(dnsRecords)
    .set({
      // propagationStatus,
      // lastCheckedAt: checkedAt,
      updatedAt: new Date(),
    })
    .where(eq(dnsRecords.id, recordId));
}

/**
 * Check propagation and update database for a single record
 */
export async function checkAndUpdateRecordPropagation(
  recordId: string,
  baseDomain: string
): Promise<DNSPropagationStatus & { recordId: string }> {
  const result = await checkRecordPropagationFromDB(recordId, baseDomain);

  await updateRecordPropagationStatus(
    result.recordId,
    result.propagationPercentage,
    result.checkedAt
  );

  return result;
}

/**
 * Check propagation and update database for all domain records
 */
export async function checkAndUpdateDomainPropagation(
  domainId: string,
  baseDomain: string
): Promise<GlobalPropagationCoverage & { domainId: string }> {
  const result = await checkDomainPropagationFromDB(domainId, baseDomain);

  // Update all record statuses in database
  const records = await db
    .select({
      id: dnsRecords.id,
      recordType: dnsRecords.recordType,
    })
    .from(dnsRecords)
    .where(and(eq(dnsRecords.domainId, domainId), eq(dnsRecords.status, 'active')));

  const supportedRecordIds = records
    .filter(
      (r) => r.recordType === 'TXT' || r.recordType === 'MX' || r.recordType === 'CNAME'
    )
    .map((r) => r.id);

  // Update each record with its propagation status
  await Promise.all(
    result.records.map((propagationStatus, index) => {
      const recordId = supportedRecordIds[index];
      if (recordId) {
        return updateRecordPropagationStatus(
          recordId,
          propagationStatus.propagationPercentage,
          propagationStatus.checkedAt
        );
      }
      return Promise.resolve();
    })
  );

  return result;
}
