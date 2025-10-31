/**
 * Warmup Settings Server Actions
 *
 * Manages warmup configuration for email accounts via Smartlead API
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { db } from '@/lib/db';
import { emailAccounts, smartleadAccountMappings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  getEmailAccountDetails,
  updateWarmupSettingsAdvanced,
} from '@/lib/clients/smartlead';
import { getSmartleadCredentials, getSmartleadBearerToken } from '@/server/credentials/credentials.data';
import { syncSmartleadWarmupToLocalDB } from '@/server/smartlead/sync-helpers';
import type { SmartleadWarmupUpdateResponse } from '@/lib/types/smartlead';

interface WarmupSettings {
  warmupEnabled: boolean;
  maxEmailPerDay: number;
  warmupMinCount: number;
  warmupMaxCount: number;
  dailyRampup: number;
  replyRatePercentage: number;
  // Advanced features (using undocumented SmartLead endpoint)
  isRampupEnabled?: boolean;
  weekdaysOnly?: boolean;
  autoAdjust?: boolean;
  warmupTrackingDomain?: boolean;
}

/**
 * Get current warmup settings for an email account from Smartlead
 *
 * @param emailAccountId - Local email account ID
 * @returns Current warmup settings or error
 */
export async function getWarmupSettingsAction(emailAccountId: string) {
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

    // Check if account is connected to Smartlead
    const mapping = await db.query.smartleadAccountMappings.findFirst({
      where: eq(smartleadAccountMappings.emailAccountId, emailAccountId),
    });

    if (!mapping) {
      return {
        success: false,
        error: 'Account not connected to Smartlead',
      };
    }

    // Get user's Smartlead credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: 'Smartlead credentials not configured',
      };
    }

    // Fetch account details from Smartlead
    const smartleadAccount = await getEmailAccountDetails(
      smartleadCreds.apiKey,
      mapping.smartleadEmailAccountId
    );

    // Extract warmup settings from SmartLead API response
    // Note: Advanced features are fetched from local DB because SmartLead's
    // getEmailAccountDetails endpoint doesn't include them
    const settings: WarmupSettings = {
      warmupEnabled: smartleadAccount.warmup_enabled ?? false,
      maxEmailPerDay: smartleadAccount.max_email_per_day ?? 50,
      warmupMinCount: account.warmupMinCount ?? 5,
      warmupMaxCount: account.warmupMaxCount ?? 8,
      dailyRampup: smartleadAccount.daily_rampup ?? 5,
      replyRatePercentage: smartleadAccount.reply_rate_percentage ?? 30,

      // Advanced features from local DB (synced from advanced warmup endpoint)
      isRampupEnabled: account.isRampupEnabled ?? false,
      weekdaysOnly: account.sendWarmupsOnlyOnWeekdays ?? false,
      autoAdjust: account.autoAdjustWarmup ?? false,
      warmupTrackingDomain: account.useCustomDomain ?? false,
    };

    return {
      success: true,
      settings,
      accountEmail: account.email,
      smartleadAccountId: mapping.smartleadEmailAccountId,
    };
  } catch (error) {
    console.error('Failed to fetch warmup settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update warmup settings for an email account in Smartlead
 *
 * @param emailAccountId - Local email account ID
 * @param settings - New warmup settings
 * @returns Success status or error
 */
export async function updateWarmupSettingsAction(
  emailAccountId: string,
  settings: Partial<WarmupSettings>
) {
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

    // Check if account is connected to Smartlead
    const mapping = await db.query.smartleadAccountMappings.findFirst({
      where: eq(smartleadAccountMappings.emailAccountId, emailAccountId),
    });

    if (!mapping) {
      return {
        success: false,
        error: 'Account not connected to Smartlead',
      };
    }

    // Get user's Smartlead credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: 'Smartlead credentials not configured',
      };
    }

    const smartleadAccountId = mapping.smartleadEmailAccountId;

    // Update warmup settings in Smartlead using advanced endpoint
    // This uses the undocumented UI endpoint that supports all warmup features
    if (
      settings.warmupEnabled !== undefined ||
      settings.maxEmailPerDay !== undefined ||
      settings.warmupMinCount !== undefined ||
      settings.warmupMaxCount !== undefined ||
      settings.dailyRampup !== undefined ||
      settings.replyRatePercentage !== undefined ||
      settings.isRampupEnabled !== undefined ||
      settings.weekdaysOnly !== undefined ||
      settings.autoAdjust !== undefined ||
      settings.warmupTrackingDomain !== undefined
    ) {
      // Get valid bearer token (auto-refreshes if expired)
      const bearerToken = await getSmartleadBearerToken();
      if (!bearerToken) {
        return {
          success: false,
          error: 'Smartlead bearer token not available. Please save your Smartlead login credentials.',
        };
      }

      const smartleadResponse = await updateWarmupSettingsAdvanced(bearerToken, smartleadAccountId, {
        warmupEnabled: settings.warmupEnabled,
        maxEmailPerDay: settings.maxEmailPerDay,
        warmupMinCount: settings.warmupMinCount,
        warmupMaxCount: settings.warmupMaxCount,
        dailyRampup: settings.dailyRampup,
        replyRatePercentage: settings.replyRatePercentage,
        isRampupEnabled: settings.isRampupEnabled,
        weekdaysOnly: settings.weekdaysOnly,
        autoAdjust: settings.autoAdjust,
        warmupTrackingDomain: settings.warmupTrackingDomain,
      }) as SmartleadWarmupUpdateResponse;

      // Sync SmartLead response to local database
      if (smartleadResponse.ok && smartleadResponse.message?.[0]) {
        await syncSmartleadWarmupToLocalDB(emailAccountId, smartleadResponse.message[0]);
        console.log('[Warmup Settings] Successfully synced SmartLead response to local DB');
      }
    }

    // Note: maxEmailPerDay is now included in the advanced endpoint call above
    // No need for separate updateEmailAccount call anymore

    // Note: Local database updates are now handled by syncSmartleadWarmupToLocalDB
    // No need to manually update the database here

    return {
      success: true,
      message: 'Warmup settings updated successfully',
    };
  } catch (error) {
    console.error('Failed to update warmup settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enable warmup for an email account
 *
 * @param emailAccountId - Local email account ID
 * @returns Success status or error
 */
export async function enableWarmupAction(emailAccountId: string) {
  return await updateWarmupSettingsAction(emailAccountId, {
    warmupEnabled: true,
  });
}

/**
 * Disable/pause warmup for an email account
 *
 * @param emailAccountId - Local email account ID
 * @returns Success status or error
 */
export async function disableWarmupAction(emailAccountId: string) {
  return await updateWarmupSettingsAction(emailAccountId, {
    warmupEnabled: false,
  });
}

/**
 * Reset warmup settings to recommended defaults
 * Aligned with SmartLead 2025 best practices
 *
 * Now includes advanced features via undocumented SmartLead endpoint
 *
 * @param emailAccountId - Local email account ID
 * @returns Success status or error
 */
export async function resetWarmupSettingsAction(emailAccountId: string) {
  return await updateWarmupSettingsAction(emailAccountId, {
    warmupEnabled: true,
    maxEmailPerDay: 50, // Max total emails (warmup + campaigns) per day
    warmupMinCount: 5, // Start range minimum (SmartLead recommends 5-8 range for new accounts)
    warmupMaxCount: 8, // Start range maximum (randomization: 5-8 emails/day)
    dailyRampup: 5, // Increase by 5 emails/day (5→10→15→20→25→30...)
    replyRatePercentage: 30, // 30-40% reply rate initially (can increase to 60-70% after 2 weeks)

    // Advanced features (SmartLead 2025 best practices)
    isRampupEnabled: true, // Enable automatic daily increase
    weekdaysOnly: true, // More natural sending pattern (pauses weekends)
    autoAdjust: true, // Let SmartLead intelligently adjust during campaigns
    warmupTrackingDomain: true, // Build reputation for tracking domain
  });
}
