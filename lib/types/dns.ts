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
