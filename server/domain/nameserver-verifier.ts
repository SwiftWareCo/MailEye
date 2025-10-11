/**
 * Nameserver Verification Service (Task 2.3)
 *
 * Verifies that domains have nameservers pointing to Cloudflare
 * before proceeding with DNS configuration
 */

import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  queryNameservers,
  areNameserversCloudflare,
  CLOUDFLARE_NAMESERVERS,
} from '@/lib/utils/dns-lookup';
import type { Domain } from '@/lib/types/domain';

/**
 * Nameserver verification result
 */
export interface NameserverVerificationResult {
  success: boolean;
  isVerified: boolean;
  currentNameservers: string[];
  expectedNameservers: readonly string[];
  message: string;
  domain?: Domain;
  error?: string;
}

/**
 * Verify that a domain's nameservers point to Cloudflare
 *
 * This function:
 * 1. Queries the domain's current nameservers via DNS lookup
 * 2. Checks if they include Cloudflare nameservers
 * 3. Updates the domain status in database if verified
 * 4. Returns verification result with current state
 *
 * @param domainId - UUID of the domain to verify
 * @param userId - User ID for authorization
 * @returns Verification result with status and nameserver details
 */
export async function verifyDomainNameservers(
  domainId: string,
  userId: string
): Promise<NameserverVerificationResult> {
  try {
    // Step 1: Fetch domain from database
    const [domainRecord] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .limit(1);

    if (!domainRecord) {
      return {
        success: false,
        isVerified: false,
        currentNameservers: [],
        expectedNameservers: CLOUDFLARE_NAMESERVERS,
        message: 'Domain not found',
        error: 'Domain not found or you do not have permission to access it',
      };
    }

    // Step 2: Query current nameservers via DNS
    const nsQuery = await queryNameservers(domainRecord.domain);

    if (!nsQuery.success) {
      return {
        success: true, // Request succeeded, but verification failed
        isVerified: false,
        currentNameservers: [],
        expectedNameservers: CLOUDFLARE_NAMESERVERS,
        message: nsQuery.error || 'Failed to query nameservers',
        domain: domainRecord,
      };
    }

    // Step 3: Check if nameservers point to Cloudflare
    const isCloudflare = areNameserversCloudflare(nsQuery.nameservers);

    if (!isCloudflare) {
      // Show current nameservers and propagation info
      const currentNS = nsQuery.nameservers.slice(0, 2).join(', ');
      return {
        success: true,
        isVerified: false,
        currentNameservers: nsQuery.nameservers,
        expectedNameservers: CLOUDFLARE_NAMESERVERS,
        message: `Still detecting old nameservers (${currentNS}). DNS changes can take up to 48 hours to propagate worldwide. Check back later.`,
        domain: domainRecord,
      };
    }

    // Step 4: Update domain status to verified (both fields for consistency)
    const [updatedDomain] = await db
      .update(domains)
      .set({
        verificationStatus: 'verified',
        nameserversVerified: true, // Set both fields for consistency
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...(domainRecord.metadata as object),
          nameservers: nsQuery.nameservers,
          verifiedAt: new Date().toISOString(),
        },
      })
      .where(
        and(eq(domains.id, domainId), eq(domains.userId, userId))
      )
      .returning();

    return {
      success: true,
      isVerified: true,
      currentNameservers: nsQuery.nameservers,
      expectedNameservers: CLOUDFLARE_NAMESERVERS,
      message: 'Nameservers verified successfully! Domain is ready for DNS configuration.',
      domain: updatedDomain,
    };
  } catch (error) {
    console.error('Error verifying nameservers:', error);

    if (error instanceof Error) {
      return {
        success: false,
        isVerified: false,
        currentNameservers: [],
        expectedNameservers: CLOUDFLARE_NAMESERVERS,
        message: 'Failed to verify nameservers',
        error: error.message,
      };
    }

    return {
      success: false,
      isVerified: false,
      currentNameservers: [],
      expectedNameservers: CLOUDFLARE_NAMESERVERS,
      message: 'Failed to verify nameservers',
      error: 'Unknown error occurred during verification',
    };
  }
}

/**
 * Check nameservers without updating database
 * Useful for polling/checking status before committing to database
 *
 * @param domain - Domain name to check
 * @returns Verification result (does not update database)
 */
export async function checkNameserversOnly(
  domain: string
): Promise<NameserverVerificationResult> {
  try {
    // Query current nameservers
    const nsQuery = await queryNameservers(domain);

    if (!nsQuery.success) {
      return {
        success: true,
        isVerified: false,
        currentNameservers: [],
        expectedNameservers: CLOUDFLARE_NAMESERVERS,
        message: nsQuery.error || 'Failed to query nameservers',
      };
    }

    // Check if nameservers point to Cloudflare
    const isCloudflare = areNameserversCloudflare(nsQuery.nameservers);

    if (!isCloudflare) {
      const currentNS = nsQuery.nameservers.slice(0, 2).join(', ');
      return {
        success: true,
        isVerified: false,
        currentNameservers: nsQuery.nameservers,
        expectedNameservers: CLOUDFLARE_NAMESERVERS,
        message: `Still detecting old nameservers (${currentNS}). DNS changes can take up to 48 hours to propagate worldwide. Check back later.`,
      };
    }

    return {
      success: true,
      isVerified: true,
      currentNameservers: nsQuery.nameservers,
      expectedNameservers: CLOUDFLARE_NAMESERVERS,
      message: 'Nameservers are pointing to Cloudflare!',
    };
  } catch (error) {
    console.error('Error checking nameservers:', error);

    if (error instanceof Error) {
      return {
        success: false,
        isVerified: false,
        currentNameservers: [],
        expectedNameservers: CLOUDFLARE_NAMESERVERS,
        message: 'Failed to check nameservers',
        error: error.message,
      };
    }

    return {
      success: false,
      isVerified: false,
      currentNameservers: [],
      expectedNameservers: CLOUDFLARE_NAMESERVERS,
      message: 'Failed to check nameservers',
      error: 'Unknown error occurred',
    };
  }
}

/**
 * Batch verify multiple domains
 * Useful for dashboard refresh or background jobs
 *
 * @param domainIds - Array of domain UUIDs to verify
 * @param userId - User ID for authorization
 * @returns Array of verification results
 */
export async function batchVerifyNameservers(
  domainIds: string[],
  userId: string
): Promise<NameserverVerificationResult[]> {
  const results: NameserverVerificationResult[] = [];

  // Process domains in parallel (max 5 concurrent to avoid overwhelming DNS servers)
  const batchSize = 5;
  for (let i = 0; i < domainIds.length; i += batchSize) {
    const batch = domainIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((domainId) => verifyDomainNameservers(domainId, userId))
    );
    results.push(...batchResults);
  }

  return results;
}
