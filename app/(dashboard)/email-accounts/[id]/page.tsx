/**
 * Email Account Detail Page
 *
 * Shows warmup metrics, checklist history, and account health for individual email account
 */

import { requireOnboarding } from '@/server/auth/auth.data';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { emailAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { EmailAccountMetrics } from '@/components/email-accounts/EmailAccountMetrics';

interface EmailAccountPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmailAccountPage({ params }: EmailAccountPageProps) {
  const { needsOnboarding, user } = await requireOnboarding();
  const { id } = await params;

  if (!user) {
    return null;
  }

  if (needsOnboarding) {
    redirect('/onboarding');
  }

  // Fetch email account with verification that it belongs to user
  const account = await db.query.emailAccounts.findFirst({
    where: and(
      eq(emailAccounts.id, id),
      eq(emailAccounts.userId, user.id)
    ),
  });

  if (!account) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <EmailAccountMetrics account={account} userId={user.id} />
    </div>
  );
}
