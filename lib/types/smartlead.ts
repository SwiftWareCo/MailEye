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
  warmupMinCount?: number;
  warmupMaxCount?: number;
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
 * Extended warmup settings with undocumented SmartLead API parameters
 * Discovered through SmartLead UI API calls (browser DevTools analysis)
 *
 * These parameters control feature toggles that are visible in SmartLead's UI
 * but not documented in their official API documentation.
 *
 * Format: Uses camelCase to match SmartLead's UI (differs from documented snake_case)
 */
export interface SmartleadWarmupSettingsExtended {
  // Documented parameters (snake_case) - from official API docs
  warmup_enabled?: boolean;
  total_warmup_per_day?: number;
  daily_rampup?: number;
  reply_rate_percentage?: number;
  warmup_key_id?: string;

  // Undocumented parameters (camelCase) - discovered from UI
  isRampupEnabled?: boolean;           // Enables "Daily Rampup" checkbox in SmartLead UI
  rampupValue?: number;                // Actual rampup increment value (may differ from daily_rampup)
  warmupMinCount?: number;             // Randomization: minimum emails/day (if min=max, no randomization)
  warmupMaxCount?: number;             // Randomization: maximum emails/day (e.g., 5-8 creates variation)
  autoAdjustWarmup?: boolean;          // Auto-adjust warmup during campaigns (reduces volume by 7-10)
  useCustomDomain?: boolean;           // Warmup tracking domain (open.sleadtrack.com) for better reputation
  sendWarmupsOnlyOnWeekdays?: boolean; // Weekdays-only mode (pauses Sat/Sun for natural pattern)
  dailyReplyLimit?: number;            // Max replies per day (calculated from replyRate × volume)
  maxEmailPerDay?: number;             // Maximum total emails (warmup + campaigns) per day
  replyRate?: number;                  // Reply rate percentage (0-100)
  status?: string;                     // Warmup status ('ACTIVE', 'INACTIVE', 'PAUSED')
  emailAccountId?: string;             // SmartLead email account ID
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
    id: number;
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
    reply_rate: number;
    warmup_key_id: string;
    total_sent_count: number;
    total_spam_count: number;
    warmup_max_count: number;
    warmup_min_count: number;
    is_warmup_blocked: boolean;
    max_email_per_day: number;
    warmup_reputation: string; // "100%"
  };
  custom_tracking_url?: string;
  bcc?: string;
  signature?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Smartlead warmup update response (from POST /api/email-account/save-warmup)
 * Contains detailed warmup configuration including undocumented advanced features
 */
export interface SmartleadWarmupResponse {
  id: number;
  email_account_id: number;
  user_id: number;
  status: 'ACTIVE' | 'INACTIVE';
  max_email_per_day: number;
  is_rampup_enabled: boolean;
  rampup_value: number;
  warmup_min_count: number;
  warmup_max_count: number;
  reply_rate: number;
  daily_reply_limit: number;
  warmup_reputation: number; // 0-100
  total_sent_count: number;
  total_spam_count: number;
  auto_adjust_warmup: boolean;
  use_custom_domain: boolean;
  send_warmups_only_on_weekdays: boolean;
  warmup_key_id: string;
  is_warmup_blocked: boolean;
  is_rampup_reached: boolean;
  blocked_reason: string | null;
  created_at: string;
  next_trigger_time: string;
  last_picked_time: string;
  daily_sent_limit: number;
  daily_sent_count: number;
  [key: string]: unknown;
}

/**
 * Response wrapper for warmup update endpoint
 */
export interface SmartleadWarmupUpdateResponse {
  ok: boolean;
  message: SmartleadWarmupResponse[];
}
