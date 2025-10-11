/**
 * Cloudflare API Client
 * Provides DNS zone and record management functionality
 */

import Cloudflare from 'cloudflare';

/**
 * Creates a Cloudflare client instance with user-specific credentials
 * @param apiToken - User's Cloudflare API token
 */
export function getCloudflareClient(apiToken: string): Cloudflare {
  return new Cloudflare({
    apiToken,
  });
}

/**
 * Gets Cloudflare zone information
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID
 */
export async function getZoneInfo(apiToken: string, zoneId: string) {
  const client = getCloudflareClient(apiToken);
  return await client.zones.get({ zone_id: zoneId });
}

/**
 * Lists all DNS records for a zone
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID
 */
export async function listDNSRecords(apiToken: string, zoneId: string) {
  const client = getCloudflareClient(apiToken);

  // Iterate through paginated results
  const records = [];
  for await (const record of client.dns.records.list({ zone_id: zoneId })) {
    records.push(record);
  }
  return records;
}

/**
 * Creates a new DNS record
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID
 * @param record - DNS record details
 */
export async function createDNSRecord(
  apiToken: string,
  zoneId: string,
  record: {
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';
    name: string;
    content: string;
    ttl?: number;
    priority?: number;
    proxied?: boolean;
  }
) {
  const client = getCloudflareClient(apiToken);

  // Build the record object - TypeScript infers the correct type from parameters
  const recordData = {
    zone_id: zoneId,
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl || 1,
    ...(record.priority !== undefined && { priority: record.priority }),
    ...(record.proxied !== undefined && { proxied: record.proxied }),
  };

  return await client.dns.records.create(recordData as Parameters<typeof client.dns.records.create>[0]);
}

/**
 * Deletes a DNS record
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID
 * @param recordId - DNS record ID to delete
 */
export async function deleteDNSRecord(apiToken: string, zoneId: string, recordId: string) {
  const client = getCloudflareClient(apiToken);
  return await client.dns.records.delete(recordId, { zone_id: zoneId });
}

/**
 * Creates a new zone in Cloudflare
 * Returns zone data including assigned nameservers
 * @param apiToken - User's Cloudflare API token
 * @param accountId - User's Cloudflare Account ID
 * @param domainName - Domain name to create zone for
 */
export async function createZone(apiToken: string, accountId: string, domainName: string) {
  const client = getCloudflareClient(apiToken);

  try {
    const zone = await client.zones.create({
      account: { id: accountId },
      name: domainName,
      type: 'full',
    });

    return zone;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);

    // Handle permission errors (403)
    if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('com.cloudflare.api.account.zone.create')) {
      throw new Error(
        `Cloudflare API token lacks required permissions to create zones.\n\n` +
        `Required permissions:\n` +
        `- Zone → Zone → Edit\n` +
        `- Zone → DNS → Edit\n\n` +
        `Update your token permissions at:\n` +
        `https://dash.cloudflare.com/profile/api-tokens`
      );
    }

    // Handle domain already exists
    if (errorMessage.includes('already exists')) {
      throw new Error(`Domain ${domainName} is already added to Cloudflare. Please remove it first or use a different domain.`);
    }

    // Re-throw with original error
    throw new Error(`Failed to create Cloudflare zone for ${domainName}: ${errorMessage}`);
  }
}

/**
 * Gets nameservers for a specific zone
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID
 */
export async function getZoneNameservers(apiToken: string, zoneId: string): Promise<string[]> {
  const client = getCloudflareClient(apiToken);
  const zone = await client.zones.get({ zone_id: zoneId });
  return zone.name_servers || [];
}

/**
 * Lists all zones in the user's Cloudflare account
 * @param apiToken - User's Cloudflare API token
 * @param accountId - User's Cloudflare Account ID
 */
export async function listZones(apiToken: string, accountId: string) {
  const client = getCloudflareClient(apiToken);

  const zones = [];
  for await (const zone of client.zones.list({ account: { id: accountId } })) {
    zones.push(zone);
  }

  return zones;
}

/**
 * Deletes a zone from Cloudflare
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID to delete
 */
export async function deleteZone(apiToken: string, zoneId: string) {
  const client = getCloudflareClient(apiToken);

  try {
    return await client.zones.delete({ zone_id: zoneId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to delete zone: ${errorMessage}`);
  }
}

/**
 * Gets the current status of a Cloudflare zone
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID
 * @returns Zone status (active, pending, initializing, moved, deleted, etc.)
 */
export async function getZoneStatus(apiToken: string, zoneId: string): Promise<string> {
  const client = getCloudflareClient(apiToken);

  try {
    const zone = await client.zones.get({ zone_id: zoneId });
    return zone.status || 'unknown';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to get zone status: ${errorMessage}`);
  }
}

/**
 * Deletes all DNS records created by our app (identified by comment field)
 * Used for resetting Cloudflare Registrar domains that cannot be deleted
 * @param apiToken - User's Cloudflare API token
 * @param zoneId - Cloudflare zone ID
 * @returns Number of records deleted
 */
export async function deleteAllAppDNSRecords(apiToken: string, zoneId: string): Promise<number> {
  try {
    const allRecords = await listDNSRecords(apiToken, zoneId);

    // Filter records created by our app (check comment field or tags)
    // We'll identify our records by checking for specific comment patterns
    const ourRecords = allRecords.filter(record => {
      // Check if record has a comment indicating it was created by our app
      // Using type assertion with Record to access comment property safely
      const recordWithComment = record as unknown as Record<string, unknown>;
      const comment = (recordWithComment.comment as string) || '';
      return comment.includes('maileye') ||
             comment.includes('Created by MailEye') ||
             // Also check for specific record types we create
             (record.type === 'TXT' && (
               (record.content as string).includes('google-site-verification') ||
               (record.content as string).includes('v=DKIM1')
             )) ||
             (record.type === 'CNAME' && (record.content as string).includes('ghs.googlehosted.com'));
    });

    // Delete each record
    let deletedCount = 0;
    for (const record of ourRecords) {
      try {
        await deleteDNSRecord(apiToken, zoneId, record.id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete DNS record ${record.id}:`, error);
        // Continue deleting other records even if one fails
      }
    }

    return deletedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to delete app DNS records: ${errorMessage}`);
  }
}
