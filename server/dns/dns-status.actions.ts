/**
 * DNS Status Server Actions (Task 4.5)
 *
 * Server Actions for fetching DNS propagation status in real-time.
 * These actions are called by TanStack Query on the frontend, polling every 30 seconds.
 *
 * Authentication:
 * - Uses stackServerApp.getUser() to get authenticated user from session
 * - All actions verify user authorization before returning data
 *
 * Caching:
 * - Data layer provides 10-second cache to reduce DB load
 * - Frontend polls every 30 seconds, so most requests hit cache
 */

'use server';

import { stackServerApp } from '@/stack/server';
import {
  startPollingSession,
  checkPollingProgress,
  cancelPollingSession,
  type PollingSession,
} from './polling-job';
import { getProgressReport, type PollingProgressReport } from './polling-progress';
import {
  getPollingSessionWithAuth,
  getDomainActivePollingSession,
  getDNSRecordStatuses,
  invalidateSessionCache,
  invalidateDomainSessionCache,
  type DNSRecordStatus,
} from './dns-status.data';

/**
 * Standard action result type
 */
interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get DNS polling status for a session
 *
 * Returns comprehensive progress report including:
 * - Overall progress percentage
 * - Record-level propagation status
 * - ETA for completion
 * - Session status (polling/completed/timeout/cancelled)
 *
 * @param sessionId - Polling session ID
 */
export async function getDNSStatusAction(
  sessionId: string
): Promise<ActionResult<PollingProgressReport>> {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Verify user owns this session
    const session = await getPollingSessionWithAuth(sessionId, user.id);
    if (!session) {
      return {
        success: false,
        error: 'Polling session not found or you do not have permission to access it',
      };
    }

    // Get comprehensive progress report
    const report = await getProgressReport(sessionId);

    return {
      success: true,
      data: report,
    };
  } catch (error) {
    console.error('Error getting DNS status:', error);
    return {
      success: false,
      error: 'Failed to fetch DNS status. Please try again.',
    };
  }
}

/**
 * Start a new DNS polling session for a domain
 *
 * Creates a new polling session that checks DNS propagation every 30 seconds.
 * Returns the session ID which can be used to poll for status updates.
 *
 * @param domainId - Domain ID to start polling for
 */
export async function startDNSPollingAction(
  domainId: string
): Promise<ActionResult<PollingSession>> {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Check if user already has an active polling session for this domain
    const existingSession = await getDomainActivePollingSession(
      domainId,
      user.id
    );

    if (existingSession) {
      return {
        success: true,
        data: existingSession,
      };
    }

    // Start new polling session
    const session = await startPollingSession(domainId, user.id);

    // Invalidate cache to ensure fresh data on next request
    invalidateDomainSessionCache(domainId, user.id);

    console.log(`[DNS Polling] Started session ${session.id} for domain ${domainId}`);

    return {
      success: true,
      data: session,
    };
  } catch (error) {
    console.error('Error starting DNS polling:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to start DNS polling. Please try again.',
    };
  }
}

/**
 * Cancel an active DNS polling session
 *
 * Stops the polling session and marks it as cancelled.
 *
 * @param sessionId - Polling session ID to cancel
 */
export async function cancelDNSPollingAction(
  sessionId: string
): Promise<ActionResult<PollingSession>> {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Verify user owns this session
    const session = await getPollingSessionWithAuth(sessionId, user.id);
    if (!session) {
      return {
        success: false,
        error: 'Polling session not found or you do not have permission to cancel it',
      };
    }

    // Cancel the session
    const cancelledSession = await cancelPollingSession(sessionId);

    // Invalidate cache
    invalidateSessionCache(sessionId, user.id);
    invalidateDomainSessionCache(session.domainId, user.id);

    console.log(`[DNS Polling] Cancelled session ${sessionId}`);

    return {
      success: true,
      data: cancelledSession,
    };
  } catch (error) {
    console.error('Error cancelling DNS polling:', error);
    return {
      success: false,
      error: 'Failed to cancel DNS polling. Please try again.',
    };
  }
}

/**
 * Get DNS status for a domain
 *
 * Returns:
 * - Active polling session (if exists)
 * - DNS record propagation statuses
 * - Overall domain DNS health
 *
 * @param domainId - Domain ID
 */
export async function getDomainDNSStatusAction(domainId: string): Promise<
  ActionResult<{
    activeSession: PollingSession | null;
    records: DNSRecordStatus[];
    summary: {
      totalRecords: number;
      propagated: number;
      propagating: number;
      pending: number;
    };
  }>
> {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Get active polling session (if exists)
    const activeSession = await getDomainActivePollingSession(
      domainId,
      user.id
    );

    // Get DNS record statuses
    const records = await getDNSRecordStatuses(domainId, user.id);

    // Calculate summary statistics
    const propagated = records.filter(
      (r) => r.propagationStatus === 'propagated'
    ).length;
    const propagating = records.filter(
      (r) => r.propagationStatus === 'propagating'
    ).length;
    const pending = records.filter(
      (r) =>
        r.propagationStatus === 'pending' ||
        r.propagationStatus === 'unknown' ||
        r.propagationStatus === null
    ).length;

    return {
      success: true,
      data: {
        activeSession,
        records,
        summary: {
          totalRecords: records.length,
          propagated,
          propagating,
          pending,
        },
      },
    };
  } catch (error) {
    console.error('Error getting domain DNS status:', error);
    return {
      success: false,
      error: 'Failed to fetch domain DNS status. Please try again.',
    };
  }
}

/**
 * Trigger DNS propagation check and update progress
 *
 * This action performs an immediate DNS check (queries DNS servers)
 * and updates the polling session with the latest propagation status.
 *
 * Use this for:
 * - Manual "Check Now" button in UI
 * - Backend scheduled job that runs every 30 seconds
 *
 * @param sessionId - Polling session ID
 */
export async function checkDNSProgressAction(
  sessionId: string
): Promise<ActionResult<PollingProgressReport>> {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Verify user owns this session
    const session = await getPollingSessionWithAuth(sessionId, user.id);
    if (!session) {
      return {
        success: false,
        error: 'Polling session not found or you do not have permission to access it',
      };
    }

    // Perform DNS check (queries DNS servers and updates database)
    const updatedSession = await checkPollingProgress(sessionId);

    // Invalidate cache to ensure fresh data
    invalidateSessionCache(sessionId, user.id);
    invalidateDomainSessionCache(updatedSession.domainId, user.id);

    // Get updated progress report
    const report = await getProgressReport(sessionId);

    console.log(
      `[DNS Polling] Checked progress for session ${sessionId}: ${report.progress.overallProgress}% complete`
    );

    return {
      success: true,
      data: report,
    };
  } catch (error) {
    console.error('Error checking DNS progress:', error);
    return {
      success: false,
      error: 'Failed to check DNS progress. Please try again.',
    };
  }
}

/**
 * Get active polling sessions for the authenticated user
 *
 * Returns all active polling sessions across all domains for the current user.
 * Useful for dashboard overview showing polling progress.
 */
export async function getUserActivePollingSessionsAction(): Promise<
  ActionResult<PollingSession[]>
> {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Get all active sessions for user (directly from polling-job)
    const { db } = await import('@/lib/db');
    const { dnsPollingSession } = await import('@/lib/db/schema/dns-polling');
    const { eq, and } = await import('drizzle-orm');

    const sessions = await db
      .select()
      .from(dnsPollingSession)
      .where(
        and(
          eq(dnsPollingSession.userId, user.id),
          eq(dnsPollingSession.status, 'polling')
        )
      );

    return {
      success: true,
      data: sessions as PollingSession[],
    };
  } catch (error) {
    console.error('Error getting user active polling sessions:', error);
    return {
      success: false,
      error: 'Failed to fetch active polling sessions. Please try again.',
    };
  }
}
