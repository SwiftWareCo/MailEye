/**
 * DNS Polling Job Service (Task 4.3)
 *
 * Background polling job that checks DNS propagation every 30 seconds.
 * Polls DNS servers for all records associated with a domain until:
 * - All records are fully propagated (100% coverage), OR
 * - Maximum polling duration is reached (48 hours), OR
 * - Polling is manually cancelled
 *
 * This service integrates with:
 * - propagation-checker.ts (Task 4.2) for DNS queries
 * - dns-polling schema (Task 1.7) for session tracking
 * - dns-records schema for fetching records to check
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { dnsPollingSession } from '@/lib/db/schema/dns-polling';
import { dnsRecords } from '@/lib/db/schema/dns-records';
import { domains } from '@/lib/db/schema/domains';
import {
  checkSPFPropagation,
  checkDKIMPropagation,
  checkDMARCPropagation,
  checkMXPropagation,
  checkTrackingDomainPropagation,
  calculateGlobalCoverage,
  type DNSPropagationStatus,
  type GlobalPropagationCoverage,
} from './propagation-checker';

/**
 * Polling session status
 */
export type PollingSessionStatus = 'polling' | 'completed' | 'timeout' | 'cancelled';

/**
 * Polling session data
 */
export interface PollingSession {
  id: string;
  domainId: string;
  userId: string;
  status: PollingSessionStatus;
  checkInterval: number; // milliseconds
  maxDuration: number; // milliseconds
  startedAt: Date;
  lastCheckedAt: Date | null;
  completedAt: Date | null;
  estimatedCompletion: Date | null;
  totalRecords: number;
  propagatedRecords: number;
  overallProgress: number; // 0-100%
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DNS record to check during polling
 */
interface DNSRecordToCheck {
  id: string;
  recordType: string;
  name: string;
  value: string;
  purpose: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Helper to build full domain name from record name and domain
 */
function buildFullDomainName(recordName: string, domainName: string): string {
  if (recordName === '@' || recordName === '') {
    return domainName;
  }
  return `${recordName}.${domainName}`;
}

/**
 * Start a new DNS polling session for a domain
 *
 * Creates a new polling session in the database and returns the session ID.
 * The frontend will use this session ID to poll for status updates.
 *
 * @param domainId - Domain ID to poll DNS records for
 * @param userId - User ID initiating the polling
 * @returns Created polling session
 */
export async function startPollingSession(
  domainId: string,
  userId: string
): Promise<PollingSession> {
  // Check if there's already an active polling session for this domain
  const existingSession = await db
    .select()
    .from(dnsPollingSession)
    .where(
      and(
        eq(dnsPollingSession.domainId, domainId),
        eq(dnsPollingSession.status, 'polling')
      )
    )
    .limit(1);

  // If active session exists, return it
  if (existingSession.length > 0) {
    return existingSession[0] as PollingSession;
  }

  // Count total DNS records for this domain
  const recordsCount = await db
    .select()
    .from(dnsRecords)
    .where(
      and(
        eq(dnsRecords.domainId, domainId),
        eq(dnsRecords.status, 'active')
      )
    );

  const totalRecords = recordsCount.length;

  // Create new polling session
  const [session] = await db
    .insert(dnsPollingSession)
    .values({
      domainId,
      userId,
      status: 'polling',
      checkInterval: 30000, // 30 seconds
      maxDuration: 172800000, // 48 hours
      totalRecords,
      propagatedRecords: 0,
      overallProgress: 0,
      estimatedCompletion: null,
      metadata: {},
    })
    .returning();

  return session as PollingSession;
}

/**
 * Check DNS propagation for a polling session
 *
 * Queries DNS servers for all records in the domain, updates propagation status,
 * and determines if polling is complete.
 *
 * @param sessionId - Polling session ID
 * @returns Updated polling session with current status
 */
export async function checkPollingProgress(
  sessionId: string
): Promise<PollingSession> {
  // Fetch the polling session
  const [session] = await db
    .select()
    .from(dnsPollingSession)
    .where(eq(dnsPollingSession.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Polling session not found: ${sessionId}`);
  }

  // If session is not polling, return current state
  if (session.status !== 'polling') {
    return session as PollingSession;
  }

  // Check if session has timed out (48 hours max)
  const now = new Date();
  const elapsedTime = now.getTime() - new Date(session.startedAt).getTime();
  if (elapsedTime > session.maxDuration) {
    // Update session to timeout status
    const [updatedSession] = await db
      .update(dnsPollingSession)
      .set({
        status: 'timeout',
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(dnsPollingSession.id, sessionId))
      .returning();

    return updatedSession as PollingSession;
  }

  // Fetch domain details
  const [domainRecord] = await db
    .select()
    .from(domains)
    .where(eq(domains.id, session.domainId))
    .limit(1);

  if (!domainRecord) {
    throw new Error(`Domain not found: ${session.domainId}`);
  }

  // Fetch all active DNS records for this domain
  const records = await db
    .select({
      id: dnsRecords.id,
      recordType: dnsRecords.recordType,
      name: dnsRecords.name,
      value: dnsRecords.value,
      purpose: dnsRecords.purpose,
      metadata: dnsRecords.metadata,
    })
    .from(dnsRecords)
    .where(
      and(
        eq(dnsRecords.domainId, session.domainId),
        eq(dnsRecords.status, 'active')
      )
    );

  // Check propagation for each record type
  const propagationChecks: Promise<{
    recordId: string;
    status: DNSPropagationStatus;
  }>[] = [];

  for (const record of records as DNSRecordToCheck[]) {
    const checkPromise = (async () => {
      let status: DNSPropagationStatus;

      if (record.purpose === 'spf' || record.recordType === 'SPF') {
        status = await checkSPFPropagation(domainRecord.domain, record.value);
      } else if (record.purpose === 'dkim' || record.recordType === 'DKIM') {
        // Extract DKIM selector from record name (e.g., "google._domainkey" -> "google")
        const selector = record.name.split('.')[0];
        status = await checkDKIMPropagation(
          domainRecord.domain,
          selector,
          record.value
        );
      } else if (record.purpose === 'dmarc' || record.recordType === 'DMARC') {
        status = await checkDMARCPropagation(domainRecord.domain, record.value);
      } else if (record.recordType === 'MX') {
        status = await checkMXPropagation(domainRecord.domain, record.value);
      } else if (record.recordType === 'CNAME' && record.purpose === 'tracking') {
        const fullDomain = buildFullDomainName(record.name, domainRecord.domain);
        status = await checkTrackingDomainPropagation(fullDomain, record.value);
      } else {
        // Default to TXT record check
        const fullDomain = buildFullDomainName(record.name, domainRecord.domain);
        status = await checkSPFPropagation(fullDomain, record.value);
      }

      return { recordId: record.id, status };
    })();

    propagationChecks.push(checkPromise);
  }

  // Execute all propagation checks in parallel
  const results = await Promise.all(propagationChecks);

  // Update database with propagation status for each record
  const updatePromises = results.map(({ recordId, status }) => {
    // Determine propagation status based on coverage
    let propagationStatus: string;
    if (status.propagatedServers === status.totalServers && status.totalServers > 0) {
      propagationStatus = 'propagated';
    } else if (status.propagatedServers > 0) {
      propagationStatus = 'propagating';
    } else {
      propagationStatus = 'pending';
    }

    // Calculate coverage percentage (0-100)
    const propagationCoverage = status.totalServers > 0
      ? Math.round((status.propagatedServers / status.totalServers) * 100)
      : 0;

    return db
      .update(dnsRecords)
      .set({
        propagationStatus,
        propagationCoverage,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(dnsRecords.id, recordId));
  });

  await Promise.all(updatePromises);

  // Calculate global coverage
  const statuses = results.map((r) => r.status);
  const coverage: GlobalPropagationCoverage = calculateGlobalCoverage(statuses);

  // Determine if polling is complete (all records 100% propagated)
  const isComplete = coverage.overallPercentage === 100;

  // Update polling session
  const [updatedSession] = await db
    .update(dnsPollingSession)
    .set({
      status: isComplete ? 'completed' : 'polling',
      lastCheckedAt: now,
      completedAt: isComplete ? now : null,
      propagatedRecords: coverage.fullyPropagated,
      overallProgress: coverage.overallPercentage,
      metadata: {
        fullyPropagated: coverage.fullyPropagated,
        partiallyPropagated: coverage.partiallyPropagated,
        notPropagated: coverage.notPropagated,
      },
      updatedAt: now,
    })
    .where(eq(dnsPollingSession.id, sessionId))
    .returning();

  return updatedSession as PollingSession;
}

/**
 * Get current status of a polling session
 *
 * @param sessionId - Polling session ID
 * @returns Current polling session status
 */
export async function getPollingStatus(
  sessionId: string
): Promise<PollingSession | null> {
  const [session] = await db
    .select()
    .from(dnsPollingSession)
    .where(eq(dnsPollingSession.id, sessionId))
    .limit(1);

  return session ? (session as PollingSession) : null;
}

/**
 * Cancel an active polling session
 *
 * @param sessionId - Polling session ID
 * @returns Updated polling session
 */
export async function cancelPollingSession(
  sessionId: string
): Promise<PollingSession> {
  const now = new Date();

  const [updatedSession] = await db
    .update(dnsPollingSession)
    .set({
      status: 'cancelled',
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(dnsPollingSession.id, sessionId))
    .returning();

  if (!updatedSession) {
    throw new Error(`Polling session not found: ${sessionId}`);
  }

  return updatedSession as PollingSession;
}

/**
 * Get active polling session for a domain
 *
 * @param domainId - Domain ID
 * @returns Active polling session or null
 */
export async function getActivePollingSession(
  domainId: string
): Promise<PollingSession | null> {
  const [session] = await db
    .select()
    .from(dnsPollingSession)
    .where(
      and(
        eq(dnsPollingSession.domainId, domainId),
        eq(dnsPollingSession.status, 'polling')
      )
    )
    .limit(1);

  return session ? (session as PollingSession) : null;
}
