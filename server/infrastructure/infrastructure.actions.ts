"use server"

import { getServiceConfig } from '@/lib/config/api-keys';
import { getZoneInfo, listDNSRecords } from '@/lib/clients/cloudflare';
import { listDomains } from '@/lib/clients/godaddy';
import { listCampaigns } from '@/lib/clients/smartlead';
import { getGoogleWorkspaceConfig, getGoogleAdminClient } from '@/lib/clients/google-workspace';

export interface TestResult {
  success: boolean;
  message: string;
}

/**
 * Tests Cloudflare API connection using the official SDK
 */
export async function testCloudflareConnection(): Promise<TestResult> {
  try {
    const config = getServiceConfig('cloudflare');
    const zoneInfo = await getZoneInfo(config.zoneId);
    const records = await listDNSRecords(config.zoneId);

    return {
      success: true,
      message: `Connected to Cloudflare zone: ${zoneInfo.name} (${records.length} DNS records)`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration error',
    };
  }
}

/**
 * Tests GoDaddy API connection using the client
 */
export async function testGoDaddyConnection(): Promise<TestResult> {
  try {
    const config = getServiceConfig('godaddy');
    const domains = await listDomains(1);

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
 * Tests Smartlead API connection using the client
 */
export async function testSmartleadConnection(): Promise<TestResult> {
  try {
    const campaigns = await listCampaigns();

    return {
      success: true,
      message: `Connected to Smartlead. Found ${Array.isArray(campaigns) ? campaigns.length : 0} campaign(s)`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration error',
    };
  }
}

/**
 * Tests Google Workspace API connection using the Admin SDK client
 */
export async function testGoogleWorkspaceConnection(): Promise<TestResult> {
  try {
    const config = getGoogleWorkspaceConfig();

    if (!config) {
      return {
        success: false,
        message: 'Google Workspace not configured',
      };
    }

    const admin = getGoogleAdminClient();

    // Try to list users with maxResults=1 to test connection
    await admin.users.list({
      customer: 'my_customer',
      maxResults: 1,
    });

    return {
      success: true,
      message: `Connected to Google Workspace as ${config.adminEmail}. Domain has users.`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration error',
    };
  }
}
