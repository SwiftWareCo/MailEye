/**
 * DNS Configuration Server Actions
 *
 * Wraps DNS setup functions for use in wizard
 */

'use server';

import { stackServerApp } from '@/stack/server';
import {
  setupEmailDNS,
  type DNSSetupConfig,
  type DNSSetupResult,
} from './dns-manager';
import { getDomainById } from '../domain/domain.data';
import { createSingleDNSRecord } from './cloudflare-record-creator';

/**
 * Setup DNS Action
 *
 * Configures SPF, DKIM, DMARC, MX, and tracking domain DNS records
 *
 * @param domainId - Domain ID to configure DNS for
 * @param options - Optional DNS configuration options
 */
export async function setupDNSAction(
  domainId: string
): Promise<DNSSetupResult> {
  // Authenticate user
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      domain: '',
      recordsCreated: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      batchResult: {
        success: false,
        totalRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
        results: [],
        errors: [],
      },
      errors: ['Authentication required'],
      warnings: [],
    };
  }

  // Get domain
  const domain = await getDomainById(domainId, user.id);
  if (!domain) {
    return {
      success: false,
      domain: '',
      recordsCreated: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      batchResult: {
        success: false,
        totalRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
        results: [],
        errors: [],
      },
      errors: ['Domain not found'],
      warnings: [],
    };
  }

  // Get Cloudflare credentials
  const cloudflareApiToken = user.serverMetadata?.cloudflare.apiToken as
    | string
    | undefined;
  if (!cloudflareApiToken || !domain.cloudflareZoneId) {
    return {
      success: false,
      domain: domain.domain,
      recordsCreated: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      batchResult: {
        success: false,
        totalRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
        results: [],
        errors: [],
      },
      errors: ['Cloudflare credentials or zone ID not found'],
      warnings: [],
    };
  }

  // Configure DNS - remove dkimPublicKey
  const config: DNSSetupConfig = {
    domain: domain.domain,
    domainId: domain.id,
    zoneId: domain.cloudflareZoneId,
    apiToken: cloudflareApiToken,
    emailPlatform: 'google-workspace',
    dmarcPolicy: 'none',
    dmarcReportEmail: `dmarc@${domain.domain}`,
    enableTracking: true,
    trackingSubdomain: 'emailtracking',
    trackingProvider: 'smartlead',
    skipDuplicates: true,
  };

  const result = await setupEmailDNS(config);

  // If DNS setup was successful, update the domain with configured timestamp
  if (result.success && result.recordsCreated > 0) {
    const { db } = await import('@/lib/db');
    const { domains } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db
      .update(domains)
      .set({
        dnsConfiguredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(domains.id, domainId));
  }

  return result;
}

/**
 * Unified Email DNS Setup Action
 *
 * Combines Google Workspace domain setup with DNS configuration in a single action:
 * 1. Adds domain to Google Workspace (if not already added)
 * 2. Creates verification TXT record + email DNS records (SPF, DMARC, MX)
 * 3. Triggers domain verification with Google
 * 4. Gmail activates automatically when Google checks MX records
 *
 * Note: DKIM records must be added manually via the DNS tab after completing these steps
 */
export async function setupEmailDNSWithVerificationAction(
  domainId: string
): Promise<{
  success: boolean;
  error?: string;
  verification?: {
    verified: boolean;
    alreadyVerified?: boolean;
  };
  dns?: DNSSetupResult;
}> {
  try {
    // Authenticate user
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Get domain
    const domain = await getDomainById(domainId, user.id);
    if (!domain) {
      return {
        success: false,
        error: 'Domain not found',
      };
    }

    // Check if Cloudflare zone exists
    if (!domain.cloudflareZoneId) {
      return {
        success: false,
        error:
          'Cloudflare zone not created. Please ensure the domain is properly connected.',
      };
    }

    // Import Google Workspace setup function
    const { setupGoogleWorkspaceAction } = await import(
      '../google-workspace/google-workspace.actions'
    );

    console.log(`[Unified DNS Setup] Starting for ${domain.domain}`);

    // Step 1: Setup Google Workspace (adds domain, creates verification TXT, triggers verification)
    const gwResult = await setupGoogleWorkspaceAction(
      domainId,
      domain.domain,
      domain.cloudflareZoneId
    );

    if (!gwResult.success) {
      return {
        success: false,
        error: `Google Workspace setup failed: ${gwResult.error}`,
      };
    }

    console.log(
      `[Unified DNS Setup] Google Workspace ${
        gwResult.verified ? 'verified' : 'pending verification'
      }`
    );

    // Step 2: Configure DNS records (SPF, DMARC, MX, DKIM if available)
    // Note: This will skip the verification TXT record if it already exists (created by GW setup)
    const dnsResult = await setupDNSAction(domainId);

    if (!dnsResult.success) {
      return {
        success: false,
        error: `DNS configuration failed: ${dnsResult.errors?.join(', ')}`,
        verification: {
          verified: gwResult.verified || false,
          alreadyVerified: gwResult.alreadyVerified,
        },
      };
    }

    console.log(
      `[Unified DNS Setup] DNS configured: ${dnsResult.recordsCreated} records created`
    );

    // Success
    return {
      success: true,
      verification: {
        verified: gwResult.verified || false,
        alreadyVerified: gwResult.alreadyVerified,
      },
      dns: dnsResult,
    };
  } catch (error) {
    console.error('[Unified DNS Setup] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Add new server action for manual DKIM
export async function addDKIMRecordAction(
  domainId: string,
  hostname: string,
  value: string
): Promise<{
  success: boolean;
  error?: string;
  recordId?: string;
}> {
  try {
    // Authenticate user
    const user = await stackServerApp.getUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get domain
    const domain = await getDomainById(domainId, user.id);
    if (!domain) {
      return { success: false, error: 'Domain not found' };
    }

    if (!domain.cloudflareZoneId) {
      return { success: false, error: 'Cloudflare zone not configured' };
    }

    // Get Cloudflare credentials
    const cloudflareApiToken = user.serverMetadata?.cloudflare.apiToken as
      | string
      | undefined;
    if (!cloudflareApiToken) {
      return { success: false, error: 'Cloudflare credentials not found' };
    }

    // Validate DKIM record format
    if (!hostname || !value) {
      return { success: false, error: 'Hostname and value are required' };
    }

    // Add DKIM record
    const recordInput = {
      type: 'TXT' as const,
      name: hostname,
      content: value,
      ttl: 3600,
      purpose: 'dkim' as const,
    };

    const result = await createSingleDNSRecord({
      zoneId: domain.cloudflareZoneId,
      domainId: domain.id,
      apiToken: cloudflareApiToken,
      record: recordInput,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create DKIM record',
      };
    }

    return {
      success: true,
      recordId: result.databaseRecordId,
    };
  } catch (error) {
    console.error('Error adding DKIM record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
