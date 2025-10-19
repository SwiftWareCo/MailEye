/**
 * Warmup Checklist Server Actions
 *
 * Manages daily manual warmup checklists for email accounts (Days 1-7)
 */

'use server';

import { db } from '@/lib/db';
import { warmupChecklistCompletions, emailAccounts } from '@/lib/db/schema';
import { stackServerApp } from '@/stack/server';
import { eq, and, isNull, sql } from 'drizzle-orm';

/**
 * Get pending warmup checklists for current user
 * Returns accounts that need manual checks today
 */
export async function getWarmupChecklistStatus() {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required', accounts: [] };
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get all email accounts with Smartlead connection and their checklist status
    const accounts = await db
      .select({
        id: emailAccounts.id,
        email: emailAccounts.email,
        createdAt: emailAccounts.createdAt,
        smartleadAccountId: emailAccounts.smartleadAccountId,
        checklistCompletedAt: warmupChecklistCompletions.completedAt,
        checklistSkipped: warmupChecklistCompletions.skipped,
      })
      .from(emailAccounts)
      .leftJoin(
        warmupChecklistCompletions,
        and(
          eq(warmupChecklistCompletions.emailAccountId, emailAccounts.id),
          eq(warmupChecklistCompletions.completionDate, sql`${today}::date`)
        )
      )
      .where(
        and(
          eq(emailAccounts.userId, user.id),
          sql`${emailAccounts.smartleadAccountId} IS NOT NULL` // Only connected accounts
        )
      );

    // Calculate warmup day for each account and filter for Days 1-7
    const pendingAccounts = accounts
      .map((account) => {
        const createdDate = new Date(account.createdAt);
        const todayDate = new Date(today);
        const daysSinceCreation = Math.floor(
          (todayDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const warmupDay = daysSinceCreation + 1; // Day 1, Day 2, etc.

        return {
          id: account.id,
          email: account.email,
          warmupDay,
          needsCheck: warmupDay <= 7, // Only Days 1-7 need manual checks
          isCompleted: !!account.checklistCompletedAt,
          isSkipped: !!account.checklistSkipped,
          lastCompletedAt: account.checklistCompletedAt,
        };
      })
      .filter(
        (account) =>
          account.needsCheck && !account.isCompleted && !account.isSkipped
      );

    // Count overdue (accounts that missed yesterday's check)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const overdueAccounts = await db
      .select({
        id: emailAccounts.id,
      })
      .from(emailAccounts)
      .leftJoin(
        warmupChecklistCompletions,
        and(
          eq(warmupChecklistCompletions.emailAccountId, emailAccounts.id),
          eq(warmupChecklistCompletions.completionDate, sql`${yesterdayStr}::date`)
        )
      )
      .where(
        and(
          eq(emailAccounts.userId, user.id),
          sql`${emailAccounts.smartleadAccountId} IS NOT NULL`,
          isNull(warmupChecklistCompletions.completedAt),
          isNull(warmupChecklistCompletions.skipped)
        )
      );

    return {
      success: true,
      accounts: pendingAccounts,
      pendingCount: pendingAccounts.length,
      overdueCount: overdueAccounts.length,
    };
  } catch (error) {
    console.error('Failed to get warmup checklist status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      accounts: [],
      pendingCount: 0,
      overdueCount: 0,
    };
  }
}

/**
 * Mark warmup checklist as complete for an email account
 */
export async function markChecklistCompleteAction(emailAccountId: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Verify account belongs to user
    const accountResult = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.id, emailAccountId),
          eq(emailAccounts.userId, user.id)
        )
      )
      .limit(1);

    if (accountResult.length === 0) {
      return { success: false, error: 'Email account not found' };
    }

    const account = accountResult[0];

    // Calculate warmup day
    const createdDate = new Date(account.createdAt);
    const todayDate = new Date(today);
    const daysSinceCreation = Math.floor(
      (todayDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const warmupDay = daysSinceCreation + 1;

    // Insert or update checklist completion
    await db
      .insert(warmupChecklistCompletions)
      .values({
        emailAccountId,
        completionDate: sql`${today}::date`,
        completedAt: new Date(),
        warmupDay,
        skipped: false,
      })
      .onConflictDoUpdate({
        target: [warmupChecklistCompletions.emailAccountId, warmupChecklistCompletions.completionDate],
        set: {
          completedAt: new Date(),
          skipped: false,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    console.error('Failed to mark checklist complete:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Skip warmup checklist for an email account with reason
 */
export async function skipChecklistAction(emailAccountId: string, reason?: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Verify account belongs to user
    const accountResult = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.id, emailAccountId),
          eq(emailAccounts.userId, user.id)
        )
      )
      .limit(1);

    if (accountResult.length === 0) {
      return { success: false, error: 'Email account not found' };
    }

    const account = accountResult[0];

    // Calculate warmup day
    const createdDate = new Date(account.createdAt);
    const todayDate = new Date(today);
    const daysSinceCreation = Math.floor(
      (todayDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const warmupDay = daysSinceCreation + 1;

    // Insert or update as skipped
    await db
      .insert(warmupChecklistCompletions)
      .values({
        emailAccountId,
        completionDate: sql`${today}::date`,
        completedAt: null,
        warmupDay,
        skipped: true,
        skipReason: reason,
      })
      .onConflictDoUpdate({
        target: [warmupChecklistCompletions.emailAccountId, warmupChecklistCompletions.completionDate],
        set: {
          skipped: true,
          skipReason: reason,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    console.error('Failed to skip checklist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
