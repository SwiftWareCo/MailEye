/**
 * Unit tests for DNS Poller Integration Layer (Task 4.3)
 *
 * Tests the job queue integration functions and helper utilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startDNSPolling,
  getDNSPollingStatus,
  stopDNSPolling,
  getActiveDNSPollingSession,
  isPollingComplete,
  calculateEstimatedCompletion,
  getPollingProgressSummary,
} from '../dns-poller';
import type { PollingSession } from '@/server/dns/polling-job';

// Mock the polling-job module
vi.mock('@/server/dns/polling-job', () => ({
  startPollingSession: vi.fn(),
  checkPollingProgress: vi.fn(),
  getPollingStatus: vi.fn(),
  cancelPollingSession: vi.fn(),
  getActivePollingSession: vi.fn(),
}));

// Mock data
const mockPollingSession: PollingSession = {
  id: 'session-123',
  domainId: 'domain-123',
  userId: 'user-123',
  status: 'polling',
  checkInterval: 30000,
  maxDuration: 172800000,
  startedAt: new Date('2025-01-01T00:00:00Z'),
  lastCheckedAt: new Date('2025-01-01T00:05:00Z'),
  completedAt: null,
  estimatedCompletion: null,
  totalRecords: 4,
  propagatedRecords: 2,
  overallProgress: 50,
  metadata: {
    fullyPropagated: 2,
    partiallyPropagated: 2,
    notPropagated: 0,
  },
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:05:00Z'),
};

describe('DNS Poller Integration Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startDNSPolling', () => {
    it('should start polling session', async () => {
      const { startPollingSession } = await import('@/server/dns/polling-job');
      (startPollingSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockPollingSession);

      const session = await startDNSPolling('domain-123', 'user-123');

      expect(session).toEqual(mockPollingSession);
      expect(startPollingSession).toHaveBeenCalledWith('domain-123', 'user-123');
    });
  });

  describe('getDNSPollingStatus', () => {
    it('should check progress if session is polling', async () => {
      const { getPollingStatus, checkPollingProgress } = await import('@/server/dns/polling-job');
      (getPollingStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockPollingSession);
      (checkPollingProgress as ReturnType<typeof vi.fn>).mockResolvedValue(mockPollingSession);

      const session = await getDNSPollingStatus('session-123');

      expect(session).toEqual(mockPollingSession);
      expect(checkPollingProgress).toHaveBeenCalledWith('session-123');
    });

    it('should return current status if session is completed', async () => {
      const { getPollingStatus, checkPollingProgress } = await import('@/server/dns/polling-job');
      const completedSession = { ...mockPollingSession, status: 'completed' as const };
      (getPollingStatus as ReturnType<typeof vi.fn>).mockResolvedValue(completedSession);

      const session = await getDNSPollingStatus('session-123');

      expect(session).toEqual(completedSession);
      expect(checkPollingProgress).not.toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      const { getPollingStatus } = await import('@/server/dns/polling-job');
      (getPollingStatus as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(getDNSPollingStatus('nonexistent')).rejects.toThrow(
        'Polling session not found: nonexistent'
      );
    });
  });

  describe('stopDNSPolling', () => {
    it('should cancel polling session', async () => {
      const { cancelPollingSession } = await import('@/server/dns/polling-job');
      const cancelledSession = { ...mockPollingSession, status: 'cancelled' as const };
      (cancelPollingSession as ReturnType<typeof vi.fn>).mockResolvedValue(cancelledSession);

      const session = await stopDNSPolling('session-123');

      expect(session).toEqual(cancelledSession);
      expect(cancelPollingSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('getActiveDNSPollingSession', () => {
    it('should return active session', async () => {
      const { getActivePollingSession } = await import('@/server/dns/polling-job');
      (getActivePollingSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockPollingSession);

      const session = await getActiveDNSPollingSession('domain-123');

      expect(session).toEqual(mockPollingSession);
      expect(getActivePollingSession).toHaveBeenCalledWith('domain-123');
    });
  });

  describe('isPollingComplete', () => {
    it('should return true for completed status', () => {
      const completedSession = { ...mockPollingSession, status: 'completed' as const };
      expect(isPollingComplete(completedSession)).toBe(true);
    });

    it('should return true for timeout status', () => {
      const timeoutSession = { ...mockPollingSession, status: 'timeout' as const };
      expect(isPollingComplete(timeoutSession)).toBe(true);
    });

    it('should return true for cancelled status', () => {
      const cancelledSession = { ...mockPollingSession, status: 'cancelled' as const };
      expect(isPollingComplete(cancelledSession)).toBe(true);
    });

    it('should return false for polling status', () => {
      expect(isPollingComplete(mockPollingSession)).toBe(false);
    });
  });

  describe('calculateEstimatedCompletion', () => {
    it('should return completion time if already complete', () => {
      const completedTime = new Date('2025-01-01T00:10:00Z');
      const completedSession = {
        ...mockPollingSession,
        status: 'completed' as const,
        completedAt: completedTime,
      };

      const estimate = calculateEstimatedCompletion(completedSession);
      expect(estimate).toEqual(completedTime);
    });

    it('should return null if no progress yet', () => {
      const noProgressSession = {
        ...mockPollingSession,
        overallProgress: 0,
        lastCheckedAt: null,
      };

      const estimate = calculateEstimatedCompletion(noProgressSession);
      expect(estimate).toBeNull();
    });

    it('should calculate estimated completion based on progress', () => {
      // Session started 5 minutes ago, 50% complete
      // Estimated total time = (5 min / 50%) * 100% = 10 minutes
      // Remaining time = 10 min - 5 min = 5 minutes
      // Estimated completion = now + 5 minutes

      const session = {
        ...mockPollingSession,
        startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        lastCheckedAt: new Date(),
        overallProgress: 50,
      };

      const estimate = calculateEstimatedCompletion(session);
      expect(estimate).toBeDefined();

      if (estimate) {
        const now = Date.now();
        const estimatedTime = estimate.getTime();
        const expectedTime = now + 5 * 60 * 1000; // ~5 minutes from now

        // Allow 1 second tolerance for test execution time
        expect(Math.abs(estimatedTime - expectedTime)).toBeLessThan(1000);
      }
    });
  });

  describe('getPollingProgressSummary', () => {
    it('should return progress summary', () => {
      const summary = getPollingProgressSummary(mockPollingSession);

      expect(summary).toEqual({
        percentage: 50,
        recordsComplete: 2,
        totalRecords: 4,
        status: 'polling',
        estimatedCompletion: expect.any(Date),
      });
    });

    it('should return null estimated completion if no progress', () => {
      const noProgressSession = {
        ...mockPollingSession,
        overallProgress: 0,
        lastCheckedAt: null,
      };

      const summary = getPollingProgressSummary(noProgressSession);

      expect(summary.estimatedCompletion).toBeNull();
    });
  });
});
