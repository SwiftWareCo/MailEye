/**
 * Batch Email Provisioning Server Actions
 *
 * Wraps batch email account creation for use in wizard
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { createEmailAccount } from './google-workspace-provisioner';
import { saveEmailAccount } from './email-account-manager';
import type {
  BatchEmailProvisioningParams,
  BatchEmailProvisioningResult,
  BatchEmailAccountResult,
  EmailProvisioningError,
} from '@/lib/types/email';
import { getDomainById } from '../domain/domain.data';

/**
 * Creates multiple email accounts in parallel (batch operation)
 *
 * Process:
 * 1. Authenticates user
 * 2. Fetches domain details
 * 3. Creates accounts in parallel (max 5 concurrent)
 * 4. Saves each account to database with encrypted credentials
 * 5. Returns results with success/failure per account
 *
 * @param params - Batch provisioning parameters
 * @returns Batch provisioning result with individual account results
 *
 * @example
 * const result = await batchCreateEmailAccountsAction({
 *   domainId: 'domain-123',
 *   accounts: [
 *     { username: 'john', firstName: 'John', lastName: 'Doe' },
 *     { username: 'jane', firstName: 'Jane', lastName: 'Smith' },
 *   ],
 * });
 *
 * if (result.success) {
 *   console.log(`Created ${result.successfulAccounts} of ${result.totalAccounts} accounts`);
 *   result.results.forEach(r => {
 *     if (r.success) {
 *       console.log(`✓ ${r.email}`);
 *     } else {
 *       console.error(`✗ ${r.email}: ${r.error?.message}`);
 *     }
 *   });
 * }
 */
export async function batchCreateEmailAccountsAction(params: {
  domainId: string;
  accounts: Array<{ username: string; firstName: string; lastName: string }>;
}): Promise<BatchEmailProvisioningResult> {
  // Authenticate user
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      batchOperationId: '', // No batch operation ID since auth failed
      totalAccounts: params.accounts.length,
      successfulAccounts: 0,
      failedAccounts: params.accounts.length,
      results: params.accounts.map((account, index) => ({
        itemIndex: index,
        username: account.username,
        email: `${account.username}@unknown`,
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          retryable: false,
        },
      })),
      errors: params.accounts.map((account, index) => ({
        itemIndex: index,
        username: account.username,
        error: {
          type: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
          retryable: false,
        },
      })),
      progress: {
        batchOperationId: '',
        totalItems: params.accounts.length,
        processedItems: 0,
        successfulItems: 0,
        failedItems: params.accounts.length,
        pendingItems: 0,
        progressPercentage: 0,
        currentStatus: 'failed',
      },
    };
  }

  // Get domain
  const domain = await getDomainById(params.domainId, user.id);
  if (!domain) {
    return {
      success: false,
      batchOperationId: '',
      totalAccounts: params.accounts.length,
      successfulAccounts: 0,
      failedAccounts: params.accounts.length,
      results: params.accounts.map((account, index) => ({
        itemIndex: index,
        username: account.username,
        email: `${account.username}@unknown`,
        success: false,
        error: {
          type: 'DOMAIN_NOT_FOUND',
          message: 'Domain not found',
          retryable: false,
        },
      })),
      errors: params.accounts.map((account, index) => ({
        itemIndex: index,
        username: account.username,
        error: {
          type: 'DOMAIN_NOT_FOUND',
          message: 'Domain not found',
          retryable: false,
        },
      })),
      progress: {
        batchOperationId: '',
        totalItems: params.accounts.length,
        processedItems: 0,
        successfulItems: 0,
        failedItems: params.accounts.length,
        pendingItems: 0,
        progressPercentage: 0,
        currentStatus: 'failed',
      },
    };
  }

  // Generate batch operation ID
  const batchOperationId = `batch-${Date.now()}-${user.id.slice(0, 8)}`;

  const results: BatchEmailAccountResult[] = [];
  const errors: Array<{ itemIndex: number; username: string; error: EmailProvisioningError }> = [];
  let successCount = 0;
  let failureCount = 0;

  // Process accounts in batches of 5 for parallel execution
  const BATCH_SIZE = 5;
  for (let i = 0; i < params.accounts.length; i += BATCH_SIZE) {
    const batch = params.accounts.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (account, batchIndex) => {
        const itemIndex = i + batchIndex;

        try {
          // Create Google Workspace account
          const provisionResult = await createEmailAccount({
            domain: domain.domain,
            username: account.username,
            firstName: account.firstName,
            lastName: account.lastName,
          });

          if (!provisionResult.success) {
            failureCount++;
            const error = provisionResult.error || {
              type: 'UNKNOWN_ERROR',
              message: 'Unknown error occurred',
              retryable: false,
            };

            errors.push({
              itemIndex,
              username: account.username,
              error,
            });

            return {
              itemIndex,
              username: account.username,
              email: `${account.username}@${domain.domain}`,
              success: false,
              error,
            };
          }

          // Save to database with encrypted credentials
          const savedAccount = await saveEmailAccount({
            userId: user.id,
            domainId: domain.id,
            email: provisionResult.email,
            password: provisionResult.credentials.smtp.password,
            displayName: `${account.firstName} ${account.lastName}`,
            smtpHost: provisionResult.credentials.smtp.host,
            smtpPort: provisionResult.credentials.smtp.port,
            smtpUsername: provisionResult.credentials.smtp.username,
            imapHost: provisionResult.credentials.imap.host,
            imapPort: provisionResult.credentials.imap.port,
            imapUsername: provisionResult.credentials.imap.username,
            provider: 'google_workspace',
            providerUserId: provisionResult.userId,
          });

          successCount++;

          return {
            itemIndex,
            username: account.username,
            email: provisionResult.email,
            success: true,
            accountId: savedAccount.id,
            providerUserId: provisionResult.userId,
            credentials: provisionResult.credentials,
            retryCount: 0,
          };
        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          const provisioningError: EmailProvisioningError = {
            type: 'UNKNOWN_ERROR',
            message: errorMessage,
            details: error,
            retryable: false,
          };

          errors.push({
            itemIndex,
            username: account.username,
            error: provisioningError,
          });

          return {
            itemIndex,
            username: account.username,
            email: `${account.username}@${domain.domain}`,
            success: false,
            error: provisioningError,
          };
        }
      })
    );

    results.push(...batchResults);
  }

  const overallSuccess = successCount > 0 && failureCount === 0;
  const progressPercentage = Math.round((results.length / params.accounts.length) * 100);

  return {
    success: overallSuccess,
    batchOperationId,
    totalAccounts: params.accounts.length,
    successfulAccounts: successCount,
    failedAccounts: failureCount,
    results,
    errors,
    progress: {
      batchOperationId,
      totalItems: params.accounts.length,
      processedItems: results.length,
      successfulItems: successCount,
      failedItems: failureCount,
      pendingItems: 0,
      progressPercentage,
      currentStatus: overallSuccess ? 'completed' : failureCount === params.accounts.length ? 'failed' : 'partial',
    },
  };
}
