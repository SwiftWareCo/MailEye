/**
 * Email Account Database Management Service
 *
 * Handles all database operations for email accounts including:
 * - Creating and storing email accounts with encrypted credentials
 * - Retrieving email accounts with credential decryption
 * - Updating and deleting email accounts
 * - Querying accounts by user, domain, and status
 */

import { db } from '@/lib/db';
import { emailAccounts } from '@/lib/db/schema/email-accounts';
import {
  encryptCredential,
  decryptCredential,
} from '@/lib/security/credential-encryption';
import type { EmailCredentials } from '@/lib/types/email';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Parameters for saving a new email account to the database
 */
export interface SaveEmailAccountParams {
  userId: string;
  domainId: string;
  email: string;
  password: string; // Will be encrypted before storage
  displayName?: string;
  credentials: EmailCredentials;
  provider: 'google_workspace' | 'microsoft365' | 'custom';
  providerUserId?: string;
}

/**
 * Stored email account with encrypted credentials
 */
export interface StoredEmailAccount {
  id: string;
  userId: string;
  domainId: string;
  email: string;
  displayName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  imapHost: string | null;
  imapPort: number | null;
  imapUsername: string | null;
  status: string;
  isVerified: boolean;
  lastVerifiedAt: Date | null;
  warmupStatus: string | null;
  warmupStartedAt: Date | null;
  warmupCompletedAt: Date | null;
  warmupDayCount: number | null;
  dailyEmailLimit: number | null;
  dailyEmailsSent: number | null;
  lastEmailSentAt: Date | null;
  deliverabilityScore: number | null;
  bounceRate: number | null;
  spamComplaintRate: number | null;
  reputationScore: string | null;
  smartleadAccountId: string | null;
  notes: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Email account with decrypted credentials
 */
export interface EmailAccountWithCredentials extends StoredEmailAccount {
  password: string; // Decrypted password
}

/**
 * Result of email account save operation
 */
export interface SaveEmailAccountResult {
  success: boolean;
  accountId?: string;
  error?: string;
}

/**
 * Saves a new email account to the database with encrypted credentials
 *
 * @param params - Email account parameters including credentials
 * @returns Save result with account ID or error
 *
 * @example
 * const result = await saveEmailAccount({
 *   userId: 'user-123',
 *   domainId: 'domain-456',
 *   email: 'john@example.com',
 *   password: 'SecurePass123!',
 *   credentials: googleWorkspaceCredentials,
 *   provider: 'google_workspace',
 * });
 */
export async function saveEmailAccount(
  params: SaveEmailAccountParams
): Promise<SaveEmailAccountResult> {
  try {
    // Check if email already exists
    const existing = await db
      .select({ id: emailAccounts.id })
      .from(emailAccounts)
      .where(eq(emailAccounts.email, params.email))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: `Email account ${params.email} already exists in database`,
      };
    }

    // Encrypt password before storage
    const encryptedPassword = encryptCredential(params.password);

    // Insert email account
    const [insertedAccount] = await db
      .insert(emailAccounts)
      .values({
        userId: params.userId,
        domainId: params.domainId,
        email: params.email,
        password: encryptedPassword,
        displayName: params.displayName || null,
        smtpHost: params.credentials.smtp.host,
        smtpPort: params.credentials.smtp.port,
        smtpUsername: params.credentials.smtp.username,
        imapHost: params.credentials.imap.host,
        imapPort: params.credentials.imap.port,
        imapUsername: params.credentials.imap.username,
        status: 'inactive', // Default status
        isVerified: false,
        warmupStatus: 'not_started',
        warmupDayCount: 0,
        dailyEmailLimit: 10,
        dailyEmailsSent: 0,
      })
      .returning({ id: emailAccounts.id });

    return {
      success: true,
      accountId: insertedAccount.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to save email account: ${errorMessage}`,
    };
  }
}

/**
 * Retrieves an email account by ID (without decrypted credentials)
 *
 * @param accountId - Email account ID
 * @returns Email account or null if not found
 *
 * @example
 * const account = await getEmailAccount('account-123');
 * if (account) {
 *   console.log(`Email: ${account.email}`);
 * }
 */
export async function getEmailAccount(
  accountId: string
): Promise<StoredEmailAccount | null> {
  try {
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId))
      .limit(1);

    return account || null;
  } catch (error) {
    console.error('Failed to retrieve email account:', error);
    return null;
  }
}

/**
 * Retrieves an email account by email address (without decrypted credentials)
 *
 * @param email - Email address
 * @returns Email account or null if not found
 *
 * @example
 * const account = await getEmailAccountByEmail('john@example.com');
 */
export async function getEmailAccountByEmail(
  email: string
): Promise<StoredEmailAccount | null> {
  try {
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.email, email))
      .limit(1);

    return account || null;
  } catch (error) {
    console.error('Failed to retrieve email account by email:', error);
    return null;
  }
}

/**
 * Retrieves all email accounts for a specific domain
 *
 * @param domainId - Domain ID
 * @returns Array of email accounts
 *
 * @example
 * const accounts = await getEmailAccountsByDomain('domain-456');
 * console.log(`Found ${accounts.length} email accounts`);
 */
export async function getEmailAccountsByDomain(
  domainId: string
): Promise<StoredEmailAccount[]> {
  try {
    const accounts = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.domainId, domainId))
      .orderBy(desc(emailAccounts.createdAt));

    return accounts;
  } catch (error) {
    console.error('Failed to retrieve email accounts by domain:', error);
    return [];
  }
}

/**
 * Retrieves all email accounts for a specific user
 *
 * @param userId - User ID
 * @returns Array of email accounts
 *
 * @example
 * const accounts = await getEmailAccountsByUser('user-123');
 */
export async function getEmailAccountsByUser(
  userId: string
): Promise<StoredEmailAccount[]> {
  try {
    const accounts = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.userId, userId))
      .orderBy(desc(emailAccounts.createdAt));

    return accounts;
  } catch (error) {
    console.error('Failed to retrieve email accounts by user:', error);
    return [];
  }
}

/**
 * Retrieves all email accounts for a user and domain combination
 *
 * @param userId - User ID
 * @param domainId - Domain ID
 * @returns Array of email accounts
 *
 * @example
 * const accounts = await getEmailAccountsByUserAndDomain('user-123', 'domain-456');
 */
export async function getEmailAccountsByUserAndDomain(
  userId: string,
  domainId: string
): Promise<StoredEmailAccount[]> {
  try {
    const accounts = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.userId, userId),
          eq(emailAccounts.domainId, domainId)
        )
      )
      .orderBy(desc(emailAccounts.createdAt));

    return accounts;
  } catch (error) {
    console.error(
      'Failed to retrieve email accounts by user and domain:',
      error
    );
    return [];
  }
}

/**
 * Retrieves decrypted credentials for an email account
 *
 * @param accountId - Email account ID
 * @returns Decrypted credentials or null if not found
 *
 * @example
 * const creds = await getDecryptedCredentials('account-123');
 * if (creds) {
 *   console.log(`SMTP: ${creds.smtp.host}:${creds.smtp.port}`);
 * }
 */
export async function getDecryptedCredentials(
  accountId: string
): Promise<EmailCredentials | null> {
  try {
    const [account] = await db
      .select({
        email: emailAccounts.email,
        password: emailAccounts.password,
        smtpHost: emailAccounts.smtpHost,
        smtpPort: emailAccounts.smtpPort,
        smtpUsername: emailAccounts.smtpUsername,
        imapHost: emailAccounts.imapHost,
        imapPort: emailAccounts.imapPort,
        imapUsername: emailAccounts.imapUsername,
      })
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId))
      .limit(1);

    if (!account || !account.password) {
      return null;
    }

    // Decrypt password
    const decryptedPassword = decryptCredential(account.password);

    return {
      email: account.email,
      smtp: {
        host: account.smtpHost || '',
        port: account.smtpPort || 587,
        username: account.smtpUsername || account.email,
        password: decryptedPassword,
        useTls: true,
      },
      imap: {
        host: account.imapHost || '',
        port: account.imapPort || 993,
        username: account.imapUsername || account.email,
        password: decryptedPassword,
        useTls: true,
      },
    };
  } catch (error) {
    console.error('Failed to retrieve decrypted credentials:', error);
    return null;
  }
}

/**
 * Retrieves an email account with decrypted password
 *
 * @param accountId - Email account ID
 * @returns Email account with decrypted password or null
 *
 * @example
 * const account = await getEmailAccountWithPassword('account-123');
 * if (account) {
 *   console.log(`Password: ${account.password}`);
 * }
 */
export async function getEmailAccountWithPassword(
  accountId: string
): Promise<EmailAccountWithCredentials | null> {
  try {
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId))
      .limit(1);

    if (!account || !account.password) {
      return null;
    }

    // Decrypt password
    const decryptedPassword = decryptCredential(account.password);

    return {
      ...account,
      password: decryptedPassword,
    };
  } catch (error) {
    console.error('Failed to retrieve email account with password:', error);
    return null;
  }
}

/**
 * Updates an email account's status
 *
 * @param accountId - Email account ID
 * @param status - New status
 * @returns Success status
 *
 * @example
 * await updateEmailAccountStatus('account-123', 'active');
 */
export async function updateEmailAccountStatus(
  accountId: string,
  status: 'inactive' | 'warming' | 'active' | 'suspended' | 'blocked'
): Promise<boolean> {
  try {
    await db
      .update(emailAccounts)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, accountId));

    return true;
  } catch (error) {
    console.error('Failed to update email account status:', error);
    return false;
  }
}

/**
 * Updates an email account's verification status
 *
 * @param accountId - Email account ID
 * @param isVerified - Verification status
 * @returns Success status
 *
 * @example
 * await updateEmailAccountVerification('account-123', true);
 */
export async function updateEmailAccountVerification(
  accountId: string,
  isVerified: boolean
): Promise<boolean> {
  try {
    await db
      .update(emailAccounts)
      .set({
        isVerified,
        lastVerifiedAt: isVerified ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, accountId));

    return true;
  } catch (error) {
    console.error('Failed to update email account verification:', error);
    return false;
  }
}

/**
 * Updates an email account's Smartlead connection
 *
 * @param accountId - Email account ID
 * @param smartleadAccountId - Smartlead account ID
 * @returns Success status
 *
 * @example
 * await updateEmailAccountSmartleadConnection('account-123', 'sl-789');
 */
export async function updateEmailAccountSmartleadConnection(
  accountId: string,
  smartleadAccountId: string | null
): Promise<boolean> {
  try {
    await db
      .update(emailAccounts)
      .set({
        smartleadAccountId,
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, accountId));

    return true;
  } catch (error) {
    console.error('Failed to update Smartlead connection:', error);
    return false;
  }
}

/**
 * Deletes an email account from the database
 *
 * Warning: This will also cascade delete warmup schedules and activity logs
 *
 * @param accountId - Email account ID
 * @returns Success status
 *
 * @example
 * const deleted = await deleteEmailAccount('account-123');
 */
export async function deleteEmailAccount(accountId: string): Promise<boolean> {
  try {
    await db.delete(emailAccounts).where(eq(emailAccounts.id, accountId));

    return true;
  } catch (error) {
    console.error('Failed to delete email account:', error);
    return false;
  }
}

/**
 * Checks if an email address already exists in the database
 *
 * @param email - Email address to check
 * @returns True if email exists
 *
 * @example
 * const exists = await verifyEmailAccountExists('john@example.com');
 * if (exists) {
 *   console.log('Email already registered');
 * }
 */
export async function verifyEmailAccountExists(
  email: string
): Promise<boolean> {
  try {
    const [existing] = await db
      .select({ id: emailAccounts.id })
      .from(emailAccounts)
      .where(eq(emailAccounts.email, email))
      .limit(1);

    return !!existing;
  } catch (error) {
    console.error('Failed to verify email account existence:', error);
    return false;
  }
}

/**
 * Retrieves an email account password for display (with user authorization)
 *
 * SECURITY: Only returns password if user owns the account
 *
 * @param accountId - Email account ID
 * @param userId - User ID for authorization
 * @returns Decrypted password or null if unauthorized/not found
 *
 * @example
 * const password = await getEmailAccountPasswordForUser('account-123', 'user-456');
 * if (password) {
 *   // Show password to user
 * }
 */
export async function getEmailAccountPasswordForUser(
  accountId: string,
  userId: string
): Promise<string | null> {
  try {
    // Get account with password
    const account = await getEmailAccountWithPassword(accountId);

    if (!account) {
      return null;
    }

    // Verify user owns this account
    if (account.userId !== userId) {
      console.warn(
        `Unauthorized password access attempt: User ${userId} tried to access account ${accountId}`
      );
      return null;
    }

    return account.password;
  } catch (error) {
    console.error('Failed to retrieve email account password:', error);
    return null;
  }
}

/**
 * Updates email account warmup metrics
 *
 * @param accountId - Email account ID
 * @param metrics - Warmup metrics to update
 * @returns Success status
 *
 * @example
 * await updateEmailAccountWarmupMetrics('account-123', {
 *   warmupStatus: 'in_progress',
 *   warmupDayCount: 5,
 *   dailyEmailLimit: 50,
 * });
 */
export async function updateEmailAccountWarmupMetrics(
  accountId: string,
  metrics: {
    warmupStatus?: 'not_started' | 'in_progress' | 'completed' | 'paused';
    warmupDayCount?: number;
    dailyEmailLimit?: number;
    dailyEmailsSent?: number;
  }
): Promise<boolean> {
  try {
    await db
      .update(emailAccounts)
      .set({
        ...metrics,
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, accountId));

    return true;
  } catch (error) {
    console.error('Failed to update warmup metrics:', error);
    return false;
  }
}
