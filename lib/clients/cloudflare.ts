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

  return await client.zones.get({ zone_id: id });
}

/**
 * Lists all DNS records for a zone
 */
export async function listDNSRecords(zoneId?: string) {
  const client = getCloudflareClient();
  const config = getServiceConfig('cloudflare');
  const id = zoneId || config.zoneId;

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
 */
export async function createZone(domainName: string) {
  const client = getCloudflareClient();
  const config = getServiceConfig('cloudflare');

  return await client.zones.create({
    account: { id: config.accountId },
    name: domainName,
    type: 'full',
  });
}
