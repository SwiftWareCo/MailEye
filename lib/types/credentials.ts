/**
 * Centralized Credentials Type Definitions
 *
 * All service credentials stored in Stack Auth serverMetadata
 */

/**
 * Cloudflare API credentials
 */
export interface CloudflareCredentials {
  apiToken: string;
  accountId: string;
  connectedAt: string;
}

/**
 * Google Workspace Admin SDK credentials
 */
export interface GoogleWorkspaceCredentials {
  serviceAccountEmail: string;
  privateKey: string;
  adminEmail: string;
  customerId?: string;
  connectedAt: string;
}

/**
 * Smartlead API credentials
 */
export interface SmartleadCredentials {
  apiKey: string;
  connectedAt: string;
}

/**
 * Complete user credentials structure stored in Stack Auth serverMetadata
 */
export interface UserCredentials {
  cloudflare?: CloudflareCredentials;
  googleWorkspace?: GoogleWorkspaceCredentials;
  smartlead?: SmartleadCredentials;
}

/**
 * Credential validation result
 */
export interface CredentialValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}
