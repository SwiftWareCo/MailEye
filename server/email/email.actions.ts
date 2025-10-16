/**
 * Email Provisioning Server Actions
 *
 * Handles email account creation with Google Workspace integration and database storage
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { createEmailAccount } from './google-workspace-provisioner';
import { saveEmailAccount } from './email-account-manager';
import { getGoogleWorkspaceCredentials } from '../credentials/credentials.data';
import type { EmailAccountResult, CreateEmailAccountParams, EmailCredentials } from '@/lib/types/email';
import { getDomainById } from '../domain/domain.data';

/**
 * Create Email Account Action
 *
 * Creates a Google Workspace email account and saves it to the database
 *
 * Flow:
 * 1. Authenticate user
 * 2. Get domain details and verify ownership
 * 3. Get user's Google Workspace credentials
 * 4. Provision account in Google Workspace
 * 5. Save account and encrypted credentials to database
 * 6. Return result
 */
export async function createEmailAccountAction(params: {
  domainId: string;
  username: string;
  firstName: string;
  lastName: string;
}): Promise<EmailAccountResult> {
  // Authenticate user
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      email: '',
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: {
        type: 'UNKNOWN_ERROR',
        message: 'Authentication required',
        details: {},
        retryable: false,
      },
    };
  }

  // Get domain
  const domain = await getDomainById(params.domainId, user.id);
  if (!domain) {
    return {
      success: false,
      email: '',
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: {
        type: 'DOMAIN_NOT_FOUND',
        message: 'Domain not found',
        details: {},
        retryable: false,
      },
    };
  }

  // Get user's Google Workspace credentials
  const gwCredentials = await getGoogleWorkspaceCredentials();
  if (!gwCredentials) {
    return {
      success: false,
      email: '',
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: {
        type: 'AUTHENTICATION_ERROR',
        message: 'Google Workspace credentials not configured. Please connect your Google Workspace account first.',
        details: {},
        retryable: false,
      },
    };
  }

  // Provision account in Google Workspace
  const provisionParams: CreateEmailAccountParams = {
    domain: domain.domain,
    username: params.username,
    firstName: params.firstName,
    lastName: params.lastName,
  };

  const result = await createEmailAccount(provisionParams, {
    serviceAccountEmail: gwCredentials.serviceAccountEmail,
    privateKey: gwCredentials.privateKey,
    adminEmail: gwCredentials.adminEmail,
    customerId: gwCredentials.customerId,
  });

  // If provisioning failed, return error
  if (!result.success) {
    return result;
  }

  // Save account to database with encrypted credentials
  const saveResult = await saveEmailAccount({
    userId: user.id,
    domainId: params.domainId,
    email: result.email,
    password: result.credentials.smtp.password,
    displayName: `${params.firstName} ${params.lastName}`.trim(),
    credentials: result.credentials,
    provider: 'google_workspace',
    providerUserId: result.userId,
  });

  // If database save failed, return error
  if (!saveResult.success) {
    console.error('[Email Account Creation] Database save failed:', saveResult.error);
    return {
      success: false,
      email: result.email,
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: {
        type: 'UNKNOWN_ERROR',
        message: `Account created in Google Workspace but failed to save to database: ${saveResult.error}`,
        details: { saveResult },
        retryable: true,
      },
    };
  }

  console.log(`[Email Account Creation] Successfully created account: ${result.email}`);

  // Return success with account ID
  return {
    ...result,
    userId: saveResult.accountId, // Database account ID
  };
}

/**
 * Batch Create Email Accounts Action
 *
 * Creates multiple Google Workspace email accounts in parallel with concurrency control
 *
 * @param params - Batch creation parameters
 * @returns Array of results for each account
 *
 * @example
 * const results = await batchCreateEmailAccountsAction({
 *   domainId: 'domain-123',
 *   emailPrefix: 'sender',
 *   displayNamePrefix: 'Sender',
 *   count: 10,
 * });
 */
export async function batchCreateEmailAccountsAction(params: {
  domainId: string;
  emailPrefix: string;
  displayNamePrefix: string;
  count: number;
  customAccounts?: Array<{ username: string; displayName: string }>;
}): Promise<{
  success: boolean;
  totalAccounts: number;
  successfulAccounts: number;
  failedAccounts: number;
  results: Array<{
    email: string;
    success: boolean;
    accountId?: string;
    error?: string;
  }>;
}> {
  const { domainId, emailPrefix, displayNamePrefix, count, customAccounts } = params;

  // Validate count
  if (count < 1 || count > 50) {
    return {
      success: false,
      totalAccounts: 0,
      successfulAccounts: 0,
      failedAccounts: 0,
      results: [
        {
          email: '',
          success: false,
          error: 'Count must be between 1 and 50',
        },
      ],
    };
  }

  // Authenticate user
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      totalAccounts: 0,
      successfulAccounts: 0,
      failedAccounts: 0,
      results: [
        {
          email: '',
          success: false,
          error: 'Authentication required',
        },
      ],
    };
  }

  // Get domain
  const domain = await getDomainById(domainId, user.id);
  if (!domain) {
    return {
      success: false,
      totalAccounts: 0,
      successfulAccounts: 0,
      failedAccounts: 0,
      results: [
        {
          email: '',
          success: false,
          error: 'Domain not found',
        },
      ],
    };
  }

  // Get user's Google Workspace credentials
  const gwCredentials = await getGoogleWorkspaceCredentials();
  if (!gwCredentials) {
    return {
      success: false,
      totalAccounts: 0,
      successfulAccounts: 0,
      failedAccounts: 0,
      results: [
        {
          email: '',
          success: false,
          error: 'Google Workspace credentials not configured',
        },
      ],
    };
  }

  // Use custom accounts if provided, otherwise generate from prefix
  const accountsToCreate = customAccounts
    ? customAccounts
    : Array.from({ length: count }, (_, i) => ({
        username: `${emailPrefix}${i + 1}`,
        displayName: `${displayNamePrefix} ${i + 1}`,
      }));

  console.log(
    `[Batch Email Creation] Creating ${accountsToCreate.length} accounts${
      customAccounts ? ' with custom names' : ` with prefix "${emailPrefix}"`
    }`
  );

  // Create all accounts in parallel with concurrency control
  const MAX_CONCURRENT = 5;
  const results: Array<{
    email: string;
    success: boolean;
    accountId?: string;
    error?: string;
  }> = [];

  // Process in batches
  for (let batchStart = 0; batchStart < accountsToCreate.length; batchStart += MAX_CONCURRENT) {
    const batchEnd = Math.min(batchStart + MAX_CONCURRENT, accountsToCreate.length);
    const batchPromises: Promise<void>[] = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const account = accountsToCreate[i];
      const username = account.username;

      // Parse display name to firstName/lastName
      const nameParts = account.displayName.trim().split(' ');
      const firstName = nameParts[0] || username;
      const lastName = nameParts.slice(1).join(' ') || username;

      const email = `${username}@${domain.domain}`;

      // Create promise for this account
      const promise = (async () => {
        try {
          const result = await createEmailAccountAction({
            domainId,
            username,
            firstName,
            lastName,
          });

          if (result.success) {
            results.push({
              email,
              success: true,
              accountId: result.userId,
            });
            console.log(`[Batch Email Creation] ✅ Created: ${email}`);
          } else {
            results.push({
              email,
              success: false,
              error: result.error?.message || 'Failed to create account',
            });
            console.error(`[Batch Email Creation] ❌ Failed: ${email} - ${result.error?.message}`);
          }
        } catch (error) {
          results.push({
            email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          console.error(`[Batch Email Creation] ❌ Error: ${email}`, error);
        }
      })();

      batchPromises.push(promise);
    }

    // Wait for this batch to complete before starting next batch
    await Promise.all(batchPromises);
  }

  const successfulAccounts = results.filter((r) => r.success).length;
  const failedAccounts = results.filter((r) => !r.success).length;

  console.log(
    `[Batch Email Creation] Completed: ${successfulAccounts} successful, ${failedAccounts} failed`
  );

  return {
    success: successfulAccounts > 0,
    totalAccounts: accountsToCreate.length,
    successfulAccounts,
    failedAccounts,
    results,
  };
}
