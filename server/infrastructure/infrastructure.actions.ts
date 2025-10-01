"use server"

import { getServiceConfig } from '@/lib/config/api-keys';

export interface TestResult {
  success: boolean;
  message: string;
}

/**
 * Tests Cloudflare API connection
 */
export async function testCloudflareConnection(): Promise<TestResult> {
  try {
    const config = getServiceConfig('cloudflare');

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${config.zoneId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: `Cloudflare API error: ${error.errors?.[0]?.message || 'Unknown error'}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: `Connected to Cloudflare zone: ${data.result?.name || 'Unknown'}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration error',
    };
  }
}

/**
 * Tests GoDaddy API connection
 */
export async function testGoDaddyConnection(): Promise<TestResult> {
  try {
    const config = getServiceConfig('godaddy');

    const response = await fetch(
      `${config.baseUrl}/v1/domains?limit=1`,
      {
        headers: {
          'Authorization': `sso-key ${config.apiKey}:${config.apiSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: `GoDaddy API error: ${error.message || 'Unknown error'}`,
      };
    }

    const domains = await response.json();

    return {
      success: true,
      message: `Connected to GoDaddy (${config.environment}). Found ${Array.isArray(domains) ? domains.length : 0} domain(s)`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration error',
    };
  }
}

/**
 * Tests Smartlead API connection
 */
export async function testSmartleadConnection(): Promise<TestResult> {
  try {
    const config = getServiceConfig('smartlead');

    const response = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns?api_key=${config.apiKey}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: `Smartlead API error: ${error.message || 'Unknown error'}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: `Connected to Smartlead. Found ${Array.isArray(data) ? data.length : 0} campaign(s)`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration error',
    };
  }
}
