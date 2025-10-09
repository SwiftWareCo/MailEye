/**
 * Domains Content Component
 *
 * Client wrapper component for domain management
 * Uses TanStack Query for state management and optimistic updates
 */

'use client';

import { DomainList } from './DomainList';
import { Button } from '@/components/ui/button';
import { useDomains } from '@/lib/hooks/use-domains';
import { useRouter } from 'next/navigation';
import type { Domain } from '@/lib/types/domain';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';

interface DomainsContentProps {
  userId: string;
  initialDomains: Domain[];
  deleteDomainAction: (domainId: string) => Promise<{ success: boolean; error?: string }>;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;
}

export function DomainsContent({
  userId,
  initialDomains,
  deleteDomainAction,
  verifyNameserversAction,
}: DomainsContentProps) {
  const router = useRouter();

  // Use TanStack Query for reactive state management
  const { data: domains } = useDomains(initialDomains, userId);

  // Calculate stats
  const totalDomains = domains.length;
  const verifiedDomains = domains.filter((d) => d.verificationStatus === 'verified').length;
  const pendingDomains = domains.filter(
    (d) =>
      d.verificationStatus === 'pending' ||
      d.verificationStatus === 'pending_nameservers' ||
      d.verificationStatus === 'verifying'
  ).length;

  return (
    <div className="space-y-6">
      {/* Page header with inline stats and action button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Domains</h1>
          <p className="text-muted-foreground mt-2">
            {totalDomains > 0 ? (
              <>
                <span className="font-medium text-foreground">{totalDomains} total</span>
                {' · '}
                <span className="text-green-500">{verifiedDomains} verified</span>
                {' · '}
                <span className="text-yellow-500">{pendingDomains} pending</span>
              </>
            ) : (
              'Set up your email infrastructure in 7 guided steps'
            )}
          </p>
        </div>
        <Button
          onClick={() => router.push('/setup')}
          variant="default"
        >
          {totalDomains > 0 ? 'Setup New Domain' : 'Start Setup Wizard'}
        </Button>
      </div>

      {/* Domain list */}
      <DomainList
        userId={userId}
        domains={domains}
        deleteDomainAction={deleteDomainAction}
        verifyNameserversAction={verifyNameserversAction}
      />
    </div>
  );
}
