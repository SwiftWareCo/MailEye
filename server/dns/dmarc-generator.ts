/**
 * DMARC Record Generation Service (Task 3.6)
 *
 * Generate DMARC TXT records with configurable policy (none/quarantine/reject)
 * and policy progression validation for safe transitions.
 *
 * Key features:
 * - DMARC record generation for _dmarc.{domain}
 * - Policy options: none, quarantine, reject
 * - Policy progression validation (none → quarantine → reject)
 * - Configurable reporting (aggregate and forensic)
 * - Alignment mode configuration (SPF/DKIM: relaxed/strict)
 * - Percentage-based policy enforcement
 *
 * @example
 * const result = await generateDMARCRecord({
 *   domain: 'example.com',
 *   policy: 'none',
 *   aggregateReportEmail: 'dmarc@example.com'
 * });
 */

import {
  DMARCPolicy,
  DMARCAlignment,
  DMARCGenerationConfig,
  DMARCGenerationResult,
  DMARCDNSRecord,
  DMARCPolicyProgression,
  ParsedDMARCRecord,
} from '@/lib/types/dns';

/**
 * Default DMARC configuration values
 */
const DEFAULTS = {
  percentage: 100,
  spfAlignment: 'r' as DMARCAlignment,
  dkimAlignment: 'r' as DMARCAlignment,
  reportingInterval: 86400, // 24 hours in seconds
  reportFormat: 'afrf',
};

/**
 * Policy progression rules (safe transitions)
 */
const POLICY_PROGRESSION_MAP: Record<DMARCPolicy, DMARCPolicy[]> = {
  'none': ['none', 'quarantine', 'reject'], // Can progress to any
  'quarantine': ['quarantine', 'reject'],   // Can only progress to reject or stay
  'reject': ['reject'],                      // Can only stay at reject (strongest)
};

/**
 * Generate DMARC TXT record from configuration
 *
 * @param config - DMARC generation configuration
 * @param currentPolicy - Optional current policy for progression validation
 * @returns DMARC generation result
 *
 * @example
 * const result = await generateDMARCRecord({
 *   domain: 'example.com',
 *   policy: 'none',
 *   aggregateReportEmail: 'dmarc@example.com',
 *   percentage: 100
 * });
 */
export async function generateDMARCRecord(
  config: DMARCGenerationConfig,
  currentPolicy?: DMARCPolicy
): Promise<DMARCGenerationResult> {
  const {
    domain,
    policy,
    subdomainPolicy,
    percentage = DEFAULTS.percentage,
    aggregateReportEmail,
    forensicReportEmail,
    spfAlignment = DEFAULTS.spfAlignment,
    dkimAlignment = DEFAULTS.dkimAlignment,
    reportingInterval = DEFAULTS.reportingInterval,
    reportFormat = DEFAULTS.reportFormat,
    validateProgression = true,
  } = config;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate domain
  if (!isValidDomain(domain)) {
    errors.push(`Invalid domain: ${domain}`);
  }

  // Validate policy
  if (!isValidDMARCPolicy(policy)) {
    errors.push(`Invalid DMARC policy: ${policy}. Must be 'none', 'quarantine', or 'reject'.`);
  }

  // Validate subdomain policy if provided
  if (subdomainPolicy && !isValidDMARCPolicy(subdomainPolicy)) {
    errors.push(`Invalid subdomain policy: ${subdomainPolicy}. Must be 'none', 'quarantine', or 'reject'.`);
  }

  // Validate percentage
  if (percentage < 0 || percentage > 100) {
    errors.push(`Invalid percentage: ${percentage}. Must be between 0 and 100.`);
  }

  // Validate alignment modes
  if (!isValidAlignment(spfAlignment)) {
    errors.push(`Invalid SPF alignment: ${spfAlignment}. Must be 'r' (relaxed) or 's' (strict).`);
  }

  if (!isValidAlignment(dkimAlignment)) {
    errors.push(`Invalid DKIM alignment: ${dkimAlignment}. Must be 'r' (relaxed) or 's' (strict).`);
  }

  // Validate email formats
  if (aggregateReportEmail && !isValidEmail(aggregateReportEmail)) {
    errors.push(`Invalid aggregate report email: ${aggregateReportEmail}`);
  }

  if (forensicReportEmail && !isValidEmail(forensicReportEmail)) {
    errors.push(`Invalid forensic report email: ${forensicReportEmail}`);
  }

  // Validate policy progression if enabled
  if (validateProgression && currentPolicy) {
    const progression = validatePolicyProgression(currentPolicy, policy);
    if (!progression.isSafe) {
      warnings.push(...progression.warnings);
      warnings.push(...progression.recommendations);
    }
  }

  // Add warnings for policy-specific recommendations
  if (policy === 'none' && percentage !== 100) {
    warnings.push(
      `Policy is 'none' (monitoring only) but percentage is ${percentage}%. ` +
      `Consider setting percentage to 100 for complete monitoring.`
    );
  }

  if (policy === 'reject' && percentage < 100) {
    warnings.push(
      `Policy is 'reject' but percentage is ${percentage}%. ` +
      `Some emails will be rejected while others pass. ` +
      `Consider starting with 'quarantine' or lower percentage.`
    );
  }

  if (!aggregateReportEmail) {
    warnings.push(
      'No aggregate report email specified (rua tag). ' +
      'You will not receive DMARC aggregate reports. ' +
      'Consider adding a reporting email to monitor authentication.'
    );
  }

  // Build DMARC record
  const recordName = `_dmarc.${domain}`;
  const recordValue = buildDMARCRecordValue({
    policy,
    subdomainPolicy,
    percentage,
    aggregateReportEmail,
    forensicReportEmail,
    spfAlignment,
    dkimAlignment,
    reportingInterval,
    reportFormat,
  });

  const characterCount = recordValue.length;

  // Check character count (DMARC records shouldn't exceed 512 chars, though typically much shorter)
  if (characterCount > 512) {
    warnings.push(
      `DMARC record is long (${characterCount} chars). ` +
      `Some DNS providers may have issues with records over 512 characters.`
    );
  }

  const result: DMARCGenerationResult = {
    success: errors.length === 0,
    domain,
    recordName,
    recordType: 'TXT',
    recordValue,
    policy,
    subdomainPolicy,
    percentage,
    aggregateReportEmail,
    forensicReportEmail,
    spfAlignment,
    dkimAlignment,
    characterCount,
    errors,
    warnings,
    generatedAt: new Date(),
  };

  return result;
}

/**
 * Build DMARC TXT record value from configuration
 *
 * Format: v=DMARC1; p=policy; sp=subdomain_policy; pct=percentage; rua=mailto:email; ...
 *
 * @param config - DMARC record configuration
 * @returns DMARC record value
 */
export function buildDMARCRecordValue(config: {
  policy: DMARCPolicy;
  subdomainPolicy?: DMARCPolicy;
  percentage?: number;
  aggregateReportEmail?: string;
  forensicReportEmail?: string;
  spfAlignment?: DMARCAlignment;
  dkimAlignment?: DMARCAlignment;
  reportingInterval?: number;
  reportFormat?: string;
}): string {
  const tags: string[] = [];

  // Required: DMARC version
  tags.push('v=DMARC1');

  // Required: Policy
  tags.push(`p=${config.policy}`);

  // Optional: Subdomain policy
  if (config.subdomainPolicy) {
    tags.push(`sp=${config.subdomainPolicy}`);
  }

  // Optional: Percentage (only include if not 100)
  if (config.percentage !== undefined && config.percentage !== 100) {
    tags.push(`pct=${config.percentage}`);
  }

  // Optional: Aggregate reports email
  if (config.aggregateReportEmail) {
    tags.push(`rua=mailto:${config.aggregateReportEmail}`);
  }

  // Optional: Forensic reports email
  if (config.forensicReportEmail) {
    tags.push(`ruf=mailto:${config.forensicReportEmail}`);
  }

  // Optional: SPF alignment mode (only include if strict)
  if (config.spfAlignment === 's') {
    tags.push(`aspf=s`);
  }

  // Optional: DKIM alignment mode (only include if strict)
  if (config.dkimAlignment === 's') {
    tags.push(`adkim=s`);
  }

  // Optional: Reporting interval (only include if not default 86400)
  if (config.reportingInterval && config.reportingInterval !== 86400) {
    tags.push(`ri=${config.reportingInterval}`);
  }

  // Optional: Report format (only include if not default afrf)
  if (config.reportFormat && config.reportFormat !== 'afrf') {
    tags.push(`rf=${config.reportFormat}`);
  }

  return tags.join('; ');
}

/**
 * Validate DMARC policy progression
 *
 * Ensures safe transitions between DMARC policies:
 * - none → quarantine → reject (recommended)
 * - Jumping from 'none' to 'reject' is not recommended
 *
 * @param currentPolicy - Current DMARC policy
 * @param newPolicy - Desired new DMARC policy
 * @returns Policy progression validation result
 */
export function validatePolicyProgression(
  currentPolicy: DMARCPolicy,
  newPolicy: DMARCPolicy
): DMARCPolicyProgression {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const allowedProgression = POLICY_PROGRESSION_MAP[currentPolicy];
  const isValid = allowedProgression.includes(newPolicy);

  // Determine if the progression is safe
  // Safe progressions:
  // - none → none (no change)
  // - none → quarantine (forward progression)
  // - quarantine → quarantine (no change)
  // - quarantine → reject (forward progression)
  // - reject → reject (no change)
  //
  // Unsafe progressions:
  // - none → reject (skips quarantine)
  // - quarantine → none (regression)
  // - reject → quarantine (regression)
  // - reject → none (regression)
  const policyOrder: Record<DMARCPolicy, number> = {
    'none': 0,
    'quarantine': 1,
    'reject': 2,
  };

  const currentLevel = policyOrder[currentPolicy];
  const newLevel = policyOrder[newPolicy];

  // Safe if progressing forward one step or staying the same
  // Unsafe if jumping forward more than one step or regressing
  const isSafe = (newLevel === currentLevel) || (newLevel === currentLevel + 1);

  if (currentPolicy === 'none' && newPolicy === 'reject') {
    warnings.push(
      'Jumping directly from "none" to "reject" is not recommended. ' +
      'This could result in legitimate emails being blocked.'
    );
    recommendations.push(
      'Consider progressing to "quarantine" first and monitor DMARC reports for 30+ days ' +
      'before moving to "reject".'
    );
  }

  if (currentPolicy === 'quarantine' && newPolicy === 'none') {
    warnings.push(
      'Moving from "quarantine" back to "none" weakens email security. ' +
      'This is a regression in DMARC enforcement.'
    );
    recommendations.push(
      'Only revert to "none" if you are experiencing deliverability issues and need to debug authentication.'
    );
  }

  if (currentPolicy === 'reject' && newPolicy !== 'reject') {
    warnings.push(
      'Moving from "reject" to a weaker policy is not recommended. ' +
      'Your domain will be more vulnerable to spoofing.'
    );
    recommendations.push(
      'Only revert from "reject" if you are experiencing critical deliverability issues.'
    );
  }

  return {
    currentPolicy,
    newPolicy,
    isValid,
    isSafe,
    recommendations,
    warnings,
  };
}

/**
 * Get recommended DMARC policy based on domain age and readiness
 *
 * @param domainAgeDays - Number of days since domain was added
 * @param hasValidSPF - Whether SPF is correctly configured
 * @param hasValidDKIM - Whether DKIM is correctly configured
 * @returns Recommended policy and explanation
 */
export function getRecommendedDMARCPolicy(
  domainAgeDays: number,
  hasValidSPF: boolean,
  hasValidDKIM: boolean
): {
  policy: DMARCPolicy;
  percentage: number;
  reason: string;
} {
  // Must have at least one authentication method
  if (!hasValidSPF && !hasValidDKIM) {
    return {
      policy: 'none',
      percentage: 100,
      reason: 'SPF and DKIM are not configured. Set up authentication before enforcing DMARC.',
    };
  }

  // New domain (< 30 days): Start with monitoring
  if (domainAgeDays < 30) {
    return {
      policy: 'none',
      percentage: 100,
      reason: 'New domain. Start with monitoring policy to collect DMARC reports and ensure authentication is working.',
    };
  }

  // 30-90 days: Move to quarantine
  if (domainAgeDays >= 30 && domainAgeDays < 90) {
    return {
      policy: 'quarantine',
      percentage: 100,
      reason: 'Domain is established. Move to quarantine policy to mark suspicious emails while monitoring results.',
    };
  }

  // 90+ days: Move to reject
  return {
    policy: 'reject',
    percentage: 100,
    reason: 'Domain is well-established. Move to reject policy for maximum protection against spoofing.',
  };
}

/**
 * Parse DMARC TXT record value
 *
 * @param recordValue - DMARC TXT record value
 * @returns Parsed DMARC record
 */
export function parseDMARCRecord(recordValue: string): ParsedDMARCRecord | null {
  // Remove whitespace and normalize
  const normalized = recordValue.replace(/\s+/g, ' ').trim();

  // Split into tags
  const tags = normalized.split(';').map(t => t.trim()).filter(t => t.length > 0);

  // Parse tags into key-value pairs
  const tagMap: Record<string, string> = {};
  tags.forEach(tag => {
    const [key, value] = tag.split('=').map(s => s.trim());
    if (key && value) {
      tagMap[key] = value;
    }
  });

  // Validate version
  if (tagMap.v !== 'DMARC1') {
    return null;
  }

  // Extract policy (required)
  const policy = tagMap.p as DMARCPolicy;
  if (!policy || !isValidDMARCPolicy(policy)) {
    return null;
  }

  return {
    version: tagMap.v,
    policy,
    subdomainPolicy: tagMap.sp as DMARCPolicy | undefined,
    percentage: tagMap.pct ? parseInt(tagMap.pct, 10) : 100,
    spfAlignment: (tagMap.aspf as DMARCAlignment) || 'r',
    dkimAlignment: (tagMap.adkim as DMARCAlignment) || 'r',
    aggregateReportEmail: tagMap.rua?.replace('mailto:', ''),
    forensicReportEmail: tagMap.ruf?.replace('mailto:', ''),
    reportingInterval: tagMap.ri ? parseInt(tagMap.ri, 10) : undefined,
    rawRecord: recordValue,
  };
}

/**
 * Validate DMARC TXT record syntax
 *
 * @param recordValue - DMARC TXT record value
 * @returns Validation result
 */
export function validateDMARCRecord(recordValue: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required DMARC version tag
  if (!recordValue.includes('v=DMARC1')) {
    errors.push('Missing required DMARC version tag: v=DMARC1');
  }

  // Check for required policy tag
  if (!recordValue.match(/p=(none|quarantine|reject)/)) {
    errors.push('Missing or invalid required policy tag: p=none|quarantine|reject');
  }

  // Parse the record
  const parsed = parseDMARCRecord(recordValue);
  if (!parsed && recordValue.includes('v=DMARC1')) {
    errors.push('Failed to parse DMARC record. Check syntax.');
  }

  if (parsed) {
    // Validate percentage
    if (parsed.percentage < 0 || parsed.percentage > 100) {
      errors.push(`Invalid percentage: ${parsed.percentage}. Must be 0-100.`);
    }

    // Check for reporting email
    if (!parsed.aggregateReportEmail && !parsed.forensicReportEmail) {
      warnings.push('No reporting email specified. You will not receive DMARC reports.');
    }

    // Check policy strength
    if (parsed.policy === 'none') {
      warnings.push('Policy is "none" (monitoring only). Emails will not be filtered based on DMARC.');
    }
  }

  // Check record length
  if (recordValue.length > 512) {
    warnings.push(
      `DMARC record is very long (${recordValue.length} chars). ` +
      `Some DNS providers may have issues with records over 512 characters.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create DMARC DNS record object for Cloudflare API
 *
 * @param dmarcResult - DMARC generation result
 * @param ttl - Time to live (default: 3600 seconds)
 * @returns DMARC DNS record for API creation
 */
export function createDMARCDNSRecord(
  dmarcResult: DMARCGenerationResult,
  ttl: number = 3600
): DMARCDNSRecord {
  return {
    name: '_dmarc', // Cloudflare auto-appends domain
    type: 'TXT',
    content: dmarcResult.recordValue,
    ttl,
  };
}

/**
 * Validate domain format
 *
 * @param domain - Domain name
 * @returns true if valid
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation regex
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Validate DMARC policy value
 *
 * @param policy - Policy value
 * @returns true if valid
 */
function isValidDMARCPolicy(policy: string): policy is DMARCPolicy {
  return ['none', 'quarantine', 'reject'].includes(policy);
}

/**
 * Validate DMARC alignment mode
 *
 * @param alignment - Alignment mode
 * @returns true if valid
 */
function isValidAlignment(alignment: string): alignment is DMARCAlignment {
  return alignment === 'r' || alignment === 's';
}

/**
 * Validate email format
 *
 * @param email - Email address
 * @returns true if valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate instructions for DMARC setup
 *
 * @param domain - Domain name
 * @param policy - DMARC policy
 * @returns Step-by-step setup instructions
 */
export function getDMARCSetupInstructions(domain: string, policy: DMARCPolicy): string[] {
  const baseInstructions = [
    `Set up DMARC for domain: ${domain}`,
    'Ensure SPF and DKIM are properly configured first',
    `Create TXT record for _dmarc.${domain}`,
    'Add the generated DMARC record value to your DNS',
    'Wait for DNS propagation (typically 5-30 minutes)',
  ];

  const policySpecific: Record<DMARCPolicy, string[]> = {
    none: [
      'Policy is set to "none" (monitoring only)',
      'Monitor DMARC aggregate reports for 30+ days',
      'Verify all legitimate email sources are authenticating correctly',
      'Once confident, progress to "quarantine" policy',
    ],
    quarantine: [
      'Policy is set to "quarantine"',
      'Failing emails will be marked as suspicious',
      'Monitor quarantine folder for false positives',
      'After 30-60 days of clean reports, consider moving to "reject"',
    ],
    reject: [
      'Policy is set to "reject" (strongest protection)',
      'Failing emails will be blocked entirely',
      'Ensure all legitimate sending sources have proper SPF/DKIM',
      'Monitor DMARC reports regularly for any issues',
    ],
  };

  return [...baseInstructions, ...policySpecific[policy]];
}
