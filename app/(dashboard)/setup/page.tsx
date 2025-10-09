/**
 * Setup Wizard Page (Full-Page)
 *
 * Dedicated route for email infrastructure setup wizard
 */

import { requireOnboarding } from '@/server/auth/auth.data';
import { redirect } from 'next/navigation';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { saveCloudflareCredentialsAction } from '@/server/cloudflare/cloudflare.actions';
import { saveGoogleWorkspaceCredentialsAction } from '@/server/google-workspace/google-workspace.actions';
import { saveSmartleadCredentialsAction } from '@/server/smartlead/credentials.actions';
import { connectDomainAction, verifyNameserversAction } from '@/server/domain/domain.actions';
import { setupDNSAction } from '@/server/dns/dns.actions';
import { startDNSPollingAction } from '@/server/dns/dns-status.actions';
import { createEmailAccountAction } from '@/server/email/email.actions';
import { connectToSmartleadAction } from '@/server/smartlead/smartlead.actions';
import { getCredentialSetupStatus } from '@/server/credentials/credentials.data';

export default async function SetupPage() {
  const { needsOnboarding, user } = await requireOnboarding();

  // If user is not authenticated, Stack Auth middleware will handle redirect
  if (!user) {
    return null;
  }

  // If user needs onboarding, redirect to onboarding page
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  // Get credential setup status to skip already configured steps
  const credentialStatus = await getCredentialSetupStatus();

  // Bind userId to domain actions
  const boundConnectDomain = connectDomainAction.bind(null, user.id);
  const boundVerifyNameservers = verifyNameserversAction.bind(null, user.id);

  return (
    <SetupWizard
      userId={user.id}
      credentialStatus={credentialStatus}
      saveCloudflareCredentialsAction={saveCloudflareCredentialsAction}
      saveGoogleWorkspaceCredentialsAction={saveGoogleWorkspaceCredentialsAction}
      saveSmartleadCredentialsAction={saveSmartleadCredentialsAction}
      connectDomainAction={boundConnectDomain}
      verifyNameserversAction={boundVerifyNameservers}
      setupDNSAction={setupDNSAction}
      startPollingAction={startDNSPollingAction}
      createEmailAccountAction={createEmailAccountAction}
      connectToSmartleadAction={connectToSmartleadAction}
    />
  );
}
