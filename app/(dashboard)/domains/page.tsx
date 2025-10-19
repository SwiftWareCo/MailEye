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
import {
  deleteDomainAction,
  verifyNameserversAction,
  connectDomainAction,
} from '@/server/domain/domain.actions';
import { getCredentialSetupStatus } from '@/server/credentials/credentials.data';
import {
  syncCloudflareZonesToDatabase,
} from '@/server/cloudflare/cloudflare.actions';
import { getDomainsWarmupStatus } from '@/server/warmup/warmup.data';

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

  // Get credential setup status
  const credentialStatus = await getCredentialSetupStatus();

  // Sync existing Cloudflare zones to database if Cloudflare is connected
  if (credentialStatus.cloudflare) {
    await syncCloudflareZonesToDatabase(user.id);
  }

  // Fetch user's domains from database (now includes synced zones)
  const domains = await getUserDomains(user.id);

  // Fetch warmup status for all domains
  const warmupStatuses = await getDomainsWarmupStatus(user.id);

  // Bind userId to Server Actions (Next.js best practice)
  const boundDeleteDomain = deleteDomainAction.bind(null, user.id);
  const boundVerifyNameservers = verifyNameserversAction.bind(null, user.id);
  const boundConnectDomain = connectDomainAction.bind(null, user.id);

  return (
    <DomainsContent
      userId={user.id}
      initialDomains={domains}
      warmupStatuses={warmupStatuses}
      credentialStatus={credentialStatus}
      deleteDomainAction={boundDeleteDomain}
      verifyNameserversAction={boundVerifyNameservers}
      connectDomainAction={boundConnectDomain}
    />
  );
}
