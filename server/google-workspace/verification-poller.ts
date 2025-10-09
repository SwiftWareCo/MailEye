/**
 * Google Workspace Domain Verification Background Poller
 *
 * Polls verification status for domains in 'pending_verification' state
 * Handles DNS propagation delays with exponential backoff
 */

import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyDomainAction } from './domain-verification.actions';

/**
 * Poll configuration
 */
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_POLL_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours
const EXPONENTIAL_BACKOFF_MULTIPLIER = 1.5;

/**
 * Verification polling state for a domain
 */
interface VerificationPollState {
  domainId: string;
  domain: string;
  startTime: number;
  attempts: number;
  nextPollTime: number;
}

/**
 * Active polling sessions (in-memory for now)
 * In production, this should be stored in Redis or database
 */
const activePollingSessions = new Map<string, VerificationPollState>();

/**
 * Start polling verification status for a domain
 *
 * @param domainId - Database domain ID
 * @param domain - Domain name
 */
export function startVerificationPolling(domainId: string, domain: string) {
  // Check if already polling
  if (activePollingSessions.has(domainId)) {
    console.log(`[Verification Poller] Already polling ${domain}`);
    return;
  }

  const pollState: VerificationPollState = {
    domainId,
    domain,
    startTime: Date.now(),
    attempts: 0,
    nextPollTime: Date.now() + POLL_INTERVAL_MS,
  };

  activePollingSessions.set(domainId, pollState);
  console.log(`[Verification Poller] Started polling ${domain}`);

  // Schedule first poll
  schedulePoll(pollState);
}

/**
 * Schedule next poll attempt with exponential backoff
 */
function schedulePoll(pollState: VerificationPollState) {
  const now = Date.now();
  const delay = Math.max(0, pollState.nextPollTime - now);

  setTimeout(async () => {
    await pollVerificationStatus(pollState);
  }, delay);
}

/**
 * Poll verification status for a domain
 */
async function pollVerificationStatus(pollState: VerificationPollState) {
  const { domainId, domain, startTime, attempts } = pollState;

  console.log(
    `[Verification Poller] Polling ${domain} (attempt ${attempts + 1})`
  );

  try {
    // Trigger verification
    const result = await verifyDomainAction(domain);

    if (result.success && result.verified) {
      // Verification succeeded!
      console.log(`[Verification Poller] ✅ Domain verified: ${domain}`);

      // Update database
      await db
        .update(domains)
        .set({
          googleWorkspaceStatus: 'verified',
          googleWorkspaceVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(domains.id, domainId));

      // Stop polling
      activePollingSessions.delete(domainId);
      return;
    }

    // Verification not ready yet - check if we should continue
    const elapsed = Date.now() - startTime;

    if (elapsed >= MAX_POLL_DURATION_MS) {
      // Timeout - give up
      console.warn(
        `[Verification Poller] ⏱️ Timeout verifying ${domain} after ${elapsed}ms`
      );

      await db
        .update(domains)
        .set({
          googleWorkspaceStatus: 'verification_failed',
          updatedAt: new Date(),
        })
        .where(eq(domains.id, domainId));

      activePollingSessions.delete(domainId);
      return;
    }

    // Schedule next poll with exponential backoff
    pollState.attempts++;
    const nextInterval =
      POLL_INTERVAL_MS * Math.pow(EXPONENTIAL_BACKOFF_MULTIPLIER, pollState.attempts);
    pollState.nextPollTime = Date.now() + nextInterval;

    console.log(
      `[Verification Poller] Next poll for ${domain} in ${Math.round(nextInterval / 1000)}s`
    );

    schedulePoll(pollState);
  } catch (error) {
    console.error(`[Verification Poller] Error polling ${domain}:`, error);

    // Continue polling despite error
    pollState.attempts++;
    pollState.nextPollTime = Date.now() + POLL_INTERVAL_MS;
    schedulePoll(pollState);
  }
}

/**
 * Stop polling for a domain
 *
 * @param domainId - Database domain ID
 */
export function stopVerificationPolling(domainId: string) {
  if (activePollingSessions.has(domainId)) {
    const pollState = activePollingSessions.get(domainId);
    console.log(`[Verification Poller] Stopped polling ${pollState?.domain}`);
    activePollingSessions.delete(domainId);
  }
}

/**
 * Get polling status for a domain
 *
 * @param domainId - Database domain ID
 * @returns Polling state or null if not polling
 */
export function getPollingStatus(domainId: string): VerificationPollState | null {
  return activePollingSessions.get(domainId) || null;
}

/**
 * Resume polling for all domains in pending_verification state
 * Called on server startup
 */
export async function resumeAllVerificationPolling() {
  try {
    const pendingDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.googleWorkspaceStatus, 'pending_verification'));

    console.log(
      `[Verification Poller] Resuming polling for ${pendingDomains.length} domains`
    );

    for (const domain of pendingDomains) {
      // Check if domain was added recently (within polling window)
      if (domain.googleWorkspaceAddedAt) {
        const elapsed = Date.now() - domain.googleWorkspaceAddedAt.getTime();

        if (elapsed < MAX_POLL_DURATION_MS) {
          startVerificationPolling(domain.id, domain.domain);
        } else {
          // Mark as failed if too old
          await db
            .update(domains)
            .set({
              googleWorkspaceStatus: 'verification_failed',
              updatedAt: new Date(),
            })
            .where(eq(domains.id, domain.id));
        }
      }
    }
  } catch (error) {
    console.error('[Verification Poller] Error resuming polling:', error);
  }
}
