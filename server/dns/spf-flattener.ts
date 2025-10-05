/**
 * SPF Record Flattening Service (Task 3.4)
 *
 * Flattens SPF records by replacing includes with resolved IP addresses.
 * This reduces DNS lookups from potentially 10+ to 0, solving the SPF 10-lookup limit.
 *
 * Key features:
 * - Replace includes with IP addresses
 * - Validate 512-character DNS TXT record limit
 * - Store flattened records in database
 * - Support for preserving specific includes
 * - Character and lookup count optimization
 */

import {
  SPFFlatteningConfig,
  FlattenedSPFResult,
  ResolvedInclude,
} from '@/lib/types/dns';
import { resolveAllIPsFromSPF } from './spf-ip-resolver';
import { validateSPFSyntax, parseSPFRecord } from './spf-parser';
import { db } from '@/lib/db';
import { spfRecords } from '@/lib/db/schema/spf-dmarc';
import { eq } from 'drizzle-orm';

/**
 * Maximum character limit for DNS TXT records
 */
const DNS_TXT_CHAR_LIMIT = 512;

/**
 * Maximum DNS lookups allowed in SPF (RFC 7208)
 */
const MAX_SPF_LOOKUPS = 10;

/**
 * Flatten an SPF record by replacing includes with IP addresses
 *
 * @param config - SPF flattening configuration
 * @returns Flattened SPF result with validation and metadata
 *
 * @example
 * const result = await flattenSPFRecord({
 *   domain: 'example.com',
 *   originalSPF: 'v=spf1 include:_spf.google.com include:sendgrid.net ~all',
 *   ipv6Support: true,
 * });
 * console.log(result.flattenedRecord); // 'v=spf1 ip4:x.x.x.x ip4:y.y.y.y ~all'
 */
export async function flattenSPFRecord(
  config: SPFFlatteningConfig
): Promise<FlattenedSPFResult> {
  const {
    domain,
    originalSPF,
    additionalIncludes = [],
    preserveIncludes = [],
    removeIncludes = [],
    ipv6Support,
  } = config;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Validate original SPF record
  const originalValidation = validateSPFSyntax(originalSPF);

  // Step 2: Resolve all IPs from includes to get accurate lookup count
  const resolvedIPs = await resolveAllIPsFromSPF(domain, {
    includeIPv6: ipv6Support,
  });

  const lookupCountBefore = resolvedIPs.lookupCount;

  if (!originalValidation.isValid) {
    errors.push(...originalValidation.errors);
  }
  warnings.push(...originalValidation.warnings);

  // Propagate resolution errors/warnings
  errors.push(...resolvedIPs.errors);
  warnings.push(...resolvedIPs.warnings);

  // Step 3: Build flattened record
  const flattenedRecord = buildFlattenedRecord(
    originalSPF,
    resolvedIPs.resolvedIncludes,
    {
      additionalIncludes,
      preserveIncludes,
      removeIncludes,
    }
  );

  // Step 4: Validate flattened record
  const flattenedValidation = validateFlattenedSPF(flattenedRecord);

  if (!flattenedValidation.valid) {
    errors.push(...flattenedValidation.errors);
  }
  warnings.push(...flattenedValidation.warnings);

  // Step 5: Count lookups after flattening
  const lookupCountAfter = validateSPFSyntax(flattenedRecord).lookupCount;

  // Step 6: Extract all IP addresses
  const allIPv4: string[] = [];
  const allIPv6: string[] = [];

  for (const resolved of resolvedIPs.resolvedIncludes) {
    // Skip if this include should be removed
    if (removeIncludes.includes(resolved.domain)) {
      continue;
    }

    // Skip if this include should be preserved (not flattened)
    if (preserveIncludes.includes(resolved.domain)) {
      continue;
    }

    allIPv4.push(...resolved.ipv4);
    allIPv6.push(...resolved.ipv6);
  }

  const result: FlattenedSPFResult = {
    success: errors.length === 0,
    flattenedRecord,
    originalRecord: originalSPF,
    lookupCountBefore,
    lookupCountAfter,
    ipv4Addresses: [...new Set(allIPv4)],
    ipv6Addresses: [...new Set(allIPv6)],
    resolvedIncludes: resolvedIPs.resolvedIncludes,
    characterCount: flattenedRecord.length,
    errors,
    warnings,
    timestamp: new Date(),
  };

  return result;
}

/**
 * Build flattened SPF record from resolved includes
 *
 * @param originalSPF - Original SPF record
 * @param resolvedIncludes - Resolved includes with IPs
 * @param options - Flattening options
 * @returns Flattened SPF string
 */
function buildFlattenedRecord(
  originalSPF: string,
  resolvedIncludes: ResolvedInclude[],
  options: {
    additionalIncludes?: string[];
    preserveIncludes?: string[];
    removeIncludes?: string[];
  }
): string {
  const { additionalIncludes = [], preserveIncludes = [], removeIncludes = [] } = options;

  // Parse original SPF to extract qualifiers and non-include mechanisms
  const parsed = parseSPFRecord('flattening', originalSPF);

  // Start with SPF version
  const parts: string[] = ['v=spf1'];

  // Add preserved includes (not flattened)
  for (const includeDomain of preserveIncludes) {
    if (removeIncludes.includes(includeDomain)) {
      continue; // Skip if also in removeIncludes
    }

    // Find the original include mechanism to preserve qualifier
    const originalInclude = parsed.mechanisms.find(
      m => m.type === 'include' && m.value === includeDomain
    );

    const qualifier = originalInclude?.qualifier !== '+' ? originalInclude?.qualifier || '' : '';
    parts.push(`${qualifier}include:${includeDomain}`);
  }

  // Add additional includes
  for (const includeDomain of additionalIncludes) {
    if (removeIncludes.includes(includeDomain)) {
      continue;
    }
    parts.push(`include:${includeDomain}`);
  }

  // Collect all IPs from resolved includes (excluding preserved/removed)
  const allIPv4: string[] = [];
  const allIPv6: string[] = [];

  for (const resolved of resolvedIncludes) {
    // Skip preserved or removed includes
    if (preserveIncludes.includes(resolved.domain) || removeIncludes.includes(resolved.domain)) {
      continue;
    }

    allIPv4.push(...resolved.ipv4);
    allIPv6.push(...resolved.ipv6);
  }

  // Deduplicate IPs
  const uniqueIPv4 = [...new Set(allIPv4)];
  const uniqueIPv6 = [...new Set(allIPv6)];

  // Add IPv4 addresses
  for (const ip of uniqueIPv4) {
    parts.push(`ip4:${ip}`);
  }

  // Add IPv6 addresses
  for (const ip of uniqueIPv6) {
    parts.push(`ip6:${ip}`);
  }

  // Add non-include, non-ip mechanisms from original (a, mx, etc.)
  for (const mechanism of parsed.mechanisms) {
    if (['include', 'ip4', 'ip6', 'all'].includes(mechanism.type)) {
      continue; // Skip includes, IPs, and 'all' (we'll add 'all' at the end)
    }

    const qualifier = mechanism.qualifier !== '+' ? mechanism.qualifier : '';
    parts.push(`${qualifier}${mechanism.raw.replace(/^[+\-~?]/, '')}`);
  }

  // Add 'all' mechanism at the end (preserve original qualifier)
  const allQualifier = parsed.allQualifier || '~';
  parts.push(`${allQualifier}all`);

  return parts.join(' ');
}

/**
 * Validate flattened SPF record
 *
 * @param flattenedRecord - Flattened SPF string
 * @returns Validation result
 */
function validateFlattenedSPF(flattenedRecord: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check character limit
  const characterCount = flattenedRecord.length;
  if (characterCount > DNS_TXT_CHAR_LIMIT) {
    errors.push(
      `Flattened SPF record exceeds 512-character limit (${characterCount} chars). ` +
      `Consider removing IPv6 support or using SPF includes for some services.`
    );
  } else if (characterCount > DNS_TXT_CHAR_LIMIT * 0.9) {
    warnings.push(
      `Flattened SPF record is approaching 512-character limit (${characterCount}/512 chars)`
    );
  }

  // Validate syntax
  const syntaxValidation = validateSPFSyntax(flattenedRecord);
  if (!syntaxValidation.isValid) {
    errors.push(...syntaxValidation.errors);
  }

  // Check lookup count (should be minimal after flattening)
  if (syntaxValidation.lookupCount > 3) {
    warnings.push(
      `Flattened SPF still has ${syntaxValidation.lookupCount} DNS lookups. ` +
      `Consider flattening more includes.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Store flattened SPF record in database
 *
 * @param domainId - Domain ID
 * @param result - Flattened SPF result
 * @returns Database record ID
 */
export async function storeFlattenedSPF(
  domainId: string,
  result: FlattenedSPFResult
): Promise<string> {
  // Check if SPF record already exists for this domain
  const existing = await db
    .select()
    .from(spfRecords)
    .where(eq(spfRecords.domainId, domainId))
    .limit(1);

  // Prepare expanded IPs for storage
  const expandedIps = {
    ipv4: result.ipv4Addresses,
    ipv6: result.ipv6Addresses,
    resolvedIncludes: result.resolvedIncludes.map(inc => ({
      domain: inc.domain,
      ipv4Count: inc.ipv4.length,
      ipv6Count: inc.ipv6.length,
      lookups: inc.nestedLookups,
      error: inc.error,
    })),
  };

  const spfData = {
    domainId,
    rawRecord: result.originalRecord,
    flattenedRecord: result.flattenedRecord,
    isFlattened: true,
    mechanismCount: result.lookupCountAfter,
    includeCount: result.resolvedIncludes.length,
    lookupCount: result.lookupCountAfter,
    isValid: result.success,
    validationErrors: result.errors.length > 0 ? result.errors : null,
    lastValidatedAt: result.timestamp,
    flatteningStrategy: 'ip_expansion',
    expandedIps,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    // Update existing record
    await db
      .update(spfRecords)
      .set(spfData)
      .where(eq(spfRecords.id, existing[0].id));

    return existing[0].id;
  } else {
    // Insert new record
    const [inserted] = await db
      .insert(spfRecords)
      .values(spfData)
      .returning({ id: spfRecords.id });

    return inserted.id;
  }
}

/**
 * Get flattened SPF record from database
 *
 * @param domainId - Domain ID
 * @returns Flattened SPF result or null if not found
 */
export async function getFlattenedSPF(domainId: string): Promise<FlattenedSPFResult | null> {
  const [record] = await db
    .select()
    .from(spfRecords)
    .where(eq(spfRecords.domainId, domainId))
    .limit(1);

  if (!record || !record.isFlattened) {
    return null;
  }

  const expandedIps = record.expandedIps as {
    ipv4: string[];
    ipv6: string[];
    resolvedIncludes: Array<{
      domain: string;
      ipv4Count: number;
      ipv6Count: number;
      lookups: number;
      error?: string;
    }>;
  };

  // Reconstruct ResolvedInclude[] from stored data
  const resolvedIncludes: ResolvedInclude[] = expandedIps.resolvedIncludes.map(inc => ({
    domain: inc.domain,
    ipv4: [], // We don't store individual IPs per include, only totals
    ipv6: [],
    nestedLookups: inc.lookups,
    error: inc.error,
  }));

  return {
    success: record.isValid,
    flattenedRecord: record.flattenedRecord || '',
    originalRecord: record.rawRecord,
    lookupCountBefore: record.includeCount,
    lookupCountAfter: record.lookupCount,
    ipv4Addresses: expandedIps.ipv4,
    ipv6Addresses: expandedIps.ipv6,
    resolvedIncludes,
    characterCount: record.flattenedRecord?.length || 0,
    errors: (record.validationErrors as string[]) || [],
    warnings: [],
    timestamp: record.lastValidatedAt || record.createdAt,
  };
}

/**
 * Calculate optimal flattening strategy
 * Determines if flattening is beneficial and suggests best approach
 *
 * @param domain - Domain to analyze
 * @returns Flattening recommendation
 */
export async function analyzeFlatteningBenefit(domain: string): Promise<{
  shouldFlatten: boolean;
  reason: string;
  estimatedCharacterCount: number;
  estimatedLookupReduction: number;
  recommendations: string[];
}> {
  const resolvedIPs = await resolveAllIPsFromSPF(domain);

  const totalIPs = resolvedIPs.totalIPv4Count + resolvedIPs.totalIPv6Count;
  const lookupCount = resolvedIPs.lookupCount;

  // Estimate character count after flattening
  // Format: "v=spf1 ip4:x.x.x.x/xx " (roughly 20 chars per IPv4, 30 per IPv6)
  const estimatedIPv4Chars = resolvedIPs.totalIPv4Count * 20;
  const estimatedIPv6Chars = resolvedIPs.totalIPv6Count * 30;
  const baseChars = 20; // "v=spf1 ~all" + spaces
  const estimatedCharacterCount = baseChars + estimatedIPv4Chars + estimatedIPv6Chars;

  const recommendations: string[] = [];

  // Decision logic
  let shouldFlatten = false;
  let reason = '';

  // First check: Would flattening exceed character limit?
  if (estimatedCharacterCount > DNS_TXT_CHAR_LIMIT) {
    shouldFlatten = false;
    reason = `Flattening would exceed 512-character limit (estimated ${estimatedCharacterCount} chars). Use SPF includes instead.`;
    recommendations.push('Consider using SPF includes for some services');
    recommendations.push('Disable IPv6 support to reduce character count');
  }
  // Second check: Too many IPs to flatten efficiently?
  else if (totalIPs > 50) {
    shouldFlatten = false;
    reason = `Too many IP addresses (${totalIPs}) to flatten efficiently. Keep as includes.`;
    recommendations.push('Use SPF includes to stay under character limit');
  }
  // Third check: SPF exceeds lookup limit (must flatten)
  else if (lookupCount > MAX_SPF_LOOKUPS) {
    shouldFlatten = true;
    reason = `SPF exceeds 10-lookup limit (${lookupCount} lookups). Flattening is required.`;
  }
  // Fourth check: Approaching lookup limit
  else if (lookupCount >= 8) {
    shouldFlatten = true;
    reason = `SPF approaching lookup limit (${lookupCount}/10). Flattening recommended for safety.`;
  }
  // Fifth check: Minimal lookups, no need to flatten
  else if (lookupCount <= 3) {
    shouldFlatten = false;
    reason = `SPF has minimal lookups (${lookupCount}). Flattening not necessary.`;
  }
  // Default: Moderate lookups, flattening beneficial
  else {
    shouldFlatten = true;
    reason = `SPF has moderate lookups (${lookupCount}). Flattening will improve performance.`;
  }

  if (shouldFlatten && estimatedCharacterCount > DNS_TXT_CHAR_LIMIT * 0.9) {
    recommendations.push('Consider disabling IPv6 to reduce character count');
  }

  return {
    shouldFlatten,
    reason,
    estimatedCharacterCount,
    estimatedLookupReduction: lookupCount,
    recommendations,
  };
}
