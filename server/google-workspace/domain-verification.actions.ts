/**
 * Google Workspace Domain Verification Server Actions
 *
 * Handles automated domain verification via Site Verification API
 */

'use server';

import {
  getVerificationToken,
  verifyDomain,
  isDomainVerified,
} from '@/lib/clients/site-verification';
import { getGoogleWorkspaceCredentials } from '../credentials/credentials.data';

/**
 * Get verification token for domain
 *
 * This token should be placed as a TXT record in DNS
 *
 * @param domain - Domain to get token for
 * @returns Verification token
 */
export async function getVerificationTokenAction(domain: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    // Get user's Google Workspace credentials
    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Google Workspace not connected',
      };
    }

    // Get verification token
    const result = await getVerificationToken(domain, {
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKey: credentials.privateKey,
      adminEmail: credentials.adminEmail,
      customerId: credentials.customerId,
    });

    console.log(`[Site Verification] Got token for ${domain}`);

    return {
      success: true,
      token: result.token,
    };
  } catch (error) {
    console.error('Error getting verification token:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return {
        success: false,
        error: 'Google Workspace service account not authorized. Please ensure domain-wide delegation is enabled with siteverification scope.',
      };
    }

    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
      return {
        success: false,
        error: 'Insufficient permissions. Ensure the admin email has super admin privileges.',
      };
    }

    return {
      success: false,
      error: `Failed to get verification token: ${errorMessage}`,
    };
  }
}

/**
 * Trigger domain verification after TXT record is placed
 *
 * @param domain - Domain to verify
 * @returns Verification result
 */
export async function verifyDomainAction(domain: string): Promise<{
  success: boolean;
  verified?: boolean;
  error?: string;
}> {
  try {
    // Get user's Google Workspace credentials
    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Google Workspace not connected',
      };
    }

    // Trigger verification
    await verifyDomain(domain, {
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKey: credentials.privateKey,
      adminEmail: credentials.adminEmail,
      customerId: credentials.customerId,
    });

    console.log(`[Site Verification] Domain verified: ${domain}`);

    return {
      success: true,
      verified: true,
    };
  } catch (error) {
    console.error('Error verifying domain:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (errorMessage.includes('400') || errorMessage.includes('verification token could not be found')) {
      return {
        success: false,
        verified: false,
        error: 'Verification TXT record not found in DNS yet. DNS propagation can take 5-60 minutes. The system will automatically retry verification. You can also manually verify later.',
      };
    }

    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return {
        success: false,
        error: 'Google Workspace service account not authorized.',
      };
    }

    return {
      success: false,
      verified: false,
      error: `Verification failed: ${errorMessage}`,
    };
  }
}

/**
 * Check if domain is already verified
 *
 * @param domain - Domain to check
 * @returns Verification status
 */
export async function checkDomainVerificationAction(domain: string): Promise<{
  success: boolean;
  verified: boolean;
  error?: string;
}> {
  try {
    // Get user's Google Workspace credentials
    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        success: false,
        verified: false,
        error: 'Google Workspace not connected',
      };
    }

    // Check verification status
    const verified = await isDomainVerified(domain, {
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKey: credentials.privateKey,
      adminEmail: credentials.adminEmail,
      customerId: credentials.customerId,
    });

    return {
      success: true,
      verified,
    };
  } catch (error) {
    console.error('Error checking domain verification:', error);

    return {
      success: false,
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete verification resource (cleanup after domain removal)
 *
 * Removes the domain from Site Verification API verified resources
 *
 * @param domain - Domain to delete verification for
 * @returns Deletion result
 */
export async function deleteVerificationAction(domain: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get user's Google Workspace credentials
    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      // No credentials, nothing to delete - treat as success
      return { success: true };
    }

    // Import Site Verification client
    const { google } = await import('googleapis');

    // Handle escaped newlines in private key
    const privateKey = credentials.privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: credentials.serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/siteverification'],
      subject: credentials.adminEmail,
    });

    const client = google.siteVerification({ version: 'v1', auth });

    // Site Verification resource ID format
    const resourceId = `dns://${domain}/`;

    // Delete the verification resource
    await client.webResource.delete({ id: resourceId });

    console.log(`[Site Verification] ✅ Deleted verification resource: ${domain}`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 404 means resource doesn't exist or already deleted - treat as success
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      console.log(`[Site Verification] Verification resource not found for ${domain} (already deleted)`);
      return { success: true };
    }

    console.error(`[Site Verification] Error deleting verification resource:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
