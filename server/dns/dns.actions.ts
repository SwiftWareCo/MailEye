/**
 * DNS Configuration Server Actions
 *
 * Wraps DNS setup functions for use in wizard
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { setupEmailDNS, type DNSSetupConfig, type DNSSetupResult } from './dns-manager';
import { getDomainById } from '../domain/domain.data';

/**
 * Setup DNS Action
 *
 * Configures SPF, DKIM, DMARC, MX, and tracking domain DNS records
 */
export async function setupDNSAction(domainId: string): Promise<DNSSetupResult> {
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

  console.log('user server metadata', user.serverMetadata);
  // Get Cloudflare credentials
  const cloudflareApiToken = user.serverMetadata?.cloudflare.apiToken as string | undefined;
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

  // Configure DNS
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
  return result;
}
