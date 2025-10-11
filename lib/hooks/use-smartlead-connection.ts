/**
 * TanStack Query Hook for Smartlead Connection
 *
 * Provides mutations for connecting email accounts to Smartlead (single and batch)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  connectToSmartleadAction,
  batchConnectToSmartleadAction,
  disconnectFromSmartleadAction,
  updateWarmupSettingsAction,
} from '@/server/smartlead/smartlead.actions';
import type { SmartleadConnectionResult } from '@/lib/types/smartlead';

/**
 * Hook for single Smartlead connection
 *
 * @example
 * const { connectAccount, isPending, isSuccess } = useSmartleadConnection();
 *
 * const handleConnect = () => {
 *   connectAccount.mutate({
 *     emailAccountId: 'email-123',
 *     warmupConfig: {
 *       warmupEnabled: true,
 *       maxEmailPerDay: 50,
 *       totalWarmupPerDay: 40,
 *       dailyRampup: 5,
 *     },
 *   });
 * };
 */
export function useSmartleadConnection() {
  const queryClient = useQueryClient();

  const connectAccount = useMutation({
    mutationFn: async ({
      emailAccountId,
      warmupConfig,
    }: {
      emailAccountId: string;
      warmupConfig?: {
        warmupEnabled?: boolean;
        maxEmailPerDay?: number;
        totalWarmupPerDay?: number;
        dailyRampup?: number;
      };
    }) => {
      return connectToSmartleadAction(emailAccountId, warmupConfig);
    },
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate smartlead connections query
        queryClient.invalidateQueries({ queryKey: ['smartlead-connections'] });
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      }
    },
  });

  const disconnectAccount = useMutation({
    mutationFn: disconnectFromSmartleadAction,
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['smartlead-connections'] });
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      }
    },
  });

  const updateWarmup = useMutation({
    mutationFn: async ({
      emailAccountId,
      settings,
    }: {
      emailAccountId: string;
      settings: {
        warmupEnabled?: boolean;
        warmupReputation?: 'average' | 'good' | 'excellent';
        maxEmailPerDay?: number;
        totalWarmupPerDay?: number;
        dailyRampup?: number;
      };
    }) => {
      return updateWarmupSettingsAction(emailAccountId, settings);
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['smartlead-connections'] });
      }
    },
  });

  return {
    connectAccount,
    disconnectAccount,
    updateWarmup,
    isPending: connectAccount.isPending,
    isSuccess: connectAccount.isSuccess,
    isError: connectAccount.isError,
    data: connectAccount.data,
    error: connectAccount.error,
  };
}

/**
 * Hook for batch Smartlead connection
 *
 * @example
 * const { batchConnect, isPending, progress } = useBatchSmartleadConnection();
 *
 * const handleBatchConnect = () => {
 *   batchConnect.mutate({
 *     emailAccountIds: ['email-1', 'email-2', 'email-3'],
 *     warmupConfig: {
 *       warmupEnabled: true,
 *       maxEmailPerDay: 50,
 *     },
 *   });
 * };
 */
export function useBatchSmartleadConnection() {
  const queryClient = useQueryClient();

  const batchConnect = useMutation({
    mutationFn: async ({
      emailAccountIds,
      warmupConfig,
    }: {
      emailAccountIds: string[];
      warmupConfig?: {
        warmupEnabled?: boolean;
        maxEmailPerDay?: number;
        totalWarmupPerDay?: number;
        dailyRampup?: number;
      };
    }) => {
      return batchConnectToSmartleadAction(emailAccountIds, warmupConfig);
    },
    onSuccess: (data) => {
      if (data.success || data.summary.successful > 0) {
        // Invalidate queries when any connection succeeds
        queryClient.invalidateQueries({ queryKey: ['smartlead-connections'] });
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      }
    },
  });

  return {
    batchConnect,
    isPending: batchConnect.isPending,
    isSuccess: batchConnect.isSuccess,
    isError: batchConnect.isError,
    data: batchConnect.data,
    error: batchConnect.error,
    summary: batchConnect.data?.summary,
  };
}
