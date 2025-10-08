/**
 * Domains Content Component
 *
 * Client wrapper component for domain management
 * Uses TanStack Query for state management and optimistic updates
 */

'use client';

import { DomainList } from './DomainList';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { useDomains } from '@/lib/hooks/use-domains';
import type { Domain, DomainConnectionInput, DomainConnectionResult } from '@/lib/types/domain';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';
import type { DNSSetupResult } from '@/server/dns/dns-manager';
import type { EmailAccountResult } from '@/lib/types/email';
import type { SmartleadConnectionResult } from '@/lib/types/smartlead';
import type { PollingSession } from '@/server/dns/polling-job';

interface DomainsContentProps {
  userId: string;
  initialDomains: Domain[];
  deleteDomainAction: (domainId: string) => Promise<{ success: boolean; error?: string }>;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;

  // Wizard Server Actions (all required for end-to-end setup)
  connectDomainAction: (input: DomainConnectionInput) => Promise<DomainConnectionResult>;
  setupDNSAction: (domainId: string) => Promise<DNSSetupResult>;
  startPollingAction: (
    domainId: string
  ) => Promise<{ success: boolean; data?: PollingSession; error?: string }>;
  createEmailAccountAction: (params: {
    domainId: string;
    username: string;
    firstName: string;
    lastName: string;
  }) => Promise<EmailAccountResult>;
  connectToSmartleadAction: (emailAccountId: string) => Promise<SmartleadConnectionResult>;
}

export function DomainsContent({
  userId,
  initialDomains,
  deleteDomainAction,
  verifyNameserversAction,
  connectDomainAction,
  setupDNSAction,
  startPollingAction,
  createEmailAccountAction,
  connectToSmartleadAction,
}: DomainsContentProps) {
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
        <SetupWizard
          userId={userId}
          triggerLabel={totalDomains > 0 ? 'Setup New Domain' : 'Start Setup Wizard'}
          triggerVariant="default"
          connectDomainAction={connectDomainAction}
          verifyNameserversAction={verifyNameserversAction}
          setupDNSAction={setupDNSAction}
          startPollingAction={startPollingAction}
          createEmailAccountAction={createEmailAccountAction}
          connectToSmartleadAction={connectToSmartleadAction}
        />
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
