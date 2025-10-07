/**
 * Smartlead Integration Server Actions
 *
 * Wraps Smartlead connection functions for use in wizard
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { connectEmailAccountToSmartlead } from './account-connector';
import type { SmartleadConnectionResult } from '@/lib/types/smartlead';

/**
 * Connect to Smartlead Action
 *
 * Connects an email account to Smartlead with warmup configuration
 */
export async function connectToSmartleadAction(
  emailAccountId: string
): Promise<SmartleadConnectionResult> {
  // Authenticate user
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      error: {
        type: 'UNKNOWN_ERROR',
        message: 'Authentication required',
        details: {},
        retryable: false,
      },
    };
  }

  // Connect to Smartlead with default warmup config
  const result = await connectEmailAccountToSmartlead({
    emailAccountId,
    userId: user.id,
    warmupEnabled: true,
    maxEmailPerDay: 50,
    totalWarmupPerDay: 40,
    dailyRampup: 5,
  });

  return result;
}
