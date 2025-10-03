/**
 * SPF DNS Lookup Resolver (Task 3.2)
 *
 * Recursively resolves SPF includes to count total DNS lookups and extract IP addresses.
 * This is essential for detecting when SPF records exceed the 10-lookup limit.
 *
 * Key features:
 * - Recursive include resolution
 * - DNS lookup counting (must stay ≤ 10 per RFC 7208)
 * - Circular dependency detection
 * - IP address extraction from includes
 * - Caching to avoid duplicate queries
 */

import {
  SPFLookupResult,
  SPFIncludeChain,
  ParsedSPFRecord,
} from '@/lib/types/dns';
import { parseSPFRecord } from './spf-parser';
import {
  queryTXTRecords,
  queryARecords,
  queryAAAARecords,
  queryMXRecords,
} from '@/lib/utils/dns-lookup';

/**
 * Configuration for SPF resolution
 */
interface SPFResolverConfig {
  maxDepth?: number;        // Maximum nesting depth (default: 10)
  includeIPv6?: boolean;    // Include IPv6 addresses (default: true)
  timeout?: number;         // Timeout per DNS query in ms (default: 5000)
}

/**
 * Internal cache for DNS lookups during a resolution session
 */
type SPFCache = Map<string, string | null>;

/**
 * Main function to resolve SPF record with recursive DNS lookups
 *
 * @param domain - Domain to resolve SPF for
 * @param config - Optional configuration
 * @returns Complete SPF lookup result with all nested includes resolved
 *
 * @example
 * const result = await resolveSPFRecord('example.com');
 * console.log(`Total DNS lookups: ${result.totalLookups}`);
 * console.log(`Exceeds limit: ${result.exceedsLimit}`);
 */
export async function resolveSPFRecord(
  domain: string,
  config: SPFResolverConfig = {}
): Promise<SPFLookupResult> {
  const {
    maxDepth = 10,
    includeIPv6 = true,
  } = config;

  const errors: string[] = [];
  const warnings: string[] = [];
  const cache: SPFCache = new Map();
  const visited = new Set<string>();

  // Fetch root SPF record
  const rootSPF = await fetchSPFRecord(domain, cache);

  if (!rootSPF) {
    return {
      domain,
      ipv4Addresses: [],
      ipv6Addresses: [],
      includeChains: [],
      totalLookups: 0,
      exceedsLimit: false,
      errors: [`No SPF record found for ${domain}`],
      warnings: [],
      resolvedAt: new Date(),
    };
  }

  let parsedRecord: ParsedSPFRecord | undefined;
  try {
    parsedRecord = parseSPFRecord(domain, rootSPF);
  } catch (error) {
    errors.push(`Failed to parse SPF record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Resolve all includes recursively
  const includeChains: SPFIncludeChain[] = [];
  let totalLookups = 0;

  if (parsedRecord) {
    // Mark root domain as visited for circular detection
    visited.add(domain);

    for (const includeDomain of parsedRecord.includes) {
      const chain = await resolveIncludeChain(
        includeDomain,
        0,
        maxDepth,
        visited,
        cache,
        includeIPv6
      );
      includeChains.push(chain);
      totalLookups += chain.lookupCount;
    }

    // Count lookups from non-include mechanisms in root record
    for (const mechanism of parsedRecord.mechanisms) {
      if (['a', 'mx', 'exists', 'ptr'].includes(mechanism.type)) {
        totalLookups++;
      }
    }
  }

  // Collect all IP addresses from includes
  const allIPv4: string[] = [];
  const allIPv6: string[] = [];

  function collectIPs(chain: SPFIncludeChain) {
    allIPv4.push(...chain.ipv4);
    allIPv6.push(...chain.ipv6);
    for (const nested of chain.nestedIncludes) {
      collectIPs(nested);
    }
  }

  for (const chain of includeChains) {
    collectIPs(chain);
  }

  // Add IPs from root record
  if (parsedRecord) {
    allIPv4.push(...parsedRecord.ipv4Addresses);
    if (includeIPv6) {
      allIPv6.push(...parsedRecord.ipv6Addresses);
    }

    // Resolve "a" mechanisms in root record
    for (const mechanism of parsedRecord.mechanisms) {
      if (mechanism.type === 'a') {
        const targetDomain = mechanism.value || domain;
        const aResult = await queryARecords(targetDomain);
        if (aResult.success) {
          allIPv4.push(...aResult.records);
        }

        if (includeIPv6) {
          const aaaaResult = await queryAAAARecords(targetDomain);
          if (aaaaResult.success) {
            allIPv6.push(...aaaaResult.records);
          }
        }
      }
    }

    // Resolve "mx" mechanisms in root record
    for (const mechanism of parsedRecord.mechanisms) {
      if (mechanism.type === 'mx') {
        const targetDomain = mechanism.value || domain;
        const mxResult = await queryMXRecords(targetDomain);
        if (mxResult.success) {
          // Resolve each MX server to IPs
          for (const mx of mxResult.records) {
            const aResult = await queryARecords(mx.exchange);
            if (aResult.success) {
              allIPv4.push(...aResult.records);
            }

            if (includeIPv6) {
              const aaaaResult = await queryAAAARecords(mx.exchange);
              if (aaaaResult.success) {
                allIPv6.push(...aaaaResult.records);
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate IPs
  const uniqueIPv4 = [...new Set(allIPv4)];
  const uniqueIPv6 = [...new Set(allIPv6)];

  // Check for 10-lookup limit
  const exceedsLimit = totalLookups > 10;
  if (exceedsLimit) {
    errors.push(`SPF record exceeds 10 DNS lookup limit (${totalLookups} lookups). SPF flattening required.`);
  } else if (totalLookups >= 8) {
    warnings.push(`SPF record has ${totalLookups} DNS lookups (approaching 10 limit). Consider SPF flattening.`);
  }

  return {
    domain,
    spfRecord: rootSPF,
    parsedRecord,
    ipv4Addresses: uniqueIPv4,
    ipv6Addresses: uniqueIPv6,
    includeChains,
    totalLookups,
    exceedsLimit,
    errors,
    warnings,
    resolvedAt: new Date(),
  };
}

/**
 * Recursively resolve an SPF include chain
 *
 * @param domain - Domain to resolve
 * @param depth - Current nesting depth
 * @param maxDepth - Maximum allowed depth
 * @param visited - Set of already visited domains (for circular detection)
 * @param cache - DNS lookup cache
 * @param includeIPv6 - Whether to include IPv6 addresses
 * @returns SPF include chain with all nested includes
 */
async function resolveIncludeChain(
  domain: string,
  depth: number,
  maxDepth: number,
  visited: Set<string>,
  cache: SPFCache,
  includeIPv6: boolean
): Promise<SPFIncludeChain> {
  // Check for circular dependency
  if (visited.has(domain)) {
    return {
      domain,
      depth,
      ipv4: [],
      ipv6: [],
      lookupCount: 0, // Circular dependency doesn't add more lookups
      nestedIncludes: [],
      error: 'Circular dependency detected',
      circular: true,
    };
  }

  // Check depth limit
  if (depth >= maxDepth) {
    return {
      domain,
      depth,
      ipv4: [],
      ipv6: [],
      lookupCount: 0,
      nestedIncludes: [],
      error: 'Maximum nesting depth exceeded',
      circular: false,
    };
  }

  // Mark as visited (do NOT remove later - we need persistent circular detection)
  visited.add(domain);

  // Fetch SPF record
  const spfRecord = await fetchSPFRecord(domain, cache);

  if (!spfRecord) {
    // Keep in visited set to prevent circular attempts
    return {
      domain,
      depth,
      ipv4: [],
      ipv6: [],
      lookupCount: 1, // The include lookup itself counts
      nestedIncludes: [],
      error: 'No SPF record found',
      circular: false,
    };
  }

  // Parse SPF record
  let parsed: ParsedSPFRecord;
  try {
    parsed = parseSPFRecord(domain, spfRecord);
  } catch (error) {
    // Keep in visited set to prevent circular attempts
    return {
      domain,
      depth,
      spfRecord,
      ipv4: [],
      ipv6: [],
      lookupCount: 1,
      nestedIncludes: [],
      error: `Failed to parse SPF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      circular: false,
    };
  }

  // Start lookup count with the include mechanism itself
  let lookupCount = 1;

  // Count additional lookups from mechanisms (a, mx, exists, ptr)
  for (const mechanism of parsed.mechanisms) {
    if (['a', 'mx', 'exists', 'ptr'].includes(mechanism.type)) {
      lookupCount++;
    }
  }

  // Collect IP addresses from this record
  const ipv4: string[] = [...parsed.ipv4Addresses];
  const ipv6: string[] = includeIPv6 ? [...parsed.ipv6Addresses] : [];

  // Resolve "a" mechanisms to IPs
  for (const mechanism of parsed.mechanisms) {
    if (mechanism.type === 'a') {
      const targetDomain = mechanism.value || domain;
      const aResult = await queryARecords(targetDomain);
      if (aResult.success) {
        ipv4.push(...aResult.records);
      }

      if (includeIPv6) {
        const aaaaResult = await queryAAAARecords(targetDomain);
        if (aaaaResult.success) {
          ipv6.push(...aaaaResult.records);
        }
      }
    }
  }

  // Resolve "mx" mechanisms to IPs
  for (const mechanism of parsed.mechanisms) {
    if (mechanism.type === 'mx') {
      const targetDomain = mechanism.value || domain;
      const mxResult = await queryMXRecords(targetDomain);
      if (mxResult.success) {
        // Resolve each MX server to IPs
        for (const mx of mxResult.records) {
          const aResult = await queryARecords(mx.exchange);
          if (aResult.success) {
            ipv4.push(...aResult.records);
          }

          if (includeIPv6) {
            const aaaaResult = await queryAAAARecords(mx.exchange);
            if (aaaaResult.success) {
              ipv6.push(...aaaaResult.records);
            }
          }
        }
      }
    }
  }

  // Recursively resolve nested includes
  const nestedIncludes: SPFIncludeChain[] = [];
  for (const nestedDomain of parsed.includes) {
    const nestedChain = await resolveIncludeChain(
      nestedDomain,
      depth + 1,
      maxDepth,
      visited,
      cache,
      includeIPv6
    );
    nestedIncludes.push(nestedChain);
    lookupCount += nestedChain.lookupCount;
  }

  // DO NOT remove from visited set - we need persistent circular detection across all branches

  return {
    domain,
    depth,
    spfRecord,
    ipv4: [...new Set(ipv4)], // Deduplicate
    ipv6: [...new Set(ipv6)], // Deduplicate
    lookupCount,
    nestedIncludes,
    circular: false,
  };
}

/**
 * Fetch SPF TXT record for a domain with caching
 *
 * @param domain - Domain to query
 * @param cache - DNS cache
 * @returns SPF record string or null if not found
 */
async function fetchSPFRecord(
  domain: string,
  cache: SPFCache
): Promise<string | null> {
  // Check cache first
  if (cache.has(domain)) {
    return cache.get(domain) || null;
  }

  // Query DNS
  const txtResult = await queryTXTRecords(domain);

  if (!txtResult.success) {
    cache.set(domain, null);
    return null;
  }

  // Find SPF record (starts with "v=spf1")
  for (const txtRecord of txtResult.records) {
    // TXT records are returned as arrays of strings
    const recordStr = Array.isArray(txtRecord) ? txtRecord.join('') : txtRecord;

    if (recordStr.toLowerCase().startsWith('v=spf1')) {
      cache.set(domain, recordStr);
      return recordStr;
    }
  }

  // No SPF record found
  cache.set(domain, null);
  return null;
}

/**
 * Count total recursive DNS lookups for an SPF record
 * Quick utility for just counting lookups without full resolution
 *
 * @param domain - Domain to count lookups for
 * @returns Total DNS lookup count
 *
 * @example
 * const count = await countRecursiveLookups('example.com');
 * console.log(`Total lookups: ${count}`);
 */
export async function countRecursiveLookups(domain: string): Promise<number> {
  const result = await resolveSPFRecord(domain, { includeIPv6: false });
  return result.totalLookups;
}

/**
 * Check if an SPF record exceeds the 10-lookup limit
 *
 * @param domain - Domain to check
 * @returns true if SPF exceeds 10 lookups
 *
 * @example
 * const needsFlattening = await exceedsSPFLookupLimit('example.com');
 * if (needsFlattening) {
 *   console.log('SPF flattening required!');
 * }
 */
export async function exceedsSPFLookupLimit(domain: string): Promise<boolean> {
  const result = await resolveSPFRecord(domain, { includeIPv6: false });
  return result.exceedsLimit;
}
