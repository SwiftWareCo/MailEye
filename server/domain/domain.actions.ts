/**
 * Domain Server Actions
 *
 * Server Actions for domain mutations (create, update, delete)
 * Called from Client Components with userId bound from Server Component
 */

'use server';

import { connectDomain } from './domain-orchestrator';
import {
  verifyDomainNameservers,
  checkNameserversOnly,
  type NameserverVerificationResult,
} from './nameserver-verifier';
import { getCloudflareCredentials } from '../credentials/credentials.data';
import { removeDomainFromGoogleWorkspaceAction } from '../google-workspace/google-workspace.actions';
import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  DomainConnectionInput,
  DomainConnectionResult,
} from '@/lib/types/domain';

/**
 * Server Action: Connect a new domain
 * Validates, creates domain record, and returns nameserver instructions
 * Note: Does NOT automatically add to Google Workspace - user must do that via modal
 *
 * @param userId - User ID (bound from Server Component)
 * @param input - Domain connection input from form
 */
export async function connectDomainAction(
  userId: string,
  input: DomainConnectionInput
): Promise<DomainConnectionResult> {
  try {
    // Get user's Cloudflare credentials from session
    const cloudflareCredentials = await getCloudflareCredentials();

    if (!cloudflareCredentials) {
      return {
        success: false,
        error:
          'Cloudflare credentials not found. Please connect your Cloudflare account first.',
      };
    }

    // Call orchestrator to handle domain connection
    const result = await connectDomain(input, userId, cloudflareCredentials);
    return result;
  } catch (error) {
    console.error('Error in connectDomainAction:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Server Action: Delete a domain
 * Deletes database record, Cloudflare zone, and removes from Google Workspace
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to delete
 */
export async function deleteDomainAction(
  userId: string,
  domainId: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    let deletionWarning: string | undefined;

    // First, get the domain to check if it has a Cloudflare zone
    const [domain] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .limit(1);

    if (!domain) {
      return {
        success: false,
        error: 'Domain not found or you do not have permission to delete it',
      };
    }

    // If domain has a Cloudflare zone, delete DNS records and zone
    if (domain.cloudflareZoneId) {
      try {
        const cloudflareCredentials = await getCloudflareCredentials();

        if (cloudflareCredentials) {
          const { deleteZone, deleteDNSRecord } = await import(
            '@/lib/clients/cloudflare'
          );
          const { dnsRecords } = await import('@/lib/db/schema');

          // Step 1: Delete individual DNS records from Cloudflare
          try {
            // Fetch all DNS records from database for this domain
            const records = await db
              .select()
              .from(dnsRecords)
              .where(eq(dnsRecords.domainId, domainId));

            console.log(
              `[Domain] Deleting ${records.length} DNS records from Cloudflare for ${domain.domain}`
            );

            // Delete each record from Cloudflare
            for (const record of records) {
              const cloudflareRecordId =
                record.metadata &&
                typeof record.metadata === 'object' &&
                'cloudflareRecordId' in record.metadata
                  ? (record.metadata as { cloudflareRecordId?: string })
                      .cloudflareRecordId
                  : undefined;

              if (cloudflareRecordId) {
                try {
                  await deleteDNSRecord(
                    cloudflareCredentials.apiToken,
                    domain.cloudflareZoneId,
                    cloudflareRecordId
                  );
                  console.log(
                    `[Domain] Deleted DNS record ${record.recordType} ${record.name} from Cloudflare`
                  );
                } catch (recordError) {
                  console.error(
                    `[Domain] Failed to delete DNS record ${cloudflareRecordId}:`,
                    recordError
                  );
                  // Continue deleting other records even if one fails
                }
              }
            }
          } catch (recordsError) {
            console.error(
              'Error deleting individual DNS records:',
              recordsError
            );
            // Continue with zone deletion attempt
          }

          // Step 2: Try to delete the entire zone
          try {
            await deleteZone(
              cloudflareCredentials.apiToken,
              domain.cloudflareZoneId
            );
            console.log(
              `[Domain] Deleted Cloudflare zone ${domain.cloudflareZoneId} for domain ${domain.domain}`
            );
          } catch (zoneError) {
            const errorMessage =
              zoneError instanceof Error
                ? zoneError.message
                : String(zoneError);

            // Check if error is due to Cloudflare Registrar (error code 1315)
            if (
              errorMessage.includes('1315') ||
              errorMessage.includes('Cloudflare Registrar')
            ) {
              console.log(
                `[Domain] Cloudflare Registrar domain ${domain.domain} - cannot delete zone`
              );

              // Set warning message but CONTINUE to delete from database
              deletionWarning =
                'This domain was purchased through Cloudflare Registrar and cannot be deleted from Cloudflare. DNS records have been removed, and the domain has been removed from your MailEye account. It will be re-synced if you sync Cloudflare zones again.';

              // CONTINUE - don't return early! Database deletion happens below
            } else {
              // Other errors - log but continue with database deletion
              console.error('Error deleting Cloudflare zone:', zoneError);
            }
          }
        } else {
          console.warn(
            `[Domain] Could not delete Cloudflare zone - credentials not found`
          );
        }
      } catch (error) {
        console.error('Error handling Cloudflare zone:', error);
        // Continue with database deletion even if Cloudflare deletion fails
        // This prevents orphaned DB records if zone was already deleted manually
      }
    }

    // If domain was added to Google Workspace, remove it
    if (domain.googleWorkspaceStatus) {
      try {
        console.log(
          `[Domain] Removing ${domain.domain} from Google Workspace...`
        );

        // Remove Site Verification resource FIRST (before domain deletion)
        try {
          const { deleteVerificationAction } = await import(
            '../google-workspace/domain-verification.actions'
          );
          const verificationResult = await deleteVerificationAction(
            domain.domain
          );
          if (verificationResult.success) {
            console.log(
              `[Domain] ✅ Deleted verification resource for ${domain.domain}`
            );
          }
        } catch (verifyError) {
          console.warn(
            `[Domain] Could not delete verification resource:`,
            verifyError
          );
          // Not critical - continue
        }

        // Then remove domain from Google Workspace
        const result = await removeDomainFromGoogleWorkspaceAction(
          domain.domain
        );

        if (result.success) {
          console.log(
            `[Domain] ✅ Removed ${domain.domain} from Google Workspace`
          );
        } else {
          console.warn(
            `[Domain] ⚠️ Failed to remove from Google Workspace: ${
              result.error || 'Unknown error'
            }`
          );
        }
      } catch (error) {
        console.error(
          '[Domain] Error removing domain from Google Workspace:',
          error
        );
        // Continue with database deletion even if Google Workspace deletion fails
      }
    }

    // Delete domain from database (CASCADE will delete DNS records automatically)
    const result = await db
      .delete(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .returning();

    if (result.length === 0) {
      return {
        success: false,
        error: 'Failed to delete domain from database',
      };
    }

    console.log(
      `[Domain] Deleted domain ${domain.domain} from database (ID: ${domainId})`
    );

    return {
      success: true,
      warning: deletionWarning, // Show warning if Cloudflare Registrar domain
    };
  } catch (error) {
    console.error('Error deleting domain:', error);
    return {
      success: false,
      error: 'Failed to delete domain',
    };
  }
}

export async function verifyNameserversAction(
  userId: string,
  domainId: string
): Promise<NameserverVerificationResult> {
  try {
    return await verifyDomainNameservers(domainId, userId);
  } catch (error) {
    console.error('Error verifying nameservers:', error);
    return {
      success: false,
      isVerified: false,
      currentNameservers: [],
      expectedNameservers: [],
      message: 'Failed to verify nameservers',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Server Action: Check nameservers without database update (Task 2.3)
 *
 * @param domain - Domain name to check
 */
export async function checkNameserversAction(
  domain: string
): Promise<NameserverVerificationResult> {
  try {
    return await checkNameserversOnly(domain);
  } catch (error) {
    console.error('Error checking nameservers:', error);
    return {
      success: false,
      isVerified: false,
      currentNameservers: [],
      expectedNameservers: [],
      message: 'Failed to check nameservers',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Add new server action at the end
export async function addDKIMRecordDomainAction(
  userId: string,
  domainId: string,
  hostname: string,
  value: string
): Promise<{
  success: boolean;
  error?: string;
  recordId?: string;
}> {
  try {
    // Verify domain ownership
    const [domain] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .limit(1);

    if (!domain) {
      return { success: false, error: 'Domain not found or access denied' };
    }

    // Import and call the DNS action
    const { addDKIMRecordAction } = await import('../dns/dns.actions');
    return await addDKIMRecordAction(domainId, hostname, value);
  } catch (error) {
    console.error('Error in addDKIMRecordDomainAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
