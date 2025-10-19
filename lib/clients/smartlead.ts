/**
 * Smartlead API Client
 * Provides email account connection and warmup management
 *
 * All functions accept apiKey parameter for user-specific credentials
 */

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';

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
        from_email: accountData.email,
        from_name: `${accountData.firstName} ${accountData.lastName}`,
        user_name: accountData.email, // Smartlead uses email as username for both SMTP and IMAP
        password: accountData.smtpPassword, // Same password used for both SMTP and IMAP
        smtp_host: accountData.smtpHost,
        smtp_port: accountData.smtpPort,
        imap_host: accountData.imapHost,
        imap_port: accountData.imapPort,
        warmup_enabled: accountData.warmupEnabled ?? true,
        max_email_per_day: accountData.maxEmailPerDay ?? 50,
        total_warmup_per_day: accountData.totalWarmupPerDay,
        daily_rampup: accountData.dailyRampup,
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
 * Gets email account warmup status
 */
export async function getEmailAccountStatus(apiKey: string, emailAccountId: string) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}?api_key=${apiKey}`,
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
 * Updates warmup settings for an email account
 * Uses POST method as per Smartlead API documentation
 */
export async function updateWarmupSettings(
  apiKey: string,
  emailAccountId: string,
  settings: {
    warmupEnabled?: boolean;
    totalWarmupPerDay?: number;
    dailyRampup?: number;
    replyRatePercentage?: number;
    warmupKeyId?: string;
  }
) {
  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}/warmup?api_key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        warmup_enabled: settings.warmupEnabled,
        total_warmup_per_day: settings.totalWarmupPerDay,
        daily_rampup: settings.dailyRampup,
        reply_rate_percentage: settings.replyRatePercentage,
        warmup_key_id: settings.warmupKeyId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead warmup update failed: ${error.message || response.statusText}`);
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

