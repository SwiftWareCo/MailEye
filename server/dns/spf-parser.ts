/**
 * SPF Record Parser (Task 3.1)
 *
 * Parses SPF (Sender Policy Framework) records to extract mechanisms,
 * identify DNS lookups, and prepare for SPF flattening.
 *
 * SPF Specification: RFC 7208
 * https://datatracker.ietf.org/doc/html/rfc7208
 */

import {
  SPFMechanism,
  SPFMechanismType,
  SPFQualifier,
  ParsedSPFRecord,
  SPFValidationResult,
} from '@/lib/types/dns';

/**
 * Parse an SPF TXT record into structured components
 *
 * @param domain - Domain name (for error context)
 * @param txtRecord - Raw SPF TXT record string
 * @returns Parsed SPF record with all mechanisms extracted
 *
 * @example
 * const result = parseSPFRecord('example.com', 'v=spf1 include:_spf.google.com ~all');
 * // Returns: { version: 'spf1', mechanisms: [...], includes: ['_spf.google.com'], ... }
 */
export function parseSPFRecord(domain: string, txtRecord: string): ParsedSPFRecord {
  // Trim whitespace
  const record = txtRecord.trim();

  // Extract version (should be "v=spf1")
  const versionMatch = record.match(/^v=spf1\s*/i);
  if (!versionMatch) {
    throw new Error(`Invalid SPF record for ${domain}: must start with "v=spf1"`);
  }

  // Remove version prefix to get mechanisms
  const mechanismsStr = record.substring(versionMatch[0].length);

  // Split into individual mechanisms (space-separated)
  const mechanismTokens = mechanismsStr.split(/\s+/).filter(Boolean);

  const mechanisms: SPFMechanism[] = [];
  const includes: string[] = [];
  const ipv4Addresses: string[] = [];
  const ipv6Addresses: string[] = [];
  let hasAll = false;
  let allQualifier: SPFQualifier | undefined;

  for (const token of mechanismTokens) {
    const mechanism = parseMechanism(token);
    mechanisms.push(mechanism);

    // Extract specific mechanism types
    switch (mechanism.type) {
      case 'include':
        if (mechanism.value) {
          includes.push(mechanism.value);
        }
        break;
      case 'ip4':
        if (mechanism.value) {
          ipv4Addresses.push(mechanism.value);
        }
        break;
      case 'ip6':
        if (mechanism.value) {
          ipv6Addresses.push(mechanism.value);
        }
        break;
      case 'all':
        hasAll = true;
        allQualifier = mechanism.qualifier;
        break;
    }
  }

  return {
    version: 'spf1',
    mechanisms,
    includes,
    ipv4Addresses,
    ipv6Addresses,
    hasAll,
    allQualifier,
    rawRecord: txtRecord,
  };
}

/**
 * Parse a single SPF mechanism into structured format
 *
 * @param mechanismStr - Single mechanism string (e.g., "include:_spf.google.com", "~all")
 * @returns Parsed mechanism with type, qualifier, and value
 *
 * @example
 * parseMechanism('include:_spf.google.com')
 * // Returns: { type: 'include', qualifier: '+', value: '_spf.google.com', raw: 'include:_spf.google.com' }
 */
export function parseMechanism(mechanismStr: string): SPFMechanism {
  // Extract qualifier (+ - ~ ?) - default is '+'
  let qualifier: SPFQualifier = '+';
  let mechanism = mechanismStr;

  const firstChar = mechanismStr[0];
  if (firstChar === '+' || firstChar === '-' || firstChar === '~' || firstChar === '?') {
    qualifier = firstChar as SPFQualifier;
    mechanism = mechanismStr.substring(1);
  }

  // Parse mechanism type and value
  // Mechanisms can be: include:domain, ip4:address, a, mx:domain, etc.
  const colonIndex = mechanism.indexOf(':');

  if (colonIndex === -1) {
    // Simple mechanisms: "all", "a", "mx", "ptr"
    const type = mechanism.toLowerCase() as SPFMechanismType;
    return {
      type,
      qualifier,
      raw: mechanismStr,
    };
  }

  // Mechanisms with values: "include:domain", "ip4:192.168.1.1/24"
  const type = mechanism.substring(0, colonIndex).toLowerCase() as SPFMechanismType;
  const value = mechanism.substring(colonIndex + 1);

  return {
    type,
    qualifier,
    value,
    raw: mechanismStr,
  };
}

/**
 * Extract all "include:" directives from SPF record
 *
 * @param spfRecord - Raw SPF record string
 * @returns Array of include domains (without "include:" prefix)
 *
 * @example
 * extractIncludes('v=spf1 include:_spf.google.com include:sendgrid.net ~all')
 * // Returns: ['_spf.google.com', 'sendgrid.net']
 */
export function extractIncludes(spfRecord: string): string[] {
  const includeRegex = /(?:^|\s)[+\-~?]?include:([^\s]+)/gi;
  const includes: string[] = [];
  let match;

  while ((match = includeRegex.exec(spfRecord)) !== null) {
    includes.push(match[1]);
  }

  return includes;
}

/**
 * Extract all IP mechanisms (ip4: and ip6:) from SPF record
 *
 * @param spfRecord - Raw SPF record string
 * @returns Object with ipv4 and ipv6 arrays
 *
 * @example
 * extractIPMechanisms('v=spf1 ip4:192.168.1.1 ip6:2001:db8::/32 ~all')
 * // Returns: { ipv4: ['192.168.1.1'], ipv6: ['2001:db8::/32'] }
 */
export function extractIPMechanisms(spfRecord: string): { ipv4: string[]; ipv6: string[] } {
  const ipv4Regex = /(?:^|\s)[+\-~?]?ip4:([^\s]+)/gi;
  const ipv6Regex = /(?:^|\s)[+\-~?]?ip6:([^\s]+)/gi;

  const ipv4: string[] = [];
  const ipv6: string[] = [];

  let match;
  while ((match = ipv4Regex.exec(spfRecord)) !== null) {
    ipv4.push(match[1]);
  }

  while ((match = ipv6Regex.exec(spfRecord)) !== null) {
    ipv6.push(match[1]);
  }

  return { ipv4, ipv6 };
}

/**
 * Validate SPF record syntax and check for common issues
 *
 * @param spfRecord - Raw SPF record string
 * @returns Validation result with errors and warnings
 *
 * @example
 * validateSPFSyntax('v=spf1 include:_spf.google.com include:sendgrid.net ~all')
 * // Returns: { isValid: true, errors: [], warnings: [], ... }
 */
export function validateSPFSyntax(spfRecord: string): SPFValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let lookupCount = 0;

  // Check 1: Must start with v=spf1
  if (!spfRecord.toLowerCase().startsWith('v=spf1')) {
    errors.push('SPF record must start with "v=spf1"');
  }

  // Check 2: Character limit (512 bytes for DNS TXT record)
  const characterCount = spfRecord.length;
  const exceedsCharLimit = characterCount > 512;
  if (exceedsCharLimit) {
    errors.push(`SPF record exceeds 512 character limit (${characterCount} chars). Consider SPF flattening.`);
  }

  // Check 3: Must end with "all" mechanism (best practice)
  if (!spfRecord.match(/[+\-~?]?all(\s|$)/i)) {
    warnings.push('SPF record should end with an "all" mechanism (~all or -all)');
  }

  // Check 4: Count DNS lookups (include, a, mx, exists, ptr)
  try {
    const parsed = parseSPFRecord('validation', spfRecord);

    // Count mechanisms that trigger DNS lookups
    for (const mechanism of parsed.mechanisms) {
      if (['include', 'a', 'mx', 'exists', 'ptr'].includes(mechanism.type)) {
        lookupCount++;
      }
    }

    // Check lookup limit (max 10)
    const exceedsLookupLimit = lookupCount > 10;
    if (exceedsLookupLimit) {
      errors.push(`SPF record exceeds 10 DNS lookup limit (${lookupCount} lookups). SPF flattening required.`);
    } else if (lookupCount >= 8) {
      warnings.push(`SPF record has ${lookupCount} DNS lookups (approaching 10 limit). Consider SPF flattening.`);
    }
  } catch (error) {
    errors.push(`Failed to parse SPF record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check 5: Deprecated "ptr" mechanism
  if (spfRecord.match(/[+\-~?]?ptr/i)) {
    warnings.push('The "ptr" mechanism is deprecated and should be avoided');
  }

  // Check 6: Invalid mechanisms
  const validMechanisms = ['include', 'a', 'mx', 'ptr', 'ip4', 'ip6', 'exists', 'all'];
  const mechanismTokens = spfRecord.replace(/^v=spf1\s*/i, '').split(/\s+/);

  for (const token of mechanismTokens) {
    if (!token) continue;

    // Remove qualifier
    const cleanToken = token.replace(/^[+\-~?]/, '');
    const mechanismType = cleanToken.split(':')[0].toLowerCase();

    if (!validMechanisms.includes(mechanismType)) {
      warnings.push(`Unknown SPF mechanism: "${mechanismType}"`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    lookupCount,
    exceedsLookupLimit: lookupCount > 10,
    characterCount,
    exceedsCharLimit,
  };
}

/**
 * Get the qualifier for a mechanism (+ - ~ ?)
 *
 * @param mechanismStr - Mechanism string
 * @returns Qualifier character
 *
 * @example
 * getSPFQualifier('~all') // Returns: '~'
 * getSPFQualifier('include:google.com') // Returns: '+' (default)
 */
export function getSPFQualifier(mechanismStr: string): SPFQualifier {
  const firstChar = mechanismStr[0];
  if (firstChar === '+' || firstChar === '-' || firstChar === '~' || firstChar === '?') {
    return firstChar as SPFQualifier;
  }
  return '+'; // Default qualifier is PASS
}

/**
 * Check if a mechanism triggers a DNS lookup
 * (include, a, mx, exists, ptr all trigger DNS lookups)
 *
 * @param mechanismType - Type of SPF mechanism
 * @returns True if mechanism triggers DNS lookup
 */
export function triggersLookup(mechanismType: SPFMechanismType): boolean {
  return ['include', 'a', 'mx', 'exists', 'ptr'].includes(mechanismType);
}

/**
 * Count total DNS lookups in an SPF record (surface level only, not recursive)
 *
 * @param spfRecord - Raw SPF record string
 * @returns Number of DNS lookups
 */
export function countDNSLookups(spfRecord: string): number {
  const parsed = parseSPFRecord('lookup-count', spfRecord);
  return parsed.mechanisms.filter(m => triggersLookup(m.type)).length;
}
