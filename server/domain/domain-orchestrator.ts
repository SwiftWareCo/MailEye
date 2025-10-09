/**
 * Domain Orchestrator (Task 2.2)
 *
 * Handles domain connection workflow including validation,
 * database record creation, and nameserver instruction generation
 */

import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateDomain } from '@/lib/utils/domain-validation';
import { generateNameserverInstructions } from './nameserver-instructions';
import { createZone } from '@/lib/clients/cloudflare';
import { randomBytes } from 'crypto';
import { getDomainByName } from './domain.data';
import type {
  DomainConnectionInput,
  DomainConnectionResult,
  DomainProvider,
} from '@/lib/types/domain';

/**
 * Generate a unique verification token for domain
 */
function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Google Workspace setup result
 */
interface GoogleWorkspaceSetupResult {
  googleWorkspaceStatus: string | null;
  googleWorkspaceVerificationToken: string | null;
  googleWorkspaceVerificationMethod: string | null;
  googleWorkspaceVerificationRecordId: string | null;
  googleWorkspaceAddedAt: Date | null;
}

/**
 * Setup Google Workspace for a domain (Idempotent)
 *
 * Adds domain to Google Workspace, gets verification token, and creates TXT record
 * If domain already added to Google Workspace, returns existing status
 *
 * @param sanitizedDomain - Domain name (sanitized)
 * @param cloudflareZoneId - Cloudflare zone ID (optional, for creating TXT record)
 * @returns Google Workspace setup result
 */
async function setupGoogleWorkspaceForDomain(
  sanitizedDomain: string,
  cloudflareZoneId: string | null
): Promise<GoogleWorkspaceSetupResult> {
  let googleWorkspaceStatus: string | null = null;
  let googleWorkspaceVerificationToken: string | null = null;
  let googleWorkspaceVerificationMethod: string | null = null;
  let googleWorkspaceVerificationRecordId: string | null = null;
  let googleWorkspaceAddedAt: Date | null = null;

  try {
    const { addDomainToGoogleWorkspaceAction } = await import(
      '../google-workspace/domain-management.actions'
    );
    const { getVerificationTokenAction } = await import(
      '../google-workspace/domain-verification.actions'
    );

    // Add domain to Google Workspace (idempotent - checks if already exists)
    const gwResult = await addDomainToGoogleWorkspaceAction(sanitizedDomain);

    if (gwResult.success) {
      googleWorkspaceStatus = 'pending_verification';
      googleWorkspaceAddedAt = new Date();

      if (gwResult.alreadyExists) {
        console.log(`[Domain] Domain ${sanitizedDomain} already in Google Workspace`);
      } else {
        console.log(`[Domain] Added ${sanitizedDomain} to Google Workspace`);
      }

      // Get verification token from Site Verification API
      const tokenResult = await getVerificationTokenAction(sanitizedDomain);

      if (tokenResult.success && tokenResult.token) {
        googleWorkspaceVerificationToken = tokenResult.token;
        googleWorkspaceVerificationMethod = 'DNS_TXT';
        console.log(`[Domain] Got verification token for ${sanitizedDomain}`);

        // Create verification TXT record in Cloudflare
        if (cloudflareZoneId) {
          try {
            const { getUserCloudflareCredentials } = await import(
              '../cloudflare/cloudflare.actions'
            );
            const { createDNSRecord } = await import('@/lib/clients/cloudflare');

            const cfCredentials = await getUserCloudflareCredentials();

            if (cfCredentials) {
              const txtRecord = await createDNSRecord(
                cfCredentials.apiToken,
                cloudflareZoneId,
                {
                  type: 'TXT',
                  name: '@',
                  content: tokenResult.token,
                  ttl: 3600,
                }
              );

              googleWorkspaceVerificationRecordId = txtRecord.id;
              console.log(`[Domain] Created verification TXT record in Cloudflare`);
            }
          } catch (error) {
            console.error('Error creating verification TXT record:', error);
            // Don't fail if TXT record creation fails - user can add manually
          }
        }
      } else {
        console.warn(`[Domain] Could not get verification token: ${tokenResult.error}`);
      }
    } else {
      console.warn(`[Domain] Could not add to Google Workspace: ${gwResult.error}`);
      // Don't fail domain connection if Google Workspace integration fails
      // User can add to Google Workspace manually later
    }
  } catch (error) {
    console.error('Error adding domain to Google Workspace:', error);
    // Continue with domain creation even if Google Workspace fails
  }

  return {
    googleWorkspaceStatus,
    googleWorkspaceVerificationToken,
    googleWorkspaceVerificationMethod,
    googleWorkspaceVerificationRecordId,
    googleWorkspaceAddedAt,
  };
}

/**
 * Connect a new domain for a user
 * This is the main orchestrator for domain connection workflow
 *
 * Steps:
 * 1. Validate domain format and check for duplicates
 * 2. Generate verification token
 * 3. Create Cloudflare zone and get assigned nameservers
 * 4. Add domain to Google Workspace and setup verification (if credentials available)
 *    a. Add domain via Directory API (domains.insert)
 *    b. Get verification token via Site Verification API (webResource.getToken)
 *    c. Create verification TXT record in Cloudflare DNS
 * 5. Create database record with zone ID, nameservers, and verification status
 * 6. Start background verification polling (checks every 30s for up to 3 hours)
 * 7. Generate nameserver instructions based on provider
 * 8. Return domain record and instructions to UI
 *
 * @param input - Domain connection input
 * @param userId - User ID
 * @param cloudflareCredentials - User's Cloudflare API credentials
 */
export async function connectDomain(
  input: DomainConnectionInput,
  userId: string,
  cloudflareCredentials: { apiToken: string; accountId: string }
): Promise<DomainConnectionResult> {
  try {
    // Step 1: Validate domain
    const validation = await validateDomain(input.domain, userId);

    if (!validation.isValid || !validation.sanitizedDomain) {
      return {
        success: false,
        validationErrors: validation.errors,
      };
    }

    const sanitizedDomain = validation.sanitizedDomain;
    const provider = input.provider || 'other';

    // Step 2: Generate verification token
    const verificationToken = generateVerificationToken();

    // Step 3: Create Cloudflare zone using user's credentials
    let cloudflareZoneId: string | null = null;
    let assignedNameservers: string[] | null = null;

    try {
      const zone = await createZone(
        cloudflareCredentials.apiToken,
        cloudflareCredentials.accountId,
        sanitizedDomain
      );
      cloudflareZoneId = zone.id;
      assignedNameservers = zone.name_servers || null;
    } catch (error) {
      console.error('Error creating Cloudflare zone:', error);
      // Continue with domain creation even if Cloudflare zone creation fails
      // This allows manual zone setup later
      if (error instanceof Error) {
        return {
          success: false,
          error: `Failed to create Cloudflare zone: ${error.message}`,
        };
      }
    }

    // Step 4: Add domain to Google Workspace and setup verification (if credentials available)
    const {
      googleWorkspaceStatus,
      googleWorkspaceVerificationToken,
      googleWorkspaceVerificationMethod,
      googleWorkspaceVerificationRecordId,
      googleWorkspaceAddedAt,
    } = await setupGoogleWorkspaceForDomain(sanitizedDomain, cloudflareZoneId);

    // Step 5: Create domain record in database
    const [newDomain] = await db
      .insert(domains)
      .values({
        userId,
        domain: sanitizedDomain,
        provider,
        cloudflareZoneId,
        assignedNameservers,
        verificationStatus: 'pending_nameservers',
        verificationToken,
        isActive: true,
        healthScore: 'unknown',
        googleWorkspaceStatus,
        googleWorkspaceVerificationToken,
        googleWorkspaceVerificationMethod,
        googleWorkspaceVerificationRecordId,
        googleWorkspaceAddedAt,
        notes: input.notes || null,
        metadata: {
          connectionInitiatedAt: new Date().toISOString(),
          provider,
          cloudflareZoneCreatedAt: cloudflareZoneId ? new Date().toISOString() : null,
          googleWorkspaceAddedAt: googleWorkspaceAddedAt?.toISOString() || null,
          googleWorkspaceVerificationTxtRecordCreated: !!googleWorkspaceVerificationRecordId,
        },
      })
      .returning();

    // Step 6: Start verification polling if verification TXT record was created
    if (googleWorkspaceVerificationRecordId && googleWorkspaceStatus === 'pending_verification') {
      try {
        const { startVerificationPolling } = await import(
          '../google-workspace/verification-poller'
        );
        startVerificationPolling(newDomain.id, sanitizedDomain);
        console.log(`[Domain] Started verification polling for ${sanitizedDomain}`);
      } catch (error) {
        console.error('Error starting verification polling:', error);
        // Don't fail domain connection if polling fails to start
      }
    }

    // Step 7: Generate nameserver instructions with dynamic nameservers
    const instructions = generateNameserverInstructions(
      provider as DomainProvider,
      assignedNameservers || []
    );

    // Step 8: Return success with domain and instructions
    return {
      success: true,
      domain: newDomain,
      nameserverInstructions: instructions,
    };
  } catch (error) {
    console.error('Error connecting domain:', error);

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('unique')) {
        return {
          success: false,
          error: 'This domain is already connected',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'Failed to connect domain. Please try again.',
    };
  }
}

/**
 * Connect or resume domain setup (Idempotent version)
 *
 * This function allows the wizard to be re-run on existing domains.
 * If domain already exists for the user, it returns the existing domain
 * and allows subsequent steps (Google Workspace, DNS, Smartlead) to proceed.
 *
 * @param input - Domain connection input
 * @param userId - User ID
 * @param cloudflareCredentials - User's Cloudflare API credentials
 */
export async function connectOrResumeDomain(
  input: DomainConnectionInput,
  userId: string,
  cloudflareCredentials: { apiToken: string; accountId: string }
): Promise<DomainConnectionResult> {
  try {
    // Step 1: Validate domain with allowExisting option
    const validation = await validateDomain(input.domain, userId, {
      allowExisting: true,
    });

    if (!validation.isValid || !validation.sanitizedDomain) {
      return {
        success: false,
        validationErrors: validation.errors,
      };
    }

    const sanitizedDomain = validation.sanitizedDomain;

    // Step 2: Check if domain already exists for this user
    const existingDomain = await getDomainByName(sanitizedDomain, userId);

    if (existingDomain) {
      console.log(`[Domain] Resuming setup for existing domain: ${sanitizedDomain}`);

      // Check if Google Workspace setup is needed
      let updatedDomain = existingDomain;

      if (!existingDomain.googleWorkspaceStatus) {
        console.log(`[Domain] Google Workspace not yet configured, setting up now...`);

        // Run Google Workspace setup
        const gwSetup = await setupGoogleWorkspaceForDomain(
          sanitizedDomain,
          existingDomain.cloudflareZoneId as string
        );

        // Update domain record with Google Workspace info
        const [updated] = await db
          .update(domains)
          .set({
            googleWorkspaceStatus: gwSetup.googleWorkspaceStatus,
            googleWorkspaceVerificationToken: gwSetup.googleWorkspaceVerificationToken,
            googleWorkspaceVerificationMethod: gwSetup.googleWorkspaceVerificationMethod,
            googleWorkspaceVerificationRecordId: gwSetup.googleWorkspaceVerificationRecordId,
            googleWorkspaceAddedAt: gwSetup.googleWorkspaceAddedAt,
            updatedAt: new Date(),
          })
          .where(eq(domains.id, existingDomain.id))
          .returning();

        updatedDomain = updated;

        // Start verification polling if verification TXT record was created
        if (
          gwSetup.googleWorkspaceVerificationRecordId &&
          gwSetup.googleWorkspaceStatus === 'pending_verification'
        ) {
          try {
            const { startVerificationPolling } = await import(
              '../google-workspace/verification-poller'
            );
            startVerificationPolling(existingDomain.id, sanitizedDomain);
            console.log(`[Domain] Started verification polling for ${sanitizedDomain}`);
          } catch (error) {
            console.error('Error starting verification polling:', error);
            // Don't fail if polling fails to start
          }
        }
      } else {
        console.log(
          `[Domain] Google Workspace already configured (status: ${existingDomain.googleWorkspaceStatus})`
        );
      }

      // Return domain with nameserver instructions
      const instructions = generateNameserverInstructions(
        updatedDomain.provider as DomainProvider,
        (updatedDomain.assignedNameservers as string[]) || []
      );

      return {
        success: true,
        domain: updatedDomain,
        nameserverInstructions: instructions,
        isResuming: true, // Flag to indicate this is a resumed setup
      };
    }

    // Step 3: Domain doesn't exist - proceed with normal connection flow
    console.log(`[Domain] Creating new domain: ${sanitizedDomain}`);
    return await connectDomain(input, userId, cloudflareCredentials);
  } catch (error) {
    console.error('Error in connectOrResumeDomain:', error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'Failed to connect or resume domain. Please try again.',
    };
  }
}

/**
 * Update domain verification status
 * This will be used later when nameserver verification is implemented
 */
export async function updateDomainStatus(
  domainId: string,
  status: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(domains)
      .set({
        verificationStatus: status,
        updatedAt: new Date(),
        lastVerifiedAt: status === 'verified' ? new Date() : undefined,
      })
      .where(
        // Security: ensure user owns this domain
        and(
          eq(domains.id, domainId),
          eq(domains.userId, userId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error updating domain status:', error);
    return {
      success: false,
      error: 'Failed to update domain status',
    };
  }
}
