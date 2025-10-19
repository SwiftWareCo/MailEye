/**
 * Warmup Data Layer
 *
 * Fetches warmup checklist status and metrics
 */

'use server';

import { db } from '@/lib/db';
import { warmupChecklistCompletions, emailAccounts, domains } from '@/lib/db/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';

export type WarmupStatus = 'overdue' | 'pending' | 'complete' | 'none';

interface DomainWarmupStatus {
  domainId: string;
  status: WarmupStatus;
  pendingCount: number;
  overdueCount: number;
  totalAccounts: number;
}

/**
 * Get warmup status for all user's domains
 */
export async function getDomainsWarmupStatus(userId: string): Promise<DomainWarmupStatus[]> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Get all domains for the user
  const userDomains = await db
    .select()
    .from(domains)
    .where(eq(domains.userId, userId));

  const statusByDomain: DomainWarmupStatus[] = [];

  for (const domain of userDomains) {
    // Get email accounts for this domain
    const domainAccounts = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.domainId, domain.id),
          isNotNull(emailAccounts.smartleadAccountId)
        )
      );

    if (domainAccounts.length === 0) {
      statusByDomain.push({
        domainId: domain.id,
        status: 'none',
        pendingCount: 0,
        overdueCount: 0,
        totalAccounts: 0,
      });
      continue;
    }

    let pendingCount = 0;
    let overdueCount = 0;

    for (const account of domainAccounts) {
      // Calculate warmup day
      const createdDate = new Date(account.createdAt);
      const todayDate = new Date(today);
      const daysSinceCreation = Math.floor(
        (todayDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const warmupDay = daysSinceCreation + 1;

      // Only check Days 1-7
      if (warmupDay > 7) continue;

      // Check today's completion
      const todayCompletion = await db
        .select()
        .from(warmupChecklistCompletions)
        .where(
          and(
            eq(warmupChecklistCompletions.emailAccountId, account.id),
            eq(warmupChecklistCompletions.completionDate, sql`${today}::date`)
          )
        )
        .limit(1);

      if (todayCompletion.length === 0 || (!todayCompletion[0].completedAt && !todayCompletion[0].skipped)) {
        pendingCount++;
      }

      // Check yesterday's completion (overdue check)
      const yesterdayCompletion = await db
        .select()
        .from(warmupChecklistCompletions)
        .where(
          and(
            eq(warmupChecklistCompletions.emailAccountId, account.id),
            eq(warmupChecklistCompletions.completionDate, sql`${yesterdayStr}::date`)
          )
        )
        .limit(1);

      if (yesterdayCompletion.length === 0 || (!yesterdayCompletion[0].completedAt && !yesterdayCompletion[0].skipped)) {
        overdueCount++;
      }
    }

    // Determine overall status
    let status: WarmupStatus;
    if (overdueCount > 0) {
      status = 'overdue';
    } else if (pendingCount > 0) {
      status = 'pending';
    } else {
      status = 'complete';
    }

    statusByDomain.push({
      domainId: domain.id,
      status,
      pendingCount,
      overdueCount,
      totalAccounts: domainAccounts.length,
    });
  }

  return statusByDomain;
}

/**
 * Get warmup status summary for user (all domains combined)
 */
export async function getUserWarmupSummary(userId: string) {
  const domainStatuses = await getDomainsWarmupStatus(userId);

  const summary = domainStatuses.reduce(
    (acc, domain) => {
      acc.totalPending += domain.pendingCount;
      acc.totalOverdue += domain.overdueCount;
      acc.totalAccounts += domain.totalAccounts;

      if (domain.status === 'overdue') acc.domainsWithOverdue++;
      if (domain.status === 'pending') acc.domainsWithPending++;

      return acc;
    },
    {
      totalPending: 0,
      totalOverdue: 0,
      totalAccounts: 0,
      domainsWithOverdue: 0,
      domainsWithPending: 0,
    }
  );

  return summary;
}
