/**
 * Custom Tracking Domain CNAME Setup Service (Task 3.8)
 *
 * Generate CNAME records for custom email tracking domains (Smartlead/Instantly).
 * Allows users to use branded tracking links instead of third-party tracking domains.
 *
 * Key features:
 * - Smartlead tracking domain CNAME generation
 * - Custom subdomain support (emailtracking, track, link, click)
 * - Tracking URL generation for email platform configuration
 * - Domain validation and subdomain format checking
 *
 * Benefits:
 * - Improved email deliverability (domain alignment)
 * - Brand consistency in tracking links
 * - Isolated sender reputation (not shared)
 * - Compliance with modern email authentication standards
 *
 * @example
 * const result = await generateTrackingDomainCNAME({
 *   domain: 'example.com',
 *   trackingSubdomain: 'emailtracking',
 *   provider: 'smartlead'
 * });
 * // Returns: emailtracking.example.com CNAME open.sleadtrack.com
 */

import {
  TrackingDomainConfig,
  TrackingDomainResult,
  TrackingDomainDNSRecord,
  TrackingProvider,
} from '@/lib/types/dns';

/**
 * CNAME targets for different tracking providers
 */
const TRACKING_CNAME_TARGETS: Record<TrackingProvider, string> = {
  smartlead: 'open.sleadtrack.com',
};

/**
 * Default TTL for tracking domain CNAME records (1 hour)
 */
const DEFAULT_TTL = 3600;

/**
 * Common tracking subdomain recommendations
 */
export const RECOMMENDED_TRACKING_SUBDOMAINS = [
  'emailtracking',
  'track',
  'link',
  'click',
  'email',
  'mail',
] as const;

/**
 * Generate custom tracking domain CNAME record
 *
 * Creates a CNAME record that points to the tracking provider's server,
 * allowing branded tracking links in cold emails for better deliverability.
 *
 * @param config - Tracking domain configuration
 * @returns Tracking domain generation result with CNAME record
 *
 * @example
 * const result = await generateTrackingDomainCNAME({
 *   domain: 'mycompany.com',
 *   trackingSubdomain: 'emailtracking',
 *   provider: 'smartlead'
 * });
 * console.log(result.trackingURL); // "http://emailtracking.mycompany.com"
 * console.log(result.dnsRecord);   // CNAME record for Cloudflare
 */
export async function generateTrackingDomainCNAME(
  config: TrackingDomainConfig
): Promise<TrackingDomainResult> {
  const { domain, trackingSubdomain, provider } = config;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate domain
  if (!isValidDomain(domain)) {
    errors.push(`Invalid domain: ${domain}`);
  }

  // Validate tracking subdomain
  const subdomainValidation = validateTrackingSubdomain(trackingSubdomain);
  if (!subdomainValidation.isValid) {
    errors.push(...subdomainValidation.errors);
  }
  warnings.push(...subdomainValidation.warnings);

  // Check for subdomain conflicts
  if (trackingSubdomain === domain) {
    errors.push(
      'Tracking subdomain cannot be the same as the domain. ' +
      'Use a subdomain like "emailtracking", "track", or "link".'
    );
  }

  // Get CNAME target for provider
  const cnameTarget = getTrackingCNAMETarget(provider);

  // Build full tracking domain
  const fullTrackingDomain = `${trackingSubdomain}.${domain}`;

  // Build tracking URL (what user enters in Smartlead)
  const trackingURL = buildTrackingURL(trackingSubdomain, domain);

  // Create DNS record
  const dnsRecord = createTrackingDNSRecord(
    trackingSubdomain,
    cnameTarget,
    DEFAULT_TTL
  );

  // Add helpful warnings
  const recommendedSubdomains = RECOMMENDED_TRACKING_SUBDOMAINS as readonly string[];
  if (!recommendedSubdomains.includes(trackingSubdomain)) {
    warnings.push(
      `Subdomain "${trackingSubdomain}" is not a common tracking subdomain. ` +
      `Recommended: ${RECOMMENDED_TRACKING_SUBDOMAINS.join(', ')}`
    );
  }

  const result: TrackingDomainResult = {
    success: errors.length === 0,
    domain,
    trackingSubdomain,
    fullTrackingDomain,
    trackingURL,
    cnameTarget,
    dnsRecord,
    errors,
    warnings,
    generatedAt: new Date(),
  };

  return result;
}

/**
 * Get CNAME target for tracking provider
 *
 * Returns the tracking server hostname that the CNAME should point to.
 *
 * @param provider - Tracking provider (smartlead, etc.)
 * @returns CNAME target hostname
 *
 * @example
 * getTrackingCNAMETarget('smartlead') // "open.sleadtrack.com"
 */
export function getTrackingCNAMETarget(provider: TrackingProvider): string {
  return TRACKING_CNAME_TARGETS[provider];
}

/**
 * Build tracking URL for email platform configuration
 *
 * Constructs the URL that users should enter in their email platform
 * (Smartlead, Instantly, etc.) to enable custom tracking domain.
 *
 * @param subdomain - Tracking subdomain (e.g., "emailtracking")
 * @param domain - Root domain (e.g., "example.com")
 * @returns Full tracking URL (e.g., "http://emailtracking.example.com")
 *
 * @example
 * buildTrackingURL('track', 'example.com') // "http://track.example.com"
 */
export function buildTrackingURL(subdomain: string, domain: string): string {
  // Most email tracking platforms require HTTP (not HTTPS) for the tracking URL
  return `http://${subdomain}.${domain}`;
}

/**
 * Create tracking domain CNAME DNS record object for Cloudflare API
 *
 * @param subdomain - Tracking subdomain
 * @param cnameTarget - CNAME target hostname
 * @param ttl - Time to live (default: 3600 seconds)
 * @returns Tracking domain DNS record for API creation
 *
 * @example
 * createTrackingDNSRecord('emailtracking', 'open.sleadtrack.com', 3600)
 * // Returns: { name: 'emailtracking', type: 'CNAME', content: 'open.sleadtrack.com', ... }
 */
export function createTrackingDNSRecord(
  subdomain: string,
  cnameTarget: string,
  ttl: number = DEFAULT_TTL
): TrackingDomainDNSRecord {
  return {
    name: subdomain,
    type: 'CNAME',
    content: cnameTarget,
    ttl,
    proxied: false, // MUST be false for email-related CNAME records
  };
}

/**
 * Validate tracking subdomain format
 *
 * Checks if the subdomain follows DNS naming rules and best practices.
 *
 * @param subdomain - Tracking subdomain to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * validateTrackingSubdomain('emailtracking') // { isValid: true, ... }
 * validateTrackingSubdomain('Email Tracking') // { isValid: false, errors: [...] }
 */
export function validateTrackingSubdomain(subdomain: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty subdomain
  if (!subdomain || subdomain.trim() === '') {
    errors.push('Tracking subdomain cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Check length (DNS subdomain max: 63 characters)
  if (subdomain.length > 63) {
    errors.push(
      `Tracking subdomain is too long (${subdomain.length} chars). ` +
      'Maximum length is 63 characters.'
    );
  }

  // Check for invalid characters
  // Valid: lowercase letters, numbers, hyphens (not at start/end)
  const validSubdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!validSubdomainRegex.test(subdomain)) {
    errors.push(
      `Invalid subdomain format: "${subdomain}". ` +
      'Subdomains must contain only lowercase letters, numbers, and hyphens ' +
      '(hyphens cannot be at the start or end).'
    );
  }

  // Check for uppercase (convert to lowercase recommendation)
  if (subdomain !== subdomain.toLowerCase()) {
    errors.push(
      `Subdomain "${subdomain}" contains uppercase letters. ` +
      'DNS subdomains must be lowercase.'
    );
  }

  // Check for spaces
  if (subdomain.includes(' ')) {
    errors.push(
      `Subdomain "${subdomain}" contains spaces. ` +
      'Spaces are not allowed in DNS subdomains.'
    );
  }

  // Check for special characters
  const hasSpecialChars = /[^a-z0-9-]/.test(subdomain);
  if (hasSpecialChars) {
    errors.push(
      `Subdomain "${subdomain}" contains invalid characters. ` +
      'Only lowercase letters, numbers, and hyphens are allowed.'
    );
  }

  // Warning: Very long subdomain (> 30 chars)
  if (subdomain.length > 30) {
    warnings.push(
      `Subdomain is quite long (${subdomain.length} chars). ` +
      'Consider using a shorter subdomain like "track" or "link".'
    );
  }

  // Warning: Multiple consecutive hyphens
  if (subdomain.includes('--')) {
    warnings.push(
      'Subdomain contains consecutive hyphens. ' +
      'This is valid but may look unusual.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate domain format
 *
 * Basic domain validation to ensure it's a valid DNS domain.
 *
 * @param domain - Domain name
 * @returns true if valid domain format
 *
 * @example
 * isValidDomain('example.com') // true
 * isValidDomain('invalid domain') // false
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation regex
  // Allows: lowercase letters, numbers, hyphens, and dots
  // Must end with a TLD (at least 2 characters)
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Get setup instructions for Smartlead custom tracking domain
 *
 * Returns step-by-step instructions for users to configure the tracking domain
 * in Smartlead after the DNS CNAME record has been created.
 *
 * @param trackingURL - Full tracking URL (e.g., "http://emailtracking.example.com")
 * @returns Setup instructions for Smartlead
 *
 * @example
 * getSmartleadTrackingInstructions('http://track.example.com')
 */
export function getSmartleadTrackingInstructions(trackingURL: string): string[] {
  return [
    'Log in to your Smartlead account',
    'Navigate to Settings > Email Accounts',
    'Select the email account you want to configure',
    'Scroll to "Custom Tracking Domain" section',
    `Enter the tracking URL: ${trackingURL}`,
    'Click "Verify CNAME" to check DNS propagation',
    'Wait for DNS propagation (typically 5-30 minutes)',
    'Once verified, your custom tracking domain is active',
    'All tracking links in emails will now use your custom domain',
  ];
}

/**
 * Generate tracking domain recommendations based on domain
 *
 * Suggests appropriate tracking subdomains for the given domain.
 *
 * @returns Array of recommended tracking subdomains
 *
 * @example
 * getTrackingSubdomainRecommendations()
 * // Returns: ['emailtracking', 'track', 'link', 'click']
 */
export function getTrackingSubdomainRecommendations(): string[] {
  return Array.from(RECOMMENDED_TRACKING_SUBDOMAINS);
}

/**
 * Validate if tracking domain CNAME is configured correctly
 *
 * Checks if the CNAME record is properly set up by querying DNS.
 * Note: This is a placeholder - actual implementation would use DNS lookup.
 *
 * @param _fullTrackingDomain - Full tracking domain (e.g., "track.example.com")
 * @param _expectedTarget - Expected CNAME target
 * @returns Validation result
 */
export async function validateTrackingDomainCNAME(
): Promise<{
  isValid: boolean;
  actualTarget?: string;
  errors: string[];
}> {
  // Placeholder: Real implementation would use DNS lookup
  // This would be implemented in Task 6.2 (Smartlead Tracking Domain Verification)
  return {
    isValid: false,
    errors: ['DNS validation not yet implemented. Use nslookup or dig to verify manually.'],
  };
}
