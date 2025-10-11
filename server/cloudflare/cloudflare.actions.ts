/**
 * Cloudflare Server Actions
 *
 * Handles user Cloudflare account connection and credential management
 */

'use server';

import Cloudflare from 'cloudflare';
import { Account } from 'cloudflare/resources/accounts/accounts.mjs';
import { Zone } from 'cloudflare/resources/zones/zones.mjs';
import { updateUserCredentials } from '../credentials/credentials.actions';
import { getCloudflareCredentials } from '../credentials/credentials.data';
import type { CloudflareCredentials } from '@/lib/types/credentials';

/**
 * Save user's Cloudflare credentials to Stack Auth metadata
 *
 * Validates credentials by testing API access before saving
 */
export async function saveCloudflareCredentialsAction(
  apiToken: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!apiToken || !accountId) {
      return {
        success: false,
        error: 'API token and Account ID are required',
      };
    }

    // Verify credentials by testing API call
    const client = new Cloudflare({ apiToken });

    // Test 1: Can we list zones?
    try {
      await client.zones.list();
    } catch (error) {
      console.error('Invalid Cloudflare API token:', error);
      return {
        success: false,
        error: 'Invalid API token. Please verify the token has Zone:Zone Edit and Zone:DNS Edit permissions.',
      };
    }

    // Test 2: Does account ID match?
    try {
      const accountsResponse = await client.accounts.list();
      // The response has a 'result' property containing the array of accounts
      const accountsList = accountsResponse?.result || [];

      if (accountsList.length > 0) {
        const validAccount = accountsList.some((acc: Account) => acc.id === accountId);
        if (!validAccount) {
          const actualAccountId = accountsList[0]?.id;
          return {
            success: false,
            error: `Account ID does not match this API token. Your correct Account ID is: ${actualAccountId}`,
          };
        }
      }
    } catch (error) {
      // If can't list accounts, that's ok - might not have that permission
      console.warn('Could not verify account ID, proceeding anyway:', error);
    }

    // Save credentials using centralized credentials system
    const credentials: CloudflareCredentials = {
      apiToken,
      accountId,
      connectedAt: new Date().toISOString(),
    };

    const result = await updateUserCredentials({
      cloudflare: credentials,
    });

    if (!result.success) {
      return result;
    }

    console.log(`[Cloudflare] User connected Cloudflare account`);

    return { success: true };
  } catch (error) {
    console.error('Error saving Cloudflare credentials:', error);
    return {
      success: false,
      error: 'Failed to save credentials. Please try again.',
    };
  }
}

/**
 * Get user's Cloudflare credentials from Stack Auth metadata
 *
 * Returns null if not connected
 *
 * @deprecated Use getCloudflareCredentials from @/server/credentials/credentials.data instead
 */
export async function getUserCloudflareCredentials(
): Promise<{ apiToken: string; accountId: string } | null> {
  const credentials = await getCloudflareCredentials();

  if (!credentials) {
    return null;
  }

  return {
    apiToken: credentials.apiToken,
    accountId: credentials.accountId,
  };
}

/**
 * Disconnect user's Cloudflare account
 */
export async function disconnectCloudflareAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { removeServiceCredentials } = await import(
      '../credentials/credentials.actions'
    );

    const result = await removeServiceCredentials('cloudflare');

    if (result.success) {
      console.log('[Cloudflare] User disconnected Cloudflare account');
    }

    return result;
  } catch (error) {
    console.error('Error disconnecting Cloudflare:', error);
    return {
      success: false,
      error: 'Failed to disconnect Cloudflare',
    };
  }
}

/**
 * Get all Cloudflare zones for the user
 */
export async function getCloudflareZonesAction(): Promise<{
  success: boolean;
  zones?: Array<{
    id: string;
    name: string;
    status: string;
    name_servers: string[];
    created_on: string;
  }>;
  error?: string;
}> {
  try {
    const credentials = await getUserCloudflareCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Cloudflare not connected',
      };
    }

    const { listZones } = await import('@/lib/clients/cloudflare');
    const zones = await listZones(credentials.apiToken, credentials.accountId);

    return {
      success: true,
      zones: zones.map((zone: Zone) => ({
        id: zone.id,
        name: zone.name,
        status: zone.status ?? 'unknown',
        name_servers: zone.name_servers || [],
        created_on: zone.created_on,
      })),
    };
  } catch (error) {
    console.error('Error fetching Cloudflare zones:', error);
    return {
      success: false,
      error: 'Failed to fetch zones from Cloudflare',
    };
  }
}

/**
 * Delete a Cloudflare zone
 */
export async function deleteCloudflareZoneAction(
  zoneId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const credentials = await getUserCloudflareCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Cloudflare not connected',
      };
    }

    const { deleteZone } = await import('@/lib/clients/cloudflare');
    await deleteZone(credentials.apiToken, zoneId);

    console.log(`[Cloudflare] Deleted zone ${zoneId}`);

    return { success: true };
  } catch (error) {
    console.error('Error deleting Cloudflare zone:', error);
    return {
      success: false,
      error: 'Failed to delete zone from Cloudflare',
    };
  }
}

/**
 * Sync existing Cloudflare zones to database
 * This is called when user first connects Cloudflare account
 * Creates DB records for any zones that exist in Cloudflare but not in database
 */
export async function syncCloudflareZonesToDatabase(
  userId: string
): Promise<{ success: boolean; synced: number; error?: string }> {
  try {
    const credentials = await getUserCloudflareCredentials();

    if (!credentials) {
      return {
        success: false,
        synced: 0,
        error: 'Cloudflare not connected',
      };
    }

    // Get all zones from Cloudflare
    const { listZones } = await import('@/lib/clients/cloudflare');
    const zones = await listZones(credentials.apiToken, credentials.accountId);

    // Get existing domains from database
    const { db } = await import('@/lib/db');
    const { domains } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const existingDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.userId, userId));

    const existingDomainNames = new Set(existingDomains.map(d => d.domain));

    // Filter zones that don't exist in database
    const zonesToSync = zones.filter((zone: Zone) => !existingDomainNames.has(zone.name));

    if (zonesToSync.length === 0) {
      return {
        success: true,
        synced: 0,
      };
    }

    // Insert new domains for each zone (skip duplicates to avoid race condition)
    const newDomains = await db
      .insert(domains)
      .values(
        zonesToSync.map((zone: Zone) => {
          const isActive = zone.status === 'active';
          return {
            userId,
            domain: zone.name,
            provider: 'cloudflare' as const,
            cloudflareZoneId: zone.id,
            assignedNameservers: zone.name_servers || [],
            verificationStatus: isActive ? 'verified' : 'pending_nameservers',
            nameserversVerified: isActive, // Set nameserversVerified based on zone status
            lastVerifiedAt: isActive ? new Date() : null,
            isActive: true,
            healthScore: 'unknown' as const,
            metadata: {
              syncedFromCloudflare: true,
              syncedAt: new Date().toISOString(),
              cloudflareStatus: zone.status,
            },
          };
        })
      )
      .onConflictDoNothing() // Skip if domain already exists (handles race condition)
      .returning();

    console.log(`[Cloudflare] Synced ${newDomains.length} zones to database for user ${userId}`);

    return {
      success: true,
      synced: newDomains.length,
    };
  } catch (error) {
    console.error('Error syncing Cloudflare zones:', error);
    return {
      success: false,
      synced: 0,
      error: 'Failed to sync zones from Cloudflare',
    };
  }
}
