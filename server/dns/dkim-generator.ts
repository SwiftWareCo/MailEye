/**
 * DKIM Key Generation Service (Task 3.5)
 *
 * Generate DKIM TXT records for Google Workspace with 2048-bit keys.
 * Handles DNS providers with 255-character TXT record limits by splitting
 * long public keys into multiple quoted strings.
 *
 * Key features:
 * - Google Workspace DKIM record generation
 * - 2048-bit RSA key support (Google recommended)
 * - Character limit handling for DNS providers
 * - TXT record value splitting for 255-char limits
 * - DKIM syntax validation
 *
 * @example
 * const result = await generateGoogleWorkspaceDKIM('example.com');
 * // Returns: google._domainkey.example.com TXT record with split values
 */

import {
  DKIMGenerationConfig,
  DKIMGenerationResult,
  DKIMDNSRecord,
  EmailProvider,
} from '@/lib/types/dns';

/**
 * Maximum characters per DNS TXT string (RFC 1035)
 * DNS TXT records can contain multiple strings, each max 255 chars
 */
const DNS_TXT_STRING_LIMIT = 255;

/**
 * Default DKIM selectors by provider
 */
const DEFAULT_SELECTORS: Record<EmailProvider, string> = {
  google_workspace: 'google',
  microsoft365: 'selector1',
  custom: 'default',
};

/**
 * Generate Google Workspace DKIM TXT record
 *
 * Google Workspace generates DKIM keys through their Admin Console.
 * This function creates the TXT record structure that would be used
 * after obtaining the public key from Google.
 *
 * @param domain - Domain name (e.g., "example.com")
 * @param publicKey - DKIM public key from Google Workspace Admin Console
 * @param options - Optional configuration
 * @returns DKIM generation result with DNS record details
 *
 * @example
 * const result = await generateGoogleWorkspaceDKIM('example.com', publicKeyFromGoogle);
 * console.log(result.recordName); // "google._domainkey.example.com"
 * console.log(result.recordValue); // "v=DKIM1; k=rsa; p=MIIB..."
 */
export async function generateGoogleWorkspaceDKIM(
  domain: string,
  publicKey: string,
  options: {
    selector?: string;
    keyLength?: number;
    splitForDNSLimit?: boolean;
  } = {}
): Promise<DKIMGenerationResult> {
  const {
    selector = DEFAULT_SELECTORS.google_workspace,
    keyLength = 2048,
    splitForDNSLimit = true,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate domain
  if (!isValidDomain(domain)) {
    errors.push(`Invalid domain: ${domain}`);
  }

  // Validate public key format (base64)
  if (!isValidDKIMPublicKey(publicKey)) {
    errors.push('Invalid DKIM public key format. Expected base64-encoded RSA public key.');
  }

  // Build DKIM record
  const recordName = `${selector}._domainkey.${domain}`;
  const recordValue = buildDKIMRecordValue(publicKey);

  // Check character count
  const characterCount = recordValue.length;
  const requiresSplitting = characterCount > DNS_TXT_STRING_LIMIT;

  // Split record value if needed
  let splitValues: string[] | undefined;
  if (splitForDNSLimit && requiresSplitting) {
    splitValues = splitDKIMRecordValue(recordValue);

    // Validate split result
    if (splitValues.some(v => v.length > DNS_TXT_STRING_LIMIT)) {
      errors.push(
        `DKIM record value exceeds DNS TXT string limit even after splitting. ` +
        `Consider using a shorter key or different DKIM configuration.`
      );
    }

    warnings.push(
      `DKIM record requires splitting for DNS providers with 255-character TXT limits. ` +
      `${splitValues.length} strings will be created.`
    );
  } else if (!splitForDNSLimit && requiresSplitting) {
    warnings.push(
      `DKIM record exceeds 255 characters (${characterCount} chars). ` +
      `Some DNS providers may require splitting the value into multiple strings.`
    );
  }

  // Check key length
  if (keyLength !== 2048 && keyLength !== 1024) {
    warnings.push(
      `Key length ${keyLength} is not standard. Google Workspace supports 1024 or 2048-bit keys. ` +
      `2048-bit is recommended for security.`
    );
  }

  const result: DKIMGenerationResult = {
    success: errors.length === 0,
    domain,
    selector,
    recordName,
    recordType: 'TXT',
    recordValue,
    publicKey,
    keyLength,
    splitValues,
    characterCount,
    requiresSplitting,
    errors,
    warnings,
    generatedAt: new Date(),
  };

  return result;
}

/**
 * Generate DKIM TXT record from configuration
 *
 * @param config - DKIM generation configuration
 * @returns DKIM generation result
 */
export async function generateDKIMRecord(
  config: DKIMGenerationConfig
): Promise<DKIMGenerationResult> {
  const { domain, provider, selector, keyLength = 2048 } = config;

  const errors: string[] = [];
  const warnings: string[] = [];

  // For now, we only support Google Workspace in the automated flow
  // Other providers would require different approaches
  if (provider !== 'google_workspace') {
    errors.push(
      `Provider "${provider}" is not yet supported for automated DKIM generation. ` +
      `Currently, only Google Workspace is supported.`
    );

    return {
      success: false,
      domain,
      selector: selector || DEFAULT_SELECTORS[provider],
      recordName: '',
      recordType: 'TXT',
      recordValue: '',
      publicKey: '',
      keyLength,
      requiresSplitting: false,
      characterCount: 0,
      errors,
      warnings: [],
      generatedAt: new Date(),
    };
  }

  // Check if user has Google Workspace credentials configured
  try {
    const { hasGoogleWorkspaceCredentials } = await import('@/server/credentials/credentials.data');
    const hasCredentials = await hasGoogleWorkspaceCredentials();

    if (!hasCredentials) {
      warnings.push(
        'Google Workspace credentials not configured. DKIM setup requires Google Workspace Admin SDK access.'
      );
      errors.push(
        'Google Workspace not connected. Please configure Google Workspace credentials first, ' +
        'or manually generate DKIM in Google Admin Console.'
      );

      return {
        success: false,
        domain,
        selector: selector || DEFAULT_SELECTORS[provider],
        recordName: `${selector || DEFAULT_SELECTORS[provider]}._domainkey.${domain}`,
        recordType: 'TXT',
        recordValue: '',
        publicKey: '',
        keyLength,
        requiresSplitting: false,
        characterCount: 0,
        errors,
        warnings: [
          ...warnings,
          'Manual DKIM setup:',
          '1. Go to admin.google.com > Apps > Google Workspace > Gmail > Authenticate email',
          '2. Select your domain and click "Generate new record"',
          '3. Choose 2048-bit key length',
          '4. Copy the generated DKIM TXT record and add it to your DNS manually',
        ],
        generatedAt: new Date(),
      };
    }
  } catch (error) {
    console.error('Error checking Google Workspace credentials:', error);
  }

  // Note: In a real implementation, this would integrate with Google Workspace Admin SDK
  // to generate or retrieve the DKIM public key. For now, this returns an instructional result.
  return {
    success: false,
    domain,
    selector: selector || DEFAULT_SELECTORS[provider],
    recordName: `${selector || DEFAULT_SELECTORS[provider]}._domainkey.${domain}`,
    recordType: 'TXT',
    recordValue: '',
    publicKey: '',
    keyLength,
    requiresSplitting: false,
    characterCount: 0,
    errors: [
      'DKIM key generation requires Google Workspace Admin SDK integration. ' +
      'Please generate the DKIM key in Google Workspace Admin Console and provide the public key.'
    ],
    warnings: [
      'To generate DKIM in Google Workspace: ' +
      '1. Go to admin.google.com > Apps > Google Workspace > Gmail > Authenticate email ' +
      '2. Select your domain and click "Generate new record" ' +
      '3. Choose 2048-bit key length ' +
      '4. Copy the generated public key'
    ],
    generatedAt: new Date(),
  };
}

/**
 * Build DKIM TXT record value from public key
 *
 * Format: v=DKIM1; k=rsa; p=<base64-encoded-public-key>
 *
 * @param publicKey - Base64-encoded public key
 * @returns DKIM record value
 */
export function buildDKIMRecordValue(publicKey: string): string {
  // Remove whitespace and newlines from public key
  const cleanKey = publicKey.replace(/\s+/g, '');

  // Build DKIM record (standard format)
  return `v=DKIM1; k=rsa; p=${cleanKey}`;
}

/**
 * Split DKIM record value into multiple strings for DNS providers with 255-char limit
 *
 * DNS TXT records can contain multiple strings, each quoted and separated by spaces.
 * Example: "v=DKIM1; k=rsa; p=MIIB..." "IjANBgkq..." "hkiG9w0B..."
 *
 * @param recordValue - Full DKIM record value
 * @returns Array of strings, each ≤ 255 characters
 */
export function splitDKIMRecordValue(recordValue: string): string[] {
  const strings: string[] = [];

  // If record is already under the limit, return as-is (without quotes)
  if (recordValue.length <= DNS_TXT_STRING_LIMIT) {
    return [recordValue];
  }

  // Split into chunks of max 255 characters
  let remaining = recordValue;
  while (remaining.length > 0) {
    const chunk = remaining.substring(0, DNS_TXT_STRING_LIMIT);
    strings.push(chunk);
    remaining = remaining.substring(DNS_TXT_STRING_LIMIT);
  }

  return strings;
}

/**
 * Format split DKIM values for DNS provider input
 *
 * Returns the formatted string that should be entered in DNS provider's TXT record value field.
 * Format: "string1" "string2" "string3"
 *
 * @param splitValues - Array of split strings
 * @returns Formatted string for DNS entry
 */
export function formatSplitDKIMForDNS(splitValues: string[]): string {
  return splitValues.map(s => `"${s}"`).join(' ');
}

/**
 * Create DKIM DNS record object for Cloudflare API
 *
 * @param dkimResult - DKIM generation result
 * @param ttl - Time to live (default: 3600 seconds)
 * @returns DKIM DNS record for API creation
 */
export function createDKIMDNSRecord(
  dkimResult: DKIMGenerationResult,
  ttl: number = 3600
): DKIMDNSRecord {
  // For Cloudflare, if the record value is split, we need to format it properly
  const content = dkimResult.splitValues
    ? formatSplitDKIMForDNS(dkimResult.splitValues)
    : dkimResult.recordValue;

  return {
    name: dkimResult.recordName.replace(`.${dkimResult.domain}`, ''), // Remove domain suffix for Cloudflare
    type: 'TXT',
    content,
    ttl,
  };
}

/**
 * Validate DKIM record syntax
 *
 * @param recordValue - DKIM TXT record value
 * @returns Validation result
 */
export function validateDKIMRecord(recordValue: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required DKIM version tag
  if (!recordValue.includes('v=DKIM1')) {
    errors.push('Missing required DKIM version tag: v=DKIM1');
  }

  // Check for required key type tag
  if (!recordValue.includes('k=rsa') && !recordValue.includes('k=ed25519')) {
    errors.push('Missing required key type tag: k=rsa or k=ed25519');
  }

  // Check for required public key tag
  if (!recordValue.includes('p=')) {
    errors.push('Missing required public key tag: p=');
  } else {
    // Validate public key is not empty
    const publicKeyMatch = recordValue.match(/p=([^;\s]+)/);
    if (!publicKeyMatch || !publicKeyMatch[1] || publicKeyMatch[1].length === 0) {
      errors.push('Public key value is empty');
    }
  }

  // Check record length
  if (recordValue.length > 512) {
    warnings.push(
      `DKIM record is very long (${recordValue.length} chars). ` +
      `Consider splitting for DNS providers with character limits.`
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
 * @param domain - Domain name
 * @returns true if valid
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation regex
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Validate DKIM public key format
 *
 * DKIM public keys are base64-encoded RSA or Ed25519 keys
 *
 * @param publicKey - Public key string
 * @returns true if valid base64
 */
function isValidDKIMPublicKey(publicKey: string): boolean {
  // Remove whitespace
  const cleaned = publicKey.replace(/\s+/g, '');

  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(cleaned) && cleaned.length > 0;
}

/**
 * Get DKIM selector recommendation based on provider
 *
 * @param provider - Email provider
 * @returns Recommended DKIM selector
 */
export function getRecommendedDKIMSelector(provider: EmailProvider): string {
  return DEFAULT_SELECTORS[provider];
}

/**
 * Generate instructions for Google Workspace DKIM setup
 *
 * @param domain - Domain name
 * @returns Step-by-step setup instructions
 */
export function getGoogleWorkspaceDKIMInstructions(domain: string): string[] {
  return [
    'Log in to Google Workspace Admin Console (admin.google.com)',
    'Navigate to Apps > Google Workspace > Gmail',
    'Click on "Authenticate email"',
    `Select domain: ${domain}`,
    'Click "Generate new record"',
    'Choose DKIM key length: 2048 bits (recommended)',
    'Click "Generate"',
    'Copy the generated DKIM TXT record value',
    'Use this tool to add the DKIM record to your DNS (Cloudflare)',
    'Return to Google Admin Console and click "Start authentication"',
  ];
}
