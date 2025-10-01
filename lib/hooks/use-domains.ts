/**
 * TanStack Query hooks for domain management
 *
 * Provides queries and mutations for domain operations with
 * automatic cache invalidation and optimistic updates
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  Domain,
  DomainConnectionInput,
  DomainConnectionResult,
} from '@/lib/types/domain';

/**
 * Query key factory for domain queries
 */
export const domainKeys = {
  all: ['domains'] as const,
  lists: () => [...domainKeys.all, 'list'] as const,
  list: (userId: string) => [...domainKeys.lists(), userId] as const,
  details: () => [...domainKeys.all, 'detail'] as const,
  detail: (id: string) => [...domainKeys.details(), id] as const,
};

/**
 * Hook: Fetch user's domains
 * Uses initial data from server component for instant hydration
 */
export function useDomains(initialDomains: Domain[], userId: string) {
  return useQuery({
    queryKey: domainKeys.list(userId),
    queryFn: async () => {
      // For now, we rely on server-side data and mutations to update
      // In future, can add client-side fetch here
      return initialDomains;
    },
    initialData: initialDomains,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook: Connect a new domain
 * Optimistically updates the cache and shows toast notifications
 */
export function useConnectDomain(
  userId: string,
  connectDomainAction: (
    input: DomainConnectionInput
  ) => Promise<DomainConnectionResult>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DomainConnectionInput) => {
      return await connectDomainAction(input);
    },
    onSuccess: (result) => {
      if (result.success && result.domain) {
        // Optimistically add domain to cache
        queryClient.setQueryData<Domain[]>(
          domainKeys.list(userId),
          (old = []) => [result.domain!, ...old]
        );

        toast.success('Domain connected successfully!', {
          description: `${result.domain.domain} has been added to your account.`,
        });
      } else if (result.error) {
        toast.error('Failed to connect domain', {
          description: result.error,
        });
      } else if (result.validationErrors && result.validationErrors.length > 0) {
        toast.error('Validation failed', {
          description: result.validationErrors[0],
        });
      }
    },
    onError: (error: Error) => {
      toast.error('An unexpected error occurred', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook: Delete a domain
 * Optimistically removes from cache and shows toast notifications
 */
export function useDeleteDomain(
  userId: string,
  deleteDomainAction: (domainId: string) => Promise<{ success: boolean; error?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domainId: string) => {
      return await deleteDomainAction(domainId);
    },
    onMutate: async (domainId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: domainKeys.list(userId) });

      // Snapshot previous value
      const previousDomains = queryClient.getQueryData<Domain[]>(
        domainKeys.list(userId)
      );

      // Optimistically remove domain
      queryClient.setQueryData<Domain[]>(domainKeys.list(userId), (old = []) =>
        old.filter((d) => d.id !== domainId)
      );

      // Return context with previous data for rollback
      return { previousDomains };
    },
    onSuccess: (result, _domainId, context) => {
      if (result.success) {
        toast.success('Domain deleted', {
          description: 'The domain has been permanently removed.',
        });
      } else {
        // Rollback on failure
        if (context?.previousDomains) {
          queryClient.setQueryData(
            domainKeys.list(userId),
            context.previousDomains
          );
        }
        toast.error('Failed to delete domain', {
          description: result.error || 'An error occurred',
        });
      }
    },
    onError: (error: Error, _domainId, context) => {
      // Rollback on error
      if (context?.previousDomains) {
        queryClient.setQueryData(
          domainKeys.list(userId),
          context.previousDomains
        );
      }
      toast.error('An unexpected error occurred', {
        description: error.message,
      });
    },
  });
}
