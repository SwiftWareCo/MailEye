/**
 * Smartlead integration type definitions
 */

/**
 * Smartlead connection error types
 */
export type SmartleadConnectionErrorType =
  | 'ACCOUNT_NOT_FOUND'
  | 'CREDENTIALS_NOT_FOUND'
  | 'INVALID_CREDENTIALS'
  | 'ALREADY_CONNECTED'
  | 'API_AUTHENTICATION_ERROR'
  | 'API_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Structured error for Smartlead connection operations
 */
export interface SmartleadConnectionError {
  type: SmartleadConnectionErrorType;
  message: string;
  details?: unknown;
  retryable: boolean;
}

/**
 * Parameters for connecting an email account to Smartlead
 */
export interface SmartleadConnectionParams {
  emailAccountId: string;
  userId: string;
  warmupEnabled?: boolean;
  maxEmailPerDay?: number;
  totalWarmupPerDay?: number;
  dailyRampup?: number;
}

/**
 * Result of Smartlead connection operation
 */
export interface SmartleadConnectionResult {
  success: boolean;
  mappingId?: string; // Database mapping record ID
  smartleadAccountId?: number; // Smartlead's email account ID (number in API response)
  warmupKey?: string; // Warmup identifier key
  email?: string;
  error?: SmartleadConnectionError;
}

/**
 * Smartlead API response structure (from /email-accounts/save endpoint)
 */
export interface SmartleadApiResponse {
  ok: boolean;
  message: string;
  emailAccountId: number;
  warmupKey: string;
}

/**
 * Smartlead account data structure (for database storage)
 */
export interface SmartleadAccountData {
  emailAccountId: number;
  email: string;
  from_name: string;
  warmup_enabled: boolean;
  max_email_per_day: number;
  warmupKey: string;
  [key: string]: unknown; // Allow additional fields
}

/**
 * Parameters for batch Smartlead connection
 */
export interface BatchSmartleadConnectionParams {
  emailAccountIds: string[];
  userId: string;
  warmupEnabled?: boolean;
  maxEmailPerDay?: number;
  totalWarmupPerDay?: number;
  dailyRampup?: number;
}

/**
 * Individual result in batch connection
 */
export interface BatchSmartleadAccountResult {
  itemIndex: number;
  emailAccountId: string;
  email: string;
  success: boolean;
  mappingId?: string;
  smartleadAccountId?: string;
  error?: SmartleadConnectionError;
  retryCount?: number;
}

/**
 * Overall result of batch Smartlead connection
 */
export interface BatchSmartleadConnectionResult {
  success: boolean;
  totalAccounts: number;
  successfulConnections: number;
  failedConnections: number;
  results: BatchSmartleadAccountResult[];
  errors: Array<{
    itemIndex: number;
    emailAccountId: string;
    error: SmartleadConnectionError;
  }>;
}

/**
 * Smartlead connection status
 */
export type SmartleadConnectionStatus = 'synced' | 'pending' | 'failed' | 'conflict';

/**
 * Warmup statistics for an email account (7-day metrics)
 */
export interface WarmupStats {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  replied: number;
  deliverability_rate: number;
}

/**
 * Campaign email account assignment
 */
export interface CampaignEmailAccountAssignment {
  campaign_id: number;
  email_account_id: number;
  assigned_at: string;
  daily_limit?: number;
}

/**
 * Email account update settings (for PUT /email-accounts/{id})
 */
export interface EmailAccountUpdateSettings {
  max_email_per_day?: number;
  warmup_enabled?: boolean;
  tags?: string[];
  from_name?: string;
}

/**
 * Warmup settings (for POST /email-accounts/{id}/warmup)
 * Aligned with Smartlead API documentation
 */
export interface WarmupSettings {
  warmup_enabled: boolean;
  warmup_reputation: 'average' | 'good' | 'excellent';
  total_warmup_per_day: number;
  daily_rampup: number;
}

/**
 * Campaign information (from list campaigns endpoint)
 */
export interface Campaign {
  id: number;
  name: string;
  status: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Email account in campaign (from list campaign email accounts)
 */
export interface CampaignEmailAccount {
  id: string;
  email_account_id?: string;
  email: string;
  from_name?: string;
  daily_limit?: number;
  [key: string]: unknown;
}

/**
 * Smartlead email account details (from GET /email-accounts/{id})
 * Contains full account information including warmup status and settings
 */
export interface SmartleadEmailAccountDetails {
  id: number;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  warmup_enabled: boolean;
  max_email_per_day: number;
  warmup_details?: {
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
    reputation_percentage: number;
    total_sent: number;
    spam_count: number;
    inbox_count: number;
    max_warmup_limit: number;
    is_blocked: boolean;
  };
  custom_tracking_url?: string;
  bcc?: string;
  signature?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}
