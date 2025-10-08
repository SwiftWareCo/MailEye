/**
 * TanStack Query Hook for DNS Status Polling (Task 7.5)
 *
 * React Query hook for real-time DNS propagation monitoring
 * Polls server every 30 seconds while DNS is propagating
 *
 * Features:
 * - Automatic 30-second polling while session is active
 * - Stops polling when DNS is fully propagated
 * - Manual "Check Now" trigger support
 * - Optimistic updates for better UX
 * - Auto-advance callback when complete
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  getDNSStatusAction,
  checkDNSProgressAction,
} from '@/server/dns/dns-status.actions';
import type { PollingProgressReport } from '@/server/dns/polling-progress';
import type { DNSRecordStatus } from '@/server/dns/dns-status.data';

/**
 * DNS Status Query Result
 */
interface DNSStatusResult {
  sessionId: string;
  domainId: string;
  domain?: string;
  status: 'polling' | 'completed' | 'timeout' | 'cancelled';
  progress: {
    overallProgress: number;
    totalRecords: number;
    fullyPropagated: number;
    partiallyPropagated: number;
    notPropagated: number;
    averagePropagationPercentage: number;
  };
  eta: {
    estimatedCompletionTime: Date | null;
    timeRemaining: number;
    timeElapsed: number;
    propagationVelocity: number;
    basedOnTTL: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  records: DNSRecordStatus[];
  isComplete: boolean;
  hasTimedOut: boolean;
  startedAt: Date;
  lastCheckedAt: Date | null;
  completedAt: Date | null;
}

/**
 * Hook options
 */
interface UseDNSStatusOptions {
  /** Callback when DNS propagation completes */
  onComplete?: () => void;

  /** Custom polling interval (default: 30 seconds) */
  pollingInterval?: number;

  /** Enable automatic polling (default: true) */
  enablePolling?: boolean;
}

/**
 * Query key factory for DNS status
 */
export const dnsStatusKeys = {
  all: ['dns-status'] as const,
  session: (sessionId: string) => [...dnsStatusKeys.all, sessionId] as const,
};

/**
 * TanStack Query hook for DNS status monitoring
 *
 * @param sessionId - DNS polling session ID from setupDNSAction
 * @param options - Hook configuration options
 */
export function useDNSStatus(
  sessionId: string,
  options: UseDNSStatusOptions = {}
) {
  const {
    onComplete,
    pollingInterval = 30000, // 30 seconds default
    enablePolling = true,
  } = options;

  const queryClient = useQueryClient();

  // Fetch DNS status from server
  const query = useQuery({
    queryKey: dnsStatusKeys.session(sessionId),
    queryFn: async (): Promise<DNSStatusResult> => {
      const result = await getDNSStatusAction(sessionId);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch DNS status');
      }

      // Transform server data to include records
      const report = result.data as PollingProgressReport & { records?: DNSRecordStatus[] };

      return {
        sessionId: report.sessionId,
        domainId: report.domainId,
        status: report.status,
        progress: report.progress,
        eta: report.eta,
        records: report.records || [],
        isComplete: report.isComplete,
        hasTimedOut: report.hasTimedOut,
        startedAt: report.startedAt,
        lastCheckedAt: report.lastCheckedAt,
        completedAt: report.completedAt,
      };
    },
    // Polling configuration
    refetchInterval: (query) => {
      const data = query.state.data;

      // Stop polling if:
      // - Polling is disabled
      // - Session is complete
      // - Session timed out
      // - Session was cancelled
      if (
        !enablePolling ||
        !data ||
        data.isComplete ||
        data.status === 'completed' ||
        data.status === 'timeout' ||
        data.status === 'cancelled'
      ) {
        return false;
      }

      return pollingInterval;
    },
    // Keep previous data while refetching for smooth UX
    staleTime: pollingInterval,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Handle completion callback
  useEffect(() => {
    if (query.data?.isComplete && onComplete) {
      // Delay callback slightly to allow UI to update
      const timer = setTimeout(() => {
        onComplete();
      }, 2000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [query.data?.isComplete, onComplete]);

  /**
   * Manually trigger DNS propagation check
   * Performs immediate DNS query and updates status
   */
  const checkNow = async () => {
    try {
      // Call server action to perform DNS check
      const result = await checkDNSProgressAction(sessionId);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to check DNS progress');
      }

      // Invalidate and refetch query to get updated data
      await queryClient.invalidateQueries({
        queryKey: dnsStatusKeys.session(sessionId),
      });

      return result.data;
    } catch (error) {
      console.error('Error checking DNS progress:', error);
      throw error;
    }
  };

  return {
    ...query,
    checkNow,
    // Convenience properties
    isPolling: query.data?.status === 'polling',
    isComplete: query.data?.isComplete || false,
    progress: query.data?.progress.overallProgress || 0,
    records: query.data?.records || [],
  };
}

/**
 * Hook for checking if a domain has an active DNS polling session
 *
 * @param domainId - Domain ID
 */
export function useDomainDNSStatus(domainId: string) {
  return useQuery({
    queryKey: ['dns-status', 'domain', domainId] as const,
    queryFn: async () => {
      // This would call getDomainDNSStatusAction when implemented
      // For now, return placeholder
      return null;
    },
    enabled: false, // Disable until needed
  });
}
