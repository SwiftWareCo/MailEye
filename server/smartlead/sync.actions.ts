/**
 * Smartlead Account Sync Server Actions
 *
 * Handles syncing email accounts between local database and Smartlead
 * Used after manual OAuth connection to verify and establish mapping
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { db } from '@/lib/db';
import { emailAccounts, smartleadAccountMappings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { listEmailAccounts, getEmailAccountDetails } from '@/lib/clients/smartlead';
import { getSmartleadCredentials } from '@/server/credentials/credentials.data';
import type { SmartleadEmailAccountDetails } from '@/lib/types/smartlead';

interface SmartleadEmailAccount {
  id: number | string;
  from_email: string;
  from_name?: string;
  warmup_enabled?: boolean;
  max_email_per_day?: number;
  warmup_reputation?: number;
}

/**
 * Syncs a single email account with Smartlead after manual OAuth connection
 *
 * Process:
 * 1. Fetches all email accounts from Smartlead API
 * 2. Matches by email address with local email_accounts table
 * 3. Updates smartleadAccountId in local database
 * 4. Creates/updates smartlead_account_mappings record
 *
 * @param emailAccountId - Local email account ID to sync
 * @returns Success status with Smartlead account ID or error
 */
export async function syncSmartleadAccountAction(emailAccountId: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Step 1: Verify email account belongs to user
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, emailAccountId),
        eq(emailAccounts.userId, user.id)
      ),
    });

    if (!account) {
      return { success: false, error: 'Email account not found' };
    }

    // Step 2: Get user's Smartlead credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: 'Smartlead credentials not configured. Please connect Smartlead in Settings first.',
      };
    }

    // Step 3: Fetch all email accounts from Smartlead
    const smartleadAccounts = await listEmailAccounts(smartleadCreds.apiKey);

    if (!Array.isArray(smartleadAccounts)) {
      return {
        success: false,
        error: 'Failed to fetch email accounts from Smartlead',
      };
    }

    // Step 4: Find matching account by email address
    const matchingAccount = smartleadAccounts.find(
      (slAccount: SmartleadEmailAccount) =>
        slAccount.from_email.toLowerCase() === account.email.toLowerCase()
    );

    if (!matchingAccount) {
      return {
        success: false,
        error: `Email account ${account.email} not found in Smartlead. Please complete the OAuth connection in Smartlead first.`,
      };
    }

    const smartleadAccountId = String(matchingAccount.id);

    // Step 5: Fetch full account details from Smartlead to get accurate warmup data
    let accountDetails: SmartleadEmailAccountDetails | null = null;
    try {
      accountDetails = await getEmailAccountDetails(smartleadCreds.apiKey, smartleadAccountId);
    } catch (error) {
      console.error('Failed to fetch account details from Smartlead:', error);
      // Continue with basic sync if detailed fetch fails
    }

    // Step 6: Determine warmup status based on Smartlead data
    const warmupEnabled = accountDetails?.warmup_enabled ?? matchingAccount.warmup_enabled ?? false;
    const warmupActive = accountDetails?.warmup_details?.status === 'ACTIVE';
    const dailyLimit = accountDetails?.max_email_per_day ?? matchingAccount.max_email_per_day;
    const deliverabilityScore = accountDetails?.warmup_details?.reputation_percentage;

    // Determine warmup status for our database
    let warmupStatus: string = 'not_started';
    let accountStatus: string = 'inactive';

    if (warmupEnabled && warmupActive) {
      warmupStatus = 'in_progress';
      accountStatus = 'warming';
    } else if (warmupEnabled && !warmupActive) {
      warmupStatus = 'paused';
      accountStatus = 'inactive';
    }

    // Step 7: Update email_accounts table with real Smartlead data
    await db
      .update(emailAccounts)
      .set({
        smartleadAccountId,
        status: accountStatus,
        warmupStatus,
        dailyEmailLimit: dailyLimit || null,
        deliverabilityScore: deliverabilityScore || null,
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, emailAccountId));

    // Step 8: Check if mapping already exists
    const existingMapping = await db.query.smartleadAccountMappings.findFirst({
      where: eq(smartleadAccountMappings.emailAccountId, emailAccountId),
    });

    const mappingData = accountDetails || (matchingAccount as unknown as Record<string, unknown>);

    if (existingMapping) {
      // Update existing mapping
      await db
        .update(smartleadAccountMappings)
        .set({
          smartleadEmailAccountId: smartleadAccountId,
          smartleadEmail: matchingAccount.from_email,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          smartleadData: mappingData as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(smartleadAccountMappings.id, existingMapping.id));
    } else {
      // Create new mapping
      await db.insert(smartleadAccountMappings).values({
        emailAccountId,
        smartleadEmailAccountId: smartleadAccountId,
        smartleadEmail: matchingAccount.from_email,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        smartleadData: mappingData as Record<string, unknown>,
      });
    }

    return {
      success: true,
      smartleadAccountId,
      email: matchingAccount.from_email,
      warmupEnabled,
      warmupActive,
    };
  } catch (error) {
    console.error('Failed to sync Smartlead account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Syncs all email accounts for a user with Smartlead
 *
 * Useful for bulk sync after initial Smartlead connection
 *
 * @returns Summary of sync results
 */
export async function syncAllSmartleadAccountsAction() {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get user's Smartlead credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: 'Smartlead credentials not configured',
      };
    }

    // Fetch all local email accounts for user
    const localAccounts = await db.query.emailAccounts.findMany({
      where: eq(emailAccounts.userId, user.id),
    });

    if (localAccounts.length === 0) {
      return {
        success: true,
        synced: 0,
        failed: 0,
        message: 'No email accounts to sync',
      };
    }

    // Fetch all Smartlead accounts
    const smartleadAccounts = await listEmailAccounts(smartleadCreds.apiKey);

    if (!Array.isArray(smartleadAccounts)) {
      return {
        success: false,
        error: 'Failed to fetch accounts from Smartlead',
      };
    }

    // Sync each local account
    let syncedCount = 0;
    let failedCount = 0;

    for (const localAccount of localAccounts) {
      const result = await syncSmartleadAccountAction(localAccount.id);
      if (result.success) {
        syncedCount++;
      } else {
        failedCount++;
      }
    }

    return {
      success: true,
      synced: syncedCount,
      failed: failedCount,
      total: localAccounts.length,
      message: `Synced ${syncedCount} of ${localAccounts.length} accounts`,
    };
  } catch (error) {
    console.error('Failed to sync all accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Disconnects an email account from Smartlead
 *
 * Removes the mapping and clears smartleadAccountId from email_accounts table
 *
 * @param emailAccountId - Email account ID to disconnect
 * @returns Success status
 */
export async function disconnectSmartleadAccountAction(emailAccountId: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Verify account belongs to user
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, emailAccountId),
        eq(emailAccounts.userId, user.id)
      ),
    });

    if (!account) {
      return { success: false, error: 'Email account not found' };
    }

    // Remove mapping
    await db
      .delete(smartleadAccountMappings)
      .where(eq(smartleadAccountMappings.emailAccountId, emailAccountId));

    // Clear smartleadAccountId from email_accounts
    await db
      .update(emailAccounts)
      .set({
        smartleadAccountId: null,
        status: 'inactive',
        warmupStatus: 'not_started',
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, emailAccountId));

    return {
      success: true,
      message: 'Email account disconnected from Smartlead',
    };
  } catch (error) {
    console.error('Failed to disconnect Smartlead account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
