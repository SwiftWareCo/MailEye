/**
 * Unit tests for Smartlead Account Connector
 *
 * Tests cover:
 * - Email account validation
 * - Existing connection detection
 * - Smartlead API integration
 * - Database mapping creation
 * - Error handling and retry logic
 * - Connection status retrieval
 * - Disconnection functionality
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  connectEmailAccountToSmartlead,
  disconnectEmailAccountFromSmartlead,
  getSmartleadConnectionStatus,
  updateSmartleadWarmupSettings,
} from '../account-connector';
import * as emailManager from '@/server/email/email-account-manager';
import * as smartleadClient from '@/lib/clients/smartlead';
import { db } from '@/lib/db';
import type { SmartleadConnectionParams } from '@/lib/types/smartlead';
import type { EmailCredentials } from '@/lib/types/email';
import type { StoredEmailAccount } from '@/server/email/email-account-manager';

// Mock database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock email manager module
vi.mock('@/server/email/email-account-manager', () => ({
  getEmailAccount: vi.fn(),
  getDecryptedCredentials: vi.fn(),
  updateEmailAccountSmartleadConnection: vi.fn(),
  updateEmailAccountStatus: vi.fn(),
  updateEmailAccountWarmupMetrics: vi.fn(),
}));

// Mock Smartlead client module
vi.mock('@/lib/clients/smartlead', () => ({
  connectEmailAccount: vi.fn(),
  disconnectEmailAccount: vi.fn(),
  updateWarmupSettings: vi.fn(),
}));

describe('Smartlead Account Connector', () => {
  // Test data
  const mockUserId = 'user-123';
  const mockEmailAccountId = 'account-456';
  const mockSmartleadAccountId = 'sl-789';
  const mockEmail = 'test@example.com';

  const mockEmailAccount: StoredEmailAccount = {
    id: mockEmailAccountId,
    userId: mockUserId,
    domainId: 'domain-123',
    email: mockEmail,
    displayName: 'Test User',
    smtpHost: 'smtp.google.com',
    smtpPort: 587,
    smtpUsername: mockEmail,
    imapHost: 'imap.google.com',
    imapPort: 993,
    imapUsername: mockEmail,
    status: 'inactive',
    isVerified: true,
    lastVerifiedAt: new Date(),
    warmupStatus: 'not_started',
    warmupStartedAt: null,
    warmupCompletedAt: null,
    warmupDayCount: 0,
    dailyEmailLimit: 10,
    dailyEmailsSent: 0,
    lastEmailSentAt: null,
    deliverabilityScore: null,
    bounceRate: 0,
    spamComplaintRate: 0,
    reputationScore: 'unknown',
    smartleadAccountId: null,
    notes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCredentials: EmailCredentials = {
    email: mockEmail,
    smtp: {
      host: 'smtp.google.com',
      port: 587,
      username: mockEmail,
      password: 'test-password-123',
      useTls: true,
    },
    imap: {
      host: 'imap.google.com',
      port: 993,
      username: mockEmail,
      password: 'test-password-123',
      useTls: true,
    },
  };

  const mockSmartleadResponse = {
    ok: true,
    message: 'Email account added/updated successfully!',
    emailAccountId: 789,
    warmupKey: 'test-warmup-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connectEmailAccountToSmartlead', () => {
    it('should successfully connect an email account to Smartlead', async () => {
      // Mock successful flow
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);
      vi.mocked(emailManager.getDecryptedCredentials).mockResolvedValue(mockCredentials);
      vi.mocked(smartleadClient.connectEmailAccount).mockResolvedValue(mockSmartleadResponse);

      // Mock database operations
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No existing connection
          }),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'mapping-123' }]),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;
      vi.mocked(db).insert = mockInsert as unknown as typeof db.insert;

      vi.mocked(emailManager.updateEmailAccountSmartleadConnection).mockResolvedValue(true);
      vi.mocked(emailManager.updateEmailAccountStatus).mockResolvedValue(true);
      vi.mocked(emailManager.updateEmailAccountWarmupMetrics).mockResolvedValue(true);

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
        warmupEnabled: true,
        maxEmailPerDay: 50,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(true);
      expect(result.smartleadAccountId).toBe(789);
      expect(result.warmupKey).toBe('test-warmup-key');
      expect(result.email).toBe(mockEmail);
      expect(result.mappingId).toBe('mapping-123');

      // Verify email account was retrieved
      expect(emailManager.getEmailAccount).toHaveBeenCalledWith(mockEmailAccountId);

      // Verify credentials were retrieved
      expect(emailManager.getDecryptedCredentials).toHaveBeenCalledWith(mockEmailAccountId);

      // Verify Smartlead API was called
      expect(smartleadClient.connectEmailAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEmail,
          firstName: 'Test',
          lastName: 'User',
          smtpHost: 'smtp.google.com',
          smtpPort: 587,
          warmupEnabled: true,
          maxEmailPerDay: 50,
        })
      );

      // Verify status updates
      expect(emailManager.updateEmailAccountSmartleadConnection).toHaveBeenCalledWith(
        mockEmailAccountId,
        '789'
      );
      expect(emailManager.updateEmailAccountStatus).toHaveBeenCalledWith(
        mockEmailAccountId,
        'warming'
      );
      expect(emailManager.updateEmailAccountWarmupMetrics).toHaveBeenCalledWith(
        mockEmailAccountId,
        expect.objectContaining({
          warmupStatus: 'in_progress',
          dailyEmailLimit: 50,
        })
      );
    });

    it('should fail if email account does not exist', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(null);

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('ACCOUNT_NOT_FOUND');
      expect(result.error?.retryable).toBe(false);
    });

    it('should fail if account belongs to different user', async () => {
      const wrongUserAccount = { ...mockEmailAccount, userId: 'different-user' };
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(wrongUserAccount);

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('ACCOUNT_NOT_FOUND');
      expect(result.error?.message).toContain('Unauthorized');
    });

    it('should fail if credentials are not found', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);
      vi.mocked(emailManager.getDecryptedCredentials).mockResolvedValue(null);

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('CREDENTIALS_NOT_FOUND');
    });

    it('should fail if credentials are incomplete', async () => {
      const incompleteCredentials: EmailCredentials = {
        ...mockCredentials,
        smtp: {
          ...mockCredentials.smtp,
          host: '', // Missing host
        },
      };

      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);
      vi.mocked(emailManager.getDecryptedCredentials).mockResolvedValue(incompleteCredentials);

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_CREDENTIALS');
      expect(result.error?.message).toContain('Incomplete');
    });

    it('should fail if account is already connected', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);
      vi.mocked(emailManager.getDecryptedCredentials).mockResolvedValue(mockCredentials);

      // Mock existing connection
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'mapping-existing',
                smartleadEmailAccountId: 'sl-existing',
              },
            ]),
          }),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('ALREADY_CONNECTED');
      expect(result.error?.message).toContain('already connected');
    });

    it('should handle Smartlead API errors', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);
      vi.mocked(emailManager.getDecryptedCredentials).mockResolvedValue(mockCredentials);

      // Mock no existing connection
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db).select = mockSelect as unknown as typeof db.select;

      // Mock API error
      vi.mocked(smartleadClient.connectEmailAccount).mockRejectedValue(
        new Error('Smartlead API error: Invalid API key')
      );

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('API_AUTHENTICATION_ERROR');
      expect(result.error?.message).toContain('Invalid API key');
    });

    it('should use default warmup configuration when not specified', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);
      vi.mocked(emailManager.getDecryptedCredentials).mockResolvedValue(mockCredentials);
      vi.mocked(smartleadClient.connectEmailAccount).mockResolvedValue(mockSmartleadResponse);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'mapping-123' }]),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;
      vi.mocked(db).insert = mockInsert as unknown as typeof db.insert;
      vi.mocked(emailManager.updateEmailAccountSmartleadConnection).mockResolvedValue(true);
      vi.mocked(emailManager.updateEmailAccountStatus).mockResolvedValue(true);
      vi.mocked(emailManager.updateEmailAccountWarmupMetrics).mockResolvedValue(true);

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
        // No warmup settings provided - should use defaults
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(true);

      // Verify default warmup config was used
      expect(smartleadClient.connectEmailAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          warmupEnabled: true,
          maxEmailPerDay: 50,
          totalWarmupPerDay: 40,
          dailyRampup: 5,
        })
      );
    });

    it('should set account to active when warmup is disabled', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);
      vi.mocked(emailManager.getDecryptedCredentials).mockResolvedValue(mockCredentials);

      const responseWithoutWarmup = {
        ...mockSmartleadResponse,
        warmup_enabled: false,
      };
      vi.mocked(smartleadClient.connectEmailAccount).mockResolvedValue(responseWithoutWarmup);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'mapping-123' }]),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;
      vi.mocked(db).insert = mockInsert as unknown as typeof db.insert;
      vi.mocked(emailManager.updateEmailAccountSmartleadConnection).mockResolvedValue(true);
      vi.mocked(emailManager.updateEmailAccountStatus).mockResolvedValue(true);

      const params: SmartleadConnectionParams = {
        emailAccountId: mockEmailAccountId,
        userId: mockUserId,
        warmupEnabled: false,
      };

      const result = await connectEmailAccountToSmartlead(params);

      expect(result.success).toBe(true);
      expect(emailManager.updateEmailAccountStatus).toHaveBeenCalledWith(
        mockEmailAccountId,
        'active'
      );
    });
  });

  describe('disconnectEmailAccountFromSmartlead', () => {
    it('should successfully disconnect an email account', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(mockEmailAccount);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db).delete = mockDelete as unknown as typeof db.delete;

      vi.mocked(emailManager.updateEmailAccountSmartleadConnection).mockResolvedValue(true);
      vi.mocked(emailManager.updateEmailAccountStatus).mockResolvedValue(true);

      const result = await disconnectEmailAccountFromSmartlead(
        mockEmailAccountId,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(emailManager.updateEmailAccountSmartleadConnection).toHaveBeenCalledWith(
        mockEmailAccountId,
        null
      );
      expect(emailManager.updateEmailAccountStatus).toHaveBeenCalledWith(
        mockEmailAccountId,
        'inactive'
      );
    });

    it('should fail if account does not exist or belongs to different user', async () => {
      vi.mocked(emailManager.getEmailAccount).mockResolvedValue(null);

      const result = await disconnectEmailAccountFromSmartlead(
        mockEmailAccountId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('ACCOUNT_NOT_FOUND');
    });
  });

  describe('getSmartleadConnectionStatus', () => {
    it('should return connection status when connected', async () => {
      const mockMapping = {
        id: 'mapping-123',
        emailAccountId: mockEmailAccountId,
        smartleadEmailAccountId: mockSmartleadAccountId,
        smartleadEmail: mockEmail,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        syncErrors: null,
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMapping]),
          }),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;

      const status = await getSmartleadConnectionStatus(mockEmailAccountId);

      expect(status.connected).toBe(true);
      expect(status.smartleadAccountId).toBe(mockSmartleadAccountId);
      expect(status.smartleadEmail).toBe(mockEmail);
      expect(status.syncStatus).toBe('synced');
    });

    it('should return not connected when no mapping exists', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;

      const status = await getSmartleadConnectionStatus(mockEmailAccountId);

      expect(status.connected).toBe(false);
      expect(status.smartleadAccountId).toBeUndefined();
    });
  });

  describe('updateSmartleadWarmupSettings', () => {
    it('should update warmup settings for connected account', async () => {
      const mockMapping = {
        smartleadEmailAccountId: mockSmartleadAccountId,
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMapping]),
          }),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;
      vi.mocked(emailManager.updateEmailAccountWarmupMetrics).mockResolvedValue(true);

      const result = await updateSmartleadWarmupSettings(mockEmailAccountId, {
        maxEmailPerDay: 100,
        totalWarmupPerDay: 80,
      });

      expect(result.success).toBe(true);
      expect(emailManager.updateEmailAccountWarmupMetrics).toHaveBeenCalledWith(
        mockEmailAccountId,
        expect.objectContaining({
          dailyEmailLimit: 100,
        })
      );
    });

    it('should fail if account is not connected', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      vi.mocked(db).select = mockSelect as unknown as typeof db.select;

      const result = await updateSmartleadWarmupSettings(mockEmailAccountId, {
        maxEmailPerDay: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });
  });
});
