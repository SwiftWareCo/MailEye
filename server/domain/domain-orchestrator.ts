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
 * 2. Create database record with pending_nameservers status
 * 3. Generate nameserver instructions based on provider
 * 4. Return domain record and instructions to UI
 */
export async function connectDomain(
  input: DomainConnectionInput,
  userId: string
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

    // Step 3: Create domain record in database
    const [newDomain] = await db
      .insert(domains)
      .values({
        userId,
        domain: sanitizedDomain,
        provider,
        verificationStatus: 'pending_nameservers',
        verificationToken,
        isActive: true,
        healthScore: 'unknown',
        notes: input.notes || null,
        metadata: {
          connectionInitiatedAt: new Date().toISOString(),
          provider,
        },
      })
      .returning();

    // Step 4: Generate nameserver instructions
    const instructions = generateNameserverInstructions(provider as DomainProvider);

    // Step 5: Return success with domain and instructions
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
