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
import { getUserCloudflareCredentials } from '../cloudflare/cloudflare.actions';
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
    const cloudflareCredentials = await getUserCloudflareCredentials();

    if (!cloudflareCredentials) {
      return {
        success: false,
        error: 'Cloudflare credentials not found. Please connect your Cloudflare account first.',
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
 * Deletes both the database record AND the Cloudflare zone
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to delete
 */
export async function deleteDomainAction(
  userId: string,
  domainId: string
): Promise<{ success: boolean; error?: string }> {
  try {
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

    // If domain has a Cloudflare zone, delete it first
    if (domain.cloudflareZoneId) {
      try {
        const cloudflareCredentials = await getUserCloudflareCredentials();

        if (cloudflareCredentials) {
          const { deleteZone } = await import('@/lib/clients/cloudflare');
          await deleteZone(cloudflareCredentials.apiToken, domain.cloudflareZoneId);
          console.log(`[Domain] Deleted Cloudflare zone ${domain.cloudflareZoneId} for domain ${domain.domain}`);
        } else {
          console.warn(`[Domain] Could not delete Cloudflare zone - credentials not found`);
        }
      } catch (error) {
        console.error('Error deleting Cloudflare zone:', error);
        // Continue with database deletion even if Cloudflare deletion fails
        // This prevents orphaned DB records if zone was already deleted manually
      }
    }

    // Delete domain from database
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

    console.log(`[Domain] Deleted domain ${domain.domain} (ID: ${domainId})`);

    return { success: true };
  } catch (error) {
    console.error('Error deleting domain:', error);
    return {
      success: false,
      error: 'Failed to delete domain',
    };
  }
}

/**
 * Server Action: Update domain notes
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to update
 * @param notes - New notes value
 */
export async function updateDomainNotesAction(
  userId: string,
  domainId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(domains)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error('Error updating domain notes:', error);
    return {
      success: false,
      error: 'Failed to update notes',
    };
  }
}

/**
 * Server Action: Toggle domain active status
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to update
 * @param isActive - New active status
 */
export async function toggleDomainActiveAction(
  userId: string,
  domainId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(domains)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error('Error toggling domain status:', error);
    return {
      success: false,
      error: 'Failed to update domain status',
    };
  }
}

/**
 * Server Action: Verify domain nameservers (Task 2.3)
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to verify
 */
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
