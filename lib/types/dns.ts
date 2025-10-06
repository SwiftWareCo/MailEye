/**
 * DNS Management Types
 * Type definitions for DNS records, SPF, DKIM, DMARC, and email authentication
 */

/**
 * DNS record types supported
 */
export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';

/**
 * SPF mechanism types
 */
export type SPFMechanismType =
  | 'include'  // include:domain.com (triggers DNS lookup)
  | 'a'        // a:domain.com (triggers DNS lookup)
  | 'mx'       // mx:domain.com (triggers DNS lookup)
  | 'ptr'      // ptr:domain.com (triggers DNS lookup - deprecated)
  | 'exists'   // exists:domain.com (triggers DNS lookup)
  | 'ip4'      // ip4:192.168.1.1/24 (no DNS lookup)
  | 'ip6'      // ip6:2001:db8::/32 (no DNS lookup)
  | 'all';     // ~all, -all, +all, ?all (no DNS lookup)

/**
 * SPF qualifier (determines action on match)
 */
export type SPFQualifier =
  | '+'  // Pass (default if no qualifier)
  | '-'  // Fail
  | '~'  // SoftFail (commonly used for ~all)
  | '?'; // Neutral

/**
 * Individual SPF mechanism
 */
export interface SPFMechanism {
  type: SPFMechanismType;
  qualifier: SPFQualifier;
  value?: string; // e.g., "_spf.google.com" for include:_spf.google.com
  raw: string;    // Original mechanism string
}

/**
 * Parsed SPF record structure
 */
export interface ParsedSPFRecord {
  version: string;              // Always "spf1"
  mechanisms: SPFMechanism[];   // All mechanisms in order
  includes: string[];           // List of include: domains
  ipv4Addresses: string[];      // List of ip4: addresses/ranges
  ipv6Addresses: string[];      // List of ip6: addresses/ranges
  hasAll: boolean;              // Whether record ends with ~all or -all
  allQualifier?: SPFQualifier;  // Qualifier for "all" mechanism
  rawRecord: string;            // Original SPF record
}

/**
 * SPF validation result
 */
export interface SPFValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  lookupCount: number;          // Total DNS lookups (must be ≤ 10)
  exceedsLookupLimit: boolean;  // true if > 10 lookups
  characterCount: number;       // Total characters (must be ≤ 512)
  exceedsCharLimit: boolean;    // true if > 512 chars
}

/**
 * SPF flattening configuration
 */
export interface SPFFlatteningConfig {
  domain: string;
  originalSPF: string;
  additionalIncludes?: string[]; // Extra includes to add (e.g., smartlead.ai)
  preserveIncludes?: string[];   // Includes to NOT flatten (keep as-is)
  removeIncludes?: string[];     // Includes to remove entirely
  ipv6Support: boolean;          // Include IPv6 addresses
}

/**
 * Flattened SPF result
 */
export interface FlattenedSPFResult {
  success: boolean;
  flattenedRecord: string;
  originalRecord: string;
  lookupCountBefore: number;
  lookupCountAfter: number;
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  resolvedIncludes: ResolvedInclude[];
  characterCount: number;
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

/**
 * Resolved include with its IPs
 */
export interface ResolvedInclude {
  domain: string;
  ipv4: string[];
  ipv6: string[];
  nestedLookups: number; // DNS lookups this include caused
  error?: string;
}

/**
 * SPF lookup result from recursive DNS resolution
 * (Task 3.2)
 */
export interface SPFLookupResult {
  domain: string;
  spfRecord?: string;              // Raw SPF record (if found)
  parsedRecord?: ParsedSPFRecord;  // Parsed SPF record
  ipv4Addresses: string[];         // All resolved IPv4 addresses
  ipv6Addresses: string[];         // All resolved IPv6 addresses
  includeChains: SPFIncludeChain[]; // All include resolution chains
  totalLookups: number;            // Total DNS lookups (recursive count)
  exceedsLimit: boolean;           // true if > 10 lookups
  errors: string[];                // Errors during resolution
  warnings: string[];              // Warnings during resolution
  resolvedAt: Date;                // When resolution occurred
}

/**
 * SPF include resolution chain
 * Tracks the path of nested includes and their DNS lookups
 * (Task 3.2)
 */
export interface SPFIncludeChain {
  domain: string;                  // The include domain
  depth: number;                   // Nesting depth (0 = top level)
  spfRecord?: string;              // SPF record found
  ipv4: string[];                  // IPv4 addresses from this include
  ipv6: string[];                  // IPv6 addresses from this include
  lookupCount: number;             // DNS lookups this chain caused
  nestedIncludes: SPFIncludeChain[]; // Nested includes
  error?: string;                  // Error if resolution failed
  circular: boolean;               // true if circular dependency detected
}

/**
 * DMARC policy options
 */
export type DMARCPolicy = 'none' | 'quarantine' | 'reject';

/**
 * DMARC alignment mode
 */
export type DMARCAlignment = 'r' | 's'; // relaxed or strict

/**
 * Parsed DMARC record
 */
export interface ParsedDMARCRecord {
  version: string;              // Always "DMARC1"
  policy: DMARCPolicy;
  subdomainPolicy?: DMARCPolicy;
  percentage: number;           // 0-100
  spfAlignment: DMARCAlignment;
  dkimAlignment: DMARCAlignment;
  aggregateReportEmail?: string; // rua tag
  forensicReportEmail?: string;  // ruf tag
  reportingInterval?: number;    // seconds
  rawRecord: string;
}

/**
 * DKIM record information
 */
export interface DKIMRecord {
  selector: string;             // e.g., "google", "default", "k1"
  domain: string;
  publicKey: string;
  algorithm: 'rsa-sha256' | 'ed25519-sha256';
  keyType: 'rsa' | 'ed25519';
  keyLength?: number;           // 2048, 4096, etc.
  rawRecord: string;
}

/**
 * DKIM key length options
 */
export type DKIMKeyLength = 1024 | 2048 | 4096;

/**
 * Email provider for DKIM generation
 */
export type EmailProvider = 'google_workspace' | 'microsoft365' | 'custom';

/**
 * DKIM generation configuration (Task 3.5)
 */
export interface DKIMGenerationConfig {
  domain: string;
  provider: EmailProvider;
  selector?: string;            // Default: "google" for GWS, "selector1" for M365
  keyLength?: DKIMKeyLength;    // Default: 2048
  splitForDNSLimit?: boolean;   // Split long keys for 255-char DNS limit (default: true)
}

/**
 * Generated DKIM record result (Task 3.5)
 */
export interface DKIMGenerationResult {
  success: boolean;
  domain: string;
  selector: string;
  recordName: string;           // e.g., "google._domainkey.example.com"
  recordType: 'TXT';
  recordValue: string;          // Complete TXT record value
  publicKey: string;            // Raw public key
  keyLength: number;
  splitValues?: string[];       // Split values for DNS providers with 255-char limit
  characterCount: number;       // Total character count
  requiresSplitting: boolean;   // true if > 255 chars
  errors: string[];
  warnings: string[];
  generatedAt: Date;
}

/**
 * Google Workspace DKIM configuration
 */
export interface GoogleWorkspaceDKIMConfig {
  domain: string;
  prefix: string;               // Default: "google"
  keyBitLength: 2048;           // Google supports 1024 or 2048
}

/**
 * DKIM DNS TXT record for Cloudflare creation
 */
export interface DKIMDNSRecord {
  name: string;                 // Record name (e.g., "google._domainkey")
  type: 'TXT';
  content: string;              // TXT record value
  ttl: number;                  // Time to live (default: 3600)
}

/**
 * MX record priority
 */
export interface MXRecord {
  priority: number;
  exchange: string;             // Mail server hostname
}

/**
 * DNS propagation status
 */
export type DNSPropagationStatus = 'pending' | 'propagating' | 'propagated' | 'failed';

/**
 * DNS record with propagation info
 */
export interface DNSRecordWithStatus {
  id: string;
  domainId: string;
  type: DNSRecordType;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  status: string;
  propagationStatus: DNSPropagationStatus;
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Email authentication compliance check
 */
export interface EmailAuthCompliance {
  provider: 'gmail' | 'yahoo' | 'outlook';
  spfPass: boolean;
  dkimPass: boolean;
  dmarcPass: boolean;
  issues: string[];
  recommendations: string[];
}

/**
 * DMARC generation configuration (Task 3.6)
 */
export interface DMARCGenerationConfig {
  domain: string;
  policy: DMARCPolicy;                    // 'none', 'quarantine', 'reject'
  subdomainPolicy?: DMARCPolicy;          // Optional subdomain policy (sp tag)
  percentage?: number;                    // pct tag (0-100), default: 100
  aggregateReportEmail?: string;          // rua tag (email for aggregate reports)
  forensicReportEmail?: string;           // ruf tag (email for forensic reports)
  spfAlignment?: DMARCAlignment;          // aspf tag (r or s), default: r
  dkimAlignment?: DMARCAlignment;         // adkim tag (r or s), default: r
  reportingInterval?: number;             // ri tag (seconds), default: 86400 (24h)
  reportFormat?: string;                  // rf tag, default: afrf
  validateProgression?: boolean;          // Validate policy progression (default: true)
}

/**
 * Generated DMARC record result (Task 3.6)
 */
export interface DMARCGenerationResult {
  success: boolean;
  domain: string;
  recordName: string;                     // e.g., "_dmarc.example.com"
  recordType: 'TXT';
  recordValue: string;                    // Complete DMARC TXT record
  policy: DMARCPolicy;
  subdomainPolicy?: DMARCPolicy;
  percentage: number;
  aggregateReportEmail?: string;
  forensicReportEmail?: string;
  spfAlignment: DMARCAlignment;
  dkimAlignment: DMARCAlignment;
  characterCount: number;                 // Total character count
  errors: string[];
  warnings: string[];
  generatedAt: Date;
}

/**
 * DMARC DNS TXT record for Cloudflare creation
 */
export interface DMARCDNSRecord {
  name: string;                           // Record name (e.g., "_dmarc")
  type: 'TXT';
  content: string;                        // TXT record value
  ttl: number;                            // Time to live (default: 3600)
}

/**
 * DMARC policy progression validation
 */
export interface DMARCPolicyProgression {
  currentPolicy?: DMARCPolicy;
  newPolicy: DMARCPolicy;
  isValid: boolean;
  isSafe: boolean;                        // true if progression is safe
  recommendations: string[];
  warnings: string[];
}

/**
 * MX generation configuration (Task 3.7)
 */
export interface MXGenerationConfig {
  domain: string;
  provider?: 'google_workspace' | 'microsoft365' | 'custom';  // Default: google_workspace
  customRecords?: MXRecord[];           // For custom provider
}

/**
 * Generated MX record result (Task 3.7)
 */
export interface MXGenerationResult {
  success: boolean;
  domain: string;
  recordType: 'MX';
  records: MXRecord[];                  // MX records generated (1 for Google Workspace)
  errors: string[];
  warnings: string[];
  generatedAt: Date;
}

/**
 * MX DNS record for Cloudflare creation
 */
export interface MXDNSRecord {
  name: string;                         // Record name (typically "@" for root domain)
  type: 'MX';
  priority: number;                     // MX priority (lower = higher priority)
  content: string;                      // Mail server hostname
  ttl: number;                          // Time to live (default: 3600)
}

/**
 * Tracking domain provider (Task 3.8)
 */
export type TrackingProvider = 'smartlead';

/**
 * Tracking domain configuration (Task 3.8)
 */
export interface TrackingDomainConfig {
  domain: string;                       // e.g., "yourcompany.com"
  trackingSubdomain: string;            // e.g., "emailtracking", "track", "link"
  provider: TrackingProvider;           // "smartlead" (future: "instantly", etc.)
}

/**
 * Generated tracking domain result (Task 3.8)
 */
export interface TrackingDomainResult {
  success: boolean;
  domain: string;
  trackingSubdomain: string;
  fullTrackingDomain: string;           // e.g., "emailtracking.yourcompany.com"
  trackingURL: string;                  // e.g., "http://emailtracking.yourcompany.com"
  cnameTarget: string;                  // e.g., "open.sleadtrack.com"
  dnsRecord: TrackingDomainDNSRecord;
  errors: string[];
  warnings: string[];
  generatedAt: Date;
}

/**
 * Tracking domain CNAME DNS record for Cloudflare creation (Task 3.8)
 */
export interface TrackingDomainDNSRecord {
  name: string;                         // Subdomain only (e.g., "emailtracking")
  type: 'CNAME';
  content: string;                      // Target (e.g., "open.sleadtrack.com")
  ttl: number;                          // Typically 3600
  proxied: boolean;                     // false for email-related records
}

/**
 * DNS Propagation Monitoring Types (Task 4.1-4.5)
 */

/**
 * DNS server provider for propagation checks
 */
export type DNSServerProvider = 'google' | 'cloudflare' | 'opendns';

/**
 * Single DNS server query result
 * Represents the result of querying one specific nameserver
 */
export interface DNSServerQueryResult {
  server: string;                       // IP address (e.g., '8.8.8.8')
  provider: DNSServerProvider;          // Provider name
  success: boolean;                     // Query succeeded
  records: string[];                    // DNS records found
  matchesExpected: boolean;             // Does it match expectedValue?
  error?: string;                       // Error message if failed
  queriedAt: Date;                      // When query was executed
  responseTime: number;                 // Query duration in milliseconds
}

/**
 * Multi-server DNS query result
 * Aggregates results from querying multiple nameservers
 */
export interface MultiServerQueryResult {
  domain: string;                       // Domain queried
  recordType: 'TXT' | 'MX' | 'CNAME';   // Record type queried
  expectedValue?: string;               // Expected record value (for verification)
  serverResults: DNSServerQueryResult[]; // Individual server results
  propagationPercentage: number;        // 0-100 (percentage of servers with correct value)
  propagatedServers: number;            // Count of servers with expected value
  totalServers: number;                 // Total servers queried
  isPropagated: boolean;                // true if propagationPercentage === 100
  queriedAt: Date;                      // When multi-server query was executed
}
