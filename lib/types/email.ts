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

/**
 * Batch email provisioning types
 */

/**
 * Individual account item for batch provisioning
 */
export interface BatchEmailAccountItem {
  username: string;
  firstName: string;
  lastName: string;
  password?: string; // Optional: will be auto-generated if not provided
  displayName?: string;
}

/**
 * Parameters for batch email account creation
 */
export interface BatchEmailProvisioningParams {
  userId: string;
  domainId: string;
  domain: string;
  accounts: BatchEmailAccountItem[];
  maxConcurrency?: number; // Default: 5
  retryFailedItems?: boolean; // Default: true
}

/**
 * Result for individual account in batch
 */
export interface BatchEmailAccountResult {
  itemIndex: number;
  username: string;
  email: string;
  success: boolean;
  accountId?: string; // Database account ID
  providerUserId?: string; // Google Workspace user ID
  credentials?: EmailCredentials;
  error?: EmailProvisioningError;
  retryCount?: number;
}

/**
 * Progress update for batch operation
 */
export interface BatchProgressUpdate {
  batchOperationId: string;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  pendingItems: number;
  progressPercentage: number;
  estimatedCompletionAt?: Date;
  currentStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
}

/**
 * Overall result of batch provisioning operation
 */
export interface BatchEmailProvisioningResult {
  success: boolean;
  batchOperationId: string;
  totalAccounts: number;
  successfulAccounts: number;
  failedAccounts: number;
  results: BatchEmailAccountResult[];
  errors: Array<{
    itemIndex: number;
    username: string;
    error: EmailProvisioningError;
  }>;
  progress: BatchProgressUpdate;
}
