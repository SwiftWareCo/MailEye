/**
 * Domain Data Layer
 *
 * Server-side data fetching for domain management
 * Uses Server Components for data fetching
 */

import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Domain } from '@/lib/types/domain';

/**
 * Get all domains for a user
 * Returns domains sorted by most recently created first
 */
export async function getUserDomains(userId: string): Promise<Domain[]> {
  try {
    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, userId),
      orderBy: [desc(domains.createdAt)],
    });

    return userDomains;
  } catch (error) {
    console.error('Error fetching user domains:', error);
    throw new Error('Failed to fetch domains');
  }
}

/**
 * Get a single domain by ID (with user ownership check)
 */
export async function getDomainById(
  domainId: string,
  userId: string
): Promise<Domain | null> {
  try {
    const domain = await db.query.domains.findFirst({
      where: (domains, { eq, and }) =>
        and(eq(domains.id, domainId), eq(domains.userId, userId)),
    });

    return domain || null;
  } catch (error) {
    console.error('Error fetching domain:', error);
    throw new Error('Failed to fetch domain');
  }
}

/**
 * Get a single domain by domain name (with user ownership check)
 */
export async function getDomainByName(
  domainName: string,
  userId: string
): Promise<Domain | null> {
  try {
    const domain = await db.query.domains.findFirst({
      where: (domains, { eq, and }) =>
        and(eq(domains.domain, domainName), eq(domains.userId, userId)),
    });

    return domain || null;
  } catch (error) {
    console.error('Error fetching domain by name:', error);
    throw new Error('Failed to fetch domain');
  }
}

/**
 * Get domain statistics for a user
 */
export async function getDomainStats(userId: string): Promise<{
  total: number;
  verified: number;
  pending: number;
  active: number;
}> {
  try {
    const userDomains = await getUserDomains(userId);

    return {
      total: userDomains.length,
      verified: userDomains.filter((d) => d.verificationStatus === 'verified')
        .length,
      pending: userDomains.filter(
        (d) =>
          d.verificationStatus === 'pending' ||
          d.verificationStatus === 'pending_nameservers' ||
          d.verificationStatus === 'verifying'
      ).length,
      active: userDomains.filter((d) => d.isActive).length,
    };
  } catch (error) {
    console.error('Error fetching domain stats:', error);
    return {
      total: 0,
      verified: 0,
      pending: 0,
      active: 0,
    };
  }
}
