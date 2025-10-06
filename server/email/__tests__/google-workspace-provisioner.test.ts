/**
 * Unit tests for Google Workspace Email Provisioning Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEmailAccount,
  verifyEmailAccount,
  deleteEmailAccount,
  getGoogleWorkspaceCredentials,
} from '../google-workspace-provisioner';
import * as googleWorkspaceClient from '@/lib/clients/google-workspace';
import * as passwordGenerator from '@/lib/utils/password-generator';

// Mock the Google Workspace client
vi.mock('@/lib/clients/google-workspace');
vi.mock('@/lib/utils/password-generator');

describe('Google Workspace Provisioner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getGoogleWorkspaceCredentials', () => {
    it('should return correct SMTP and IMAP credentials', () => {
      const email = 'test@example.com';
      const password = 'SecurePass123!';

      const credentials = getGoogleWorkspaceCredentials(email, password);

      expect(credentials).toEqual({
        email: 'test@example.com',
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          username: 'test@example.com',
          password: 'SecurePass123!',
          useTls: true,
        },
        imap: {
          host: 'imap.gmail.com',
          port: 993,
          username: 'test@example.com',
          password: 'SecurePass123!',
          useTls: true,
        },
      });
    });
  });

  describe('createEmailAccount', () => {
    it('should successfully create an email account with auto-generated password', async () => {
      const mockGoogleUser = {
        id: 'google-user-id-123',
        primaryEmail: 'john.doe@example.com',
      };

      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockResolvedValue(
        mockGoogleUser
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'john.doe',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.success).toBe(true);
      expect(result.email).toBe('john.doe@example.com');
      expect(result.provider).toBe('google_workspace');
      expect(result.userId).toBe('google-user-id-123');
      expect(result.credentials.smtp.host).toBe('smtp.gmail.com');
      expect(result.credentials.smtp.port).toBe(587);
      expect(result.credentials.imap.host).toBe('imap.gmail.com');
      expect(result.credentials.imap.port).toBe(993);

      expect(googleWorkspaceClient.createGoogleWorkspaceUser).toHaveBeenCalledWith('example.com', {
        username: 'john.doe',
        firstName: 'John',
        lastName: 'Doe',
        password: 'GeneratedPass123!',
      });
    });

    it('should successfully create an email account with provided password', async () => {
      const mockGoogleUser = {
        id: 'google-user-id-456',
        primaryEmail: 'jane.smith@example.com',
      };

      vi.mocked(passwordGenerator.validatePasswordStrength).mockReturnValue({
        isValid: true,
        score: 90,
        errors: [],
      });

      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockResolvedValue(
        mockGoogleUser
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'jane.smith',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'MySecurePassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.email).toBe('jane.smith@example.com');
      expect(result.userId).toBe('google-user-id-456');

      expect(googleWorkspaceClient.createGoogleWorkspaceUser).toHaveBeenCalledWith('example.com', {
        username: 'jane.smith',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'MySecurePassword123!',
      });
    });

    it('should reject invalid domain format', async () => {
      const result = await createEmailAccount({
        domain: 'invalid domain with spaces',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_DOMAIN');
      expect(result.error?.message).toContain('Invalid domain');
      expect(googleWorkspaceClient.createGoogleWorkspaceUser).not.toHaveBeenCalled();
    });

    it('should reject empty domain', async () => {
      const result = await createEmailAccount({
        domain: '',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_DOMAIN');
      expect(result.error?.message).toContain('required');
    });

    it('should reject invalid username format', async () => {
      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'invalid username!',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_USERNAME');
      expect(result.error?.message).toContain('letters, numbers');
    });

    it('should reject username that is too long', async () => {
      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'a'.repeat(65), // 65 characters
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_USERNAME');
      expect(result.error?.message).toContain('64 characters');
    });

    it('should reject weak password if provided', async () => {
      vi.mocked(passwordGenerator.validatePasswordStrength).mockReturnValue({
        isValid: false,
        score: 30,
        errors: ['Password must contain at least one uppercase letter', 'Password is too short'],
      });

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
        password: 'weak',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_PASSWORD');
      expect(result.error?.message).toContain('Password does not meet requirements');
      expect(googleWorkspaceClient.createGoogleWorkspaceUser).not.toHaveBeenCalled();
    });

    it('should handle duplicate user error from Google API', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('Entity already exists')
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'existing.user',
        firstName: 'Existing',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('USER_ALREADY_EXISTS');
      expect(result.error?.message).toContain('already exists');
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle domain not found error', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('domain not found')
      );

      const result = await createEmailAccount({
        domain: 'nonexistent.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('DOMAIN_NOT_FOUND');
      expect(result.error?.message).toContain('not found');
    });

    it('should handle domain not verified error', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('domain not verified')
      );

      const result = await createEmailAccount({
        domain: 'unverified.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('DOMAIN_NOT_VERIFIED');
      expect(result.error?.message).toContain('not verified');
    });

    it('should handle insufficient permissions error', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('insufficient permissions')
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INSUFFICIENT_PERMISSIONS');
      expect(result.error?.message).toContain('domain-wide delegation');
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle authentication error', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('authentication failed')
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('AUTHENTICATION_ERROR');
      expect(result.error?.message).toContain('Authentication failed');
    });

    it('should handle rate limit error as retryable', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('rate limit exceeded')
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('RATE_LIMIT_ERROR');
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle license limit error', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('license limit reached')
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('LICENSE_LIMIT_REACHED');
      expect(result.error?.message).toContain('License limit');
    });

    it('should handle network error as retryable', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('network timeout')
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NETWORK_ERROR');
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle generic API error', async () => {
      vi.mocked(passwordGenerator.generateSecurePassword).mockReturnValue('GeneratedPass123!');
      vi.mocked(googleWorkspaceClient.createGoogleWorkspaceUser).mockRejectedValue(
        new Error('Some unexpected API error')
      );

      const result = await createEmailAccount({
        domain: 'example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('API_ERROR');
      expect(result.error?.message).toContain('Google Workspace API error');
    });
  });

  describe('verifyEmailAccount', () => {
    it('should verify an active email account', async () => {
      const mockUser = {
        id: 'user-123',
        primaryEmail: 'test@example.com',
        suspended: false,
        archived: false,
      };

      vi.mocked(googleWorkspaceClient.getGoogleWorkspaceUser).mockResolvedValue(mockUser);

      const result = await verifyEmailAccount('test@example.com');

      expect(result.isVerified).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.canSendEmail).toBe(true);
      expect(result.canReceiveEmail).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect suspended account', async () => {
      const mockUser = {
        id: 'user-123',
        primaryEmail: 'suspended@example.com',
        suspended: true,
        archived: false,
      };

      vi.mocked(googleWorkspaceClient.getGoogleWorkspaceUser).mockResolvedValue(mockUser);

      const result = await verifyEmailAccount('suspended@example.com');

      expect(result.isVerified).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.canSendEmail).toBe(false);
      expect(result.canReceiveEmail).toBe(false);
    });

    it('should detect archived account', async () => {
      const mockUser = {
        id: 'user-123',
        primaryEmail: 'archived@example.com',
        suspended: false,
        archived: true,
      };

      vi.mocked(googleWorkspaceClient.getGoogleWorkspaceUser).mockResolvedValue(mockUser);

      const result = await verifyEmailAccount('archived@example.com');

      expect(result.isVerified).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.canSendEmail).toBe(false);
      expect(result.canReceiveEmail).toBe(false);
    });

    it('should handle non-existent account', async () => {
      vi.mocked(googleWorkspaceClient.getGoogleWorkspaceUser).mockRejectedValue(
        new Error('User not found')
      );

      const result = await verifyEmailAccount('nonexistent@example.com');

      expect(result.isVerified).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.canSendEmail).toBe(false);
      expect(result.canReceiveEmail).toBe(false);
      expect(result.error).toBe('Email account not found');
    });

    it('should handle API errors during verification', async () => {
      vi.mocked(googleWorkspaceClient.getGoogleWorkspaceUser).mockRejectedValue(
        new Error('API error occurred')
      );

      const result = await verifyEmailAccount('test@example.com');

      expect(result.isVerified).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toContain('Verification failed');
    });
  });

  describe('deleteEmailAccount', () => {
    it('should successfully delete an email account', async () => {
      vi.mocked(googleWorkspaceClient.deleteGoogleWorkspaceUser).mockResolvedValue({
        success: true,
      });

      const result = await deleteEmailAccount('test@example.com');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(googleWorkspaceClient.deleteGoogleWorkspaceUser).toHaveBeenCalledWith(
        'test@example.com'
      );
    });

    it('should handle deletion error', async () => {
      vi.mocked(googleWorkspaceClient.deleteGoogleWorkspaceUser).mockRejectedValue(
        new Error('User not found')
      );

      const result = await deleteEmailAccount('nonexistent@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('API_ERROR');
    });

    it('should handle permission error during deletion', async () => {
      vi.mocked(googleWorkspaceClient.deleteGoogleWorkspaceUser).mockRejectedValue(
        new Error('insufficient permissions')
      );

      const result = await deleteEmailAccount('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});
