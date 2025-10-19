/**
 * Domains Content Component
 *
 * Client wrapper component for domain management
 * Uses TanStack Query for state management and optimistic updates
 */

'use client';

import { DomainList } from './DomainList';
import { DomainConnectionModal } from './DomainConnectionModal';
import { CredentialSetupBanner } from './CredentialSetupBanner';
import { Button } from '@/components/ui/button';
import { useDomains } from '@/lib/hooks/use-domains';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Domain, DomainConnectionInput, DomainConnectionResult } from '@/lib/types/domain';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';

interface CredentialStatus {
  cloudflare: boolean;
  googleWorkspace: boolean;
  smartlead: boolean;
}

interface DomainWarmupStatus {
  domainId: string;
  status: 'overdue' | 'pending' | 'complete' | 'none';
  pendingCount: number;
  overdueCount: number;
  totalAccounts: number;
}

interface DomainsContentProps {
  userId: string;
  initialDomains: Domain[];
  warmupStatuses: DomainWarmupStatus[];
  credentialStatus: CredentialStatus;
  deleteDomainAction: (domainId: string) => Promise<{ success: boolean; error?: string }>;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;
  connectDomainAction: (input: DomainConnectionInput) => Promise<DomainConnectionResult>;
}

export function DomainsContent({
  userId,
  initialDomains,
  warmupStatuses,
  credentialStatus,
  deleteDomainAction,
  verifyNameserversAction,
  connectDomainAction,
}: DomainsContentProps) {
  const [showDomainModal, setShowDomainModal] = useState(false);

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

  const hasCloudflare = credentialStatus.cloudflare;

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
            ) : hasCloudflare ? (
              'Connect your first domain to get started'
            ) : (
              'Connect to Cloudflare to manage your domains'
            )}
          </p>
        </div>
        {hasCloudflare && (
          <Button
            onClick={() => setShowDomainModal(true)}
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            {totalDomains > 0 ? 'Connect Domain' : 'Connect First Domain'}
          </Button>
        )}
      </div>

      {/* Credential setup banner */}
      <CredentialSetupBanner credentialStatus={credentialStatus} />

      {/* Domain list */}
      {hasCloudflare && (
        <DomainList
          userId={userId}
          domains={domains}
          warmupStatuses={warmupStatuses}
          deleteDomainAction={deleteDomainAction}
          verifyNameserversAction={verifyNameserversAction}
        />
      )}

      {/* Domain connection modal */}
      {hasCloudflare && (
        <DomainConnectionModal
          userId={userId}
          connectDomainAction={connectDomainAction}
          open={showDomainModal}
          onOpenChange={setShowDomainModal}
        />
      )}
    </div>
  );
}
