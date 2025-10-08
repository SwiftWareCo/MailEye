/**
 * DNS Polling Progress Tracking (Task 4.4)
 *
 * Tracks DNS polling progress and calculates estimated completion time (ETA)
 * based on DNS TTL values, current propagation status, and propagation velocity.
 *
 * This service provides:
 * - Real-time progress percentage calculation
 * - TTL-based ETA estimation
 * - Propagation velocity tracking
 * - Comprehensive progress reports for frontend display
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { dnsPollingSession } from '@/lib/db/schema/dns-polling';
import { dnsRecords } from '@/lib/db/schema/dns-records';

/**
 * Progress metrics for a polling session
 */
export interface ProgressMetrics {
  overallProgress: number; // 0-100%
  totalRecords: number;
  fullyPropagated: number; // 100% propagated
  partiallyPropagated: number; // 1-99% propagated
  notPropagated: number; // 0% propagated
  averagePropagationPercentage: number; // Average across all records
}

/**
 * ETA calculation breakdown
 */
export interface ETACalculation {
  estimatedCompletionTime: Date | null;
  timeRemaining: number; // milliseconds
  timeElapsed: number; // milliseconds
  propagationVelocity: number; // percentage per minute
  basedOnTTL: number; // TTL used for calculation (seconds)
  confidenceLevel: 'high' | 'medium' | 'low'; // Confidence in estimate
}

/**
 * Comprehensive progress report
 */
export interface PollingProgressReport {
  sessionId: string;
  domainId: string;
  status: 'polling' | 'completed' | 'timeout' | 'cancelled';
  progress: ProgressMetrics;
  eta: ETACalculation;
  startedAt: Date;
  lastCheckedAt: Date | null;
  completedAt: Date | null;
  isComplete: boolean;
  hasTimedOut: boolean;
  records: Array<{
    id: string;
    type: string;
    name: string | null;
    content: string | null;
    propagationStatus: string | null;
    propagationCoverage: number | null;
  }>;
}

/**
 * Calculate progress metrics for a polling session
 *
 * @param sessionId - Polling session ID
 * @returns Progress metrics
 */
export async function calculatePollingProgress(
  sessionId: string
): Promise<ProgressMetrics> {
  // Fetch the polling session
  const [session] = await db
    .select()
    .from(dnsPollingSession)
    .where(eq(dnsPollingSession.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Polling session not found: ${sessionId}`);
  }

  // Fetch all DNS records for the domain
  const records = await db
    .select({
      id: dnsRecords.id,
      propagationStatus: dnsRecords.propagationStatus,
    })
    .from(dnsRecords)
    .where(
      and(
        eq(dnsRecords.domainId, session.domainId),
        eq(dnsRecords.status, 'active')
      )
    );

  // Categorize records by propagation status
  let fullyPropagated = 0;
  let partiallyPropagated = 0;
  let notPropagated = 0;

  for (const record of records) {
    const status = record.propagationStatus || 'unknown';
    if (status === 'propagated') {
      fullyPropagated++;
    } else if (status === 'propagating') {
      partiallyPropagated++;
    } else {
      notPropagated++;
    }
  }

  const totalRecords = records.length;
  const overallProgress =
    totalRecords > 0 ? Math.round((fullyPropagated / totalRecords) * 100) : 0;

  // Calculate average propagation percentage
  // Assume: propagated = 100%, propagating = 50%, pending/unknown = 0%
  const totalPercentage =
    fullyPropagated * 100 + partiallyPropagated * 50 + notPropagated * 0;
  const averagePropagationPercentage =
    totalRecords > 0 ? Math.round(totalPercentage / totalRecords) : 0;

  return {
    overallProgress,
    totalRecords,
    fullyPropagated,
    partiallyPropagated,
    notPropagated,
    averagePropagationPercentage,
  };
}

/**
 * Calculate estimated completion time based on TTL and propagation status
 *
 * Algorithm:
 * 1. Fetch TTL values for all DNS records
 * 2. Calculate weighted average TTL
 * 3. Estimate time remaining based on:
 *    - Current propagation percentage
 *    - TTL expiry time
 *    - Propagation velocity (if available)
 * 4. Add buffer for DNS caching delays
 *
 * @param sessionId - Polling session ID
 * @returns ETA calculation
 */
export async function calculateEstimatedCompletion(
  sessionId: string
): Promise<ETACalculation> {
  // Fetch the polling session
  const [session] = await db
    .select()
    .from(dnsPollingSession)
    .where(eq(dnsPollingSession.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Polling session not found: ${sessionId}`);
  }

  // If session is already completed or timed out, no ETA needed
  if (
    session.status === 'completed' ||
    session.status === 'timeout' ||
    session.status === 'cancelled'
  ) {
    return {
      estimatedCompletionTime: session.completedAt || null,
      timeRemaining: 0,
      timeElapsed: new Date().getTime() - new Date(session.startedAt).getTime(),
      propagationVelocity: 0,
      basedOnTTL: 0,
      confidenceLevel: 'high',
    };
  }

  // Fetch DNS records with TTL values
  const records = await db
    .select({
      id: dnsRecords.id,
      ttl: dnsRecords.ttl,
      propagationStatus: dnsRecords.propagationStatus,
      lastCheckedAt: dnsRecords.lastCheckedAt,
    })
    .from(dnsRecords)
    .where(
      and(
        eq(dnsRecords.domainId, session.domainId),
        eq(dnsRecords.status, 'active')
      )
    );

  // Calculate average TTL (default 3600 seconds if not set)
  const ttlValues = records.map((r) => r.ttl || 3600);
  const averageTTL =
    ttlValues.length > 0
      ? ttlValues.reduce((sum, ttl) => sum + ttl, 0) / ttlValues.length
      : 3600;

  // Calculate time elapsed
  const now = new Date();
  const timeElapsed = now.getTime() - new Date(session.startedAt).getTime();
  const timeElapsedMinutes = timeElapsed / (1000 * 60);

  // Calculate current progress
  const progress = await calculatePollingProgress(sessionId);
  const currentProgress = progress.averagePropagationPercentage;

  // Calculate propagation velocity (percentage per minute)
  const propagationVelocity =
    timeElapsedMinutes > 0 ? currentProgress / timeElapsedMinutes : 0;

  // Estimate time remaining based on propagation velocity
  let timeRemaining: number;
  let confidenceLevel: 'high' | 'medium' | 'low';

  if (propagationVelocity > 0 && timeElapsedMinutes >= 5) {
    // Use velocity-based estimate if we have enough data (5+ minutes)
    const remainingProgress = 100 - currentProgress;
    const minutesRemaining = remainingProgress / propagationVelocity;
    timeRemaining = minutesRemaining * 60 * 1000; // Convert to milliseconds
    confidenceLevel = timeElapsedMinutes >= 15 ? 'high' : 'medium';
  } else {
    // Use TTL-based estimate for initial phase
    // DNS propagation typically takes 1-2x TTL for full propagation
    const propagationMultiplier = 1.5; // Conservative estimate
    const expectedTotalTime = averageTTL * propagationMultiplier * 1000; // milliseconds
    timeRemaining = Math.max(0, expectedTotalTime - timeElapsed);
    confidenceLevel = 'low';
  }

  // Add buffer for DNS caching delays (15 minutes)
  const cachingBuffer = 15 * 60 * 1000; // 15 minutes in milliseconds
  timeRemaining += cachingBuffer;

  // Calculate estimated completion time
  const estimatedCompletionTime = new Date(now.getTime() + timeRemaining);

  return {
    estimatedCompletionTime,
    timeRemaining,
    timeElapsed,
    propagationVelocity,
    basedOnTTL: Math.round(averageTTL),
    confidenceLevel,
  };
}

/**
 * Get comprehensive progress report for a polling session
 *
 * This function combines progress metrics and ETA calculation
 * into a single report suitable for frontend display.
 *
 * @param sessionId - Polling session ID
 * @returns Comprehensive progress report
 */
export async function getProgressReport(
  sessionId: string
): Promise<PollingProgressReport> {
  // Fetch the polling session
  const [session] = await db
    .select()
    .from(dnsPollingSession)
    .where(eq(dnsPollingSession.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Polling session not found: ${sessionId}`);
  }

  // Calculate progress and ETA
  const progress = await calculatePollingProgress(sessionId);
  const eta = await calculateEstimatedCompletion(sessionId);

  // Fetch DNS records with propagation status
  const records = await db
    .select({
      id: dnsRecords.id,
      type: dnsRecords.recordType,
      name: dnsRecords.name,
      content: dnsRecords.value,
      propagationStatus: dnsRecords.propagationStatus,
      propagationCoverage: dnsRecords.propagationCoverage,
    })
    .from(dnsRecords)
    .where(
      and(
        eq(dnsRecords.domainId, session.domainId),
        eq(dnsRecords.status, 'active')
      )
    );

  // Determine completion and timeout status
  const isComplete = session.status === 'completed';
  const hasTimedOut = session.status === 'timeout';

  return {
    sessionId: session.id,
    domainId: session.domainId,
    status: session.status as 'polling' | 'completed' | 'timeout' | 'cancelled',
    progress,
    eta,
    startedAt: new Date(session.startedAt),
    lastCheckedAt: session.lastCheckedAt ? new Date(session.lastCheckedAt) : null,
    completedAt: session.completedAt ? new Date(session.completedAt) : null,
    isComplete,
    hasTimedOut,
    records,
  };
}

/**
 * Update polling session with estimated completion time
 *
 * This function is called by the polling job to update the session
 * with the latest ETA after each check.
 *
 * @param sessionId - Polling session ID
 * @returns Updated ETA calculation
 */
export async function updateSessionETA(
  sessionId: string
): Promise<ETACalculation> {
  const eta = await calculateEstimatedCompletion(sessionId);

  // Update session with estimated completion time
  await db
    .update(dnsPollingSession)
    .set({
      estimatedCompletion: eta.estimatedCompletionTime,
      updatedAt: new Date(),
    })
    .where(eq(dnsPollingSession.id, sessionId));

  return eta;
}

/**
 * Get progress summary for multiple polling sessions
 *
 * Useful for dashboard views showing multiple domains being polled.
 *
 * @param sessionIds - Array of polling session IDs
 * @returns Array of progress reports
 */
export async function getMultipleProgressReports(
  sessionIds: string[]
): Promise<PollingProgressReport[]> {
  const reports = await Promise.all(
    sessionIds.map((sessionId) => getProgressReport(sessionId))
  );

  return reports;
}

/**
 * Get active polling sessions for a user
 *
 * Fetches all active polling sessions for a user and returns
 * progress reports for each.
 *
 * @param userId - User ID
 * @returns Array of progress reports for active sessions
 */
export async function getUserPollingProgress(
  userId: string
): Promise<PollingProgressReport[]> {
  // Fetch all active polling sessions for the user
  const sessions = await db
    .select()
    .from(dnsPollingSession)
    .where(
      and(
        eq(dnsPollingSession.userId, userId),
        eq(dnsPollingSession.status, 'polling')
      )
    );

  // Get progress reports for each session
  const reports = await Promise.all(
    sessions.map((session) => getProgressReport(session.id))
  );

  return reports;
}
