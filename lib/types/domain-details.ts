/**
 * Domain Details Types
 * Aggregated domain information for detail view with tab completion status
 */

import type { Domain } from './domain';

/**
 * DNS Record information
 */
export interface DNSRecordInfo {
  id: string;
  recordType: string;
  name: string;
  value: string;
  ttl: number | null;
  priority: number | null;
  status: string;
  purpose: string | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
}

/**
 * Email Account information
 */
export interface EmailAccountInfo {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  warmupStatus: string | null;
  warmupDayCount: number | null;
  dailyEmailLimit: number | null;
  smartleadAccountId: string | null;
  deliverabilityScore: number | null;
  reputationScore: string | null;
  createdAt: Date;
}

/**
 * Setup completion status per tab
 */
export interface SetupCompletionStatus {
  overview: {
    isComplete: boolean;
    completionPercentage: number;
    pendingTasks: string[];
  };
  dns: {
    isComplete: boolean;
    hasZone: boolean;
    nameserversVerified: boolean;
    recordCount: number;
    missingRecords: string[]; // e.g., ['SPF', 'DKIM', 'DMARC', 'MX']
    dmarcConfigured: boolean;
    dmarcPending: boolean;
  };
  emailAccounts: {
    isComplete: boolean;
    accountCount: number;
    provisionedCount: number;
    needsProvisioning: boolean;
  };
  warmup: {
    isComplete: boolean;
    smartleadConnected: boolean;
    accountsConnected: number;
    accountsTotal: number;
    warmupInProgress: number;
    warmupCompleted: number;
  };
}

/**
 * Aggregated domain details
 */
export interface DomainDetails {
  // Core domain info
  domain: Domain;

  // DNS records
  dnsRecords: DNSRecordInfo[];
  dnsRecordsByType: {
    SPF: DNSRecordInfo[];
    DKIM: DNSRecordInfo[];
    DMARC: DNSRecordInfo[];
    MX: DNSRecordInfo[];
    Tracking: DNSRecordInfo[];
    Other: DNSRecordInfo[];
  };

  // Email accounts
  emailAccounts: EmailAccountInfo[];

  // Setup completion status
  setupStatus: SetupCompletionStatus;
}

/**
 * Tab completion badge types
 */
export type TabBadgeStatus =
  | 'complete'
  | 'in-progress'
  | 'not-started'
  | 'warning';

/**
 * Tab badge info
 */
export interface TabBadge {
  status: TabBadgeStatus;
  label?: string; // Optional label like "3 pending"
}
