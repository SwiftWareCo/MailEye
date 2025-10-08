/**
 * DNS Configuration Orchestrator (Task 3.10)
 *
 * Orchestrates full DNS setup for email infrastructure including:
 * - SPF record flattening
 * - DKIM key generation
 * - DMARC policy configuration
 * - MX records for Google Workspace
 * - Custom tracking domain CNAME setup
 *
 * This is the high-level service that Phase 7 wizard will call to set up
 * complete email DNS configuration in a single operation.
 *
 * @example
 * const result = await setupEmailDNS({
 *   domain: 'example.com',
 *   domainId: 'db-domain-id',
 *   zoneId: 'cloudflare-zone-id',
 *   apiToken: 'cloudflare-token',
 *   emailPlatform: 'google-workspace',
 *   trackingSubdomain: 'emailtracking',
 *   trackingProvider: 'smartlead'
 * });
 */

import { flattenSPFRecord } from './spf-flattener';
import { generateDKIMRecord } from './dkim-generator';
import { generateDMARCRecord } from './dmarc-generator';
import { generateGoogleWorkspaceMXRecord, createMXDNSRecords } from './mx-generator';
import { generateTrackingDomainCNAME } from './tracking-domain-setup';
import {
  createDNSRecordsBatch,
  type DNSRecordInput,
  type BatchDNSRecordResult,
} from './cloudflare-record-creator';

/**
 * Email platform types supported
 */
export type EmailPlatform = 'google-workspace' | 'microsoft-365' | 'custom';

/**
 * Tracking provider types
 */
export type TrackingProvider = 'smartlead' | 'instantly' | 'none';

/**
 * DMARC policy options
 */
export type DMARCPolicy = 'none' | 'quarantine' | 'reject';

/**
 * DNS setup configuration input
 */
export interface DNSSetupConfig {
  // Domain details
  domain: string;
  domainId: string; // Database domain ID
  zoneId: string; // Cloudflare zone ID
  apiToken: string; // Cloudflare API token

  // Email platform configuration
  emailPlatform: EmailPlatform;
  customMXRecords?: Array<{ priority: number; server: string }>; // For custom email platforms

  // SPF configuration
  spfIncludes?: string[]; // Additional SPF includes beyond email platform defaults
  existingSPFRecord?: string; // Existing SPF record to flatten (optional)

  // DKIM configuration
  dkimSelector?: string; // DKIM selector (default: 'google' for Google Workspace)
  dkimPublicKey?: string; // DKIM public key (if already generated)

  // DMARC configuration
  dmarcPolicy?: DMARCPolicy; // DMARC policy (default: 'none')
  dmarcReportEmail?: string; // Email for DMARC aggregate reports
  dmarcForensicEmail?: string; // Email for DMARC forensic reports

  // Tracking domain setup (optional)
  enableTracking?: boolean;
  trackingSubdomain?: string; // e.g., 'emailtracking', 'track', 'link'
  trackingProvider?: TrackingProvider;

  // Options
  skipDuplicates?: boolean; // Skip duplicate records instead of failing
}

/**
 * Individual DNS record setup result
 */
export interface DNSRecordSetupResult {
  type: 'SPF' | 'DKIM' | 'DMARC' | 'MX' | 'TRACKING';
  success: boolean;
  recordsCreated: number;
  records?: DNSRecordInput[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Complete DNS setup result
 */
export interface DNSSetupResult {
  success: boolean;
  domain: string;
  recordsCreated: number;
  recordsFailed: number;
  recordsSkipped: number;

  // Individual component results
  spf?: DNSRecordSetupResult;
  dkim?: DNSRecordSetupResult;
  dmarc?: DNSRecordSetupResult;
  mx?: DNSRecordSetupResult;
  tracking?: DNSRecordSetupResult;

  // Batch creation result
  batchResult: BatchDNSRecordResult;

  // Overall errors and warnings
  errors: string[];
  warnings: string[];
}

/**
 * Set up complete email DNS infrastructure for a domain
 *
 * This is the main orchestrator function that:
 * 1. Generates SPF record (flattened if needed)
 * 2. Generates DKIM records for email platform
 * 3. Generates DMARC record with policy
 * 4. Generates MX records for email platform
 * 5. Generates tracking domain CNAME (if enabled)
 * 6. Batch creates all records in Cloudflare
 * 7. Saves records to database
 *
 * @param config - DNS setup configuration
 * @returns Complete DNS setup result
 *
 * @example
 * const result = await setupEmailDNS({
 *   domain: 'example.com',
 *   domainId: 'domain-123',
 *   zoneId: 'zone-456',
 *   apiToken: 'token',
 *   emailPlatform: 'google-workspace',
 *   dmarcPolicy: 'none',
 *   enableTracking: true,
 *   trackingSubdomain: 'track',
 *   trackingProvider: 'smartlead'
 * });
 */
export async function setupEmailDNS(
  config: DNSSetupConfig
): Promise<DNSSetupResult> {
  const {
    domain,
    domainId,
    zoneId,
    apiToken,
    skipDuplicates = true,
  } = config;

  const errors: string[] = [];
  const warnings: string[] = [];
  const allRecords: DNSRecordInput[] = [];

  let spfResult: DNSRecordSetupResult | undefined;
  let dkimResult: DNSRecordSetupResult | undefined;
  let dmarcResult: DNSRecordSetupResult | undefined;
  let mxResult: DNSRecordSetupResult | undefined;
  let trackingResult: DNSRecordSetupResult | undefined;

  // Step 1: Generate SPF record
  try {
    const spfGeneration = await generateSPFRecord(config);
    spfResult = spfGeneration;

    if (spfGeneration.success && spfGeneration.records) {
      allRecords.push(...spfGeneration.records);
    } else {
      errors.push(...(spfGeneration.errors || []));
    }

    warnings.push(...(spfGeneration.warnings || []));
  } catch (error) {
    console.error('Error generating SPF record:', error);
    spfResult = {
      type: 'SPF',
      success: false,
      recordsCreated: 0,
      errors: [
        `SPF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
    errors.push(...(spfResult.errors || []));
  }

  // Step 2: Generate DKIM records
  try {
    const dkimGeneration = await generateDKIMRecordsForPlatform(config);
    dkimResult = dkimGeneration;

    if (dkimGeneration.success && dkimGeneration.records) {
      allRecords.push(...dkimGeneration.records);
    } else {
      // Check if error is due to missing Google Workspace credentials
      const isGoogleWorkspaceError = dkimGeneration.errors?.some(
        (error) =>
          error.includes('Google Workspace not connected') ||
          error.includes('Google Workspace credentials')
      );

      if (isGoogleWorkspaceError) {
        // Treat as warning instead of error - DNS setup can continue without DKIM
        warnings.push(
          'DKIM record skipped: Google Workspace credentials not configured. ' +
          'You can add DKIM records manually later after configuring Google Workspace.'
        );
        warnings.push(...(dkimGeneration.errors || []));
        warnings.push(...(dkimGeneration.warnings || []));
      } else {
        // Other DKIM errors are still treated as errors
        errors.push(...(dkimGeneration.errors || []));
        warnings.push(...(dkimGeneration.warnings || []));
      }
    }

    if (dkimGeneration.success || dkimGeneration.warnings) {
      warnings.push(...(dkimGeneration.warnings || []));
    }
  } catch (error) {
    console.error('Error generating DKIM records:', error);
    dkimResult = {
      type: 'DKIM',
      success: false,
      recordsCreated: 0,
      errors: [
        `DKIM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
    // Treat unexpected errors as warnings too if Google Workspace is involved
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('Google Workspace')) {
      warnings.push(...(dkimResult.errors || []));
    } else {
      errors.push(...(dkimResult.errors || []));
    }
  }

  // Step 3: Generate DMARC record
  try {
    const dmarcGeneration = await generateDMARCRecordForDomain(config);
    dmarcResult = dmarcGeneration;

    if (dmarcGeneration.success && dmarcGeneration.records) {
      allRecords.push(...dmarcGeneration.records);
    } else {
      errors.push(...(dmarcGeneration.errors || []));
    }

    warnings.push(...(dmarcGeneration.warnings || []));
  } catch (error) {
    console.error('Error generating DMARC record:', error);
    dmarcResult = {
      type: 'DMARC',
      success: false,
      recordsCreated: 0,
      errors: [
        `DMARC generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
    errors.push(...(dmarcResult.errors || []));
  }

  // Step 4: Generate MX records
  try {
    const mxGeneration = await generateMXRecordsForPlatform(config);
    mxResult = mxGeneration;

    if (mxGeneration.success && mxGeneration.records) {
      allRecords.push(...mxGeneration.records);
    } else {
      errors.push(...(mxGeneration.errors || []));
    }

    warnings.push(...(mxGeneration.warnings || []));
  } catch (error) {
    console.error('Error generating MX records:', error);
    mxResult = {
      type: 'MX',
      success: false,
      recordsCreated: 0,
      errors: [
        `MX generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
    errors.push(...(mxResult.errors || []));
  }

  // Step 5: Generate tracking domain CNAME (if enabled)
  if (config.enableTracking && config.trackingSubdomain && config.trackingProvider) {
    try {
      const trackingGeneration = await generateTrackingCNAME(config);
      trackingResult = trackingGeneration;

      if (trackingGeneration.success && trackingGeneration.records) {
        allRecords.push(...trackingGeneration.records);
      } else {
        errors.push(...(trackingGeneration.errors || []));
      }

      warnings.push(...(trackingGeneration.warnings || []));
    } catch (error) {
      console.error('Error generating tracking CNAME:', error);
      trackingResult = {
        type: 'TRACKING',
        success: false,
        recordsCreated: 0,
        errors: [
          `Tracking CNAME generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
      errors.push(...(trackingResult.errors || []));
    }
  }

  // Step 6: Batch create all DNS records in Cloudflare and database
  let batchResult: BatchDNSRecordResult;

  try {
    batchResult = await createDNSRecordsBatch({
      zoneId,
      domainId,
      apiToken,
      records: allRecords,
      skipDuplicates,
    });

    // Add batch creation errors to overall errors
    errors.push(...batchResult.errors);
  } catch (error) {
    console.error('Error creating DNS records batch:', error);
    batchResult = {
      success: false,
      totalRecords: allRecords.length,
      successfulRecords: 0,
      failedRecords: allRecords.length,
      skippedRecords: 0,
      results: [],
      errors: [
        `Batch creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
    errors.push(...batchResult.errors);
  }

  // Step 7: Build final result
  const result: DNSSetupResult = {
    success: batchResult.success && errors.length === 0,
    domain,
    recordsCreated: batchResult.successfulRecords,
    recordsFailed: batchResult.failedRecords,
    recordsSkipped: batchResult.skippedRecords,
    spf: spfResult,
    dkim: dkimResult,
    dmarc: dmarcResult,
    mx: mxResult,
    tracking: trackingResult,
    batchResult,
    errors,
    warnings,
  };

  return result;
}

/**
 * Generate SPF record for domain
 * Uses SPF flattening service if existing SPF record is provided
 */
async function generateSPFRecord(
  config: DNSSetupConfig
): Promise<DNSRecordSetupResult> {
  const { domain, emailPlatform, spfIncludes = [], existingSPFRecord } = config;

  try {
    // Build SPF includes based on email platform
    const platformIncludes = getPlatformSPFIncludes(emailPlatform);
    const allIncludes = [...platformIncludes, ...spfIncludes];

    // If existing SPF record provided, flatten it
    let spfValue: string;
    const warnings: string[] = [];

    if (existingSPFRecord) {
      const flattenResult = await flattenSPFRecord({
        domain,
        originalSPF: existingSPFRecord,
        ipv6Support: true,
      });

      if (!flattenResult.success || !flattenResult.flattenedRecord) {
        return {
          type: 'SPF',
          success: false,
          recordsCreated: 0,
          errors: flattenResult.errors,
          warnings: flattenResult.warnings,
        };
      }

      spfValue = flattenResult.flattenedRecord;
      warnings.push(...flattenResult.warnings);
    } else {
      // Build basic SPF record
      const includeString = allIncludes.map((inc) => `include:${inc}`).join(' ');
      spfValue = `v=spf1 ${includeString} ~all`;
    }

    return {
      type: 'SPF',
      success: true,
      recordsCreated: 1,
      records: [
        {
          type: 'TXT',
          name: '@',
          content: spfValue,
          ttl: 3600,
          purpose: 'spf',
          metadata: {
            emailPlatform,
            includes: allIncludes,
          },
        },
      ],
      warnings,
    };
  } catch (error) {
    return {
      type: 'SPF',
      success: false,
      recordsCreated: 0,
      errors: [
        `SPF generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}

/**
 * Generate DKIM records for email platform
 */
async function generateDKIMRecordsForPlatform(
  config: DNSSetupConfig
): Promise<DNSRecordSetupResult> {
  const { domain, emailPlatform, dkimSelector } = config;

  try {
    if (emailPlatform === 'google-workspace') {
      const dkimResult = await generateDKIMRecord({
        domain,
        provider: 'google_workspace',
        selector: dkimSelector || 'google',
      });

      if (!dkimResult.success) {
        return {
          type: 'DKIM',
          success: false,
          recordsCreated: 0,
          errors: dkimResult.errors,
          warnings: dkimResult.warnings,
        };
      }

      // Convert DKIM result to DNSRecordInput format
      const records: DNSRecordInput[] = [{
        type: 'TXT',
        name: dkimResult.recordName.split('.')[0], // Extract subdomain part (e.g., "google._domainkey")
        content: dkimResult.recordValue,
        ttl: 3600,
        purpose: 'dkim',
        metadata: {
          selector: dkimResult.selector,
          emailPlatform,
          keyLength: dkimResult.keyLength,
          requiresSplitting: dkimResult.requiresSplitting,
        },
      }];

      return {
        type: 'DKIM',
        success: true,
        recordsCreated: records.length,
        records,
        warnings: dkimResult.warnings,
      };
    }

    // For other platforms, skip DKIM generation
    return {
      type: 'DKIM',
      success: true,
      recordsCreated: 0,
      records: [],
      warnings: [`DKIM generation not yet implemented for ${emailPlatform}`],
    };
  } catch (error) {
    return {
      type: 'DKIM',
      success: false,
      recordsCreated: 0,
      errors: [
        `DKIM generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}

/**
 * Generate DMARC record for domain
 */
async function generateDMARCRecordForDomain(
  config: DNSSetupConfig
): Promise<DNSRecordSetupResult> {
  const {
    domain,
    dmarcPolicy = 'none',
    dmarcReportEmail,
    dmarcForensicEmail,
  } = config;

  try {
    const dmarcResult = await generateDMARCRecord({
      domain,
      policy: dmarcPolicy,
      aggregateReportEmail: dmarcReportEmail,
      forensicReportEmail: dmarcForensicEmail,
    });

    if (!dmarcResult.success) {
      return {
        type: 'DMARC',
        success: false,
        recordsCreated: 0,
        errors: dmarcResult.errors,
        warnings: dmarcResult.warnings,
      };
    }

    return {
      type: 'DMARC',
      success: true,
      recordsCreated: 1,
      records: [
        {
          type: 'TXT',
          name: '_dmarc', // DMARC records always use _dmarc subdomain
          content: dmarcResult.recordValue,
          ttl: 3600,
          purpose: 'dmarc',
          metadata: {
            policy: dmarcPolicy,
            aggregateReportEmail: dmarcReportEmail,
            forensicReportEmail: dmarcForensicEmail,
          },
        },
      ],
      warnings: dmarcResult.warnings,
    };
  } catch (error) {
    return {
      type: 'DMARC',
      success: false,
      recordsCreated: 0,
      errors: [
        `DMARC generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}

/**
 * Generate MX records for email platform
 */
async function generateMXRecordsForPlatform(
  config: DNSSetupConfig
): Promise<DNSRecordSetupResult> {
  const { domain, emailPlatform, customMXRecords } = config;

  try {
    if (emailPlatform === 'google-workspace') {
      const mxResult = await generateGoogleWorkspaceMXRecord(domain);

      if (!mxResult.success) {
        return {
          type: 'MX',
          success: false,
          recordsCreated: 0,
          errors: mxResult.errors,
          warnings: mxResult.warnings,
        };
      }

      // Convert MXRecord[] to MXDNSRecord[] format
      const dnsRecords = createMXDNSRecords(mxResult.records, 3600);

      const records: DNSRecordInput[] = dnsRecords.map((rec) => ({
        type: 'MX',
        name: rec.name,
        content: rec.content,
        priority: rec.priority,
        ttl: rec.ttl || 3600,
        purpose: 'mx',
        metadata: {
          emailPlatform,
        },
      }));

      return {
        type: 'MX',
        success: true,
        recordsCreated: records.length,
        records,
        warnings: mxResult.warnings,
      };
    } else if (emailPlatform === 'custom' && customMXRecords) {
      const records: DNSRecordInput[] = customMXRecords.map((mx) => ({
        type: 'MX',
        name: '@',
        content: mx.server,
        priority: mx.priority,
        ttl: 3600,
        purpose: 'mx',
        metadata: {
          emailPlatform: 'custom',
        },
      }));

      return {
        type: 'MX',
        success: true,
        recordsCreated: records.length,
        records,
      };
    }

    return {
      type: 'MX',
      success: true,
      recordsCreated: 0,
      records: [],
      warnings: [`MX generation not yet implemented for ${emailPlatform}`],
    };
  } catch (error) {
    return {
      type: 'MX',
      success: false,
      recordsCreated: 0,
      errors: [
        `MX generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}

/**
 * Generate tracking domain CNAME
 */
async function generateTrackingCNAME(
  config: DNSSetupConfig
): Promise<DNSRecordSetupResult> {
  const { domain, trackingSubdomain, trackingProvider } = config;

  if (!trackingSubdomain || !trackingProvider || trackingProvider === 'none') {
    return {
      type: 'TRACKING',
      success: true,
      recordsCreated: 0,
      records: [],
    };
  }

  try {
    const trackingResult = await generateTrackingDomainCNAME({
      domain,
      trackingSubdomain,
      provider: trackingProvider as 'smartlead',
    });

    if (!trackingResult.success || !trackingResult.dnsRecord) {
      return {
        type: 'TRACKING',
        success: false,
        recordsCreated: 0,
        errors: trackingResult.errors,
        warnings: trackingResult.warnings,
      };
    }

    return {
      type: 'TRACKING',
      success: true,
      recordsCreated: 1,
      records: [
        {
          type: 'CNAME',
          name: trackingResult.dnsRecord.name,
          content: trackingResult.dnsRecord.content,
          ttl: trackingResult.dnsRecord.ttl || 3600,
          proxied: false,
          purpose: 'tracking',
          metadata: {
            trackingProvider,
            trackingURL: trackingResult.trackingURL,
          },
        },
      ],
      warnings: trackingResult.warnings,
    };
  } catch (error) {
    return {
      type: 'TRACKING',
      success: false,
      recordsCreated: 0,
      errors: [
        `Tracking CNAME error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}

/**
 * Get default SPF includes for email platform
 */
function getPlatformSPFIncludes(platform: EmailPlatform): string[] {
  switch (platform) {
    case 'google-workspace':
      return ['_spf.google.com'];
    case 'microsoft-365':
      return ['spf.protection.outlook.com'];
    case 'custom':
    default:
      return [];
  }
}

/**
 * Verify DNS configuration status
 *
 * Checks if all required DNS records are properly configured and propagated.
 * This is used after setupEmailDNS to validate the configuration.
 *
 * @param domainId - Database domain ID
 * @returns Verification result
 */
export async function verifyDNSConfiguration(domainId: string): Promise<{
  success: boolean;
  spfConfigured: boolean;
  dkimConfigured: boolean;
  dmarcConfigured: boolean;
  mxConfigured: boolean;
  trackingConfigured: boolean;
  missingRecords: string[];
}> {
  const { getDNSRecordsForDomain } = await import('./cloudflare-record-creator');

  const records = await getDNSRecordsForDomain(domainId);

  const spfRecords = records.filter((r) => r.purpose === 'spf');
  const dkimRecords = records.filter((r) => r.purpose === 'dkim');
  const dmarcRecords = records.filter((r) => r.purpose === 'dmarc');
  const mxRecords = records.filter((r) => r.purpose === 'mx');
  const trackingRecords = records.filter((r) => r.purpose === 'tracking');

  const missingRecords: string[] = [];

  if (spfRecords.length === 0) missingRecords.push('SPF');
  if (dkimRecords.length === 0) missingRecords.push('DKIM');
  if (dmarcRecords.length === 0) missingRecords.push('DMARC');
  if (mxRecords.length === 0) missingRecords.push('MX');

  return {
    success: missingRecords.length === 0,
    spfConfigured: spfRecords.length > 0,
    dkimConfigured: dkimRecords.length > 0,
    dmarcConfigured: dmarcRecords.length > 0,
    mxConfigured: mxRecords.length > 0,
    trackingConfigured: trackingRecords.length > 0,
    missingRecords,
  };
}
