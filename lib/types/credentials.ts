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
  // Bearer token for advanced features (undocumented SmartLead UI endpoint)
  bearerToken?: string;
  tokenExpiresAt?: string;
  // Email/password for token refresh (password encrypted via Stack Auth)
  email?: string;
  password?: string;
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
