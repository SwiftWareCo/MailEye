/**
 * TanStack Query hook for nameserver verification with polling
 *
 * Provides real-time nameserver verification status with automatic polling
 * every 30 seconds until verification is complete
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';

/**
 * Query key factory for nameserver verification
 */
export const nameserverVerificationKeys = {
  all: ['nameserver-verification'] as const,
  domain: (domainId: string) => [...nameserverVerificationKeys.all, domainId] as const,
};

interface UseNameserverVerificationOptions {
  domainId: string;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;
  enabled?: boolean;
  onVerified?: () => void;
}

/**
 * Hook: Poll nameserver verification status
 *
 * Features:
 * - Polls every 30 seconds while verification is pending
 * - Stops polling when verified or error occurs
 * - Refetches on window focus if still pending
 * - Calls onVerified callback when verification succeeds
 */
export function useNameserverVerification({
  domainId,
  verifyNameserversAction,
  enabled = true,
  onVerified,
}: UseNameserverVerificationOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: nameserverVerificationKeys.domain(domainId),
    queryFn: async () => {
      const result = await verifyNameserversAction(domainId);

      // Call onVerified callback if verification succeeds
      if (result.isVerified && onVerified) {
        onVerified();
      }

      return result;
    },
    enabled: enabled && !!domainId,
    refetchInterval: (query) => {
      const data = query.state.data;

      // Stop polling if verified
      if (data?.isVerified) {
        return false;
      }

      // Stop polling if there's an error
      if (data?.error) {
        return false;
      }

      // Poll every 30 seconds while pending
      return 30000; // 30 seconds
    },
    refetchOnWindowFocus: (query) => {
      const data = query.state.data;
      // Only refetch on focus if not yet verified
      return !data?.isVerified;
    },
    staleTime: 0, // Always fetch fresh data
    retry: 1, // Retry once on network errors
  });

  /**
   * Manual verification trigger (for "Check Now" button)
   */
  const checkNow = async () => {
    await queryClient.invalidateQueries({
      queryKey: nameserverVerificationKeys.domain(domainId),
    });
    return query.refetch();
  };

  return {
    ...query,
    isVerified: query.data?.isVerified ?? false,
    currentNameservers: query.data?.currentNameservers ?? [],
    expectedNameservers: query.data?.expectedNameservers ?? [],
    message: query.data?.message ?? '',
    verificationError: query.data?.error,
    checkNow,
  };
}
