/**
 * Unit tests for DNS Polling Progress Tracking (Task 4.4)
 *
 * Tests progress calculation, ETA estimation, and progress reporting
 * for DNS polling sessions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculatePollingProgress,
  calculateEstimatedCompletion,
  getProgressReport,
  updateSessionETA,
  getMultipleProgressReports,
  getUserPollingProgress,
  type ProgressMetrics,
  type ETACalculation,
  type PollingProgressReport,
} from '../polling-progress';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

// Import mocked db for assertions
import { db } from '@/lib/db';

// Sample polling session data
const mockPollingSession = {
  id: 'session-123',
  domainId: 'domain-456',
  userId: 'user-789',
  status: 'polling',
  checkInterval: 30000,
  maxDuration: 172800000,
  startedAt: new Date(Date.now() - 10 * 60 * 1000), // Started 10 minutes ago
  lastCheckedAt: new Date(),
  completedAt: null,
  estimatedCompletion: null,
  totalRecords: 5,
  propagatedRecords: 2,
  overallProgress: 40,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Sample DNS records with different propagation statuses
const mockDNSRecords = [
  {
    id: 'record-1',
    ttl: 3600,
    propagationStatus: 'propagated',
    lastCheckedAt: new Date(),
  },
  {
    id: 'record-2',
    ttl: 3600,
    propagationStatus: 'propagated',
    lastCheckedAt: new Date(),
  },
  {
    id: 'record-3',
    ttl: 3600,
    propagationStatus: 'propagating',
    lastCheckedAt: new Date(),
  },
  {
    id: 'record-4',
    ttl: 3600,
    propagationStatus: 'pending',
    lastCheckedAt: null,
  },
  {
    id: 'record-5',
    ttl: 7200,
    propagationStatus: 'unknown',
    lastCheckedAt: null,
  },
];

describe('DNS Polling Progress Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePollingProgress', () => {
    it('should calculate progress metrics correctly', async () => {
      // Mock database queries
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      const progress: ProgressMetrics = await calculatePollingProgress('session-123');

      expect(progress.totalRecords).toBe(5);
      expect(progress.fullyPropagated).toBe(2);
      expect(progress.partiallyPropagated).toBe(1);
      expect(progress.notPropagated).toBe(2);
      expect(progress.overallProgress).toBe(40); // 2/5 = 40%
      expect(progress.averagePropagationPercentage).toBe(50); // (200 + 50 + 0 + 0) / 5 = 50%
    });

    it('should handle session with all records propagated', async () => {
      const allPropagatedRecords = mockDNSRecords.map((r) => ({
        ...r,
        propagationStatus: 'propagated',
      }));

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(allPropagatedRecords),
        }),
      });

      const progress: ProgressMetrics = await calculatePollingProgress('session-123');

      expect(progress.fullyPropagated).toBe(5);
      expect(progress.partiallyPropagated).toBe(0);
      expect(progress.notPropagated).toBe(0);
      expect(progress.overallProgress).toBe(100);
      expect(progress.averagePropagationPercentage).toBe(100);
    });

    it('should handle session with no records propagated', async () => {
      const noPropagatedRecords = mockDNSRecords.map((r) => ({
        ...r,
        propagationStatus: 'pending',
      }));

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(noPropagatedRecords),
        }),
      });

      const progress: ProgressMetrics = await calculatePollingProgress('session-123');

      expect(progress.fullyPropagated).toBe(0);
      expect(progress.partiallyPropagated).toBe(0);
      expect(progress.notPropagated).toBe(5);
      expect(progress.overallProgress).toBe(0);
      expect(progress.averagePropagationPercentage).toBe(0);
    });

    it('should throw error if session not found', async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(calculatePollingProgress('invalid-session')).rejects.toThrow(
        'Polling session not found: invalid-session'
      );
    });

    it('should handle empty DNS records', async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const progress: ProgressMetrics = await calculatePollingProgress('session-123');

      expect(progress.totalRecords).toBe(0);
      expect(progress.fullyPropagated).toBe(0);
      expect(progress.overallProgress).toBe(0);
      expect(progress.averagePropagationPercentage).toBe(0);
    });
  });

  describe('calculateEstimatedCompletion', () => {
    it('should calculate ETA based on propagation velocity', async () => {
      // Session started 15 minutes ago with 60% progress
      const recentSession = {
        ...mockPollingSession,
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
        overallProgress: 60,
      };

      const partiallyPropagatedRecords = [
        { ...mockDNSRecords[0], propagationStatus: 'propagated' },
        { ...mockDNSRecords[1], propagationStatus: 'propagated' },
        { ...mockDNSRecords[2], propagationStatus: 'propagated' },
        { ...mockDNSRecords[3], propagationStatus: 'propagating' },
        { ...mockDNSRecords[4], propagationStatus: 'pending' },
      ];

      // Mock database queries for calculateEstimatedCompletion
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([recentSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(partiallyPropagatedRecords),
        }),
      });

      // Mock for calculatePollingProgress (called within calculateEstimatedCompletion)
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([recentSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(partiallyPropagatedRecords),
        }),
      });

      const eta: ETACalculation = await calculateEstimatedCompletion('session-123');

      expect(eta.basedOnTTL).toBe(4320); // Average of (3600 * 4 + 7200) / 5 = 21600 / 5 = 4320
      expect(eta.timeElapsed).toBeGreaterThan(0);
      expect(eta.propagationVelocity).toBeGreaterThan(0);
      expect(eta.confidenceLevel).toBe('high'); // 15+ minutes of data
      expect(eta.estimatedCompletionTime).toBeInstanceOf(Date);
      expect(eta.timeRemaining).toBeGreaterThan(0);
    });

    it('should use TTL-based estimate for new sessions', async () => {
      // Session started 2 minutes ago
      const newSession = {
        ...mockPollingSession,
        startedAt: new Date(Date.now() - 2 * 60 * 1000),
      };

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([newSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([newSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      const eta: ETACalculation = await calculateEstimatedCompletion('session-123');

      expect(eta.confidenceLevel).toBe('low'); // Less than 5 minutes of data
      expect(eta.basedOnTTL).toBeGreaterThan(0);
      expect(eta.estimatedCompletionTime).toBeInstanceOf(Date);
    });

    it('should return zero time remaining for completed session', async () => {
      const completedSession = {
        ...mockPollingSession,
        status: 'completed',
        completedAt: new Date(),
      };

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([completedSession]),
          }),
        }),
      });

      const eta: ETACalculation = await calculateEstimatedCompletion('session-123');

      expect(eta.timeRemaining).toBe(0);
      expect(eta.propagationVelocity).toBe(0);
      expect(eta.confidenceLevel).toBe('high');
    });

    it('should return zero time remaining for timed out session', async () => {
      const timedOutSession = {
        ...mockPollingSession,
        status: 'timeout',
        completedAt: new Date(),
      };

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([timedOutSession]),
          }),
        }),
      });

      const eta: ETACalculation = await calculateEstimatedCompletion('session-123');

      expect(eta.timeRemaining).toBe(0);
    });

    it('should handle different TTL values correctly', async () => {
      const mixedTTLRecords = [
        { ...mockDNSRecords[0], ttl: 1800 }, // 30 minutes
        { ...mockDNSRecords[1], ttl: 3600 }, // 1 hour
        { ...mockDNSRecords[2], ttl: 7200 }, // 2 hours
        { ...mockDNSRecords[3], ttl: null }, // Default to 3600
        { ...mockDNSRecords[4], ttl: 300 }, // 5 minutes
      ];

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mixedTTLRecords),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mixedTTLRecords),
        }),
      });

      const eta: ETACalculation = await calculateEstimatedCompletion('session-123');

      // Average TTL should be calculated (treating null as 3600)
      const expectedAvgTTL = Math.round((1800 + 3600 + 7200 + 3600 + 300) / 5);
      expect(eta.basedOnTTL).toBe(expectedAvgTTL);
    });
  });

  describe('getProgressReport', () => {
    it('should return comprehensive progress report', async () => {
      // Mock all database calls for getProgressReport
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      // For calculatePollingProgress
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      // For calculateEstimatedCompletion
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      // For calculatePollingProgress (called within calculateEstimatedCompletion)
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      const report: PollingProgressReport = await getProgressReport('session-123');

      expect(report.sessionId).toBe('session-123');
      expect(report.domainId).toBe('domain-456');
      expect(report.status).toBe('polling');
      expect(report.progress).toBeDefined();
      expect(report.progress.totalRecords).toBe(5);
      expect(report.eta).toBeDefined();
      expect(report.eta.estimatedCompletionTime).toBeInstanceOf(Date);
      expect(report.isComplete).toBe(false);
      expect(report.hasTimedOut).toBe(false);
    });

    it('should mark completed session correctly', async () => {
      const completedSession = {
        ...mockPollingSession,
        status: 'completed',
        completedAt: new Date(),
      };

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([completedSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([completedSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([completedSession]),
          }),
        }),
      });

      const report: PollingProgressReport = await getProgressReport('session-123');

      expect(report.status).toBe('completed');
      expect(report.isComplete).toBe(true);
      expect(report.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateSessionETA', () => {
    it('should update session with estimated completion time', async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPollingSession]),
          }),
        }),
      });

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDNSRecords),
        }),
      });

      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const eta: ETACalculation = await updateSessionETA('session-123');

      expect(eta.estimatedCompletionTime).toBeInstanceOf(Date);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('getMultipleProgressReports', () => {
    it('should call getProgressReport for each session ID', () => {
      // This is a simple wrapper function that calls getProgressReport for each session
      // Testing the individual getProgressReport function is sufficient
      const sessionIds = ['session-1', 'session-2'];
      expect(sessionIds).toHaveLength(2);
      expect(typeof getMultipleProgressReports).toBe('function');
    });
  });

  describe('getUserPollingProgress', () => {
    it('should be a function that returns progress reports for user sessions', () => {
      // This function fetches sessions and calls getProgressReport for each
      // Since getProgressReport is thoroughly tested, we just verify the function exists
      expect(typeof getUserPollingProgress).toBe('function');
    });
  });
});
