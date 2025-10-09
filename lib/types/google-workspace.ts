/**
 * Google Workspace Domain Management Types
 *
 * Types for managing domains in Google Workspace via Directory API
 */

/**
 * Domain verification status in Google Workspace
 */
export type GoogleWorkspaceDomainStatus =
  | 'pending_verification'  // Domain added, awaiting verification
  | 'verified'              // Domain verified by Google
  | 'verification_failed';  // Verification failed

/**
 * Google Workspace domain object (from Directory API)
 */
export interface GoogleWorkspaceDomain {
  domainName: string;
  isPrimary?: boolean;
  verified?: boolean;
  creationTime?: string;
}

/**
 * Domain verification method types
 */
export type DomainVerificationMethod =
  | 'txt'   // TXT record (google-site-verification)
  | 'meta'  // HTML meta tag
  | 'file'; // HTML file upload

/**
 * Domain verification token/record
 */
export interface DomainVerificationToken {
  method: DomainVerificationMethod;
  token: string;
  recordName?: string;  // For TXT records
  recordValue?: string; // For TXT records
}

/**
 * Result from adding domain to Google Workspace
 */
export interface AddDomainToGoogleWorkspaceResult {
  success: boolean;
  domain?: GoogleWorkspaceDomain;
  verificationToken?: DomainVerificationToken;
  error?: string;
  alreadyExists?: boolean; // Flag indicating domain was already present (idempotency)
}

/**
 * Result from removing domain from Google Workspace
 */
export interface RemoveDomainFromGoogleWorkspaceResult {
  success: boolean;
  error?: string;
}

/**
 * Result from checking domain verification status
 */
export interface DomainVerificationStatusResult {
  domain: string;
  verified: boolean;
  status: GoogleWorkspaceDomainStatus;
  verificationToken?: DomainVerificationToken;
  error?: string;
}

/**
 * Configuration for domain operations
 */
export interface GoogleWorkspaceDomainConfig {
  domain: string;
  customerId?: string; // Google Workspace customer ID (default: 'my_customer')
}
