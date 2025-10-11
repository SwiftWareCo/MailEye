/**
 * Google Workspace Credentials Server Actions
 *
 * Handles user Google Workspace Admin SDK credential connection and management
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { google } from 'googleapis';
import { updateUserCredentials } from '../credentials/credentials.actions';
import type { GoogleWorkspaceCredentials } from '@/lib/types/credentials';
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
 * Save user's Google Workspace credentials to Stack Auth metadata
 *
 * Validates credentials by testing Admin SDK access before saving
 */
export async function saveGoogleWorkspaceCredentialsAction(
  serviceAccountEmail: string,
  privateKey: string,
  adminEmail: string,
  customerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!serviceAccountEmail || !privateKey || !adminEmail) {
      return {
        success: false,
        error:
          'Service Account Email, Private Key, and Admin Email are required',
      };
    }

    // Verify credentials by testing API call
    try {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
        scopes: [
          'https://www.googleapis.com/auth/admin.directory.user',
          'https://www.googleapis.com/auth/admin.directory.user.security',
        ],
        subject: adminEmail,
      });

      const admin = google.admin({ version: 'directory_v1', auth });

      // Test: Can we list users?
      await admin.users.list({
        customer: customerId || 'my_customer',
        maxResults: 1,
      });
    } catch (error) {
      console.error('Invalid Google Workspace credentials:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Provide helpful error messages
      if (errorMessage.includes('invalid_grant')) {
        return {
          success: false,
          error:
            'Invalid service account credentials. Please verify the private key and service account email are correct.',
        };
      }

      if (errorMessage.includes('unauthorized_client')) {
        return {
          success: false,
          error:
            'Service account not authorized. Please ensure domain-wide delegation is enabled for this service account.',
        };
      }

      if (
        errorMessage.includes('access_denied') ||
        errorMessage.includes('403')
      ) {
        return {
          success: false,
          error:
            'Access denied. Please verify the admin email has the necessary permissions and domain-wide delegation is configured.',
        };
      }

      return {
        success: false,
        error: `Failed to verify credentials: ${errorMessage}`,
      };
    }

    // Save credentials to Stack Auth metadata (automatically encrypted)
    const credentials: GoogleWorkspaceCredentials = {
      serviceAccountEmail,
      privateKey,
      adminEmail,
      customerId,
      connectedAt: new Date().toISOString(),
    };

    const result = await updateUserCredentials({
      googleWorkspace: credentials,
    });

    if (!result.success) {
      return result;
    }

    console.log('[Google Workspace] User connected Google Workspace account');

    return { success: true };
  } catch (error) {
    console.error('Error saving Google Workspace credentials:', error);
    return {
      success: false,
      error: 'Failed to save credentials. Please try again.',
    };
  }
}

/**
 * Disconnect user's Google Workspace account
 */
export async function disconnectGoogleWorkspaceAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { removeServiceCredentials } = await import(
      '../credentials/credentials.actions'
    );

    const result = await removeServiceCredentials('googleWorkspace');

    if (result.success) {
      console.log(
        '[Google Workspace] User disconnected Google Workspace account'
      );
    }

    return result;
  } catch (error) {
    console.error('Error disconnecting Google Workspace:', error);
    return {
      success: false,
      error: 'Failed to disconnect Google Workspace',
    };
  }
}

/**
 * Test Google Workspace connection
 *
 * Verifies that stored credentials are still valid
 */
export async function testGoogleWorkspaceConnectionAction(): Promise<{
  success: boolean;
  error?: string;
  userCount?: number;
}> {
  try {
    const { getGoogleWorkspaceCredentials } = await import(
      '../credentials/credentials.data'
    );

    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Google Workspace not connected',
      };
    }

    // Test connection
    const auth = new google.auth.JWT({
      email: credentials.serviceAccountEmail,
      key: credentials.privateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.user.security',
      ],
      subject: credentials.adminEmail,
    });

    const admin = google.admin({ version: 'directory_v1', auth });

    const response = await admin.users.list({
      customer: credentials.customerId || 'my_customer',
      maxResults: 1,
    });

    return {
      success: true,
      userCount: response.data.users?.length || 0,
    };
  } catch (error) {
    console.error('Error testing Google Workspace connection:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to test connection',
    };
  }
}

/**
 * Add a domain to Google Workspace (Public Server Action)
 *
 * This is the main action called by UI components to add a domain to Google Workspace.
 * It uses the Site Verification API to get real verification tokens.
 *
 * @param domain - Domain name to add
 * @returns Result with verification token from Site Verification API
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
        error:
          'Google Workspace not connected. Please configure Google Workspace credentials first.',
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
      console.log(
        `[Google Workspace] Domain ${domain} already exists, returning existing status`
      );

      // Get verification token from Site Verification API
      const { getVerificationTokenAction } = await import(
        './domain-verification.actions'
      );
      const tokenResult = await getVerificationTokenAction(domain);

      return {
        success: true,
        domain: {
          domainName: existingDomain.domainName || domain,
          isPrimary: existingDomain.isPrimary as boolean,
          verified: existingDomain.verified as boolean,
          creationTime: existingDomain.creationTime as string,
        },
        verificationToken:
          tokenResult.success && tokenResult.token
            ? {
                method: 'txt',
                token: tokenResult.token,
                recordName: domain,
                recordValue: tokenResult.token,
              }
            : undefined,
        alreadyExists: true,
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

    // Get verification token from Site Verification API
    const { getVerificationTokenAction } = await import(
      './domain-verification.actions'
    );
    const tokenResult = await getVerificationTokenAction(domain);

    if (!tokenResult.success || !tokenResult.token) {
      return {
        success: false,
        error: `Domain added but could not get verification token: ${tokenResult.error}`,
      };
    }

    return {
      success: true,
      domain: {
        domainName: result.domainName || domain,
        isPrimary: result.isPrimary as boolean,
        verified: result.verified as boolean,
        creationTime: result.creationTime as string,
      },
      verificationToken: {
        method: 'txt',
        token: tokenResult.token,
        recordName: domain,
        recordValue: tokenResult.token,
      },
    };
  } catch (error) {
    console.error('Error adding domain to Google Workspace:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Handle duplicate case
    if (
      errorMessage.includes('duplicate') ||
      errorMessage.includes('already exists')
    ) {
      console.log(
        `[Google Workspace] Domain ${domain} already exists (caught in error handler)`
      );
      return {
        success: true,
        alreadyExists: true,
      };
    }

    if (errorMessage.includes('invalid_grant')) {
      return {
        success: false,
        error:
          'Invalid Google Workspace credentials. Please reconnect your account.',
      };
    }

    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
      return {
        success: false,
        error:
          'Insufficient permissions. Ensure domain-wide delegation is enabled with admin.directory.domain scope.',
      };
    }

    return {
      success: false,
      error: `Failed to add domain: ${errorMessage}`,
    };
  }
}

/**
 * Remove a domain from Google Workspace (Public Server Action)
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

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

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
 * Check domain verification status in Google Workspace (Public Server Action)
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

export interface GoogleWorkspaceSetupResult {
  success: boolean;
  error?: string;
  verificationToken?: string;
  verified?: boolean;
  alreadyVerified?: boolean;
}

/**
 * Complete Google Workspace domain setup (Unified Action)
 *
 * This action handles the entire Google Workspace setup flow in one call:
 * 1. Adds domain to Google Workspace (gets verification token from result)
 * 2. Creates verification TXT record in Cloudflare
 * 3. Waits for DNS propagation (10 seconds)
 * 4. Triggers verification with Google
 * 5. Updates domain record in database
 * 6. Starts background polling if verification is pending
 *
 * @param domainId - Domain ID in database
 * @param domainName - Domain name (e.g., "example.com")
 * @param cloudflareZoneId - Cloudflare zone ID for DNS record creation
 */
export async function setupGoogleWorkspaceAction(
  domainId: string,
  domainName: string,
  cloudflareZoneId: string
): Promise<GoogleWorkspaceSetupResult> {
  try {
    const { db } = await import('@/lib/db');
    const { domains } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { createSingleDNSRecord } = await import(
      '../dns/cloudflare-record-creator'
    );
    const { verifyDomainAction } = await import(
      './domain-verification.actions'
    );
    const { getCloudflareCredentials } = await import(
      '../credentials/credentials.data'
    );

    // Step 1: Add domain to Google Workspace and get verification token
    console.log(`[Google Workspace] Starting setup for ${domainName}`);
    const addResult = await addDomainToGoogleWorkspaceAction(domainName);

    if (!addResult.success) {
      return {
        success: false,
        error: addResult.error || 'Failed to add domain to Google Workspace',
      };
    }

    // Check if domain is already verified
    if (addResult.domain?.verified) {
      console.log(`[Google Workspace] Domain ${domainName} already verified`);

      // Update database
      await db
        .update(domains)
        .set({
          googleWorkspaceStatus: 'verified',
          googleWorkspaceVerificationToken:
            addResult.verificationToken?.recordValue || null,
          googleWorkspaceVerificationMethod: 'DNS_TXT',
          googleWorkspaceAddedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(domains.id, domainId));

      return {
        success: true,
        verified: true,
        alreadyVerified: true,
        verificationToken: addResult.verificationToken?.recordValue,
      };
    }

    // Step 2: Get verification token from result (returned by addDomainToGoogleWorkspaceAction)
    const verificationToken = addResult.verificationToken?.recordValue;

    if (!verificationToken) {
      return {
        success: false,
        error: 'Could not get verification token from Google Workspace',
      };
    }

    console.log(`[Google Workspace] Got verification token for ${domainName}`);

    // Step 3: Create verification TXT record in Cloudflare
    const cfCredentials = await getCloudflareCredentials();

    if (!cfCredentials) {
      return {
        success: false,
        error: 'Cloudflare credentials not found',
      };
    }

    let databaseRecordId: string | null = null;

    try {
      // Create the TXT record in Cloudflare and save to database in one operation
      const createResult = await createSingleDNSRecord({
        zoneId: cloudflareZoneId,
        domainId,
        apiToken: cfCredentials.apiToken,
        record: {
          type: 'TXT',
          name: '@',
          content: verificationToken,
          ttl: 3600,
          metadata: {
            createdVia: 'google_workspace_setup',
            verificationType: 'domain_verification',
          },
        },
      });

      if (!createResult.success) {
        return {
          success: false,
          error: `Failed to create verification TXT record: ${createResult.error}`,
        };
      }

      databaseRecordId = createResult.databaseRecordId || null;

      console.log(
        `[Google Workspace] Created and saved verification TXT record`
      );
    } catch (error) {
      console.error('[Google Workspace] Error creating TXT record:', error);
      return {
        success: false,
        error: 'Failed to create verification TXT record in Cloudflare',
      };
    }

    // Step 4: Update database with pending verification status
    await db
      .update(domains)
      .set({
        googleWorkspaceStatus: 'pending_verification',
        googleWorkspaceVerificationToken: verificationToken,
        googleWorkspaceVerificationMethod: 'DNS_TXT',
        googleWorkspaceVerificationRecordId: databaseRecordId, // Changed from txtRecordId
        googleWorkspaceAddedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(domains.id, domainId));

    // Step 5: Wait for DNS propagation (10 seconds)
    console.log(`[Google Workspace] Waiting 10 seconds for DNS propagation...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Step 6: Trigger verification with Google
    console.log(`[Google Workspace] Triggering verification with Google...`);
    const verifyResult = await verifyDomainAction(domainName);

    if (verifyResult.success && verifyResult.verified) {
      // Verification succeeded immediately
      console.log(
        `[Google Workspace] ✅ Domain verified immediately: ${domainName}`
      );

      await db
        .update(domains)
        .set({
          googleWorkspaceStatus: 'verified',
          updatedAt: new Date(),
        })
        .where(eq(domains.id, domainId));

      return {
        success: true,
        verified: true,
        verificationToken,
      };
    }

    return {
      success: true,
      verified: false,
      verificationToken,
    };
  } catch (error) {
    console.error(
      '[Google Workspace] Error in setupGoogleWorkspaceAction:',
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Confirm manual verification in Google Workspace Admin Console
 *
 * Called after user manually clicks "Verify" in Google Admin Console.
 * Updates database to mark domain as manually verified.
 *
 * @param domainId - Domain ID to mark as verified
 * @returns Success status
 */
export async function confirmManualVerificationAction(
  domainId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Authenticate user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    const { db } = await import('@/lib/db');
    const { domains } = await import('@/lib/db/schema');
    const { eq, and } = await import('drizzle-orm');

    // Update domain to mark as manually verified
    const result = await db
      .update(domains)
      .set({
        googleWorkspaceManuallyVerified: true,
        googleWorkspaceStatus: 'verified',
        googleWorkspaceVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(domains.id, domainId), eq(domains.userId, user.id)))
      .returning();

    if (result.length === 0) {
      return {
        success: false,
        error: 'Domain not found or you do not have permission',
      };
    }

    console.log(
      `[Manual Verification] Domain ${domainId} marked as verified by user`
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error confirming manual verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
