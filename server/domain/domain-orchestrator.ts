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
 * Connect a new domain for a user
 * This is the main orchestrator for domain connection workflow
 *
 * Steps:
 * 1. Validate domain format and check for duplicates
 * 2. Generate verification token
 * 3. Create Cloudflare zone and get assigned nameservers
 * 4. Create database record with zone ID and nameservers
 * 5. Generate nameserver instructions based on provider
 * 6. Return domain record and instructions to UI
 *
 * Note: Google Workspace setup is now done separately via GoogleWorkspaceSetupModal
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

    // Step 4: Skip automatic Google Workspace setup - user will do this via modal

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
        googleWorkspaceStatus: null,
        googleWorkspaceVerificationToken: null,
        googleWorkspaceVerificationMethod: null,
        googleWorkspaceVerificationRecordId: null,
        googleWorkspaceAddedAt: null,
        notes: input.notes || null,
        metadata: {
          connectionInitiatedAt: new Date().toISOString(),
          provider,
          cloudflareZoneCreatedAt: cloudflareZoneId ? new Date().toISOString() : null,
          googleWorkspaceAddedAt: null,
          googleWorkspaceVerificationTxtRecordCreated: false,
        },
      })
      .returning();

    // Step 6: Generate nameserver instructions with dynamic nameservers
    const instructions = generateNameserverInstructions(
      provider as DomainProvider,
      assignedNameservers || []
    );

    // Step 7: Return success with domain and instructions
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
