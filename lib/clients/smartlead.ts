/**
 * Smartlead API Client
 * Provides email account connection and warmup management
 *
 * All functions accept apiKey parameter for user-specific credentials
 */

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const SMARTLEAD_AUTH_URL = 'https://server.smartlead.ai/api/auth';

/**
 * Smartlead login response structure
 */
export interface SmartleadLoginResponse {
  user: {
    id: number;
    uuid: string;
    email: string;
    name: string;
    role: string;
    api_key: string;
    [key: string]: unknown;
  };
  token: string; // JWT bearer token
}

/**
 * Login to Smartlead and get bearer token
 * Required for advanced warmup settings endpoint
 *
 * @param email - Smartlead account email
 * @param password - Smartlead account password
 * @returns Login response with bearer token
 */
export async function loginToSmartlead(
  email: string,
  password: string
): Promise<SmartleadLoginResponse> {
  const response = await fetch(`${SMARTLEAD_AUTH_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Login failed';

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    if (response.status === 401) {
      throw new Error('Invalid email or password');
    }

    throw new Error(`Smartlead login failed: ${errorMessage}`);
  }

  return await response.json();
}

/**
 * Lists all campaigns in Smartlead account
 */
export async function listCampaigns(apiKey: string) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns?api_key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead API error: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Lists all email accounts in Smartlead
 */
export async function listEmailAccounts(apiKey: string) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts?api_key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead API error: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Connects an email account to Smartlead
 * Uses the /email-accounts/save endpoint which creates or updates accounts
 *
 * Uses ONLY documented parameters from SmartLead API reference.
 * Advanced features (randomization, weekdays-only, auto-adjust, custom domain)
 * should be set via the Bearer token endpoint after account creation.
 */
export async function connectEmailAccount(
  apiKey: string,
  accountData: {
    email: string;
    firstName: string;
    lastName: string;
    smtpHost: string;
    smtpPort: number;
    smtpPassword: string;
    imapHost: string;
    imapPort: number;
    warmupEnabled?: boolean;
    maxEmailPerDay?: number;
    totalWarmupPerDay?: number;
    dailyRampup?: number;
    replyRatePercentage?: number;
  }
) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/save?api_key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Basic account fields (documented)
        from_email: accountData.email,
        from_name: `${accountData.firstName} ${accountData.lastName}`,
        user_name: accountData.email, // Smartlead uses email as username for both SMTP and IMAP
        password: accountData.smtpPassword, // Same password used for both SMTP and IMAP
        smtp_host: accountData.smtpHost,
        smtp_port: accountData.smtpPort,
        imap_host: accountData.imapHost,
        imap_port: accountData.imapPort,

        // Warmup configuration (documented parameters only)
        warmup_enabled: accountData.warmupEnabled ?? true, // Default to true for best practices
        max_email_per_day: accountData.maxEmailPerDay ?? 100,
        total_warmup_per_day: accountData.totalWarmupPerDay ?? null,
        daily_rampup: accountData.dailyRampup ?? null,
        reply_rate_percentage: accountData.replyRatePercentage ?? null,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;

    // Enhanced error logging for debugging
    console.error('[Smartlead API Error] Status:', response.status, response.statusText);
    console.error('[Smartlead API Error] Response:', errorText);

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(`Smartlead API error: ${errorMessage}`);
  }

  return await response.json();
}

/**
 * Updates an email account settings in Smartlead
 * Used for modifying send limits, custom tracking, BCC, signature, etc.
 * Note: Smartlead doesn't have a true "delete" endpoint - use this to set accounts inactive
 */
export async function updateEmailAccount(
  apiKey: string,
  emailAccountId: string,
  settings: {
    maxEmailPerDay?: number;
    customTrackingUrl?: string;
    bcc?: string;
    signature?: string;
    clientId?: number;
    timeToWaitInMins?: number;
  }
) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}?api_key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_email_per_day: settings.maxEmailPerDay,
        custom_tracking_url: settings.customTrackingUrl,
        bcc: settings.bcc,
        signature: settings.signature,
        client_id: settings.clientId,
        time_to_wait_in_mins: settings.timeToWaitInMins,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead account update failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Gets full email account details including warmup status and settings
 * Returns comprehensive account information from Smartlead API
 */
export async function getEmailAccountDetails(apiKey: string, emailAccountId: string) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}?api_key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(`Smartlead API error: ${errorMessage}`);
  }

  return await response.json();
}

/**
 * Updates warmup settings with ADVANCED FEATURES (UNDOCUMENTED ENDPOINT)
 *
 * This uses SmartLead's internal UI endpoint discovered via browser DevTools analysis.
 * It supports all advanced warmup features including:
 * - Randomization (varying daily email volume)
 * - Weekdays-only mode (pause on weekends)
 * - Auto-adjust during campaigns
 * - Warmup tracking domain
 *
 * ⚠️ WARNING: This is an undocumented endpoint. It may break in future SmartLead updates.
 * The endpoint is used by SmartLead's own dashboard, so it should be relatively stable.
 *
 * AUTHENTICATION: Requires Bearer token (JWT) from SmartLead login, NOT API key.
 *
 * @experimental
 */
export async function updateWarmupSettingsAdvanced(
  bearerToken: string,
  emailAccountId: string,
  settings: {
    warmupEnabled?: boolean;
    maxEmailPerDay?: number;
    warmupMinCount?: number;
    warmupMaxCount?: number;
    dailyRampup?: number;
    replyRatePercentage?: number;
    warmupKeyId?: string;
    // Advanced features
    isRampupEnabled?: boolean;
    weekdaysOnly?: boolean;
    autoAdjust?: boolean;
    warmupTrackingDomain?: boolean;
  }
) {
  // Use passed warmup range values directly (no auto-calculation)
  const warmupMinCount = settings.warmupMinCount || 5;
  const warmupMaxCount = settings.warmupMaxCount || 8;

  // Calculate daily reply limit based on average warmup volume
  // Formula: (replyRate% / 100) × avgWarmupVolume × 0.3 (conservative multiplier)
  const avgWarmupCount = (warmupMinCount + warmupMaxCount) / 2;
  const dailyReplyLimit = settings.replyRatePercentage
    ? Math.ceil((settings.replyRatePercentage / 100) * avgWarmupCount * 0.3)
    : 8; // Default to 8 if not specified

  // Use the undocumented UI endpoint with Bearer token authentication
  const response = await fetch(
    `https://server.smartlead.ai/api/email-account/save-warmup`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        // IMPORTANT: Based on real SmartLead UI request structure
        emailAccountId: emailAccountId, // Keep as string, not number
        maxEmailPerDay: settings.maxEmailPerDay || 50,
        isRampupEnabled: settings.isRampupEnabled ?? (settings.dailyRampup !== undefined && settings.dailyRampup > 0),
        rampupValue: settings.dailyRampup || 0,
        warmupMinCount: warmupMinCount,
        warmupMaxCount: warmupMaxCount,
        replyRate: settings.replyRatePercentage || 30, // Note: camelCase, not snake_case
        dailyReplyLimit: dailyReplyLimit,
        status: settings.warmupEnabled ? 'ACTIVE' : 'INACTIVE', // Required field
        autoAdjustWarmup: settings.autoAdjust ?? false,
        useCustomDomain: settings.warmupTrackingDomain ?? false,
        sendWarmupsOnlyOnWeekdays: settings.weekdaysOnly ?? false,
        warmupKeyId: settings.warmupKeyId, // Note: camelCase, not snake_case
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;


    // Enhanced error logging
    console.error('[SmartLead Advanced Warmup] Status:', response.status);
    console.error('[SmartLead Advanced Warmup] Response:', errorText);

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(`Smartlead advanced warmup update failed: ${errorMessage}`);
  }
  return await response.json();
}

/**
 * Gets warmup statistics for an email account (last 7 days)
 * Returns daily metrics: sent, delivered, bounced, replied, deliverability rate
 */
export async function getWarmupStats(apiKey: string, emailAccountId: string) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}/warmup-stats?api_key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );


  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead warmup stats fetch failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Lists all email accounts assigned to a campaign
 */
export async function listCampaignEmailAccounts(apiKey: string, campaignId: number) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns/${campaignId}/email-accounts?api_key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead campaign email accounts fetch failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Adds email account(s) to a campaign
 * Note: Smartlead API accepts an array of email account IDs
 */
export async function addEmailAccountToCampaign(
  apiKey: string,
  campaignId: number,
  emailAccountId: string | string[]
) {
  const accountIds = Array.isArray(emailAccountId) ? emailAccountId : [emailAccountId];

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns/${campaignId}/email-accounts?api_key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_account_ids: accountIds,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead add account to campaign failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Removes email account(s) from a campaign
 * Note: Smartlead API accepts an array of email account IDs in the request body
 */
export async function removeEmailAccountFromCampaign(
  apiKey: string,
  campaignId: number,
  emailAccountId: string | string[]
) {
  const accountIds = Array.isArray(emailAccountId) ? emailAccountId : [emailAccountId];

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns/${campaignId}/email-accounts?api_key=${apiKey}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_account_ids: accountIds,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead remove account from campaign failed: ${error.message || response.statusText}`);
  }

  return { success: true };
}

