/**
 * Unit tests for DNS Polling Job Service (Task 4.3)
 *
 * Tests polling job lifecycle, timeout handling, completion detection,
 * and database updates.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  startPollingSession,
  checkPollingProgress,
  getPollingStatus,
  cancelPollingSession,
  getActivePollingSession,
  type PollingSession,
} from '../polling-job';
import * as propagationChecker from '../propagation-checker';
import type { DNSPropagationStatus, GlobalPropagationCoverage } from '../propagation-checker';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([mockPollingSession])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockPollingSession])),
        })),
      })),
    })),
  },
}));

// Mock propagation checker functions
vi.mock('../propagation-checker', async () => {
  const actual = await vi.importActual('../propagation-checker');
  return {
    ...actual,
    checkSPFPropagation: vi.fn(),
    checkDKIMPropagation: vi.fn(),
    checkDMARCPropagation: vi.fn(),
    checkMXPropagation: vi.fn(),
    checkTrackingDomainPropagation: vi.fn(),
    calculateGlobalCoverage: vi.fn(),
  };
});

// Mock data
const mockPollingSession: PollingSession = {
  id: 'session-123',
  domainId: 'domain-123',
  userId: 'user-123',
  status: 'polling',
  checkInterval: 30000,
  maxDuration: 172800000,
  startedAt: new Date('2025-01-01T00:00:00Z'),
  lastCheckedAt: null,
  completedAt: null,
  estimatedCompletion: null,
  totalRecords: 4,
  propagatedRecords: 0,
  overallProgress: 0,
  metadata: {},
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const mockDomain = {
  id: 'domain-123',
  domain: 'example.com',
  userId: 'user-123',
};

const mockDNSRecords = [
  {
    id: 'record-1',
    recordType: 'SPF',
    name: '@',
    value: 'v=spf1 include:_spf.google.com ~all',
    purpose: 'spf',
    metadata: null,
  },
  {
    id: 'record-2',
    recordType: 'DKIM',
    name: 'google._domainkey',
    value: 'v=DKIM1; k=rsa; p=MIGfMA0GCS...',
    purpose: 'dkim',
    metadata: null,
  },
  {
    id: 'record-3',
    recordType: 'DMARC',
    name: '_dmarc',
    value: 'v=DMARC1; p=none; rua=mailto:dmarc@example.com',
    purpose: 'dmarc',
    metadata: null,
  },
  {
    id: 'record-4',
    recordType: 'MX',
    name: '@',
    value: 'smtp.google.com',
    purpose: 'mx',
    metadata: null,
  },
];

const mockPropagationStatus: DNSPropagationStatus = {
  domain: 'example.com',
  recordType: 'TXT',
  expectedValue: 'v=spf1 include:_spf.google.com ~all',
  isPropagated: false,
  propagationPercentage: 50,
  propagatedServers: 2,
  totalServers: 4,
  serversWithCorrectValue: ['8.8.8.8', '1.1.1.1'],
  serversWithoutValue: ['208.67.222.222', '8.8.4.4'],
  serversWithWrongValue: [],
  checkedAt: new Date(),
};

const mockGlobalCoverage: GlobalPropagationCoverage = {
  overallPercentage: 50,
  totalRecords: 4,
  fullyPropagated: 0,
  partiallyPropagated: 4,
  notPropagated: 0,
  records: [mockPropagationStatus, mockPropagationStatus, mockPropagationStatus, mockPropagationStatus],
  checkedAt: new Date(),
};

describe('DNS Polling Job Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startPollingSession', () => {
    it('should create a new polling session', async () => {
      const { db } = await import('@/lib/db');

      // Mock no existing session
      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      // Mock record count query
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockDNSRecords)),
        })),
      });

      const session = await startPollingSession('domain-123', 'user-123');

      expect(session).toBeDefined();
      expect(session.domainId).toBe('domain-123');
      expect(session.userId).toBe('user-123');
      expect(session.status).toBe('polling');
      expect(session.checkInterval).toBe(30000);
      expect(session.maxDuration).toBe(172800000);
    });

    it('should return existing session if already polling', async () => {
      const { db } = await import('@/lib/db');

      // Mock existing session
      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockPollingSession])),
          })),
        })),
      });

      const session = await startPollingSession('domain-123', 'user-123');

      expect(session).toEqual(mockPollingSession);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('checkPollingProgress', () => {
    it('should check DNS propagation for all records', async () => {
      const { db } = await import('@/lib/db');

      // Mock session fetch
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockPollingSession])),
          })),
        })),
      });

      // Mock domain fetch
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockDomain])),
          })),
        })),
      });

      // Mock DNS records fetch
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockDNSRecords)),
        })),
      });

      // Mock propagation checks
      (propagationChecker.checkSPFPropagation as Mock).mockResolvedValue(mockPropagationStatus);
      (propagationChecker.checkDKIMPropagation as Mock).mockResolvedValue(mockPropagationStatus);
      (propagationChecker.checkDMARCPropagation as Mock).mockResolvedValue(mockPropagationStatus);
      (propagationChecker.checkMXPropagation as Mock).mockResolvedValue(mockPropagationStatus);
      (propagationChecker.calculateGlobalCoverage as Mock).mockReturnValue(mockGlobalCoverage);

      await checkPollingProgress('session-123');

      expect(propagationChecker.checkSPFPropagation).toHaveBeenCalled();
      expect(propagationChecker.checkDKIMPropagation).toHaveBeenCalled();
      expect(propagationChecker.checkDMARCPropagation).toHaveBeenCalled();
      expect(propagationChecker.checkMXPropagation).toHaveBeenCalled();
      expect(propagationChecker.calculateGlobalCoverage).toHaveBeenCalled();
    });

    it('should mark session as completed when all records propagated', async () => {
      const { db } = await import('@/lib/db');

      const completedCoverage: GlobalPropagationCoverage = {
        overallPercentage: 100,
        totalRecords: 4,
        fullyPropagated: 4,
        partiallyPropagated: 0,
        notPropagated: 0,
        records: [],
        checkedAt: new Date(),
      };

      // Mock session fetch
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockPollingSession])),
          })),
        })),
      });

      // Mock domain fetch
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockDomain])),
          })),
        })),
      });

      // Mock DNS records fetch
      (db.select as Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockDNSRecords)),
        })),
      });

      (propagationChecker.checkSPFPropagation as Mock).mockResolvedValue({
        ...mockPropagationStatus,
        isPropagated: true,
        propagationPercentage: 100,
      });
      (propagationChecker.checkDKIMPropagation as Mock).mockResolvedValue({
        ...mockPropagationStatus,
        isPropagated: true,
        propagationPercentage: 100,
      });
      (propagationChecker.checkDMARCPropagation as Mock).mockResolvedValue({
        ...mockPropagationStatus,
        isPropagated: true,
        propagationPercentage: 100,
      });
      (propagationChecker.checkMXPropagation as Mock).mockResolvedValue({
        ...mockPropagationStatus,
        isPropagated: true,
        propagationPercentage: 100,
      });
      (propagationChecker.calculateGlobalCoverage as Mock).mockReturnValue(completedCoverage);

      // Mock update to return completed session
      const completedSession = { ...mockPollingSession, status: 'completed', overallProgress: 100 };
      (db.update as Mock).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([completedSession])),
          })),
        })),
      });

      const session = await checkPollingProgress('session-123');

      expect(session.status).toBe('completed');
      expect(session.overallProgress).toBe(100);
    });

    it('should mark session as timeout after 48 hours', async () => {
      const { db } = await import('@/lib/db');

      // Mock session that started 49 hours ago
      const oldSession = {
        ...mockPollingSession,
        startedAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
      };

      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([oldSession])),
          })),
        })),
      });

      // Mock update to return timeout session
      const timeoutSession = { ...oldSession, status: 'timeout' };
      (db.update as Mock).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([timeoutSession])),
          })),
        })),
      });

      const session = await checkPollingProgress('session-123');

      expect(session.status).toBe('timeout');
    });

    it('should throw error if session not found', async () => {
      const { db } = await import('@/lib/db');

      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      await expect(checkPollingProgress('nonexistent')).rejects.toThrow(
        'Polling session not found: nonexistent'
      );
    });
  });

  describe('getPollingStatus', () => {
    it('should return current session status', async () => {
      const { db } = await import('@/lib/db');

      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockPollingSession])),
          })),
        })),
      });

      const session = await getPollingStatus('session-123');

      expect(session).toEqual(mockPollingSession);
    });

    it('should return null if session not found', async () => {
      const { db } = await import('@/lib/db');

      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      const session = await getPollingStatus('nonexistent');

      expect(session).toBeNull();
    });
  });

  describe('cancelPollingSession', () => {
    it('should cancel an active polling session', async () => {
      const { db } = await import('@/lib/db');

      const cancelledSession = { ...mockPollingSession, status: 'cancelled' };
      (db.update as Mock).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([cancelledSession])),
          })),
        })),
      });

      const session = await cancelPollingSession('session-123');

      expect(session.status).toBe('cancelled');
    });

    it('should throw error if session not found', async () => {
      const { db } = await import('@/lib/db');

      (db.update as Mock).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      await expect(cancelPollingSession('nonexistent')).rejects.toThrow(
        'Polling session not found: nonexistent'
      );
    });
  });

  describe('getActivePollingSession', () => {
    it('should return active polling session for domain', async () => {
      const { db } = await import('@/lib/db');

      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockPollingSession])),
          })),
        })),
      });

      const session = await getActivePollingSession('domain-123');

      expect(session).toEqual(mockPollingSession);
    });

    it('should return null if no active session', async () => {
      const { db } = await import('@/lib/db');

      (db.select as Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      const session = await getActivePollingSession('domain-123');

      expect(session).toBeNull();
    });
  });
});
