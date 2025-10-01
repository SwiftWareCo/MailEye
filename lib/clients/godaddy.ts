/**
 * GoDaddy API Client
 * Provides domain availability checking and purchase functionality
 */

import { getServiceConfig } from '@/lib/config/api-keys';

/**
 * Checks if a domain is available for purchase
 */
export async function checkDomainAvailability(domain: string): Promise<{
  available: boolean;
  price?: number;
  currency?: string;
}> {
  const config = getServiceConfig('godaddy');

  const response = await fetch(
    `${config.baseUrl}/v1/domains/available?domain=${encodeURIComponent(domain)}`,
    {
      headers: {
        Authorization: `sso-key ${config.apiKey}:${config.apiSecret}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GoDaddy API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    available: data.available,
    price: data.price,
    currency: data.currency,
  };
}

/**
 * Gets domain pricing information
 */
export async function getDomainPrice(domain: string) {
  const config = getServiceConfig('godaddy');

  const response = await fetch(
    `${config.baseUrl}/v1/domains/available?domain=${encodeURIComponent(domain)}`,
    {
      headers: {
        Authorization: `sso-key ${config.apiKey}:${config.apiSecret}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GoDaddy API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Purchases a domain through GoDaddy
 * NOTE: This will actually purchase a domain and charge your account
 */
export async function purchaseDomain(
  domain: string,
  contactInfo: {
    nameFirst: string;
    nameLast: string;
    email: string;
    phone: string;
    addressMailing: {
      address1: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  },
  options?: {
    autoRenew?: boolean;
    privacy?: boolean;
  }
) {
  const config = getServiceConfig('godaddy');

  const response = await fetch(`${config.baseUrl}/v1/domains/purchase`, {
    method: 'POST',
    headers: {
      Authorization: `sso-key ${config.apiKey}:${config.apiSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      domain,
      consent: {
        agreementKeys: ['DNRA'],
        agreedAt: new Date().toISOString(),
        agreedBy: contactInfo.email,
      },
      contactAdmin: contactInfo,
      contactBilling: contactInfo,
      contactRegistrant: contactInfo,
      contactTech: contactInfo,
      period: 1,
      renewAuto: options?.autoRenew ?? true,
      privacy: options?.privacy ?? true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GoDaddy purchase failed: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Updates nameservers for a domain
 */
export async function updateNameservers(domain: string, nameservers: string[]) {
  const config = getServiceConfig('godaddy');

  const response = await fetch(
    `${config.baseUrl}/v1/domains/${encodeURIComponent(domain)}/nameservers`,
    {
      method: 'PUT',
      headers: {
        Authorization: `sso-key ${config.apiKey}:${config.apiSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nameservers }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GoDaddy nameserver update failed: ${error.message || response.statusText}`);
  }

  return { success: true };
}

/**
 * Lists all domains in the GoDaddy account
 */
export async function listDomains(limit = 100) {
  const config = getServiceConfig('godaddy');

  const response = await fetch(
    `${config.baseUrl}/v1/domains?limit=${limit}`,
    {
      headers: {
        Authorization: `sso-key ${config.apiKey}:${config.apiSecret}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GoDaddy API error: ${response.statusText}`);
  }

  return await response.json();
}
