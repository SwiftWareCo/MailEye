/**
 * Domains Page
 *
 * Main page for domain management (Server Component)
 * Fetches domains and binds userId to Server Actions
 */

import { requireOnboarding } from '@/server/auth/auth.data';
import { redirect } from 'next/navigation';
import { getUserDomains } from '@/server/domain/domain.data';
import { DomainsContent } from '@/components/domains/DomainsContent';
import { CloudflareSetup } from '@/components/domains/CloudflareSetup';
import {
  connectDomainAction,
  deleteDomainAction,
  verifyNameserversAction,
} from '@/server/domain/domain.actions';
import {
  saveCloudflareCredentialsAction,
  getUserCloudflareCredentials,
  syncCloudflareZonesToDatabase,
} from '@/server/cloudflare/cloudflare.actions';
import { setupDNSAction } from '@/server/dns/dns.actions';
import { startDNSPollingAction } from '@/server/dns/dns-status.actions';
import { createEmailAccountAction } from '@/server/email/email.actions';
import { connectToSmartleadAction } from '@/server/smartlead/smartlead.actions';

export default async function DomainsPage() {
  const { needsOnboarding, user } = await requireOnboarding();


  // If user is not authenticated, Stack Auth middleware will handle redirect
  if (!user) {
    return null;
  }

  // If user needs onboarding, redirect to onboarding page
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  // Check if user has connected Cloudflare
  const cloudflareCredentials = await getUserCloudflareCredentials();

  // If no Cloudflare credentials, show setup component
  if (!cloudflareCredentials) {
    return <CloudflareSetup saveCredentialsAction={saveCloudflareCredentialsAction} />;
  }

  // Sync existing Cloudflare zones to database (if any)
  await syncCloudflareZonesToDatabase(user.id);

  // Fetch user's domains from database (now includes synced zones)
  const domains = await getUserDomains(user.id);

  // Bind userId to Server Actions (Next.js best practice)
  const boundConnectDomain = connectDomainAction.bind(null, user.id);
  const boundDeleteDomain = deleteDomainAction.bind(null, user.id);
  const boundVerifyNameservers = verifyNameserversAction.bind(null, user.id);

  // Note: DNS, Email, and Smartlead actions handle auth internally (don't need userId binding)

  return (
    <DomainsContent
      userId={user.id}
      initialDomains={domains}
      connectDomainAction={boundConnectDomain}
      deleteDomainAction={boundDeleteDomain}
      verifyNameserversAction={boundVerifyNameservers}
      setupDNSAction={setupDNSAction}
      startPollingAction={startDNSPollingAction}
      createEmailAccountAction={createEmailAccountAction}
      connectToSmartleadAction={connectToSmartleadAction}
    />
  );
}
