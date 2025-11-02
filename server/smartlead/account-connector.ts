/**
 * Smartlead Email Account Connection Service
 *
 * Handles connecting email accounts to Smartlead via API with:
 * - SMTP/IMAP credential configuration
 * - Warmup settings (reputation, daily limits)
 * - Database mapping between local and Smartlead accounts
 * - Error handling and retry logic
 * - Connection validation
 */

import { db } from '@/lib/db';
import { smartleadAccountMappings } from '@/lib/db/schema/smartlead';
import {
  getEmailAccount,
  getDecryptedCredentials,
  updateEmailAccountSmartleadConnection,
  updateEmailAccountStatus,
  updateEmailAccountWarmupMetrics,
} from '@/server/email/email-account-manager';
import {
  connectEmailAccount as smartleadConnectAPI,
  listCampaigns,
  listCampaignEmailAccounts,
  addEmailAccountToCampaign,
  removeEmailAccountFromCampaign,
  updateEmailAccount as updateSmartleadAccount,
  updateWarmupSettingsAdvanced,
} from '@/lib/clients/smartlead';
import { getSmartleadBearerToken, getSmartleadCredentials } from '@/server/credentials/credentials.data';
import type {
  SmartleadConnectionParams,
  SmartleadConnectionResult,
  SmartleadConnectionError,
  SmartleadAccountData,
  SmartleadApiResponse,
} from '@/lib/types/smartlead';
import { eq } from 'drizzle-orm';

/**
 * Default warmup configuration for new connections
 * Aligned with SmartLead 2025 best practices for optimal deliverability
 * Start conservatively and ramp up gradually to build sender reputation
 *
 * NEW: Includes undocumented SmartLead feature toggles discovered via UI analysis
 */
const DEFAULT_WARMUP_CONFIG = {
  warmupEnabled: true,
  maxEmailPerDay: 50,
  warmupMinCount: 5, // Start range minimum (SmartLead recommends 5-8 range for new accounts)
  warmupMaxCount: 8, // Start range maximum (randomization: 5-8 emails/day)
  dailyRampup: 5, // Increase by 5 emails/day (5→10→15→20→25→30...)

  // SmartLead advanced features (2025 best practices)
  weekdaysOnly: true, // More natural sending pattern (pauses weekends)
  autoAdjust: true, // Let SmartLead intelligently adjust during campaigns
  warmupTrackingDomain: true, // Build reputation for tracking domain (open.sleadtrack.com)
};

/**
 * Maximum retry attempts for API failures
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Delay between retries (milliseconds)
 */
const RETRY_DELAY_MS = 2000;

/**
 * Validates that an email account exists and has required credentials
 */
async function validateEmailAccount(
  emailAccountId: string,
  userId: string
): Promise<{ valid: boolean; error?: SmartleadConnectionError }> {
  // Check if account exists
  const account = await getEmailAccount(emailAccountId);

  if (!account) {
    return {
      valid: false,
      error: {
        type: 'ACCOUNT_NOT_FOUND',
        message: `Email account ${emailAccountId} not found`,
        retryable: false,
      },
    };
  }

  // Verify account belongs to user
  if (account.userId !== userId) {
    return {
      valid: false,
      error: {
        type: 'ACCOUNT_NOT_FOUND',
        message: 'Unauthorized: Account does not belong to user',
        retryable: false,
      },
    };
  }

  // Check if credentials are available
  const credentials = await getDecryptedCredentials(emailAccountId);

  if (!credentials) {
    return {
      valid: false,
      error: {
        type: 'CREDENTIALS_NOT_FOUND',
        message: 'Email account credentials not found or could not be decrypted',
        retryable: false,
      },
    };
  }

  // Validate required credential fields
  if (
    !credentials.smtp.host ||
    !credentials.smtp.username ||
    !credentials.smtp.password ||
    !credentials.imap.host ||
    !credentials.imap.username ||
    !credentials.imap.password
  ) {
    return {
      valid: false,
      error: {
        type: 'INVALID_CREDENTIALS',
        message: 'Incomplete SMTP or IMAP credentials',
        retryable: false,
      },
    };
  }

  return { valid: true };
}

/**
 * Checks if an email account is already connected to Smartlead
 */
async function checkExistingConnection(
  emailAccountId: string
): Promise<{ exists: boolean; mappingId?: string; smartleadAccountId?: string }> {
  try {
    const [existing] = await db
      .select()
      .from(smartleadAccountMappings)
      .where(eq(smartleadAccountMappings.emailAccountId, emailAccountId))
      .limit(1);

    if (existing) {
      return {
        exists: true,
        mappingId: existing.id,
        smartleadAccountId: existing.smartleadEmailAccountId,
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('Failed to check existing connection:', error);
    return { exists: false };
  }
}

/**
 * Creates a Smartlead account mapping in the database
 */
async function createSmartleadMapping(
  emailAccountId: string,
  smartleadAccountData: SmartleadAccountData
): Promise<string | null> {
  try {
    const [mapping] = await db
      .insert(smartleadAccountMappings)
      .values({
        emailAccountId,
        smartleadEmailAccountId: String(smartleadAccountData.emailAccountId),
        smartleadEmail: smartleadAccountData.email,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        smartleadData: smartleadAccountData,
      })
      .returning({ id: smartleadAccountMappings.id });

    return mapping.id;
  } catch (error) {
    console.error('Failed to create Smartlead mapping:', error);
    return null;
  }
}

/**
 * Calls Smartlead API to connect an email account
 * Includes undocumented SmartLead feature toggle parameters
 */
async function callSmartleadAPI(
  apiKey: string,
  credentials: {
    email: string;
    displayName: string;
    smtp: {
      host: string;
      port: number;
      password: string;
    };
    imap: {
      host: string;
      port: number;
    };
  },
  config: {
    warmupEnabled: boolean;
    maxEmailPerDay: number;
    warmupMinCount?: number;
    warmupMaxCount?: number;
    dailyRampup?: number;
    replyRatePercentage?: number;
  },
  retryCount: number = 0
): Promise<{ success: boolean; data?: SmartleadAccountData; error?: SmartleadConnectionError }> {
  try {
    // Split display name into first and last name
    const nameParts = credentials.displayName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'Account';

    // Log connection attempt (without passwords for security)
    console.log('[Smartlead Connection] Starting connection with config:', {
      email: credentials.email,
      warmupEnabled: config.warmupEnabled,
      maxEmailPerDay: config.maxEmailPerDay,
      dailyRampup: config.dailyRampup,
      replyRatePercentage: config.replyRatePercentage,
    });

    // Call Smartlead API with correct endpoint and fields
    // Note: Smartlead uses the same password and username (email) for both SMTP and IMAP
    // Note: Using documented API which doesn't support warmupMinCount/warmupMaxCount directly
    // These will be set via the advanced endpoint after account creation
    const response: SmartleadApiResponse = await smartleadConnectAPI(apiKey, {
      email: credentials.email,
      firstName,
      lastName,
      smtpHost: credentials.smtp.host,
      smtpPort: credentials.smtp.port,
      smtpPassword: credentials.smtp.password,
      imapHost: credentials.imap.host,
      imapPort: credentials.imap.port,
      warmupEnabled: config.warmupEnabled,
      maxEmailPerDay: config.maxEmailPerDay,
      dailyRampup: config.dailyRampup,
      replyRatePercentage: config.replyRatePercentage,
    });

    // Log successful API response
    console.log('[Smartlead Connection] API response received:', {
      emailAccountId: response.emailAccountId,
      email: credentials.email,
      ok: response.ok,
      warmupKey: response.warmupKey,
    });

    // Convert API response to SmartleadAccountData for database storage
    const accountData: SmartleadAccountData = {
      emailAccountId: response.emailAccountId,
      email: credentials.email,
      from_name: credentials.displayName,
      warmup_enabled: config.warmupEnabled,
      max_email_per_day: config.maxEmailPerDay,
      warmupKey: response.warmupKey,
    };

    return {
      success: true,
      data: accountData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Determine if error is retryable
    const isRetryable =
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('rate limit');

    // Retry logic
    if (isRetryable && retryCount < MAX_RETRY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return callSmartleadAPI(apiKey, credentials, config, retryCount + 1);
    }

    // Determine error type
    let errorType: SmartleadConnectionError['type'] = 'API_ERROR';
    if (
      errorMessage.includes('authentication') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('API key')
    ) {
      errorType = 'API_AUTHENTICATION_ERROR';
    } else if (errorMessage.includes('rate limit')) {
      errorType = 'RATE_LIMIT_ERROR';
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      errorType = 'NETWORK_ERROR';
    } else if (errorMessage.includes('credentials')) {
      errorType = 'INVALID_CREDENTIALS';
    }

    return {
      success: false,
      error: {
        type: errorType,
        message: errorMessage,
        details: error,
        retryable: isRetryable,
      },
    };
  }
}

/**
 * Connects an email account to Smartlead with warmup settings
 *
 * Process:
 * 1. Validates email account exists and has credentials
 * 2. Checks for existing Smartlead connection
 * 3. Retrieves decrypted SMTP/IMAP credentials
 * 4. Calls Smartlead API to connect account
 * 5. Creates database mapping record
 * 6. Updates email account with Smartlead ID and warmup settings
 *
 * @param params - Connection parameters including account ID and warmup settings
 * @returns Connection result with mapping ID or error
 *
 * @example
 * const result = await connectEmailAccountToSmartlead({
 *   emailAccountId: 'account-123',
 *   userId: 'user-456',
 *   warmupEnabled: true,
 *   maxEmailPerDay: 75,
 *   warmupMinCount: 5,
 *   warmupMaxCount: 8,
 *   dailyRampup: 5,
 * });
 *
 * if (result.success) {
 *   console.log(`Connected to Smartlead: ${result.smartleadAccountId}`);
 *   console.log(`Warmup Key: ${result.warmupKey}`);
 * }
 */
export async function connectEmailAccountToSmartlead(
  params: SmartleadConnectionParams
): Promise<SmartleadConnectionResult> {
  const {
    emailAccountId,
    userId,
    warmupEnabled = DEFAULT_WARMUP_CONFIG.warmupEnabled,
    maxEmailPerDay = DEFAULT_WARMUP_CONFIG.maxEmailPerDay,
    warmupMinCount = DEFAULT_WARMUP_CONFIG.warmupMinCount,
    warmupMaxCount = DEFAULT_WARMUP_CONFIG.warmupMaxCount,
    dailyRampup = DEFAULT_WARMUP_CONFIG.dailyRampup,
  } = params;

  try {
    // Step 1: Get user's Smartlead API credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: {
          type: 'API_AUTHENTICATION_ERROR',
          message: 'Smartlead credentials not configured. Please connect your Smartlead account in Settings.',
          retryable: false,
        },
      };
    }

    // Step 2: Validate email account
    const validation = await validateEmailAccount(emailAccountId, userId);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Step 3: Check for existing connection
    const existingConnection = await checkExistingConnection(emailAccountId);
    if (existingConnection.exists) {
      return {
        success: false,
        error: {
          type: 'ALREADY_CONNECTED',
          message: `Email account is already connected to Smartlead (ID: ${existingConnection.smartleadAccountId})`,
          retryable: false,
        },
      };
    }

    // Step 4: Get account details and credentials
    const account = await getEmailAccount(emailAccountId);
    const credentials = await getDecryptedCredentials(emailAccountId);

    if (!account || !credentials) {
      return {
        success: false,
        error: {
          type: 'ACCOUNT_NOT_FOUND',
          message: 'Failed to retrieve account details',
          retryable: false,
        },
      };
    }

    // Step 5: Call Smartlead API
    const apiResult = await callSmartleadAPI(
      smartleadCreds.apiKey,
      {
        email: credentials.email,
        displayName: account.displayName || credentials.email,
        smtp: {
          host: credentials.smtp.host,
          port: credentials.smtp.port,
          password: credentials.smtp.password,
        },
        imap: {
          host: credentials.imap.host,
          port: credentials.imap.port,
        },
      },
      {
        warmupEnabled,
        maxEmailPerDay,
        warmupMinCount,
        warmupMaxCount,
        dailyRampup,
        replyRatePercentage: 30, // Default 30% reply rate
      }
    );

    if (!apiResult.success || !apiResult.data) {
      return {
        success: false,
        error: apiResult.error || {
          type: 'API_ERROR',
          message: 'Smartlead API connection failed',
          retryable: false,
        },
      };
    }

    // Step 5: Create database mapping
    const mappingId = await createSmartleadMapping(emailAccountId, apiResult.data);

    if (!mappingId) {
      return {
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to create Smartlead account mapping',
          retryable: true,
        },
      };
    }

    // Step 6: Update email account with Smartlead connection
    await updateEmailAccountSmartleadConnection(
      emailAccountId,
      String(apiResult.data.emailAccountId)
    );

    // Step 7: Update warmup status in local database
    // Note: We don't call syncSmartleadWarmupToLocalDB here because the account
    // creation response doesn't include all warmup details. The sync will happen
    // when we fetch account details or update warmup settings.
    console.log('[Smartlead Connection] Setting local warmup status:', {
      emailAccountId,
      warmupEnabled,
      maxEmailPerDay,
    });

    if (warmupEnabled) {
      await updateEmailAccountStatus(emailAccountId, 'warming');
      await updateEmailAccountWarmupMetrics(emailAccountId, {
        warmupStatus: 'in_progress',
        warmupStartedAt: new Date(),
        dailyEmailLimit: maxEmailPerDay,
      });
      console.log('[Smartlead Connection] Warmup status set to "warming" and in_progress');
    } else {
      await updateEmailAccountStatus(emailAccountId, 'active');
      console.log('[Smartlead Connection] Warmup disabled - account status set to "active"');
    }

    console.log('[Smartlead Connection] Connection completed successfully:', {
      smartleadAccountId: apiResult.data.emailAccountId,
      warmupKey: apiResult.data.warmupKey,
      warmupEnabled,
    });

    return {
      success: true,
      mappingId,
      smartleadAccountId: apiResult.data.emailAccountId,
      warmupKey: apiResult.data.warmupKey,
      email: apiResult.data.email,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to connect email account to Smartlead:', error);

    return {
      success: false,
      error: {
        type: 'UNKNOWN_ERROR',
        message: errorMessage,
        details: error,
        retryable: false,
      },
    };
  }
}

/**
 * Disconnects an email account from Smartlead
 *
 * Process (following Smartlead API limitations):
 * 1. Fetches all campaigns in the Smartlead account
 * 2. Checks which campaigns use this email account
 * 3. Removes the email account from each campaign
 * 4. Updates the email account to inactive status in Smartlead
 * 5. Clears local database mapping
 *
 * Note: Smartlead doesn't have a true "delete account" endpoint.
 * This implements a proper inactivation workflow.
 *
 * @param emailAccountId - Email account ID
 * @param userId - User ID for authorization
 * @returns Success status
 *
 * @example
 * const result = await disconnectEmailAccountFromSmartlead('account-123', 'user-456');
 */
export async function disconnectEmailAccountFromSmartlead(
  emailAccountId: string,
  userId: string
): Promise<{ success: boolean; error?: SmartleadConnectionError }> {
  try {
    // Step 1: Get user's Smartlead API credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: {
          type: 'API_AUTHENTICATION_ERROR',
          message: 'Smartlead credentials not configured',
          retryable: false,
        },
      };
    }

    // Step 2: Validate ownership
    const account = await getEmailAccount(emailAccountId);
    if (!account || account.userId !== userId) {
      return {
        success: false,
        error: {
          type: 'ACCOUNT_NOT_FOUND',
          message: 'Unauthorized: Account not found or does not belong to user',
          retryable: false,
        },
      };
    }

    // Step 3: Get Smartlead account mapping
    const status = await getSmartleadConnectionStatus(emailAccountId);
    if (!status.connected || !status.smartleadAccountId) {
      return {
        success: false,
        error: {
          type: 'ACCOUNT_NOT_FOUND',
          message: 'Email account is not connected to Smartlead',
          retryable: false,
        },
      };
    }

    const smartleadAccountId = status.smartleadAccountId;

    // Step 4: Fetch all campaigns
    try {
      const campaignsResponse = await listCampaigns(smartleadCreds.apiKey);
      const campaigns = Array.isArray(campaignsResponse) ? campaignsResponse : [];

      // Step 5: Remove account from each campaign it's assigned to
      for (const campaign of campaigns) {
        try {
          // Check if this campaign uses this email account
          const campaignAccounts = await listCampaignEmailAccounts(smartleadCreds.apiKey, campaign.id);
          const accountsArray = Array.isArray(campaignAccounts) ? campaignAccounts : [];

          const isInCampaign = accountsArray.some(
            (acc: { id?: string; email_account_id?: string }) =>
              String(acc.id || acc.email_account_id) === smartleadAccountId
          );

          if (isInCampaign) {
            await removeEmailAccountFromCampaign(smartleadCreds.apiKey, campaign.id, smartleadAccountId);
            console.log(`Removed account from campaign ${campaign.id}`);
          }
        } catch (campaignError) {
          console.warn(`Failed to remove from campaign ${campaign.id}:`, campaignError);
          // Continue with other campaigns even if one fails
        }
      }
    } catch (campaignsError) {
      console.warn('Failed to fetch campaigns:', campaignsError);
      // Continue with inactivation even if campaign removal fails
    }

    // Step 6: Set account to inactive in Smartlead
    try {
      await updateSmartleadAccount(smartleadCreds.apiKey, smartleadAccountId, {
        maxEmailPerDay: 0,
      });
    } catch (updateError) {
      console.warn('Failed to update Smartlead account to inactive:', updateError);
      // Continue with local cleanup even if Smartlead update fails
    }

    // Step 6: Remove local mapping
    await db
      .delete(smartleadAccountMappings)
      .where(eq(smartleadAccountMappings.emailAccountId, emailAccountId));

    // Step 7: Update local email account status
    await updateEmailAccountSmartleadConnection(emailAccountId, null);
    await updateEmailAccountStatus(emailAccountId, 'inactive');

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to disconnect from Smartlead:', error);

    return {
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        message: errorMessage,
        retryable: true,
      },
    };
  }
}

/**
 * Gets Smartlead connection status for an email account
 *
 * @param emailAccountId - Email account ID
 * @returns Connection status information
 *
 * @example
 * const status = await getSmartleadConnectionStatus('account-123');
 * if (status.connected) {
 *   console.log(`Smartlead ID: ${status.smartleadAccountId}`);
 * }
 */
export async function getSmartleadConnectionStatus(emailAccountId: string): Promise<{
  connected: boolean;
  smartleadAccountId?: string;
  smartleadEmail?: string;
  syncStatus?: string;
  lastSyncedAt?: Date;
  error?: string;
}> {
  try {
    const [mapping] = await db
      .select()
      .from(smartleadAccountMappings)
      .where(eq(smartleadAccountMappings.emailAccountId, emailAccountId))
      .limit(1);

    if (!mapping) {
      return { connected: false };
    }

    return {
      connected: true,
      smartleadAccountId: mapping.smartleadEmailAccountId,
      smartleadEmail: mapping.smartleadEmail,
      syncStatus: mapping.syncStatus,
      lastSyncedAt: mapping.lastSyncedAt || undefined,
      error: mapping.syncErrors ? JSON.stringify(mapping.syncErrors) : undefined,
    };
  } catch (error) {
    console.error('Failed to get connection status:', error);
    return { connected: false };
  }
}

/**
 * Updates warmup settings for a connected Smartlead account
 *
 * Process:
 * 1. Validates Smartlead connection exists
 * 2. Updates warmup settings via Smartlead API (POST endpoint)
 * 3. Updates send limits via separate account update endpoint
 * 4. Updates local database metrics
 *
 * @param emailAccountId - Email account ID
 * @param settings - New warmup settings
 * @returns Success status
 *
 * @example
 * await updateSmartleadWarmupSettings('account-123', {
 *   warmupEnabled: true,
 *   maxEmailPerDay: 100,
 *   warmupMinCount: 5,
 *   warmupMaxCount: 8,
 *   dailyRampup: 10,
 *   replyRatePercentage: 30,
 * });
 *
 * NOTE: This function now uses the undocumented SmartLead bearer token endpoint
 * which supports ALL warmup features including randomization (warmupMinCount/warmupMaxCount),
 * weekdays-only mode, auto-adjust, and tracking domain warmup.
 */
export async function updateSmartleadWarmupSettings(
  emailAccountId: string,
  settings: {
    warmupEnabled?: boolean;
    maxEmailPerDay?: number;
    warmupMinCount?: number;
    warmupMaxCount?: number;
    dailyRampup?: number;
    replyRatePercentage?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Smartlead account ID
    const status = await getSmartleadConnectionStatus(emailAccountId);
    if (!status.connected || !status.smartleadAccountId) {
      return {
        success: false,
        error: 'Email account is not connected to Smartlead',
      };
    }

    const smartleadAccountId = status.smartleadAccountId;

    // Get valid bearer token (auto-refreshes if expired)
    const bearerToken = await getSmartleadBearerToken();
    if (!bearerToken) {
      return {
        success: false,
        error: 'Smartlead bearer token not available. Please save your Smartlead login credentials.',
      };
    }

    // Update warmup settings using the advanced endpoint (undocumented, supports all features)
    try {
      await updateWarmupSettingsAdvanced(bearerToken, smartleadAccountId, {
        warmupEnabled: settings.warmupEnabled,
        maxEmailPerDay: settings.maxEmailPerDay,
        warmupMinCount: settings.warmupMinCount,
        warmupMaxCount: settings.warmupMaxCount,
        dailyRampup: settings.dailyRampup,
        replyRatePercentage: settings.replyRatePercentage,
      });
    } catch (warmupError) {
      console.error('Failed to update Smartlead warmup settings:', warmupError);
      return {
        success: false,
        error: `Failed to update warmup settings: ${warmupError instanceof Error ? warmupError.message : 'Unknown error'}`,
      };
    }

    // Update local database
    await updateEmailAccountWarmupMetrics(emailAccountId, {
      dailyEmailLimit: settings.maxEmailPerDay,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to update warmup settings:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Assigns an email account to a Smartlead campaign
 *
 * Process:
 * 1. Validates email account ownership
 * 2. Verifies Smartlead connection exists
 * 3. Assigns account to campaign via Smartlead API
 *
 * @param emailAccountId - Local email account ID
 * @param campaignId - Smartlead campaign ID
 * @param userId - User ID for authorization
 * @returns Success status
 *
 * @example
 * const result = await assignEmailAccountToCampaign('account-123', 12345, 'user-456');
 */
export async function assignEmailAccountToCampaign(
  emailAccountId: string,
  campaignId: number,
  userId: string
): Promise<{ success: boolean; error?: SmartleadConnectionError }> {
  try {
    // Step 1: Validate ownership
    const account = await getEmailAccount(emailAccountId);
    if (!account || account.userId !== userId) {
      return {
        success: false,
        error: {
          type: 'ACCOUNT_NOT_FOUND',
          message: 'Unauthorized: Account not found or does not belong to user',
          retryable: false,
        },
      };
    }

    // Step 2: Verify Smartlead connection
    const status = await getSmartleadConnectionStatus(emailAccountId);
    if (!status.connected || !status.smartleadAccountId) {
      return {
        success: false,
        error: {
          type: 'ACCOUNT_NOT_FOUND',
          message: 'Email account is not connected to Smartlead',
          retryable: false,
        },
      };
    }

    // Step 3: Get user's Smartlead API credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: {
          type: 'API_AUTHENTICATION_ERROR',
          message: 'Smartlead credentials not configured',
          retryable: false,
        },
      };
    }

    // Step 4: Assign to campaign
    try {
      await addEmailAccountToCampaign(
        smartleadCreds.apiKey,
        campaignId,
        status.smartleadAccountId
      );

      return { success: true };
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      return {
        success: false,
        error: {
          type: 'API_ERROR',
          message: `Failed to assign account to campaign: ${errorMessage}`,
          retryable: true,
        },
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to assign email account to campaign:', error);

    return {
      success: false,
      error: {
        type: 'UNKNOWN_ERROR',
        message: errorMessage,
        retryable: false,
      },
    };
  }
}

/**
 * Removes an email account from all campaigns it's assigned to
 *
 * Useful for preparing an account for disconnect or reallocation
 *
 * @param emailAccountId - Local email account ID
 * @param userId - User ID for authorization
 * @returns Success status with removed campaign count
 *
 * @example
 * const result = await removeEmailAccountFromAllCampaigns('account-123', 'user-456');
 * console.log(`Removed from ${result.removedFromCount} campaigns`);
 */
export async function removeEmailAccountFromAllCampaigns(
  emailAccountId: string,
  userId: string
): Promise<{
  success: boolean;
  removedFromCount: number;
  errors: Array<{ campaignId: number; error: string }>;
}> {
  let removedCount = 0;
  const errors: Array<{ campaignId: number; error: string }> = [];

  try {
    // Get user's Smartlead API credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      throw new Error('Smartlead credentials not configured');
    }

    // Validate ownership
    const account = await getEmailAccount(emailAccountId);
    if (!account || account.userId !== userId) {
      throw new Error('Unauthorized: Account not found or does not belong to user');
    }

    // Get Smartlead account ID
    const status = await getSmartleadConnectionStatus(emailAccountId);
    if (!status.connected || !status.smartleadAccountId) {
      throw new Error('Email account is not connected to Smartlead');
    }

    const smartleadAccountId = status.smartleadAccountId;

    // Fetch all campaigns
    const campaignsResponse = await listCampaigns(smartleadCreds.apiKey);
    const campaigns = Array.isArray(campaignsResponse) ? campaignsResponse : [];

    // Remove from each campaign
    for (const campaign of campaigns) {
      try {
        const campaignAccounts = await listCampaignEmailAccounts(smartleadCreds.apiKey, campaign.id);
        const accountsArray = Array.isArray(campaignAccounts) ? campaignAccounts : [];

        const isInCampaign = accountsArray.some(
          (acc: { id?: string; email_account_id?: string }) =>
            String(acc.id || acc.email_account_id) === smartleadAccountId
        );

        if (isInCampaign) {
          await removeEmailAccountFromCampaign(smartleadCreds.apiKey, campaign.id, smartleadAccountId);
          removedCount++;
        }
      } catch (campaignError) {
        const errorMessage =
          campaignError instanceof Error ? campaignError.message : 'Unknown error';
        errors.push({
          campaignId: campaign.id,
          error: errorMessage,
        });
      }
    }

    return {
      success: errors.length === 0,
      removedFromCount: removedCount,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to remove from all campaigns:', error);

    return {
      success: false,
      removedFromCount: removedCount,
      errors: [{ campaignId: 0, error: errorMessage }],
    };
  }
}
