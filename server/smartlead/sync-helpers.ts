/**
 * SmartLead Sync Helpers
 *
 * Syncs SmartLead API responses to local database to maintain single source of truth
 */

import 'server-only';
import { db } from '@/lib/db';
import { emailAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type {
  SmartleadWarmupResponse,
  SmartleadEmailAccountDetails,
} from '@/lib/types/smartlead';

/**
 * Syncs SmartLead warmup response to local database
 *
 * Handles both:
 * - Warmup update responses (POST /api/email-account/save-warmup)
 * - Email account details responses (GET /email-accounts/{id})
 *
 * Maps SmartLead fields to local DB fields:
 * - status: 'ACTIVE' → warmupStatus: 'in_progress', 'INACTIVE' → 'paused'
 * - max_email_per_day → dailyEmailLimit
 * - warmup_reputation (100 or "100%") → deliverabilityScore
 * - Auto-completes warmup after 21 days (3 weeks)
 *
 * @param emailAccountId - Local email account ID
 * @param smartleadResponse - Response from SmartLead API (warmup update or account details)
 */
export async function syncSmartleadWarmupToLocalDB(
  emailAccountId: string,
  smartleadResponse: SmartleadWarmupResponse | SmartleadEmailAccountDetails['warmup_details']
): Promise<void> {
  if (!smartleadResponse) {
    console.warn(`[SmartLead Sync] No response data provided for email account ${emailAccountId}`);
    return;
  }

  try {
    // Extract fields (handle both response formats)
    const status = smartleadResponse.status;
    const warmupKeyId = smartleadResponse.warmup_key_id;
    const replyRate = smartleadResponse.reply_rate;
    const totalSentCount = smartleadResponse.total_sent_count;
    const totalSpamCount = smartleadResponse.total_spam_count;
    const warmupMinCount = smartleadResponse.warmup_min_count;
    const warmupMaxCount = smartleadResponse.warmup_max_count;
    const isWarmupBlocked = smartleadResponse.is_warmup_blocked;

    // Fields only in warmup update response (not in email account details)
    const isRampupEnabled = 'is_rampup_enabled' in smartleadResponse ? smartleadResponse.is_rampup_enabled : undefined;
    const rampupValue = 'rampup_value' in smartleadResponse ? smartleadResponse.rampup_value : undefined;
    const dailyReplyLimit = 'daily_reply_limit' in smartleadResponse ? smartleadResponse.daily_reply_limit : undefined;
    const autoAdjustWarmup = 'auto_adjust_warmup' in smartleadResponse ? smartleadResponse.auto_adjust_warmup : undefined;
    const useCustomDomain = 'use_custom_domain' in smartleadResponse ? smartleadResponse.use_custom_domain : undefined;
    const sendWarmupsOnlyOnWeekdays = 'send_warmups_only_on_weekdays' in smartleadResponse ? smartleadResponse.send_warmups_only_on_weekdays : undefined;
    const maxEmailPerDay = 'max_email_per_day' in smartleadResponse ? smartleadResponse.max_email_per_day : undefined;

    // Parse warmup reputation (can be number 100 or string "100%")
    let deliverabilityScore: number | undefined;
    if ('warmup_reputation' in smartleadResponse && smartleadResponse.warmup_reputation) {
      const reputation = smartleadResponse.warmup_reputation;
      if (typeof reputation === 'number') {
        deliverabilityScore = reputation;
      } else if (typeof reputation === 'string') {
        // Parse "100%" to 100
        deliverabilityScore = parseInt(reputation.replace('%', ''), 10);
      }
    }

    // Map SmartLead status to local warmup status
    let warmupStatus: 'not_started' | 'in_progress' | 'completed' | 'paused';
    let accountStatus: string;

    if (status === 'ACTIVE') {
      warmupStatus = 'in_progress';
      accountStatus = 'warming';
    } else {
      warmupStatus = 'paused';
      accountStatus = 'active'; // Inactive warmup means account is active but not warming
    }

    // Get current email account to check warmup dates
    const currentAccount = await db.query.emailAccounts.findFirst({
      where: eq(emailAccounts.id, emailAccountId),
    });

    if (!currentAccount) {
      console.error(`[SmartLead Sync] Email account ${emailAccountId} not found`);
      return;
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      // Status fields
      status: accountStatus,
      warmupStatus,

      // SmartLead configuration
      warmupKeyId,
      replyRate,
      warmupMinCount,
      warmupMaxCount,
      isWarmupBlocked,

      // Counters
      totalSentCount,
      totalSpamCount,

      // Health metrics
      ...(deliverabilityScore !== undefined && { deliverabilityScore }),
      ...(maxEmailPerDay !== undefined && { dailyEmailLimit: maxEmailPerDay }),

      // Update timestamp
      updatedAt: new Date(),
    };

    // Add fields only present in warmup update response
    if (isRampupEnabled !== undefined) updateData.isRampupEnabled = isRampupEnabled;
    if (rampupValue !== undefined) updateData.rampupValue = rampupValue;
    if (dailyReplyLimit !== undefined) updateData.dailyReplyLimit = dailyReplyLimit;
    if (autoAdjustWarmup !== undefined) updateData.autoAdjustWarmup = autoAdjustWarmup;
    if (useCustomDomain !== undefined) updateData.useCustomDomain = useCustomDomain;
    if (sendWarmupsOnlyOnWeekdays !== undefined) updateData.sendWarmupsOnlyOnWeekdays = sendWarmupsOnlyOnWeekdays;

    // Set warmupStartedAt if warmup is now ACTIVE and wasn't started before
    if (status === 'ACTIVE' && !currentAccount.warmupStartedAt) {
      updateData.warmupStartedAt = new Date();
    }

    // Auto-complete warmup after 21 days (3 weeks)
    if (currentAccount.warmupStartedAt && !currentAccount.warmupCompletedAt) {
      const daysSinceStart =
        (Date.now() - currentAccount.warmupStartedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceStart >= 21) {
        updateData.warmupCompletedAt = new Date();
        updateData.warmupStatus = 'completed';
        console.log(
          `[SmartLead Sync] Auto-completed warmup for account ${emailAccountId} after ${Math.round(daysSinceStart)} days`
        );
      }
    }

    // Update database
    await db
      .update(emailAccounts)
      .set(updateData)
      .where(eq(emailAccounts.id, emailAccountId));

    console.log(`[SmartLead Sync] Successfully synced warmup data for account ${emailAccountId}`);
  } catch (error) {
    console.error(`[SmartLead Sync] Failed to sync warmup data for account ${emailAccountId}:`, error);
    throw error;
  }
}
