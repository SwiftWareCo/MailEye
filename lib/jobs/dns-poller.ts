/**
 * DNS Poller - Job Queue Integration (Task 4.3)
 *
 * Simplified job queue integration using Server Actions.
 * Instead of using complex background job systems (BullMQ/Inngest),
 * we leverage Next.js Server Actions + TanStack Query for polling.
 *
 * The frontend uses TanStack Query with 30-second refetch intervals
 * to poll the getDNSPollingStatus() Server Action, which internally
 * calls checkPollingProgress() to check DNS propagation.
 *
 * This approach is simpler for MVP and works well for the use case:
 * - Frontend initiates polling via startDNSPolling()
 * - Frontend polls status every 30s via TanStack Query
 * - Backend checks DNS and updates database on each poll
 * - No separate background process needed
 */

import {
  startPollingSession,
  checkPollingProgress,
  getPollingStatus,
  cancelPollingSession,
  getActivePollingSession,
  type PollingSession,
} from '@/server/dns/polling-job';

/**
 * Start DNS polling for a domain
 *
 * Creates a polling session and returns the session ID.
 * The frontend should then poll getDNSPollingStatus() every 30 seconds
 * using TanStack Query.
 *
 * @param domainId - Domain ID to poll
 * @param userId - User ID initiating polling
 * @returns Polling session
 *
 * @example
 * // Frontend usage with Server Action:
 * const session = await startDNSPolling(domainId, userId);
 *
 * // Then use TanStack Query to poll status:
 * const { data } = useQuery({
 *   queryKey: ['dns-polling-status', session.id],
 *   queryFn: () => getDNSPollingStatus(session.id),
 *   refetchInterval: 30000, // 30 seconds
 * });
 */
export async function startDNSPolling(
  domainId: string,
  userId: string
): Promise<PollingSession> {
  return startPollingSession(domainId, userId);
}

/**
 * Get DNS polling status (checks propagation on each call)
 *
 * This function is called by TanStack Query every 30 seconds.
 * It checks DNS propagation status and updates the database.
 *
 * @param sessionId - Polling session ID
 * @returns Current polling session status
 *
 * @example
 * // TanStack Query hook:
 * const { data: pollingStatus } = useQuery({
 *   queryKey: ['dns-polling', sessionId],
 *   queryFn: () => getDNSPollingStatus(sessionId),
 *   refetchInterval: 30000,
 *   enabled: !!sessionId && status === 'polling',
 * });
 */
export async function getDNSPollingStatus(
  sessionId: string
): Promise<PollingSession> {
  // Get current session status
  const session = await getPollingStatus(sessionId);

  if (!session) {
    throw new Error(`Polling session not found: ${sessionId}`);
  }

  // If session is still polling, check progress
  if (session.status === 'polling') {
    return checkPollingProgress(sessionId);
  }

  // Otherwise, return current status (completed/timeout/cancelled)
  return session;
}

/**
 * Stop DNS polling for a session
 *
 * Cancels an active polling session. The frontend should stop polling
 * after calling this.
 *
 * @param sessionId - Polling session ID
 * @returns Updated polling session
 *
 * @example
 * const updatedSession = await stopDNSPolling(sessionId);
 * // updatedSession.status === 'cancelled'
 */
export async function stopDNSPolling(
  sessionId: string
): Promise<PollingSession> {
  return cancelPollingSession(sessionId);
}

/**
 * Get active polling session for a domain
 *
 * Checks if there's already an active polling session for a domain.
 * Useful for resuming polling after page refresh or navigation.
 *
 * @param domainId - Domain ID
 * @returns Active polling session or null
 *
 * @example
 * // Check if polling is already in progress before starting
 * const existingSession = await getActiveDNSPollingSession(domainId);
 * if (existingSession) {
 *   // Resume polling with existing session
 *   return existingSession;
 * } else {
 *   // Start new polling session
 *   return await startDNSPolling(domainId, userId);
 * }
 */
export async function getActiveDNSPollingSession(
  domainId: string
): Promise<PollingSession | null> {
  return getActivePollingSession(domainId);
}

/**
 * Check if polling is complete for a session
 *
 * Helper function to determine if polling has finished.
 *
 * @param session - Polling session
 * @returns True if polling is complete (completed/timeout/cancelled)
 */
export function isPollingComplete(session: PollingSession): boolean {
  return ['completed', 'timeout', 'cancelled'].includes(session.status);
}

/**
 * Calculate estimated completion time for a polling session
 *
 * Estimates when polling will complete based on current progress.
 * Uses average TTL (3600s) and current propagation percentage.
 *
 * @param session - Polling session
 * @returns Estimated completion time or null if not enough data
 */
export function calculateEstimatedCompletion(
  session: PollingSession
): Date | null {
  // If already complete, return completion time
  if (session.completedAt) {
    return session.completedAt;
  }

  // If no progress yet, can't estimate
  if (session.overallProgress === 0 || !session.lastCheckedAt) {
    return null;
  }

  // Calculate time elapsed since start
  const now = new Date();
  const elapsed = now.getTime() - new Date(session.startedAt).getTime();

  // Estimate total time based on current progress
  // (elapsed / progress) * 100 = estimated total time
  const estimatedTotalTime = (elapsed / session.overallProgress) * 100;

  // Remaining time = estimated total - elapsed
  const remainingTime = estimatedTotalTime - elapsed;

  // Return estimated completion time
  return new Date(now.getTime() + remainingTime);
}

/**
 * Get polling progress summary
 *
 * Returns a human-readable summary of polling progress.
 *
 * @param session - Polling session
 * @returns Progress summary
 */
export function getPollingProgressSummary(session: PollingSession): {
  percentage: number;
  recordsComplete: number;
  totalRecords: number;
  status: string;
  estimatedCompletion: Date | null;
} {
  return {
    percentage: session.overallProgress,
    recordsComplete: session.propagatedRecords,
    totalRecords: session.totalRecords,
    status: session.status,
    estimatedCompletion: calculateEstimatedCompletion(session),
  };
}
