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
  connectDomainAction,
  deleteDomainAction,
  verifyNameserversAction,
} from '@/server/domain/domain.actions';

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

  // Fetch user's domains
  const domains = await getUserDomains(user.id);


  // Bind userId to Server Actions (Next.js best practice)
  const boundConnectDomain = connectDomainAction.bind(null, user.id);
  const boundDeleteDomain = deleteDomainAction.bind(null, user.id);
  const boundVerifyNameservers = verifyNameserversAction.bind(null, user.id);

  return (
    <DomainsContent
      userId={user.id}
      initialDomains={domains}
      connectDomainAction={boundConnectDomain}
      deleteDomainAction={boundDeleteDomain}
      verifyNameserversAction={boundVerifyNameservers}
    />
  );
}
