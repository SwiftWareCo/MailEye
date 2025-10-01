/**
 * Domains Content Component
 *
 * Client wrapper component for domain management
 * Uses TanStack Query for state management and optimistic updates
 */

'use client';

import { DomainList } from './DomainList';
import { DomainConnectionModal } from './DomainConnectionModal';
import { useDomains } from '@/lib/hooks/use-domains';
import type { Domain, DomainConnectionInput, DomainConnectionResult } from '@/lib/types/domain';

interface DomainsContentProps {
  userId: string;
  initialDomains: Domain[];
  connectDomainAction: (input: DomainConnectionInput) => Promise<DomainConnectionResult>;
  deleteDomainAction: (domainId: string) => Promise<{ success: boolean; error?: string }>;
}

export function DomainsContent({
  userId,
  initialDomains,
  connectDomainAction,
  deleteDomainAction,
}: DomainsContentProps) {
  // Use TanStack Query for reactive state management
  const { data: domains } = useDomains(initialDomains, userId);
  return (
    <div className="space-y-6">
      {/* Page header with action button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Domains</h1>
          <p className="text-muted-foreground mt-2">
            Manage your domains and email infrastructure
          </p>
        </div>
        <DomainConnectionModal userId={userId} connectDomainAction={connectDomainAction} />
      </div>

      {/* Domain list */}
      <DomainList
        userId={userId}
        domains={domains}
        deleteDomainAction={deleteDomainAction}
      />
    </div>
  );
}
