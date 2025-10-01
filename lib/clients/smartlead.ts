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
 */
export async function connectEmailAccount(accountData: {
  email: string;
  firstName: string;
  lastName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  warmupEnabled?: boolean;
  warmupReputation?: 'average' | 'good' | 'excellent';
  dailyLimit?: number;
}) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/connect?api_key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_email: accountData.email,
        from_name: `${accountData.firstName} ${accountData.lastName}`,
        smtp_host: accountData.smtpHost,
        smtp_port: accountData.smtpPort,
        smtp_username: accountData.smtpUsername,
        smtp_password: accountData.smtpPassword,
        imap_host: accountData.imapHost,
        imap_port: accountData.imapPort,
        imap_username: accountData.imapUsername,
        imap_password: accountData.imapPassword,
        warmup_enabled: accountData.warmupEnabled ?? true,
        warmup_reputation: accountData.warmupReputation ?? 'average',
        daily_limit: accountData.dailyLimit ?? 50,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead connection failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Disconnects an email account from Smartlead
 */
export async function disconnectEmailAccount(emailAccountId: string) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}?api_key=${config.apiKey}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead disconnect failed: ${error.message || response.statusText}`);
  }

  return { success: true };
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
 */
export async function updateWarmupSettings(
  emailAccountId: string,
  settings: {
    warmupEnabled?: boolean;
    warmupReputation?: 'average' | 'good' | 'excellent';
    dailyLimit?: number;
  }
) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/email-accounts/${emailAccountId}/warmup?api_key=${config.apiKey}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        warmup_enabled: settings.warmupEnabled,
        warmup_reputation: settings.warmupReputation,
        daily_limit: settings.dailyLimit,
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
 * Sets up a custom tracking domain in Smartlead
 */
export async function setupTrackingDomain(domain: string) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/tracking-domains?api_key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead tracking domain setup failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Verifies a custom tracking domain
 */
export async function verifyTrackingDomain(trackingDomainId: string) {
  const config = getServiceConfig('smartlead');

  const response = await fetch(
    `${SMARTLEAD_BASE_URL}/tracking-domains/${trackingDomainId}/verify?api_key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Smartlead tracking verification failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}
