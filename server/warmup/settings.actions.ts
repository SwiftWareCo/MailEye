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
  getEmailAccountStatus,
  updateWarmupSettings,
  updateEmailAccount,
} from '@/lib/clients/smartlead';
import { getSmartleadCredentials } from '@/server/credentials/credentials.data';

interface WarmupSettings {
  warmupEnabled: boolean;
  maxEmailPerDay: number;
  totalWarmupPerDay: number;
  dailyRampup: number;
  replyRatePercentage: number;
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
    const smartleadAccount = await getEmailAccountStatus(
      smartleadCreds.apiKey,
      mapping.smartleadEmailAccountId
    );

    // Extract warmup settings from response
    const settings: WarmupSettings = {
      warmupEnabled: smartleadAccount.warmup_enabled ?? false,
      maxEmailPerDay: smartleadAccount.max_email_per_day ?? 50,
      totalWarmupPerDay: smartleadAccount.total_warmup_per_day ?? 40,
      dailyRampup: smartleadAccount.daily_rampup ?? 5,
      replyRatePercentage: smartleadAccount.reply_rate_percentage ?? 30,
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

    // Update warmup settings in Smartlead
    // Note: Smartlead has two endpoints - one for warmup config, one for send limits
    if (
      settings.warmupEnabled !== undefined ||
      settings.totalWarmupPerDay !== undefined ||
      settings.dailyRampup !== undefined ||
      settings.replyRatePercentage !== undefined
    ) {
      await updateWarmupSettings(smartleadCreds.apiKey, smartleadAccountId, {
        warmupEnabled: settings.warmupEnabled,
        totalWarmupPerDay: settings.totalWarmupPerDay,
        dailyRampup: settings.dailyRampup,
        replyRatePercentage: settings.replyRatePercentage,
      });
    }

    // Update max email per day separately
    if (settings.maxEmailPerDay !== undefined) {
      await updateEmailAccount(smartleadCreds.apiKey, smartleadAccountId, {
        maxEmailPerDay: settings.maxEmailPerDay,
      });
    }

    // Update local database to reflect changes
    const updateData: {
      dailyEmailLimit?: number;
      status?: string;
      warmupStatus?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (settings.maxEmailPerDay !== undefined) {
      updateData.dailyEmailLimit = settings.maxEmailPerDay;
    }

    if (settings.warmupEnabled !== undefined) {
      updateData.status = settings.warmupEnabled ? 'warming' : 'active';
      updateData.warmupStatus = settings.warmupEnabled ? 'in_progress' : 'paused';
    }

    await db
      .update(emailAccounts)
      .set(updateData)
      .where(eq(emailAccounts.id, emailAccountId));

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
 * @param emailAccountId - Local email account ID
 * @returns Success status or error
 */
export async function resetWarmupSettingsAction(emailAccountId: string) {
  return await updateWarmupSettingsAction(emailAccountId, {
    warmupEnabled: true,
    maxEmailPerDay: 50, // Max total emails (warmup + campaigns) per day
    totalWarmupPerDay: 5, // Start at 5 emails/day (SmartLead recommends 5-8 for new accounts)
    dailyRampup: 5, // Increase by 5 emails/day (5→10→15→20→25→30...)
    replyRatePercentage: 30, // 30-40% reply rate initially (can increase to 60-70% after 2 weeks)
  });
}
