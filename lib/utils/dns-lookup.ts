/**
 * DNS Lookup Utilities (Task 2.3)
 *
 * Provides DNS query functionality for nameserver verification
 * and DNS record checking
 */

import { Resolver } from 'dns';
import { promisify } from 'util';

/**
 * Cloudflare nameservers that domains should point to
 */
export const CLOUDFLARE_NAMESERVERS = [
  'aron.ns.cloudflare.com',
  'june.ns.cloudflare.com',
] as const;

/**
 * DNS query result for nameservers
 */
export interface NameserverQueryResult {
  success: boolean;
  nameservers: string[];
  error?: string;
}

/**
 * DNS query result for any record type
 */
export interface DNSQueryResult<T = unknown> {
  success: boolean;
  records: T[];
  error?: string;
}

/**
 * Query nameservers for a domain
 * Uses Node.js dns module to resolve NS records
 */
export async function queryNameservers(
  domain: string
): Promise<NameserverQueryResult> {
  try {
    const resolver = new Resolver();
    const resolveNs = promisify(resolver.resolveNs.bind(resolver));

    // Query NS records
    const nameservers = await resolveNs(domain);

    // Normalize nameservers (remove trailing dots, convert to lowercase)
    const normalizedNameservers = nameservers.map((ns) =>
      ns.toLowerCase().replace(/\.$/, '')
    );

    return {
      success: true,
      nameservers: normalizedNameservers,
    };
  } catch (error) {
    // Handle DNS lookup errors
    if (error instanceof Error) {
      // ENOTFOUND means no NS records found
      if ('code' in error && error.code === 'ENOTFOUND') {
        return {
          success: false,
          nameservers: [],
          error: 'Domain not found. Please verify the domain name is correct.',
        };
      }

      // ENODATA means domain exists but no NS records
      if ('code' in error && error.code === 'ENODATA') {
        return {
          success: false,
          nameservers: [],
          error: 'No nameservers configured for this domain yet.',
        };
      }

      // ESERVFAIL means DNS server failed or is returning conflicting data
      // This is VERY common during nameserver propagation!
      if ('code' in error && error.code === 'ESERVFAIL') {
        return {
          success: false,
          nameservers: [],
          error: 'Nameservers are still propagating. DNS changes can take 5 minutes to 48 hours. Please try again later.',
        };
      }

      // ETIMEOUT means DNS query timed out
      if ('code' in error && error.code === 'ETIMEOUT') {
        return {
          success: false,
          nameservers: [],
          error: 'DNS lookup timed out. This can happen during propagation. Please try again in a few minutes.',
        };
      }

      return {
        success: false,
        nameservers: [],
        error: `DNS lookup error: ${error.message}. If you just updated nameservers, they may still be propagating.`,
      };
    }

    return {
      success: false,
      nameservers: [],
      error: 'Unable to verify nameservers. Please try again.',
    };
  }
}

/**
 * Check if domain's nameservers point to Cloudflare
 * Returns true if at least one Cloudflare nameserver is detected
 */
export function areNameserversCloudflare(nameservers: string[]): boolean {
  if (nameservers.length === 0) return false;

  // Check if any nameserver ends with cloudflare.com
  const hasCloudflareNS = nameservers.some((ns) =>
    ns.endsWith('cloudflare.com')
  );

  return hasCloudflareNS;
}

/**
 * Query TXT records for a domain
 * Used for SPF, DKIM, DMARC verification
 */
export async function queryTXTRecords(
  domain: string
): Promise<DNSQueryResult<string[]>> {
  try {
    const resolver = new Resolver();
    const resolveTxt = promisify(resolver.resolveTxt.bind(resolver));

    const txtRecords = await resolveTxt(domain);

    return {
      success: true,
      records: txtRecords,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        records: [],
        error: error.message,
      };
    }

    return {
      success: false,
      records: [],
      error: 'Unknown DNS TXT query error',
    };
  }
}

/**
 * Query MX records for a domain
 * Used for email configuration verification
 */
export async function queryMXRecords(
  domain: string
): Promise<DNSQueryResult<{ exchange: string; priority: number }>> {
  try {
    const resolver = new Resolver();
    const resolveMx = promisify(resolver.resolveMx.bind(resolver));

    const mxRecords = await resolveMx(domain);

    return {
      success: true,
      records: mxRecords,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        records: [],
        error: error.message,
      };
    }

    return {
      success: false,
      records: [],
      error: 'Unknown DNS MX query error',
    };
  }
}

/**
 * Query CNAME records for a domain/subdomain
 * Used for tracking domain verification
 */
export async function queryCNAMERecords(
  domain: string
): Promise<DNSQueryResult<string>> {
  try {
    const resolver = new Resolver();
    const resolveCname = promisify(resolver.resolveCname.bind(resolver));

    const cnameRecords = await resolveCname(domain);

    return {
      success: true,
      records: cnameRecords,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        records: [],
        error: error.message,
      };
    }

    return {
      success: false,
      records: [],
      error: 'Unknown DNS CNAME query error',
    };
  }
}

/**
 * Query A records (IPv4) for a domain
 * Used for SPF "a" mechanism resolution
 */
export async function queryARecords(
  domain: string
): Promise<DNSQueryResult<string>> {
  try {
    const resolver = new Resolver();
    const resolve4 = promisify(resolver.resolve4.bind(resolver));

    const aRecords = await resolve4(domain);

    return {
      success: true,
      records: aRecords,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        records: [],
        error: error.message,
      };
    }

    return {
      success: false,
      records: [],
      error: 'Unknown DNS A query error',
    };
  }
}

/**
 * Query AAAA records (IPv6) for a domain
 * Used for SPF "a" mechanism resolution (IPv6)
 */
export async function queryAAAARecords(
  domain: string
): Promise<DNSQueryResult<string>> {
  try {
    const resolver = new Resolver();
    const resolve6 = promisify(resolver.resolve6.bind(resolver));

    const aaaaRecords = await resolve6(domain);

    return {
      success: true,
      records: aaaaRecords,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        records: [],
        error: error.message,
      };
    }

    return {
      success: false,
      records: [],
      error: 'Unknown DNS AAAA query error',
    };
  }
}
