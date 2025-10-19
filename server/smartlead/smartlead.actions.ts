/**
 * Smartlead Integration Server Actions
 *
 * Wraps Smartlead connection functions for use in wizard
 */

'use server';

import { stackServerApp } from '@/stack/server';
import {
  connectEmailAccountToSmartlead,
  disconnectEmailAccountFromSmartlead,
  updateSmartleadWarmupSettings,
  assignEmailAccountToCampaign,
  removeEmailAccountFromAllCampaigns,
} from './account-connector';
import type {
  SmartleadConnectionResult,
  SmartleadConnectionParams,
} from '@/lib/types/smartlead';

/**
 * Connect to Smartlead Action
 *
 * Connects an email account to Smartlead with warmup configuration
 *
 * @param emailAccountId - Local email account ID
 * @param warmupConfig - Optional warmup settings
 * @returns Connection result with Smartlead account ID
 *
 * @example
 * const result = await connectToSmartleadAction('email-123', {
 *   warmupEnabled: true,
 *   maxEmailPerDay: 50,
 *   totalWarmupPerDay: 40,
 *   dailyRampup: 5,
 * });
 */
export async function connectToSmartleadAction(
  emailAccountId: string,
  warmupConfig?: {
    warmupEnabled?: boolean;
    maxEmailPerDay?: number;
    totalWarmupPerDay?: number;
    dailyRampup?: number;
  }
): Promise<SmartleadConnectionResult> {
  // Authenticate user
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      error: {
        type: 'API_AUTHENTICATION_ERROR',
        message: 'Authentication required',
        retryable: false,
      },
    };
  }

  // Connect to Smartlead
  const params: SmartleadConnectionParams = {
    emailAccountId,
    userId: user.id,
    warmupEnabled: warmupConfig?.warmupEnabled ?? true,
    maxEmailPerDay: warmupConfig?.maxEmailPerDay ?? 50,
    totalWarmupPerDay: warmupConfig?.totalWarmupPerDay ?? 40,
    dailyRampup: warmupConfig?.dailyRampup ?? 5,
  };

  const result = await connectEmailAccountToSmartlead(params);
  return result;
}


/**
 * Disconnects an email account from Smartlead
 *
 * @param emailAccountId - Local email account ID
 * @returns Success status
 */
export async function disconnectFromSmartleadAction(
  emailAccountId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const result = await disconnectEmailAccountFromSmartlead(emailAccountId, user.id);

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message || 'Failed to disconnect from Smartlead',
    };
  }

  return { success: true };
}

/**
 * Updates warmup settings for a connected Smartlead account
 *
 * @param emailAccountId - Local email account ID
 * @param settings - New warmup settings
 * @returns Success status
 */
export async function updateWarmupSettingsAction(
  emailAccountId: string,
  settings: {
    warmupEnabled?: boolean;
    maxEmailPerDay?: number;
    totalWarmupPerDay?: number;
    dailyRampup?: number;
    replyRatePercentage?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const result = await updateSmartleadWarmupSettings(emailAccountId, settings);
  return result;
}

/**
 * Assigns an email account to a Smartlead campaign
 *
 * @param emailAccountId - Local email account ID
 * @param campaignId - Smartlead campaign ID
 * @returns Success status
 */
export async function assignToCampaignAction(
  emailAccountId: string,
  campaignId: number
): Promise<{ success: boolean; error?: string }> {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const result = await assignEmailAccountToCampaign(
    emailAccountId,
    campaignId,
    user.id
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message || 'Failed to assign to campaign',
    };
  }

  return { success: true };
}

/**
 * Removes an email account from all campaigns
 *
 * @param emailAccountId - Local email account ID
 * @returns Success status with removed campaign count
 */
export async function removeFromAllCampaignsAction(
  emailAccountId: string
): Promise<{
  success: boolean;
  removedFromCount: number;
  errors: Array<{ campaignId: number; error: string }>;
}> {
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      removedFromCount: 0,
      errors: [{ campaignId: 0, error: 'Authentication required' }],
    };
  }

  const result = await removeEmailAccountFromAllCampaigns(emailAccountId, user.id);
  return result;
}
