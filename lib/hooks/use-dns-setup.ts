/**
 * DNS Setup Hook (Task 7.3a)
 *
 * TanStack Query hook for DNS configuration workflow
 * Handles DNS record creation and automatic polling session start
 */

'use client';

import { useMutation } from '@tanstack/react-query';
import type { DNSSetupResult } from '@/server/dns/dns-manager';
import type { PollingSession } from '@/server/dns/polling-job';

interface UseDNSSetupParams {
  setupDNSAction: (domainId: string) => Promise<DNSSetupResult>;
  startPollingAction: (
    domainId: string
  ) => Promise<{ success: boolean; data?: PollingSession; error?: string }>;
  onSuccess?: (pollingSessionId: string) => void;
  onError?: (error: string) => void;
}

export function useDNSSetup({
  setupDNSAction,
  startPollingAction,
  onSuccess,
  onError,
}: UseDNSSetupParams) {
  // DNS setup mutation
  const setupMutation = useMutation({
    mutationFn: async (domainId: string) => {
      // Step 1: Configure DNS records
      const setupResult = await setupDNSAction(domainId);

      if (!setupResult.success) {
        throw new Error(
          setupResult.errors.length > 0
            ? setupResult.errors[0]
            : 'Failed to configure DNS records'
        );
      }

      // Step 2: Start polling session
      const pollingResult = await startPollingAction(domainId);

      if (!pollingResult.success || !pollingResult.data) {
        throw new Error(
          pollingResult.error || 'Failed to start DNS monitoring'
        );
      }

      return {
        setupResult,
        pollingSession: pollingResult.data,
      };
    },
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data.pollingSession.id);
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (onError) {
        onError(errorMessage);
      }
    },
  });

  return {
    setupDNS: setupMutation.mutate,
    isLoading: setupMutation.isPending,
    isSuccess: setupMutation.isSuccess,
    isError: setupMutation.isError,
    result: setupMutation.data?.setupResult,
    pollingSession: setupMutation.data?.pollingSession,
    error: setupMutation.error?.message,
    reset: setupMutation.reset,
  };
}
