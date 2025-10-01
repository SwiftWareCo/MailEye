/**
 * Cloudflare API Client
 * Provides DNS zone and record management functionality
 */

import Cloudflare from 'cloudflare';
import { getServiceConfig } from '@/lib/config/api-keys';

let cloudflareClient: Cloudflare | null = null;

/**
 * Gets or creates a singleton Cloudflare client instance
 */
export function getCloudflareClient(): Cloudflare {
  if (!cloudflareClient) {
    const config = getServiceConfig('cloudflare');

    cloudflareClient = new Cloudflare({
      apiToken: config.apiToken,
    });
  }

  return cloudflareClient;
}

/**
 * Gets Cloudflare zone information
 */
export async function getZoneInfo(zoneId?: string) {
  const client = getCloudflareClient();
  const config = getServiceConfig('cloudflare');
  const id = zoneId || config.zoneId;

  if (!id) {
    throw new Error('Zone ID is required');
  }

  return await client.zones.get({ zone_id: id });
}

/**
 * Lists all DNS records for a zone
 */
export async function listDNSRecords(zoneId?: string) {
  const client = getCloudflareClient();
  const config = getServiceConfig('cloudflare');
  const id = zoneId || config.zoneId;

  if (!id) {
    throw new Error('Zone ID is required');
  }

  // Iterate through paginated results
  const records = [];
  for await (const record of client.dns.records.list({ zone_id: id })) {
    records.push(record);
  }
  return records;
}

/**
 * Creates a new DNS record
 */
export async function createDNSRecord(
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
  const client = getCloudflareClient();

  // Build the record object with proper typing
  const recordData: any = {
    zone_id: zoneId,
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl || 1,
  };

  if (record.priority !== undefined) {
    recordData.priority = record.priority;
  }

  if (record.proxied !== undefined) {
    recordData.proxied = record.proxied;
  }

  return await client.dns.records.create(recordData);
}

/**
 * Deletes a DNS record
 */
export async function deleteDNSRecord(zoneId: string, recordId: string) {
  const client = getCloudflareClient();

  return await client.dns.records.delete(recordId, { zone_id: zoneId });
}

/**
 * Creates a new zone in Cloudflare
 * Returns zone data including assigned nameservers
 */
export async function createZone(domainName: string) {
  const client = getCloudflareClient();
  const config = getServiceConfig('cloudflare');

  try {
    const zone = await client.zones.create({
      account: { id: config.accountId },
      name: domainName,
      type: 'full',
    });

    return zone;
  } catch (error: any) {
    const errorMessage = error.message || JSON.stringify(error);

    // Handle permission errors (403)
    if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('com.cloudflare.api.account.zone.create')) {
      throw new Error(
        `Cloudflare API token lacks required permissions to create zones.\n\n` +
        `Required permissions:\n` +
        `- Account → Account Settings → Read\n` +
        `- Account → Account Zone → Edit (CRITICAL for zone creation)\n` +
        `- Zone → Zone → Edit\n` +
        `- Zone → DNS → Edit\n\n` +
        `Create a new token with these permissions at:\n` +
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
 */
export async function getZoneNameservers(zoneId: string): Promise<string[]> {
  const client = getCloudflareClient();

  const zone = await client.zones.get({ zone_id: zoneId });
  return zone.name_servers || [];
}
