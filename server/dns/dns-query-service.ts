/**
 * DNS Query Service for Multiple Servers (Task 4.1)
 *
 * Queries DNS records across multiple global nameservers (Google, Cloudflare, OpenDNS)
 * to verify DNS propagation status. This is used by the propagation checker to determine
 * if DNS records have propagated globally.
 *
 * Key differences from dns-lookup.ts:
 * - dns-lookup.ts: Queries system DNS (for resolution)
 * - dns-query-service.ts: Queries specific nameservers (for propagation verification)
 */

import { Resolver } from 'dns';
import { promisify } from 'util';
import type {
  DNSServerProvider,
  DNSServerQueryResult,
  MultiServerQueryResult,
} from '@/lib/types/dns';

/**
 * Public DNS nameserver pool
 * These servers are queried to verify global DNS propagation
 */
export const PUBLIC_DNS_SERVERS: Record<DNSServerProvider, string[]> = {
  google: ['8.8.8.8', '8.8.4.4'],
  cloudflare: ['1.1.1.1', '1.0.0.1'],
  opendns: ['208.67.222.222', '208.67.220.220'],
};

/**
 * Timeout for DNS queries (5 seconds per query)
 */
const DNS_QUERY_TIMEOUT = 5000;

/**
 * Get provider name from nameserver IP
 */
function getProviderFromServer(server: string): DNSServerProvider {
  for (const [provider, servers] of Object.entries(PUBLIC_DNS_SERVERS)) {
    if (servers.includes(server)) {
      return provider as DNSServerProvider;
    }
  }
  return 'google'; // Default fallback
}

/**
 * Query TXT records from a specific nameserver
 */
export async function queryTXTFromServer(
  domain: string,
  nameserver: string
): Promise<DNSServerQueryResult> {
  const startTime = Date.now();
  const provider = getProviderFromServer(nameserver);

  try {
    const resolver = new Resolver();
    resolver.setServers([nameserver]);

    // Set timeout
    const resolveTxt = promisify(resolver.resolveTxt.bind(resolver));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS query timeout')), DNS_QUERY_TIMEOUT)
    );

    const txtRecords = await Promise.race([
      resolveTxt(domain),
      timeoutPromise,
    ]);

    // Flatten TXT records (they come as string[][])
    const records = txtRecords.map((record) =>
      Array.isArray(record) ? record.join('') : record
    );

    return {
      server: nameserver,
      provider,
      success: true,
      records,
      matchesExpected: false, // Will be set later by comparison logic
      queriedAt: new Date(),
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      // Handle common DNS error codes
      if ('code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOTFOUND' || code === 'ENODATA') {
          errorMessage = 'No TXT records found';
        } else if (code === 'ETIMEOUT') {
          errorMessage = 'Query timeout';
        } else if (code === 'ESERVFAIL') {
          errorMessage = 'Server failure';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = error.message;
      }
    }

    return {
      server: nameserver,
      provider,
      success: false,
      records: [],
      matchesExpected: false,
      error: errorMessage,
      queriedAt: new Date(),
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Query MX records from a specific nameserver
 */
export async function queryMXFromServer(
  domain: string,
  nameserver: string
): Promise<DNSServerQueryResult> {
  const startTime = Date.now();
  const provider = getProviderFromServer(nameserver);

  try {
    const resolver = new Resolver();
    resolver.setServers([nameserver]);

    const resolveMx = promisify(resolver.resolveMx.bind(resolver));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS query timeout')), DNS_QUERY_TIMEOUT)
    );

    const mxRecords = await Promise.race([
      resolveMx(domain),
      timeoutPromise,
    ]);

    // Format MX records as "priority exchange" strings
    const records = mxRecords.map((mx) => `${mx.priority} ${mx.exchange}`);

    return {
      server: nameserver,
      provider,
      success: true,
      records,
      matchesExpected: false,
      queriedAt: new Date(),
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      if ('code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOTFOUND' || code === 'ENODATA') {
          errorMessage = 'No MX records found';
        } else if (code === 'ETIMEOUT') {
          errorMessage = 'Query timeout';
        } else if (code === 'ESERVFAIL') {
          errorMessage = 'Server failure';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = error.message;
      }
    }

    return {
      server: nameserver,
      provider,
      success: false,
      records: [],
      matchesExpected: false,
      error: errorMessage,
      queriedAt: new Date(),
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Query CNAME records from a specific nameserver
 */
export async function queryCNAMEFromServer(
  domain: string,
  nameserver: string
): Promise<DNSServerQueryResult> {
  const startTime = Date.now();
  const provider = getProviderFromServer(nameserver);

  try {
    const resolver = new Resolver();
    resolver.setServers([nameserver]);

    const resolveCname = promisify(resolver.resolveCname.bind(resolver));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS query timeout')), DNS_QUERY_TIMEOUT)
    );

    const cnameRecords = await Promise.race([
      resolveCname(domain),
      timeoutPromise,
    ]);

    return {
      server: nameserver,
      provider,
      success: true,
      records: cnameRecords,
      matchesExpected: false,
      queriedAt: new Date(),
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      if ('code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOTFOUND' || code === 'ENODATA') {
          errorMessage = 'No CNAME records found';
        } else if (code === 'ETIMEOUT') {
          errorMessage = 'Query timeout';
        } else if (code === 'ESERVFAIL') {
          errorMessage = 'Server failure';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = error.message;
      }
    }

    return {
      server: nameserver,
      provider,
      success: false,
      records: [],
      matchesExpected: false,
      error: errorMessage,
      queriedAt: new Date(),
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Query DNS records from a specific nameserver
 * Routes to the appropriate query function based on record type
 */
export async function queryDNSRecordFromServer(
  domain: string,
  recordType: 'TXT' | 'MX' | 'CNAME',
  nameserver: string
): Promise<DNSServerQueryResult> {
  switch (recordType) {
    case 'TXT':
      return queryTXTFromServer(domain, nameserver);
    case 'MX':
      return queryMXFromServer(domain, nameserver);
    case 'CNAME':
      return queryCNAMEFromServer(domain, nameserver);
    default:
      throw new Error(`Unsupported record type: ${recordType}`);
  }
}

/**
 * Calculate DNS propagation percentage
 * Compares server results against expected value
 */
export function calculatePropagationPercentage(
  serverResults: DNSServerQueryResult[],
  expectedValue?: string
): number {
  if (serverResults.length === 0) return 0;
  if (!expectedValue) return 0;

  // Count servers that have the expected value
  const propagatedCount = serverResults.filter((result) => {
    if (!result.success || result.records.length === 0) return false;

    // Check if any record matches the expected value
    return result.records.some((record) => {
      // Normalize values for comparison (trim whitespace, lowercase)
      const normalizedRecord = record.trim().toLowerCase();
      const normalizedExpected = expectedValue.trim().toLowerCase();

      return normalizedRecord === normalizedExpected;
    });
  }).length;

  return Math.round((propagatedCount / serverResults.length) * 100);
}

/**
 * Mark server results as matching expected value
 */
function markMatchingResults(
  serverResults: DNSServerQueryResult[],
  expectedValue?: string
): DNSServerQueryResult[] {
  if (!expectedValue) return serverResults;

  return serverResults.map((result) => ({
    ...result,
    matchesExpected:
      result.success &&
      result.records.some((record) =>
        record.trim().toLowerCase() === expectedValue.trim().toLowerCase()
      ),
  }));
}

/**
 * Query DNS records across all public nameservers
 * Queries Google, Cloudflare, and OpenDNS in parallel
 */
export async function queryDNSAcrossServers(
  domain: string,
  recordType: 'TXT' | 'MX' | 'CNAME',
  expectedValue?: string
): Promise<MultiServerQueryResult> {
  const queriedAt = new Date();

  // Get all nameserver IPs
  const allServers = Object.values(PUBLIC_DNS_SERVERS).flat();

  // Query all servers in parallel
  const queryPromises = allServers.map((server) =>
    queryDNSRecordFromServer(domain, recordType, server)
  );

  const serverResults = await Promise.all(queryPromises);

  // Mark results that match expected value
  const markedResults = markMatchingResults(serverResults, expectedValue);

  // Calculate propagation
  const propagationPercentage = calculatePropagationPercentage(
    markedResults,
    expectedValue
  );

  const propagatedServers = markedResults.filter((r) => r.matchesExpected).length;

  return {
    domain,
    recordType,
    expectedValue,
    serverResults: markedResults,
    propagationPercentage,
    propagatedServers,
    totalServers: allServers.length,
    isPropagated: propagationPercentage === 100,
    queriedAt,
  };
}
