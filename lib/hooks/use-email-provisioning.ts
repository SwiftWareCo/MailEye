/**
 * TanStack Query Hook for Email Provisioning
 *
 * Provides mutations for creating email accounts (single and batch)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEmailAccountAction } from '@/server/email/email.actions';
import { batchCreateEmailAccountsAction } from '@/server/email/batch-email.actions';

/**
 * Hook for single email account creation
 *
 * @example
 * const { createAccount, isPending, isSuccess, data } = useEmailProvisioning();
 *
 * const handleCreate = () => {
 *   createAccount.mutate({
 *     domainId: 'domain-123',
 *     username: 'john',
 *     firstName: 'John',
 *     lastName: 'Doe',
 *   });
 * };
 */
export function useEmailProvisioning(domainId?: string) {
  const queryClient = useQueryClient();

  const createAccount = useMutation({
    mutationFn: createEmailAccountAction,
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate email accounts query when new account is created
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });

        // Invalidate domain setup status for this domain
        if (domainId) {
          queryClient.invalidateQueries({ queryKey: ['domain-setup-status', domainId] });
        }
      }
    },
  });

  return {
    createAccount,
    isPending: createAccount.isPending,
    isSuccess: createAccount.isSuccess,
    isError: createAccount.isError,
    data: createAccount.data,
    error: createAccount.error,
  };
}

/**
 * Hook for batch email account creation
 *
 * @example
 * const { batchCreate, isPending, progress } = useBatchEmailProvisioning();
 *
 * const handleBatchCreate = () => {
 *   batchCreate.mutate({
 *     domainId: 'domain-123',
 *     accounts: [
 *       { username: 'john', firstName: 'John', lastName: 'Doe' },
 *       { username: 'jane', firstName: 'Jane', lastName: 'Smith' },
 *     ],
 *   });
 * };
 */
export function useBatchEmailProvisioning(domainId?: string) {
  const queryClient = useQueryClient();

  const batchCreate = useMutation({
    mutationFn: batchCreateEmailAccountsAction,
    onSuccess: (data) => {
      if (data.success || data.successfulAccounts > 0) {
        // Invalidate email accounts query when any account is created
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });

        // Invalidate domain setup status for this domain
        if (domainId) {
          queryClient.invalidateQueries({ queryKey: ['domain-setup-status', domainId] });
        }
      }
    },
  });

  return {
    batchCreate,
    isPending: batchCreate.isPending,
    isSuccess: batchCreate.isSuccess,
    isError: batchCreate.isError,
    data: batchCreate.data,
    error: batchCreate.error,
    progress: batchCreate.data?.progress,
  };
}
