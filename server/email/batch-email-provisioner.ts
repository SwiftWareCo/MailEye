/**
 * Batch Email Account Provisioning Service
 *
 * Handles parallel creation of multiple email accounts with:
 * - Concurrent processing (configurable, default 5)
 * - Progress tracking in database
 * - Partial failure support
 * - Automatic retry for retryable errors
 * - Detailed error reporting
 */

import { db } from '@/lib/db';
import { batchOperations, batchOperationItems } from '@/lib/db/schema/batch-operations';
import { createEmailAccount } from './google-workspace-provisioner';
import { saveEmailAccount } from './email-account-manager';
import type {
  BatchEmailProvisioningParams,
  BatchEmailProvisioningResult,
  BatchEmailAccountResult,
  BatchProgressUpdate,
  EmailProvisioningError,
} from '@/lib/types/email';
import { eq, and } from 'drizzle-orm';

/**
 * Default concurrency limit for parallel account creation
 * Prevents overwhelming Google Workspace API
 */
const DEFAULT_MAX_CONCURRENCY = 5;

/**
 * Maximum retry attempts for retryable errors
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Delay between retries (milliseconds)
 */
const RETRY_DELAY_MS = 2000;

/**
 * Creates a batch operation record in the database
 */
async function createBatchOperationRecord(
  userId: string,
  totalItems: number,
  inputData: unknown
): Promise<string> {
  const [batchOp] = await db
    .insert(batchOperations)
    .values({
      userId,
      operationType: 'email_account_creation',
      status: 'pending',
      totalItems,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      inputData,
      startedAt: new Date(),
    })
    .returning({ id: batchOperations.id });

  return batchOp.id;
}

/**
 * Creates batch operation item records for each account
 */
async function createBatchItemRecords(
  batchOperationId: string,
  params: BatchEmailProvisioningParams
): Promise<void> {
  const items = params.accounts.map((account, index) => ({
    batchOperationId,
    itemIndex: index,
    itemData: {
      username: account.username,
      firstName: account.firstName,
      lastName: account.lastName,
      displayName: account.displayName,
      domain: params.domain,
    },
    status: 'pending' as const,
  }));

  await db.insert(batchOperationItems).values(items);
}

/**
 * Updates batch operation progress
 */
async function updateBatchProgress(
  batchOperationId: string,
  updates: {
    processedItems?: number;
    successfulItems?: number;
    failedItems?: number;
    status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  }
): Promise<void> {
  await db
    .update(batchOperations)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(batchOperations.id, batchOperationId));
}

/**
 * Updates individual batch item status
 */
async function updateBatchItemStatus(
  batchOperationId: string,
  itemIndex: number,
  status: 'pending' | 'processing' | 'success' | 'failed' | 'skipped',
  resultData?: unknown,
  errorMessage?: string,
  errorCode?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'processing') {
    updates.startedAt = new Date();
  }

  if (status === 'success' || status === 'failed') {
    updates.completedAt = new Date();
  }

  if (resultData) {
    updates.resultData = resultData;
  }

  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }

  if (errorCode) {
    updates.errorCode = errorCode;
  }

  await db
    .update(batchOperationItems)
    .set(updates)
    .where(
      and(
        eq(batchOperationItems.batchOperationId, batchOperationId),
        eq(batchOperationItems.itemIndex, itemIndex)
      )
    );
}

/**
 * Processes a single email account creation with retry logic
 */
async function processBatchEmailAccount(
  params: BatchEmailProvisioningParams,
  accountIndex: number,
  batchOperationId: string,
  retryCount: number = 0
): Promise<BatchEmailAccountResult> {
  const account = params.accounts[accountIndex];
  const email = `${account.username}@${params.domain}`;

  try {
    // Update item status to processing
    await updateBatchItemStatus(batchOperationId, accountIndex, 'processing');

    // Create email account in Google Workspace
    const provisioningResult = await createEmailAccount({
      domain: params.domain,
      username: account.username,
      firstName: account.firstName,
      lastName: account.lastName,
      password: account.password,
      displayName: account.displayName,
    });

    // If provisioning failed
    if (!provisioningResult.success || !provisioningResult.credentials) {
      const error = provisioningResult.error || {
        type: 'UNKNOWN_ERROR' as const,
        message: 'Unknown provisioning error',
        retryable: false,
      };

      // Check if error is retryable and we haven't exceeded max retries
      if (error.retryable && retryCount < MAX_RETRY_ATTEMPTS) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

        // Retry the operation
        return processBatchEmailAccount(
          params,
          accountIndex,
          batchOperationId,
          retryCount + 1
        );
      }

      // Update item status to failed
      await updateBatchItemStatus(
        batchOperationId,
        accountIndex,
        'failed',
        undefined,
        error.message,
        error.type
      );

      return {
        itemIndex: accountIndex,
        username: account.username,
        email,
        success: false,
        error,
        retryCount,
      };
    }

    // Save account to database
    const saveResult = await saveEmailAccount({
      userId: params.userId,
      domainId: params.domainId,
      email: provisioningResult.email,
      password: provisioningResult.credentials.smtp.password,
      displayName: account.displayName,
      credentials: provisioningResult.credentials,
      provider: 'google_workspace',
      providerUserId: provisioningResult.userId,
    });

    // If database save failed
    if (!saveResult.success) {
      const error: EmailProvisioningError = {
        type: 'API_ERROR',
        message: saveResult.error || 'Failed to save account to database',
        retryable: false,
      };

      await updateBatchItemStatus(
        batchOperationId,
        accountIndex,
        'failed',
        undefined,
        error.message,
        error.type
      );

      return {
        itemIndex: accountIndex,
        username: account.username,
        email,
        success: false,
        error,
        retryCount,
      };
    }

    // Success - update item status
    await updateBatchItemStatus(batchOperationId, accountIndex, 'success', {
      accountId: saveResult.accountId,
      providerUserId: provisioningResult.userId,
      email: provisioningResult.email,
    });

    return {
      itemIndex: accountIndex,
      username: account.username,
      email: provisioningResult.email,
      success: true,
      accountId: saveResult.accountId,
      providerUserId: provisioningResult.userId,
      credentials: provisioningResult.credentials,
      retryCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const provisioningError: EmailProvisioningError = {
      type: 'UNKNOWN_ERROR',
      message: errorMessage,
      details: error,
      retryable: false,
    };

    await updateBatchItemStatus(
      batchOperationId,
      accountIndex,
      'failed',
      undefined,
      errorMessage,
      'UNKNOWN_ERROR'
    );

    return {
      itemIndex: accountIndex,
      username: account.username,
      email,
      success: false,
      error: provisioningError,
      retryCount,
    };
  }
}

/**
 * Processes accounts in batches with concurrency control
 */
async function processWithConcurrencyLimit<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<unknown>,
  maxConcurrency: number
): Promise<void> {
  const results: Promise<unknown>[] = [];
  let currentIndex = 0;

  while (currentIndex < items.length) {
    // Process up to maxConcurrency items at once
    const batch = items.slice(currentIndex, currentIndex + maxConcurrency);
    const batchPromises = batch.map((item, batchIndex) =>
      processor(item, currentIndex + batchIndex)
    );

    results.push(...batchPromises);

    // Wait for this batch to complete before starting next batch
    await Promise.all(batchPromises);

    currentIndex += maxConcurrency;
  }
}

/**
 * Gets current batch operation progress
 */
export async function getBatchOperationProgress(
  batchOperationId: string
): Promise<BatchProgressUpdate | null> {
  try {
    const [batchOp] = await db
      .select()
      .from(batchOperations)
      .where(eq(batchOperations.id, batchOperationId))
      .limit(1);

    if (!batchOp) {
      return null;
    }

    const pendingItems = batchOp.totalItems - (batchOp.processedItems || 0);
    const progressPercentage = batchOp.totalItems > 0
      ? Math.round(((batchOp.processedItems || 0) / batchOp.totalItems) * 100)
      : 0;

    return {
      batchOperationId,
      totalItems: batchOp.totalItems,
      processedItems: batchOp.processedItems || 0,
      successfulItems: batchOp.successfulItems || 0,
      failedItems: batchOp.failedItems || 0,
      pendingItems,
      progressPercentage,
      estimatedCompletionAt: batchOp.estimatedCompletionAt || undefined,
      currentStatus: batchOp.status as 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial',
    };
  } catch (error) {
    console.error('Failed to get batch operation progress:', error);
    return null;
  }
}

/**
 * Creates multiple email accounts in parallel with progress tracking
 *
 * Process:
 * 1. Creates batch operation record in database
 * 2. Creates individual item records for tracking
 * 3. Processes accounts with concurrency limit
 * 4. Handles partial failures gracefully
 * 5. Updates progress in real-time
 * 6. Returns detailed results for each account
 *
 * @param params - Batch provisioning parameters
 * @returns BatchEmailProvisioningResult with detailed status
 *
 * @example
 * const result = await createBatchEmailAccounts({
 *   userId: 'user-123',
 *   domainId: 'domain-456',
 *   domain: 'example.com',
 *   accounts: [
 *     { username: 'john.doe', firstName: 'John', lastName: 'Doe' },
 *     { username: 'jane.smith', firstName: 'Jane', lastName: 'Smith' },
 *   ],
 * });
 *
 * console.log(`Created ${result.successfulAccounts}/${result.totalAccounts} accounts`);
 */
export async function createBatchEmailAccounts(
  params: BatchEmailProvisioningParams
): Promise<BatchEmailProvisioningResult> {
  const maxConcurrency = params.maxConcurrency || DEFAULT_MAX_CONCURRENCY;
  const totalAccounts = params.accounts.length;

  // Validate input
  if (totalAccounts === 0) {
    throw new Error('No accounts provided for batch creation');
  }

  if (totalAccounts > 20) {
    throw new Error('Cannot create more than 20 accounts per batch (Google Workspace best practice)');
  }

  // Create batch operation record
  const batchOperationId = await createBatchOperationRecord(
    params.userId,
    totalAccounts,
    {
      domain: params.domain,
      domainId: params.domainId,
      accountCount: totalAccounts,
    }
  );

  // Create batch item records
  await createBatchItemRecords(batchOperationId, params);

  // Update status to in_progress
  await updateBatchProgress(batchOperationId, { status: 'in_progress' });

  // Track results
  const results: BatchEmailAccountResult[] = new Array(totalAccounts);
  let successfulAccounts = 0;
  let failedAccounts = 0;

  try {
    // Process accounts with concurrency control
    await processWithConcurrencyLimit(
      params.accounts,
      async (_, index) => {
        const result = await processBatchEmailAccount(params, index, batchOperationId);
        results[index] = result;

        if (result.success) {
          successfulAccounts++;
        } else {
          failedAccounts++;
        }

        // Update batch progress
        await updateBatchProgress(batchOperationId, {
          processedItems: successfulAccounts + failedAccounts,
          successfulItems: successfulAccounts,
          failedItems: failedAccounts,
        });
      },
      maxConcurrency
    );

    // Determine final status
    const finalStatus =
      failedAccounts === 0
        ? 'completed'
        : successfulAccounts === 0
        ? 'failed'
        : 'partial';

    // Update final batch status
    await updateBatchProgress(batchOperationId, {
      status: finalStatus,
    });

    // Update completion time
    await db
      .update(batchOperations)
      .set({
        completedAt: new Date(),
      })
      .where(eq(batchOperations.id, batchOperationId));

    // Get final progress
    const progress = await getBatchOperationProgress(batchOperationId);

    // Build error summary
    const errors = results
      .filter((r) => !r.success && r.error)
      .map((r) => ({
        itemIndex: r.itemIndex,
        username: r.username,
        error: r.error!,
      }));

    return {
      success: failedAccounts === 0,
      batchOperationId,
      totalAccounts,
      successfulAccounts,
      failedAccounts,
      results,
      errors,
      progress: progress || {
        batchOperationId,
        totalItems: totalAccounts,
        processedItems: totalAccounts,
        successfulItems: successfulAccounts,
        failedItems: failedAccounts,
        pendingItems: 0,
        progressPercentage: 100,
        currentStatus: finalStatus,
      },
    };
  } catch (error) {
    // Update batch status to failed
    await updateBatchProgress(batchOperationId, {
      status: 'failed',
    });

    await db
      .update(batchOperations)
      .set({
        completedAt: new Date(),
      })
      .where(eq(batchOperations.id, batchOperationId));

    throw error;
  }
}

/**
 * Retries failed items in a batch operation
 *
 * @param batchOperationId - Batch operation ID
 * @returns Array of retry results
 *
 * @example
 * const retryResults = await retryFailedBatchItems('batch-123');
 * console.log(`Retried ${retryResults.length} failed accounts`);
 */
export async function retryFailedBatchItems(
  batchOperationId: string
): Promise<BatchEmailAccountResult[]> {
  try {
    // Get batch operation
    const [batchOp] = await db
      .select()
      .from(batchOperations)
      .where(eq(batchOperations.id, batchOperationId))
      .limit(1);

    if (!batchOp) {
      throw new Error('Batch operation not found');
    }

    // Get failed items
    const failedItems = await db
      .select()
      .from(batchOperationItems)
      .where(
        and(
          eq(batchOperationItems.batchOperationId, batchOperationId),
          eq(batchOperationItems.status, 'failed')
        )
      );

    if (failedItems.length === 0) {
      return [];
    }

    // Extract original input data
    const inputData = batchOp.inputData as {
      domain: string;
      domainId: string;
    };

    // Build retry params
    const retryAccounts = failedItems.map((item) => {
      const data = item.itemData as {
        username: string;
        firstName: string;
        lastName: string;
        displayName?: string;
      };
      return {
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
      };
    });

    const retryParams: BatchEmailProvisioningParams = {
      userId: batchOp.userId,
      domainId: inputData.domainId,
      domain: inputData.domain,
      accounts: retryAccounts,
    };

    // Process retries
    const results: BatchEmailAccountResult[] = [];

    for (let i = 0; i < failedItems.length; i++) {
      const originalItemIndex = failedItems[i].itemIndex;
      const result = await processBatchEmailAccount(
        retryParams,
        i,
        batchOperationId
      );

      // Update the original item index in result
      result.itemIndex = originalItemIndex;
      results.push(result);
    }

    // Recalculate batch statistics
    const allItems = await db
      .select()
      .from(batchOperationItems)
      .where(eq(batchOperationItems.batchOperationId, batchOperationId));

    const successCount = allItems.filter((item) => item.status === 'success').length;
    const failCount = allItems.filter((item) => item.status === 'failed').length;

    await updateBatchProgress(batchOperationId, {
      successfulItems: successCount,
      failedItems: failCount,
      status: failCount === 0 ? 'completed' : 'partial',
    });

    return results;
  } catch (error) {
    console.error('Failed to retry batch items:', error);
    throw error;
  }
}
