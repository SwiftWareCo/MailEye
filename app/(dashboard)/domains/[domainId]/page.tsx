/**
 * Domain Detail Page
 *
 * Shows comprehensive domain information with tabbed interface
 */

import { requireOnboarding } from '@/server/auth/auth.data';
import { redirect } from 'next/navigation';
import { getDomainDetails } from '@/server/domain/domain-details.data';
import { DomainDetailView } from '@/components/domains/DomainDetailView';
import { verifyNameserversAction } from '@/server/domain/domain.actions';
import {
  setupEmailDNSWithVerificationAction,
  createDMARCRecordAction,
} from '@/server/dns/dns.actions';
import { confirmManualVerificationAction } from '@/server/google-workspace/google-workspace.actions';
import { connectToSmartleadAction } from '@/server/smartlead/smartlead.actions';
import { addDKIMRecordDomainAction } from '@/server/domain/domain.actions';

interface DomainDetailPageProps {
  params: Promise<{
    domainId: string;
  }>;
}

export default async function DomainDetailPage({
  params,
}: DomainDetailPageProps) {
  const { domainId } = await params;
  const { needsOnboarding, user } = await requireOnboarding();

  // If user is not authenticated, Stack Auth middleware will handle redirect
  if (!user) {
    return null;
  }

  // If user needs onboarding, redirect to onboarding page
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  // Fetch domain details
  const details = await getDomainDetails(domainId, user.id);

  // If domain not found or not owned by user, redirect to domains page
  if (!details) {
    redirect('/domains');
    return null;
  }

  // Bind userId to actions
  const boundVerifyNameservers = verifyNameserversAction.bind(null, user.id);

  return (
    <DomainDetailView
      details={details}
      onVerifyNameservers={async () => {
        'use server';
        await boundVerifyNameservers(domainId);
      }}
      onConfigureEmailDNS={async () => {
        'use server';
        await setupEmailDNSWithVerificationAction(domainId);
      }}
      onConfirmManualVerification={async () => {
        'use server';
        return await confirmManualVerificationAction(domainId);
      }}
      onAddDKIMRecord={async (hostname: string, value: string) => {
        'use server';
        return await addDKIMRecordDomainAction(
          user.id,
          domainId,
          hostname,
          value
        );
      }}
      onCreateDMARCRecord={async () => {
        'use server';
        return await createDMARCRecordAction(domainId);
      }}
      onConnectToSmartlead={async (emailAccountId: string) => {
        'use server';
        await connectToSmartleadAction(emailAccountId);
      }}
    />
  );
}
