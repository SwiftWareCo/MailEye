"use server"

import { listCampaigns } from '@/lib/clients/smartlead';
import { getGoogleWorkspaceConfig, getGoogleAdminClient } from '@/lib/clients/google-workspace';
import { getSmartleadCredentials } from '@/server/credentials/credentials.data';

export interface TestResult {
  success: boolean;
  message: string;
}

/**
 * Tests Cloudflare API connection using the official SDK
 * NOTE: Cloudflare is now user-specific, so this test is deprecated
 * Each user connects their own Cloudflare account via the domains page
 */
export async function testCloudflareConnection(): Promise<TestResult> {
  return {
    success: false,
    message: 'Cloudflare is now user-specific. Connect your account in the Domains page.',
  };
}

/**
 * Tests Smartlead API connection using the client
 */
export async function testSmartleadConnection(): Promise<TestResult> {
  try {
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        message: 'Smartlead credentials not configured. Please connect your account in Settings.',
      };
    }

    const campaigns = await listCampaigns(smartleadCreds.apiKey);

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
