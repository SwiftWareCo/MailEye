/**
 * Google Workspace Domain Management Server Actions
 *
 * Handles adding, removing, and verifying domains in Google Workspace
 */

'use server';

import {
  addDomainToGoogleWorkspace,
  removeDomainFromGoogleWorkspace,
  getGoogleWorkspaceDomain,
} from '@/lib/clients/google-workspace';
import { getGoogleWorkspaceCredentials } from '../credentials/credentials.data';
import type {
  AddDomainToGoogleWorkspaceResult,
  RemoveDomainFromGoogleWorkspaceResult,
  DomainVerificationStatusResult,
  GoogleWorkspaceDomainStatus,
} from '@/lib/types/google-workspace';

/**
 * Add a domain to Google Workspace (Idempotent)
 *
 * This will initiate domain verification process.
 * If domain already exists, returns success without error.
 *
 * @param domain - Domain name to add
 * @returns Result with verification token
 */
export async function addDomainToGoogleWorkspaceAction(
  domain: string
): Promise<AddDomainToGoogleWorkspaceResult> {
  try {
    // Get user's Google Workspace credentials
    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Google Workspace not connected. Please configure Google Workspace credentials first.',
      };
    }

    // Check if domain already exists (idempotency check)
    const existingDomain = await getGoogleWorkspaceDomain(domain, {
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKey: credentials.privateKey,
      adminEmail: credentials.adminEmail,
      customerId: credentials.customerId,
    });

    if (existingDomain) {
      console.log(`[Google Workspace] Domain ${domain} already exists, skipping creation`);

      // Return success with existing domain info
      return {
        success: true,
        domain: {
          domainName: existingDomain.domainName || domain,
          isPrimary: existingDomain.isPrimary as boolean,
          verified: existingDomain.verified as boolean,
          creationTime: existingDomain.creationTime as string,
        },
        // Placeholder - in production, integrate with Site Verification API
        verificationToken: {
          method: 'txt',
          token: 'VERIFICATION_TOKEN_FROM_ADMIN_CONSOLE',
          recordName: domain,
          recordValue: 'google-site-verification=VERIFICATION_TOKEN_FROM_ADMIN_CONSOLE',
        },
        alreadyExists: true, // Flag to indicate domain was already present
      };
    }

    // Add domain to Google Workspace
    const result = await addDomainToGoogleWorkspace(domain, {
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKey: credentials.privateKey,
      adminEmail: credentials.adminEmail,
      customerId: credentials.customerId,
    });

    console.log(`[Google Workspace] Domain ${domain} added successfully`);

    // Note: Google Workspace domains.insert doesn't directly return verification token
    // The verification token/method needs to be retrieved via Site Verification API
    // For now, we'll indicate that TXT record verification is needed
    // User should go to admin.google.com to get the verification record

    return {
      success: true,
      domain: {
        domainName: result.domainName || domain,
        isPrimary: result.isPrimary as boolean,
        verified: result.verified as boolean,
        creationTime: result.creationTime as string,
      },
      // Placeholder - in production, integrate with Site Verification API
      verificationToken: {
        method: 'txt',
        token: 'VERIFICATION_TOKEN_FROM_ADMIN_CONSOLE',
        recordName: domain,
        recordValue: 'google-site-verification=VERIFICATION_TOKEN_FROM_ADMIN_CONSOLE',
      },
    };
  } catch (error) {
    console.error('Error adding domain to Google Workspace:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle duplicate case (shouldn't happen due to idempotency check above, but just in case)
    if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
      console.log(`[Google Workspace] Domain ${domain} already exists (caught in error handler)`);
      return {
        success: true,
        alreadyExists: true,
      };
    }

    if (errorMessage.includes('invalid_grant')) {
      return {
        success: false,
        error: 'Invalid Google Workspace credentials. Please reconnect your account.',
      };
    }

    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
      return {
        success: false,
        error: 'Insufficient permissions. Ensure domain-wide delegation is enabled with admin.directory.domain scope.',
      };
    }

    return {
      success: false,
      error: `Failed to add domain: ${errorMessage}`,
    };
  }
}

/**
 * Remove a domain from Google Workspace
 *
 * @param domain - Domain name to remove
 * @returns Result indicating success or failure
 */
export async function removeDomainFromGoogleWorkspaceAction(
  domain: string
): Promise<RemoveDomainFromGoogleWorkspaceResult> {
  try {
    // Get user's Google Workspace credentials
    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Google Workspace not connected',
      };
    }

    // Remove domain from Google Workspace
    await removeDomainFromGoogleWorkspace(domain, {
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKey: credentials.privateKey,
      adminEmail: credentials.adminEmail,
      customerId: credentials.customerId,
    });

    console.log(`[Google Workspace] Domain removed: ${domain}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error removing domain from Google Workspace:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // If domain not found, treat as success (idempotent)
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        success: true,
      };
    }

    // Cannot delete primary domain
    if (errorMessage.includes('primary')) {
      return {
        success: false,
        error: 'Cannot remove primary domain from Google Workspace',
      };
    }

    return {
      success: false,
      error: `Failed to remove domain: ${errorMessage}`,
    };
  }
}

/**
 * Check domain verification status in Google Workspace
 *
 * @param domain - Domain name to check
 * @returns Verification status result
 */
export async function checkDomainVerificationStatusAction(
  domain: string
): Promise<DomainVerificationStatusResult> {
  try {
    // Get user's Google Workspace credentials
    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        domain,
        verified: false,
        status: 'verification_failed',
        error: 'Google Workspace not connected',
      };
    }

    // Get domain from Google Workspace
    const domainInfo = await getGoogleWorkspaceDomain(domain, {
      serviceAccountEmail: credentials.serviceAccountEmail,
      privateKey: credentials.privateKey,
      adminEmail: credentials.adminEmail,
      customerId: credentials.customerId,
    });

    if (!domainInfo) {
      return {
        domain,
        verified: false,
        status: 'verification_failed',
        error: 'Domain not found in Google Workspace',
      };
    }

    // Determine status
    let status: GoogleWorkspaceDomainStatus;
    if (domainInfo.verified) {
      status = 'verified';
    } else {
      // Domain exists but not verified yet
      status = 'pending_verification';
    }

    return {
      domain,
      verified: domainInfo.verified || false,
      status,
    };
  } catch (error) {
    console.error('Error checking domain verification status:', error);

    return {
      domain,
      verified: false,
      status: 'verification_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
