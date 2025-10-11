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
} from '@/server/dns/dns.actions';
import { confirmManualVerificationAction } from '@/server/google-workspace/google-workspace.actions';
import { connectToSmartleadAction } from '@/server/smartlead/smartlead.actions';
import { addDKIMRecordDomainAction } from '@/server/domain/domain.actions';
import { createEmailAccountAction } from '@/server/email/email.actions';

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
      onCreateEmailAccount={async (
        emailPrefix: string,
        displayName: string,
        count?: number
      ) => {
        'use server';

        // Parse firstName and lastName from displayName
        const nameParts = displayName.trim().split(' ');
        const firstName = nameParts[0] || emailPrefix;
        const lastName = nameParts.slice(1).join(' ') || emailPrefix;

        // For now, only support single account creation
        // Batch creation would require using batchCreateEmailAccountsAction
        if (count && count > 1) {
          return {
            success: false,
            error: 'Batch creation not yet implemented',
          };
        }

        const result = await createEmailAccountAction({
          domainId,
          username: emailPrefix,
          firstName,
          lastName,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error?.message || 'Failed to create email account',
          };
        }

        return {
          success: true,
          accounts: [result],
        };
      }}
      onConnectToSmartlead={async (emailAccountId: string) => {
        'use server';
        await connectToSmartleadAction(emailAccountId);
      }}
    />
  );
}
