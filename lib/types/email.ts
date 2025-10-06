/**
 * Email provisioning and management type definitions
 */

/**
 * Parameters for creating a new email account
 */
export interface CreateEmailAccountParams {
  domain: string;
  username: string;
  firstName: string;
  lastName: string;
  password?: string; // Optional: will be auto-generated if not provided
  displayName?: string;
}

/**
 * SMTP server configuration
 */
export interface SmtpCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
}

/**
 * IMAP server configuration
 */
export interface ImapCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
}

/**
 * Combined SMTP and IMAP credentials for an email account
 */
export interface EmailCredentials {
  email: string;
  smtp: SmtpCredentials;
  imap: ImapCredentials;
}

/**
 * Result of email account creation
 */
export interface EmailAccountResult {
  success: boolean;
  email: string;
  credentials: EmailCredentials;
  provider: 'google_workspace' | 'microsoft365' | 'custom';
  userId?: string; // Provider-specific user ID
  error?: EmailProvisioningError;
}

/**
 * Email account verification result
 */
export interface EmailVerificationResult {
  isVerified: boolean;
  email: string;
  exists: boolean;
  canSendEmail: boolean;
  canReceiveEmail: boolean;
  error?: string;
}

/**
 * Email provisioning error types
 */
export type EmailProvisioningErrorType =
  | 'DOMAIN_NOT_FOUND'
  | 'DOMAIN_NOT_VERIFIED'
  | 'USER_ALREADY_EXISTS'
  | 'INVALID_DOMAIN'
  | 'INVALID_USERNAME'
  | 'INVALID_PASSWORD'
  | 'LICENSE_LIMIT_REACHED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'API_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Structured error for email provisioning operations
 */
export interface EmailProvisioningError {
  type: EmailProvisioningErrorType;
  message: string;
  details?: unknown;
  retryable: boolean;
}

/**
 * Email account status for tracking
 */
export type EmailAccountStatus =
  | 'provisioning'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'deleted'
  | 'failed';

/**
 * Email provider configuration
 */
export interface EmailProviderConfig {
  provider: 'google_workspace' | 'microsoft365' | 'custom';
  domain: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  useTls: boolean;
}

/**
 * Email account provisioning metadata
 */
export interface EmailProvisioningMetadata {
  provisionedAt: Date;
  provider: string;
  providerUserId?: string;
  apiVersion?: string;
  status: EmailAccountStatus;
  lastVerifiedAt?: Date;
}
