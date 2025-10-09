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
    if (errorMessage.includes('400')) {
      return {
        success: false,
        verified: false,
        error: 'Verification token not found in DNS. Please wait for DNS propagation (can take up to 48 hours).',
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
