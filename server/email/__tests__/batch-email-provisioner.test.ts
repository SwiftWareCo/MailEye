/**
 * Unit tests for Batch Email Account Provisioning Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createBatchEmailAccounts,
  getBatchOperationProgress,
  retryFailedBatchItems,
} from '../batch-email-provisioner';
import type {
  BatchEmailProvisioningParams,
  EmailAccountResult,
} from '@/lib/types/email';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../google-workspace-provisioner', () => ({
  createEmailAccount: vi.fn(),
}));

vi.mock('../email-account-manager', () => ({
  saveEmailAccount: vi.fn(),
}));

// Import mocked modules
import { db } from '@/lib/db';
import { createEmailAccount } from '../google-workspace-provisioner';
import { saveEmailAccount } from '../email-account-manager';

describe('Batch Email Provisioner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createBatchEmailAccounts', () => {
    it('should successfully create multiple email accounts', async () => {
      const params: BatchEmailProvisioningParams = {
        userId: 'user-123',
        domainId: 'domain-456',
        domain: 'example.com',
        accounts: [
          {
            username: 'john.doe',
            firstName: 'John',
            lastName: 'Doe',
          },
          {
            username: 'jane.smith',
            firstName: 'Jane',
            lastName: 'Smith',
          },
        ],
      };

      // Mock batch operation creation
      const mockBatchOperationId = 'batch-op-789';
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockBatchOperationId }]),
        }),
      } as never);

      // Mock email account creation - all succeed
      const mockAccountResult: EmailAccountResult = {
        success: true,
        email: 'john.doe@example.com',
        credentials: {
          email: 'john.doe@example.com',
          smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            username: 'john.doe@example.com',
            password: 'secure-password',
            useTls: true,
          },
          imap: {
            host: 'imap.gmail.com',
            port: 993,
            username: 'john.doe@example.com',
            password: 'secure-password',
            useTls: true,
          },
        },
        provider: 'google_workspace',
        userId: 'google-user-123',
      };

      vi.mocked(createEmailAccount).mockResolvedValue(mockAccountResult);

      // Mock database save
      vi.mocked(saveEmailAccount).mockResolvedValue({
        success: true,
        accountId: 'account-123',
      });

      // Mock update operations
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      // Mock select operations for progress tracking
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: mockBatchOperationId,
                totalItems: 2,
                processedItems: 2,
                successfulItems: 2,
                failedItems: 0,
                status: 'completed',
              },
            ]),
          }),
        }),
      } as never);

      const result = await createBatchEmailAccounts(params);

      expect(result.success).toBe(true);
      expect(result.totalAccounts).toBe(2);
      expect(result.successfulAccounts).toBe(2);
      expect(result.failedAccounts).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.batchOperationId).toBe(mockBatchOperationId);
    });

    it('should handle partial failures gracefully', async () => {
      const params: BatchEmailProvisioningParams = {
        userId: 'user-123',
        domainId: 'domain-456',
        domain: 'example.com',
        accounts: [
          {
            username: 'john.doe',
            firstName: 'John',
            lastName: 'Doe',
          },
          {
            username: 'jane.smith',
            firstName: 'Jane',
            lastName: 'Smith',
          },
          {
            username: 'bob.jones',
            firstName: 'Bob',
            lastName: 'Jones',
          },
        ],
      };

      // Mock batch operation creation
      const mockBatchOperationId = 'batch-op-789';
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockBatchOperationId }]),
        }),
      } as never);

      // Mock email account creation - first succeeds, second fails, third succeeds
      let callCount = 0;
      vi.mocked(createEmailAccount).mockImplementation(async (params) => {
        callCount++;

        if (callCount === 2) {
          // Second account fails
          return {
            success: false,
            email: `${params.username}@${params.domain}`,
            credentials: {} as never,
            provider: 'google_workspace',
            error: {
              type: 'USER_ALREADY_EXISTS',
              message: 'User already exists',
              retryable: false,
            },
          };
        }

        // Others succeed
        return {
          success: true,
          email: `${params.username}@${params.domain}`,
          credentials: {
            email: `${params.username}@${params.domain}`,
            smtp: {
              host: 'smtp.gmail.com',
              port: 587,
              username: `${params.username}@${params.domain}`,
              password: 'secure-password',
              useTls: true,
            },
            imap: {
              host: 'imap.gmail.com',
              port: 993,
              username: `${params.username}@${params.domain}`,
              password: 'secure-password',
              useTls: true,
            },
          },
          provider: 'google_workspace',
          userId: 'google-user-123',
        };
      });

      // Mock database save
      vi.mocked(saveEmailAccount).mockResolvedValue({
        success: true,
        accountId: 'account-123',
      });

      // Mock update operations
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      // Mock select operations for progress tracking
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: mockBatchOperationId,
                totalItems: 3,
                processedItems: 3,
                successfulItems: 2,
                failedItems: 1,
                status: 'partial',
              },
            ]),
          }),
        }),
      } as never);

      const result = await createBatchEmailAccounts(params);

      expect(result.success).toBe(false); // Not fully successful
      expect(result.totalAccounts).toBe(3);
      expect(result.successfulAccounts).toBe(2);
      expect(result.failedAccounts).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].username).toBe('jane.smith');
      expect(result.progress.currentStatus).toBe('partial');
    });

    it('should respect concurrency limits', async () => {
      const params: BatchEmailProvisioningParams = {
        userId: 'user-123',
        domainId: 'domain-456',
        domain: 'example.com',
        accounts: Array.from({ length: 10 }, (_, i) => ({
          username: `user${i}`,
          firstName: `User`,
          lastName: `${i}`,
        })),
        maxConcurrency: 2, // Only 2 concurrent requests
      };

      // Mock batch operation creation
      const mockBatchOperationId = 'batch-op-789';
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockBatchOperationId }]),
        }),
      } as never);

      // Track concurrent calls
      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      vi.mocked(createEmailAccount).mockImplementation(async (params) => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));

        concurrentCalls--;

        return {
          success: true,
          email: `${params.username}@${params.domain}`,
          credentials: {
            email: `${params.username}@${params.domain}`,
            smtp: {
              host: 'smtp.gmail.com',
              port: 587,
              username: `${params.username}@${params.domain}`,
              password: 'secure-password',
              useTls: true,
            },
            imap: {
              host: 'imap.gmail.com',
              port: 993,
              username: `${params.username}@${params.domain}`,
              password: 'secure-password',
              useTls: true,
            },
          },
          provider: 'google_workspace',
          userId: 'google-user-123',
        };
      });

      // Mock database save
      vi.mocked(saveEmailAccount).mockResolvedValue({
        success: true,
        accountId: 'account-123',
      });

      // Mock update operations
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      // Mock select operations
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: mockBatchOperationId,
                totalItems: 10,
                processedItems: 10,
                successfulItems: 10,
                failedItems: 0,
                status: 'completed',
              },
            ]),
          }),
        }),
      } as never);

      await createBatchEmailAccounts(params);

      // Verify concurrency was respected
      expect(maxConcurrentCalls).toBeLessThanOrEqual(2);
    });

    it('should retry retryable errors', async () => {
      const params: BatchEmailProvisioningParams = {
        userId: 'user-123',
        domainId: 'domain-456',
        domain: 'example.com',
        accounts: [
          {
            username: 'john.doe',
            firstName: 'John',
            lastName: 'Doe',
          },
        ],
      };

      // Mock batch operation creation
      const mockBatchOperationId = 'batch-op-789';
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockBatchOperationId }]),
        }),
      } as never);

      // Mock email account creation - fails twice with retryable error, then succeeds
      let attemptCount = 0;
      vi.mocked(createEmailAccount).mockImplementation(async (params) => {
        attemptCount++;

        if (attemptCount <= 2) {
          // First two attempts fail with retryable error
          return {
            success: false,
            email: `${params.username}@${params.domain}`,
            credentials: {} as never,
            provider: 'google_workspace',
            error: {
              type: 'RATE_LIMIT_ERROR',
              message: 'Rate limit exceeded',
              retryable: true,
            },
          };
        }

        // Third attempt succeeds
        return {
          success: true,
          email: `${params.username}@${params.domain}`,
          credentials: {
            email: `${params.username}@${params.domain}`,
            smtp: {
              host: 'smtp.gmail.com',
              port: 587,
              username: `${params.username}@${params.domain}`,
              password: 'secure-password',
              useTls: true,
            },
            imap: {
              host: 'imap.gmail.com',
              port: 993,
              username: `${params.username}@${params.domain}`,
              password: 'secure-password',
              useTls: true,
            },
          },
          provider: 'google_workspace',
          userId: 'google-user-123',
        };
      });

      // Mock database save
      vi.mocked(saveEmailAccount).mockResolvedValue({
        success: true,
        accountId: 'account-123',
      });

      // Mock update operations
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      // Mock select operations
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: mockBatchOperationId,
                totalItems: 1,
                processedItems: 1,
                successfulItems: 1,
                failedItems: 0,
                status: 'completed',
              },
            ]),
          }),
        }),
      } as never);

      const result = await createBatchEmailAccounts(params);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3); // Verify it retried
      expect(result.results[0].retryCount).toBe(2);
    });

    it('should validate maximum account limit', async () => {
      const params: BatchEmailProvisioningParams = {
        userId: 'user-123',
        domainId: 'domain-456',
        domain: 'example.com',
        accounts: Array.from({ length: 21 }, (_, i) => ({
          username: `user${i}`,
          firstName: 'User',
          lastName: `${i}`,
        })),
      };

      await expect(createBatchEmailAccounts(params)).rejects.toThrow(
        'Cannot create more than 20 accounts per batch'
      );
    });

    it('should validate empty accounts array', async () => {
      const params: BatchEmailProvisioningParams = {
        userId: 'user-123',
        domainId: 'domain-456',
        domain: 'example.com',
        accounts: [],
      };

      await expect(createBatchEmailAccounts(params)).rejects.toThrow(
        'No accounts provided for batch creation'
      );
    });
  });

  describe('getBatchOperationProgress', () => {
    it('should return current progress for a batch operation', async () => {
      const batchOperationId = 'batch-op-123';

      // Mock select operation
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: batchOperationId,
                totalItems: 10,
                processedItems: 7,
                successfulItems: 6,
                failedItems: 1,
                status: 'in_progress',
                estimatedCompletionAt: null,
              },
            ]),
          }),
        }),
      } as never);

      const progress = await getBatchOperationProgress(batchOperationId);

      expect(progress).not.toBeNull();
      expect(progress?.batchOperationId).toBe(batchOperationId);
      expect(progress?.totalItems).toBe(10);
      expect(progress?.processedItems).toBe(7);
      expect(progress?.pendingItems).toBe(3);
      expect(progress?.progressPercentage).toBe(70);
      expect(progress?.currentStatus).toBe('in_progress');
    });

    it('should return null for non-existent batch operation', async () => {
      const batchOperationId = 'non-existent';

      // Mock select operation returning no results
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const progress = await getBatchOperationProgress(batchOperationId);

      expect(progress).toBeNull();
    });

    it('should calculate progress percentage correctly', async () => {
      const batchOperationId = 'batch-op-123';

      // Mock select operation - 50% complete
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: batchOperationId,
                totalItems: 20,
                processedItems: 10,
                successfulItems: 9,
                failedItems: 1,
                status: 'in_progress',
              },
            ]),
          }),
        }),
      } as never);

      const progress = await getBatchOperationProgress(batchOperationId);

      expect(progress?.progressPercentage).toBe(50);
      expect(progress?.pendingItems).toBe(10);
    });
  });

  describe('retryFailedBatchItems', () => {
    it('should retry all failed items in a batch', async () => {
      const batchOperationId = 'batch-op-123';

      // Mock batch operation select
      const selectMock = vi.mocked(db.select);

      // First call - get batch operation
      selectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: batchOperationId,
                userId: 'user-123',
                inputData: {
                  domain: 'example.com',
                  domainId: 'domain-456',
                },
              },
            ]),
          }),
        }),
      } as never);

      // Second call - get failed items
      selectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              itemIndex: 1,
              itemData: {
                username: 'jane.smith',
                firstName: 'Jane',
                lastName: 'Smith',
              },
              status: 'failed',
            },
          ]),
        }),
      } as never);

      // Third call - get all items for statistics recalculation
      selectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              itemIndex: 0,
              status: 'success',
            },
            {
              itemIndex: 1,
              status: 'success', // Now succeeded after retry
            },
            {
              itemIndex: 2,
              status: 'success',
            },
          ]),
        }),
      } as never);

      // Mock successful retry
      vi.mocked(createEmailAccount).mockResolvedValue({
        success: true,
        email: 'jane.smith@example.com',
        credentials: {
          email: 'jane.smith@example.com',
          smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            username: 'jane.smith@example.com',
            password: 'secure-password',
            useTls: true,
          },
          imap: {
            host: 'imap.gmail.com',
            port: 993,
            username: 'jane.smith@example.com',
            password: 'secure-password',
            useTls: true,
          },
        },
        provider: 'google_workspace',
        userId: 'google-user-123',
      });

      vi.mocked(saveEmailAccount).mockResolvedValue({
        success: true,
        accountId: 'account-456',
      });

      // Mock update operations
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const results = await retryFailedBatchItems(batchOperationId);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].itemIndex).toBe(1); // Original index preserved
    });

    it('should return empty array if no failed items exist', async () => {
      const batchOperationId = 'batch-op-123';

      // Mock batch operation select
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: batchOperationId,
                userId: 'user-123',
                inputData: {
                  domain: 'example.com',
                  domainId: 'domain-456',
                },
              },
            ]),
          }),
        }),
      } as never);

      // No failed items
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      const results = await retryFailedBatchItems(batchOperationId);

      expect(results).toHaveLength(0);
    });

    it('should throw error for non-existent batch operation', async () => {
      const batchOperationId = 'non-existent';

      // Mock select returning no results
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      await expect(retryFailedBatchItems(batchOperationId)).rejects.toThrow(
        'Batch operation not found'
      );
    });
  });
});
