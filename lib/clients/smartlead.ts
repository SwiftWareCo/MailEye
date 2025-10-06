/**
 * Smartlead API Client
 * Provides email account connection and warmup management
 */

import { getServiceConfig } from '@/lib/config/api-keys';

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';

/**
 * Lists all campaigns in Smartlead account
 */
export async function listCampaigns() {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns?api_key=${config.apiKey}`,
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
export async function listEmailAccounts() {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts?api_key=${config.apiKey}`,
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
export async function connectEmailAccount(accountData: {
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
}) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/save?api_key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_email: accountData.email,
        from_name: `${accountData.firstName} ${accountData.lastName}`,
        user_name: accountData.email, // Smartlead uses email as username
        password: accountData.smtpPassword,
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
 * Used for modifying send limits, warmup settings, tags, etc.
 * Note: Smartlead doesn't have a true "delete" endpoint - use this to set accounts inactive
 */
export async function updateEmailAccount(
  emailAccountId: string,
  settings: {
    maxEmailPerDay?: number;
    warmupEnabled?: boolean;
    tags?: string[];
    fromName?: string;
  }
) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}?api_key=${config.apiKey}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_email_per_day: settings.maxEmailPerDay,
        warmup_enabled: settings.warmupEnabled,
        tags: settings.tags,
        from_name: settings.fromName,
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
export async function getEmailAccountStatus(emailAccountId: string) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}?api_key=${config.apiKey}`,
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
  emailAccountId: string,
  settings: {
    warmupEnabled?: boolean;
    warmupReputation?: 'average' | 'good' | 'excellent';
    totalWarmupPerDay?: number;
    dailyRampup?: number;
  }
) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}/warmup?api_key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        warmup_enabled: settings.warmupEnabled,
        warmup_reputation: settings.warmupReputation,
        total_warmup_per_day: settings.totalWarmupPerDay,
        daily_rampup: settings.dailyRampup,
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
export async function getWarmupStats(emailAccountId: string) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}/warmup-stats?api_key=${config.apiKey}`,
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
export async function listCampaignEmailAccounts(campaignId: number) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns/${campaignId}/email-accounts?api_key=${config.apiKey}`,
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
 * Adds an email account to a campaign
 */
export async function addEmailAccountToCampaign(
  campaignId: number,
  emailAccountId: string,
  settings?: {
    dailyLimit?: number;
  }
) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns/${campaignId}/email-accounts?api_key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_account_id: emailAccountId,
        daily_limit: settings?.dailyLimit,
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
 * Removes an email account from a campaign
 */
export async function removeEmailAccountFromCampaign(
  campaignId: number,
  emailAccountId: string
) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/campaigns/${campaignId}/email-accounts/${emailAccountId}?api_key=${config.apiKey}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead remove account from campaign failed: ${error.message || response.statusText}`);
  }

  return { success: true };
}

