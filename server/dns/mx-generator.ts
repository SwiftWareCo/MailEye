/**
 * MX Record Generation Service (Task 3.7)
 *
 * Generate MX records for Google Workspace with correct priority values.
 * Uses modern Google Workspace MX configuration (2023+): smtp.google.com
 *
 * Key features:
 * - Google Workspace MX record generation (single record: smtp.google.com)
 * - Domain validation
 * - MX record structure creation for Cloudflare
 * - Helper functions for DNS record formatting
 *
 * @example
 * const result = await generateGoogleWorkspaceMXRecord('example.com');
 * // Returns: MX record with priority 1 pointing to smtp.google.com
 */

import {
  MXGenerationResult,
  MXRecord,
  MXDNSRecord,
} from '@/lib/types/dns';

/**
 * Default TTL for MX records (1 hour)
 */
const DEFAULT_MX_TTL = 3600;

/**
 * Google Workspace MX configuration (2023+)
 * Single MX record with priority 1
 */
const GOOGLE_WORKSPACE_MX_RECORD: MXRecord = {
  priority: 1,
  exchange: 'smtp.google.com',
};

/**
 * Domain validation regex
 * Validates standard domain format (e.g., example.com, sub.example.com)
 */
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

/**
 * Generate Google Workspace MX record
 *
 * Creates a single MX record pointing to smtp.google.com with priority 1.
 * This is the modern Google Workspace configuration (2023 and later).
 *
 * @param domain - Domain name (e.g., "example.com")
 * @param options - Optional configuration
 * @returns MX generation result with success status and generated record
 *
 * @example
 * const result = await generateGoogleWorkspaceMXRecord('example.com');
 * console.log(result.records); // [{ priority: 1, exchange: 'smtp.google.com' }]
 */
export async function generateGoogleWorkspaceMXRecord(
  domain: string,
): Promise<MXGenerationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate domain format
  const domainValidation = validateDomain(domain);
  if (!domainValidation.isValid) {
    return {
      success: false,
      domain,
      recordType: 'MX',
      records: [],
      errors: domainValidation.errors,
      warnings: [],
      generatedAt: new Date(),
    };
  }

  // Normalize domain (lowercase)
  const normalizedDomain = domain.toLowerCase().trim();

  // Generate MX record
  const records: MXRecord[] = [GOOGLE_WORKSPACE_MX_RECORD];

  // Add informational warning about DNS propagation
  warnings.push(
    'MX record changes can take up to 72 hours to propagate globally. ' +
    'Ensure old MX records are removed before adding Google Workspace records.'
  );

  return {
    success: true,
    domain: normalizedDomain,
    recordType: 'MX',
    records,
    errors,
    warnings,
    generatedAt: new Date(),
  };
}

/**
 * Create MX DNS record for Cloudflare API
 *
 * Converts MX record to Cloudflare DNS API format
 *
 * @param mxRecord - MX record to convert
 * @param ttl - Time to live (default: 3600)
 * @returns MX DNS record ready for Cloudflare API
 *
 * @example
 * const dnsRecord = createMXDNSRecord({
 *   priority: 1,
 *   exchange: 'smtp.google.com'
 * });
 */
export function createMXDNSRecord(
  mxRecord: MXRecord,
  ttl: number = DEFAULT_MX_TTL
): MXDNSRecord {
  return {
    name: '@', // Root domain
    type: 'MX',
    priority: mxRecord.priority,
    content: mxRecord.exchange,
    ttl,
  };
}

/**
 * Create multiple MX DNS records for Cloudflare API
 *
 * Converts multiple MX records to Cloudflare DNS API format
 *
 * @param mxRecords - Array of MX records
 * @param ttl - Time to live (default: 3600)
 * @returns Array of MX DNS records
 */
export function createMXDNSRecords(
  mxRecords: MXRecord[],
  ttl: number = DEFAULT_MX_TTL
): MXDNSRecord[] {
  return mxRecords.map(record => createMXDNSRecord(record, ttl));
}

/**
 * Validate domain format
 *
 * @param domain - Domain to validate
 * @returns Validation result with errors
 */
export function validateDomain(domain: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!domain || domain.trim().length === 0) {
    errors.push('Domain is required');
    return { isValid: false, errors };
  }

  // Check for invalid characters first (more specific error message)
  if (/[^a-z0-9.-]/i.test(domain.trim())) {
    errors.push('Domain contains invalid characters. Only letters, numbers, hyphens, and periods allowed.');
    return { isValid: false, errors };
  }

  if (!DOMAIN_REGEX.test(domain.trim())) {
    errors.push(`Invalid domain format: "${domain}". Expected format: example.com`);
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validate MX configuration
 *
 * Ensures MX records have valid priority values and hostnames
 *
 * @param records - MX records to validate
 * @returns Validation result
 */
export function validateMXConfiguration(records: MXRecord[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!records || records.length === 0) {
    errors.push('At least one MX record is required');
    return { isValid: false, errors, warnings };
  }

  for (const record of records) {
    // Validate priority
    if (record.priority < 0 || record.priority > 65535) {
      errors.push(`Invalid MX priority: ${record.priority}. Must be between 0 and 65535.`);
    }

    // Validate exchange (mail server)
    if (!record.exchange || record.exchange.trim().length === 0) {
      errors.push('MX exchange (mail server) is required');
    } else if (!/^[a-z0-9.-]+$/i.test(record.exchange)) {
      errors.push(`Invalid MX exchange format: "${record.exchange}"`);
    }
  }

  // Check for duplicate priorities (warning, not error)
  const priorities = records.map(r => r.priority);
  const duplicatePriorities = priorities.filter((p, i) => priorities.indexOf(p) !== i);
  if (duplicatePriorities.length > 0) {
    warnings.push(
      `Multiple MX records with same priority detected: ${[...new Set(duplicatePriorities)].join(', ')}. ` +
      'This is valid but may affect mail delivery behavior.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get Google Workspace MX record information
 *
 * Returns the recommended MX record for Google Workspace
 *
 * @returns Google Workspace MX record
 */
export function getGoogleWorkspaceMXRecord(): MXRecord {
  return { ...GOOGLE_WORKSPACE_MX_RECORD };
}

/**
 * Get Google Workspace MX setup instructions
 *
 * Returns user-friendly instructions for setting up Google Workspace MX records
 *
 * @param domain - Domain name
 * @returns Setup instructions object
 */
export function getGoogleWorkspaceMXInstructions(domain: string): {
  domain: string;
  record: MXRecord;
  instructions: string[];
  notes: string[];
} {
  return {
    domain,
    record: { ...GOOGLE_WORKSPACE_MX_RECORD },
    instructions: [
      '1. Remove any existing MX records from your DNS configuration',
      '2. Add the Google Workspace MX record:',
      `   - Name: @ (root domain)`,
      `   - Type: MX`,
      `   - Priority: ${GOOGLE_WORKSPACE_MX_RECORD.priority}`,
      `   - Mail Server: ${GOOGLE_WORKSPACE_MX_RECORD.exchange}`,
      `   - TTL: 3600 (1 hour)`,
      '3. Wait for DNS propagation (usually 5-30 minutes, can take up to 72 hours)',
      '4. Verify MX records using: dig MX ' + domain + ' or online DNS checker',
    ],
    notes: [
      'This is the modern Google Workspace MX configuration (2023+)',
      'Only one MX record is needed for Google Workspace',
      'Lower priority numbers have higher priority (1 is highest)',
      'Old Google Workspace setups used 5 MX records (aspmx.l.google.com)',
      'If migrating from old setup, remove all old MX records first',
    ],
  };
}

/**
 * Check if MX record is a Google Workspace record
 *
 * @param mxRecord - MX record to check
 * @returns True if record points to Google Workspace
 */
export function isGoogleWorkspaceMXRecord(mxRecord: MXRecord): boolean {
  const exchange = mxRecord.exchange.toLowerCase();
  return (
    exchange === 'smtp.google.com' ||
    exchange.endsWith('.google.com') ||
    exchange.endsWith('.aspmx.l.google.com')
  );
}
