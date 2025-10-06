/**
 * SPF IP Address Resolution Service (Task 3.3)
 *
 * Resolves all SPF includes to their IP addresses (IPv4 and IPv6).
 * This service wraps the SPF Lookup Resolver and provides a clean interface
 * for extracting and organizing IPs by service/include.
 *
 * Key features:
 * - Extract all IPs from SPF includes
 * - Group IPs by service (Google, SendGrid, etc.)
 * - Caching layer to avoid duplicate DNS queries
 * - Support IPv6 inclusion/exclusion
 */

import {
  ResolvedInclude,
  SPFIncludeChain,
} from '@/lib/types/dns';
import { resolveSPFRecord } from './spf-lookup-resolver';

/**
 * Configuration for IP resolution
 */
export interface IPResolutionConfig {
  includeIPv6?: boolean;    // Include IPv6 addresses (default: true)
  useCache?: boolean;        // Use cache for resolved IPs (default: true)
  cacheTTL?: number;         // Cache TTL in seconds (default: 3600 = 1 hour)
}

/**
 * Result of IP resolution
 */
export interface ResolvedIPResult {
  domain: string;
  resolvedIncludes: ResolvedInclude[];
  totalIPv4Count: number;
  totalIPv6Count: number;
  lookupCount: number;
  resolvedAt: Date;
  errors: string[];
  warnings: string[];
}

/**
 * Simple in-memory cache for IP resolutions
 * In production, this could be replaced with Redis or database cache
 */
const ipResolutionCache = new Map<string, {
  result: ResolvedIPResult;
  expiresAt: Date;
}>();

/**
 * Resolve all IPs from SPF record includes
 *
 * @param domain - Domain to resolve SPF IPs for
 * @param config - Optional resolution configuration
 * @returns Complete IP resolution result with IPs grouped by include
 *
 * @example
 * const result = await resolveAllIPsFromSPF('example.com');
 * console.log(`Total IPv4: ${result.totalIPv4Count}`);
 * console.log(`Services: ${result.resolvedIncludes.map(i => i.domain).join(', ')}`);
 */
export async function resolveAllIPsFromSPF(
  domain: string,
  config: IPResolutionConfig = {}
): Promise<ResolvedIPResult> {
  const {
    includeIPv6 = true,
    useCache = true,
    cacheTTL = 3600, // 1 hour default
  } = config;

  // Check cache first
  if (useCache) {
    const cached = getCachedIPResolution(domain);
    if (cached) {
      return cached;
    }
  }

  // Resolve SPF record with DNS lookups
  const spfResult = await resolveSPFRecord(domain, { includeIPv6 });

  // Extract resolved includes
  const resolvedIncludes: ResolvedInclude[] = [];

  // Process all include chains
  for (const chain of spfResult.includeChains) {
    const resolved = extractResolvedIncludeFromChain(chain);
    resolvedIncludes.push(resolved);
  }

  // Calculate totals
  const totalIPv4Count = resolvedIncludes.reduce((sum, inc) => sum + inc.ipv4.length, 0);
  const totalIPv6Count = resolvedIncludes.reduce((sum, inc) => sum + inc.ipv6.length, 0);

  const result: ResolvedIPResult = {
    domain,
    resolvedIncludes,
    totalIPv4Count,
    totalIPv6Count,
    lookupCount: spfResult.totalLookups,
    resolvedAt: new Date(),
    errors: spfResult.errors,
    warnings: spfResult.warnings,
  };

  // Cache the result
  if (useCache) {
    cacheIPResolution(domain, result, cacheTTL);
  }

  return result;
}

/**
 * Extract ResolvedInclude from SPFIncludeChain (recursive)
 * Flattens nested includes into a single ResolvedInclude structure
 *
 * @param chain - SPF include chain
 * @returns Resolved include with all IPs and nested lookups counted
 */
function extractResolvedIncludeFromChain(chain: SPFIncludeChain): ResolvedInclude {
  // Collect all IPs from this chain and nested chains
  const allIPv4: string[] = [...chain.ipv4];
  const allIPv6: string[] = [...chain.ipv6];
  const nestedLookups = chain.lookupCount;

  // Recursively collect IPs from nested includes
  function collectFromNested(nestedChain: SPFIncludeChain) {
    allIPv4.push(...nestedChain.ipv4);
    allIPv6.push(...nestedChain.ipv6);

    for (const nested of nestedChain.nestedIncludes) {
      collectFromNested(nested);
    }
  }

  for (const nested of chain.nestedIncludes) {
    collectFromNested(nested);
  }

  // Deduplicate IPs
  const uniqueIPv4 = [...new Set(allIPv4)];
  const uniqueIPv6 = [...new Set(allIPv6)];

  return {
    domain: chain.domain,
    ipv4: uniqueIPv4,
    ipv6: uniqueIPv6,
    nestedLookups,
    error: chain.error,
  };
}

/**
 * Get cached IP resolution if available and not expired
 *
 * @param domain - Domain to check cache for
 * @returns Cached result or null if not found/expired
 */
function getCachedIPResolution(domain: string): ResolvedIPResult | null {
  const cached = ipResolutionCache.get(domain);

  if (!cached) {
    return null;
  }

  // Check if expired
  if (cached.expiresAt < new Date()) {
    ipResolutionCache.delete(domain);
    return null;
  }

  return cached.result;
}

/**
 * Cache IP resolution result
 *
 * @param domain - Domain to cache result for
 * @param result - IP resolution result to cache
 * @param ttlSeconds - Time to live in seconds
 */
function cacheIPResolution(
  domain: string,
  result: ResolvedIPResult,
  ttlSeconds: number
): void {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

  ipResolutionCache.set(domain, {
    result,
    expiresAt,
  });
}

/**
 * Clear cache for a specific domain
 *
 * @param domain - Domain to clear cache for
 */
export function clearIPResolutionCache(domain?: string): void {
  if (domain) {
    ipResolutionCache.delete(domain);
  } else {
    ipResolutionCache.clear();
  }
}

/**
 * Get cache statistics (useful for monitoring)
 *
 * @returns Cache statistics
 */
export function getIPResolutionCacheStats(): {
  size: number;
  domains: string[];
  oldestEntry?: Date;
  newestEntry?: Date;
} {
  const domains = Array.from(ipResolutionCache.keys());
  const entries = Array.from(ipResolutionCache.values());

  const expirations = entries.map(e => e.expiresAt);
  const oldestEntry = expirations.length > 0 ? new Date(Math.min(...expirations.map(d => d.getTime()))) : undefined;
  const newestEntry = expirations.length > 0 ? new Date(Math.max(...expirations.map(d => d.getTime()))) : undefined;

  return {
    size: ipResolutionCache.size,
    domains,
    oldestEntry,
    newestEntry,
  };
}

/**
 * Quick utility to check if SPF IPs have been resolved for a domain
 *
 * @param domain - Domain to check
 * @returns true if IPs are cached
 */
export function hasResolvedIPs(domain: string): boolean {
  return getCachedIPResolution(domain) !== null;
}

/**
 * Get total IP count for a domain (from cache or fresh resolution)
 *
 * @param domain - Domain to get IP count for
 * @param config - Optional resolution configuration
 * @returns IP count
 */
export async function getTotalIPCount(
  domain: string,
  config: IPResolutionConfig = {}
): Promise<{ ipv4: number; ipv6: number; total: number }> {
  const result = await resolveAllIPsFromSPF(domain, config);

  return {
    ipv4: result.totalIPv4Count,
    ipv6: result.totalIPv6Count,
    total: result.totalIPv4Count + result.totalIPv6Count,
  };
}
