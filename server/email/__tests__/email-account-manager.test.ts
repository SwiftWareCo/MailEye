/**
 * Email Account Manager Tests
 *
 * Tests database operations for email account management including:
 * - Saving accounts with encrypted credentials
 * - Retrieving accounts and credentials
 * - Updating account status and metrics
 * - Deleting accounts
 * - Validation and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as accountManager from '../email-account-manager';
import { db } from '@/lib/db';
import { emailAccounts } from '@/lib/db/schema/email-accounts';
import { encryptCredential, decryptCredential } from '@/lib/security/credential-encryption';
import type { EmailCredentials } from '@/lib/types/email';

// Mock database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock encryption module
vi.mock('@/lib/security/credential-encryption', () => ({
  encryptCredential: vi.fn((password: string) => `encrypted_${password}`),
  decryptCredential: vi.fn((encrypted: string) => encrypted.replace('encrypted_', '')),
}));

describe('Email Account Manager', () => {
  const mockUserId = 'user-123';
  const mockDomainId = 'domain-456';
  const mockEmail = 'test@example.com';
  const mockPassword = 'SecurePassword123!';

  const mockCredentials: EmailCredentials = {
    email: mockEmail,
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      username: mockEmail,
      password: mockPassword,
      useTls: true,
    },
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      username: mockEmail,
      password: mockPassword,
      useTls: true,
    },
  };

  const mockStoredAccount = {
    id: 'account-789',
    userId: mockUserId,
    domainId: mockDomainId,
    email: mockEmail,
    password: 'encrypted_SecurePassword123!',
    displayName: 'Test User',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: mockEmail,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapUsername: mockEmail,
    status: 'inactive',
    isVerified: false,
    lastVerifiedAt: null,
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
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveEmailAccount', () => {
    it('should save email account with encrypted password', async () => {
      // Mock no existing account
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'account-789' }]),
        }),
      });

      const result = await accountManager.saveEmailAccount({
        userId: mockUserId,
        domainId: mockDomainId,
        email: mockEmail,
        password: mockPassword,
        displayName: 'Test User',
        credentials: mockCredentials,
        provider: 'google_workspace',
      });

      expect(result.success).toBe(true);
      expect(result.accountId).toBe('account-789');
      expect(encryptCredential).toHaveBeenCalledWith(mockPassword);
    });

    it('should fail if email already exists', async () => {
      // Mock existing account
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-account' }]),
          }),
        }),
      });

      const result = await accountManager.saveEmailAccount({
        userId: mockUserId,
        domainId: mockDomainId,
        email: mockEmail,
        password: mockPassword,
        credentials: mockCredentials,
        provider: 'google_workspace',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          }),
        }),
      });

      const result = await accountManager.saveEmailAccount({
        userId: mockUserId,
        domainId: mockDomainId,
        email: mockEmail,
        password: mockPassword,
        credentials: mockCredentials,
        provider: 'google_workspace',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save email account');
    });

    it('should store SMTP and IMAP configuration correctly', async () => {
      // Mock no existing account
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'account-789' }]),
      });

      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      await accountManager.saveEmailAccount({
        userId: mockUserId,
        domainId: mockDomainId,
        email: mockEmail,
        password: mockPassword,
        credentials: mockCredentials,
        provider: 'google_workspace',
      });

      // Verify SMTP/IMAP config was passed
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          imapHost: 'imap.gmail.com',
          imapPort: 993,
        })
      );
    });
  });

  describe('getEmailAccount', () => {
    it('should retrieve email account by ID', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStoredAccount]),
          }),
        }),
      });

      const account = await accountManager.getEmailAccount('account-789');

      expect(account).not.toBeNull();
      expect(account?.id).toBe('account-789');
      expect(account?.email).toBe(mockEmail);
    });

    it('should return null if account not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const account = await accountManager.getEmailAccount('nonexistent');

      expect(account).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const account = await accountManager.getEmailAccount('account-789');

      expect(account).toBeNull();
    });
  });

  describe('getEmailAccountByEmail', () => {
    it('should retrieve email account by email address', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStoredAccount]),
          }),
        }),
      });

      const account = await accountManager.getEmailAccountByEmail(mockEmail);

      expect(account).not.toBeNull();
      expect(account?.email).toBe(mockEmail);
    });

    it('should return null if email not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const account = await accountManager.getEmailAccountByEmail('nonexistent@example.com');

      expect(account).toBeNull();
    });
  });

  describe('getEmailAccountsByDomain', () => {
    it('should retrieve all accounts for a domain', async () => {
      const mockAccounts = [mockStoredAccount, { ...mockStoredAccount, id: 'account-999' }];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAccounts),
          }),
        }),
      });

      const accounts = await accountManager.getEmailAccountsByDomain(mockDomainId);

      expect(accounts).toHaveLength(2);
      expect(accounts[0].domainId).toBe(mockDomainId);
    });

    it('should return empty array if no accounts found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const accounts = await accountManager.getEmailAccountsByDomain('nonexistent-domain');

      expect(accounts).toHaveLength(0);
    });
  });

  describe('getEmailAccountsByUser', () => {
    it('should retrieve all accounts for a user', async () => {
      const mockAccounts = [mockStoredAccount, { ...mockStoredAccount, id: 'account-999' }];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAccounts),
          }),
        }),
      });

      const accounts = await accountManager.getEmailAccountsByUser(mockUserId);

      expect(accounts).toHaveLength(2);
      expect(accounts[0].userId).toBe(mockUserId);
    });
  });

  describe('getEmailAccountsByUserAndDomain', () => {
    it('should retrieve accounts filtered by user and domain', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockStoredAccount]),
          }),
        }),
      });

      const accounts = await accountManager.getEmailAccountsByUserAndDomain(
        mockUserId,
        mockDomainId
      );

      expect(accounts).toHaveLength(1);
      expect(accounts[0].userId).toBe(mockUserId);
      expect(accounts[0].domainId).toBe(mockDomainId);
    });
  });

  describe('getDecryptedCredentials', () => {
    it('should decrypt and return email credentials', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                email: mockEmail,
                password: 'encrypted_SecurePassword123!',
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
                smtpUsername: mockEmail,
                imapHost: 'imap.gmail.com',
                imapPort: 993,
                imapUsername: mockEmail,
              },
            ]),
          }),
        }),
      });

      const credentials = await accountManager.getDecryptedCredentials('account-789');

      expect(credentials).not.toBeNull();
      expect(credentials?.email).toBe(mockEmail);
      expect(credentials?.smtp.password).toBe(mockPassword);
      expect(credentials?.imap.password).toBe(mockPassword);
      expect(decryptCredential).toHaveBeenCalledWith('encrypted_SecurePassword123!');
    });

    it('should return null if account not found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const credentials = await accountManager.getDecryptedCredentials('nonexistent');

      expect(credentials).toBeNull();
    });

    it('should return null if password is missing', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                email: mockEmail,
                password: null,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
              },
            ]),
          }),
        }),
      });

      const credentials = await accountManager.getDecryptedCredentials('account-789');

      expect(credentials).toBeNull();
    });
  });

  describe('getEmailAccountWithPassword', () => {
    it('should return account with decrypted password', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStoredAccount]),
          }),
        }),
      });

      const account = await accountManager.getEmailAccountWithPassword('account-789');

      expect(account).not.toBeNull();
      expect(account?.password).toBe(mockPassword);
      expect(decryptCredential).toHaveBeenCalled();
    });
  });

  describe('updateEmailAccountStatus', () => {
    it('should update account status', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      const result = await accountManager.updateEmailAccountStatus('account-789', 'active');

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Update failed')),
        }),
      });

      const result = await accountManager.updateEmailAccountStatus('account-789', 'active');

      expect(result).toBe(false);
    });
  });

  describe('updateEmailAccountVerification', () => {
    it('should update verification status to true', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      const result = await accountManager.updateEmailAccountVerification('account-789', true);

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerified: true,
          lastVerifiedAt: expect.any(Date),
        })
      );
    });

    it('should update verification status to false and clear timestamp', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      const result = await accountManager.updateEmailAccountVerification('account-789', false);

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerified: false,
          lastVerifiedAt: null,
        })
      );
    });
  });

  describe('updateEmailAccountSmartleadConnection', () => {
    it('should update Smartlead account ID', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      const result = await accountManager.updateEmailAccountSmartleadConnection(
        'account-789',
        'smartlead-123'
      );

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          smartleadAccountId: 'smartlead-123',
        })
      );
    });

    it('should allow clearing Smartlead connection', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      const result = await accountManager.updateEmailAccountSmartleadConnection(
        'account-789',
        null
      );

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          smartleadAccountId: null,
        })
      );
    });
  });

  describe('deleteEmailAccount', () => {
    it('should delete email account', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const result = await accountManager.deleteEmailAccount('account-789');

      expect(result).toBe(true);
    });

    it('should handle deletion errors gracefully', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });

      const result = await accountManager.deleteEmailAccount('account-789');

      expect(result).toBe(false);
    });
  });

  describe('verifyEmailAccountExists', () => {
    it('should return true if email exists', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'account-789' }]),
          }),
        }),
      });

      const exists = await accountManager.verifyEmailAccountExists(mockEmail);

      expect(exists).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const exists = await accountManager.verifyEmailAccountExists('nonexistent@example.com');

      expect(exists).toBe(false);
    });

    it('should return false on database error', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const exists = await accountManager.verifyEmailAccountExists(mockEmail);

      expect(exists).toBe(false);
    });
  });

  describe('updateEmailAccountWarmupMetrics', () => {
    it('should update warmup metrics', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      const result = await accountManager.updateEmailAccountWarmupMetrics('account-789', {
        warmupStatus: 'in_progress',
        warmupDayCount: 5,
        dailyEmailLimit: 50,
        dailyEmailsSent: 25,
      });

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          warmupStatus: 'in_progress',
          warmupDayCount: 5,
          dailyEmailLimit: 50,
          dailyEmailsSent: 25,
        })
      );
    });

    it('should update partial warmup metrics', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      const result = await accountManager.updateEmailAccountWarmupMetrics('account-789', {
        warmupStatus: 'completed',
      });

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          warmupStatus: 'completed',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Update failed')),
        }),
      });

      const result = await accountManager.updateEmailAccountWarmupMetrics('account-789', {
        warmupStatus: 'in_progress',
      });

      expect(result).toBe(false);
    });
  });
});
