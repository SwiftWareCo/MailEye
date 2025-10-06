/**
 * Google Workspace Email Account Provisioning Service
 *
 * Creates and manages email accounts in Google Workspace via Admin SDK.
 *
 * Prerequisites:
 * - User must have existing Google Workspace subscription
 * - Service account with domain-wide delegation configured
 * - Admin API enabled in Google Cloud Console
 *
 * Billing Context (2025):
 * - Flexible Plan: Users auto-assigned licenses, billed monthly (prorated)
 * - Annual Plan: Requires pre-purchased licenses (not currently handled)
 */

import {
  createGoogleWorkspaceUser,
  deleteGoogleWorkspaceUser,
  getGoogleWorkspaceUser,
} from '@/lib/clients/google-workspace';
import { generateSecurePassword } from '@/lib/utils/password-generator';
import type {
  CreateEmailAccountParams,
  EmailAccountResult,
  EmailCredentials,
  EmailProvisioningError,
  EmailProvisioningErrorType,
  EmailVerificationResult,
} from '@/lib/types/email';

/**
 * Google Workspace SMTP/IMAP configuration constants
 */
const GOOGLE_WORKSPACE_CONFIG = {
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    useTls: true,
  },
  imap: {
    host: 'imap.gmail.com',
    port: 993,
    useTls: true,
  },
} as const;

/**
 * Validates domain format (basic validation)
 */
function validateDomain(domain: string): { valid: boolean; error?: string } {
  if (!domain || domain.trim().length === 0) {
    return { valid: false, error: 'Domain is required' };
  }

  // Basic domain regex: example.com, sub.example.com
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

  if (!domainRegex.test(domain)) {
    return { valid: false, error: 'Invalid domain format' };
  }

  return { valid: true };
}

/**
 * Validates username format (Google Workspace requirements)
 */
function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username is required' };
  }

  // Google Workspace allows: letters, numbers, dots, underscores, hyphens
  // Must start with a letter or number
  const usernameRegex = /^[a-z0-9][a-z0-9._-]*$/i;

  if (!usernameRegex.test(username)) {
    return {
      valid: false,
      error: 'Username must start with a letter/number and contain only letters, numbers, dots, underscores, or hyphens',
    };
  }

  if (username.length > 64) {
    return { valid: false, error: 'Username must be 64 characters or less' };
  }

  return { valid: true };
}

/**
 * Creates a structured provisioning error
 */
function createProvisioningError(
  type: EmailProvisioningErrorType,
  message: string,
  details?: unknown,
  retryable: boolean = false
): EmailProvisioningError {
  return {
    type,
    message,
    details,
    retryable,
  };
}

/**
 * Maps Google Workspace API errors to provisioning error types
 */
function mapGoogleApiError(error: unknown): EmailProvisioningError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // User already exists
  if (errorMessage.includes('Entity already exists') || errorMessage.includes('duplicate')) {
    return createProvisioningError(
      'USER_ALREADY_EXISTS',
      'An account with this email address already exists',
      error,
      false
    );
  }

  // Domain not found or not verified
  if (errorMessage.includes('domain') && errorMessage.includes('not found')) {
    return createProvisioningError(
      'DOMAIN_NOT_FOUND',
      'Domain not found in Google Workspace',
      error,
      false
    );
  }

  if (errorMessage.includes('domain') && errorMessage.includes('not verified')) {
    return createProvisioningError(
      'DOMAIN_NOT_VERIFIED',
      'Domain is not verified in Google Workspace',
      error,
      false
    );
  }

  // Authentication/permissions
  if (errorMessage.includes('insufficient permissions') || errorMessage.includes('forbidden')) {
    return createProvisioningError(
      'INSUFFICIENT_PERMISSIONS',
      'Service account lacks required permissions. Ensure domain-wide delegation is configured.',
      error,
      false
    );
  }

  if (errorMessage.includes('authentication') || errorMessage.includes('credentials')) {
    return createProvisioningError(
      'AUTHENTICATION_ERROR',
      'Authentication failed. Check service account configuration.',
      error,
      false
    );
  }

  // Rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return createProvisioningError(
      'RATE_LIMIT_ERROR',
      'API rate limit exceeded. Please try again later.',
      error,
      true
    );
  }

  // License limit (Annual Plan)
  if (errorMessage.includes('license')) {
    return createProvisioningError(
      'LICENSE_LIMIT_REACHED',
      'License limit reached. Please purchase additional Google Workspace licenses.',
      error,
      false
    );
  }

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return createProvisioningError(
      'NETWORK_ERROR',
      'Network error occurred. Please try again.',
      error,
      true
    );
  }

  // Generic API error
  return createProvisioningError(
    'API_ERROR',
    `Google Workspace API error: ${errorMessage}`,
    error,
    true
  );
}

/**
 * Generates SMTP and IMAP credentials for a Google Workspace email account
 */
export function getGoogleWorkspaceCredentials(
  email: string,
  password: string
): EmailCredentials {
  return {
    email,
    smtp: {
      host: GOOGLE_WORKSPACE_CONFIG.smtp.host,
      port: GOOGLE_WORKSPACE_CONFIG.smtp.port,
      username: email,
      password,
      useTls: GOOGLE_WORKSPACE_CONFIG.smtp.useTls,
    },
    imap: {
      host: GOOGLE_WORKSPACE_CONFIG.imap.host,
      port: GOOGLE_WORKSPACE_CONFIG.imap.port,
      username: email,
      password,
      useTls: GOOGLE_WORKSPACE_CONFIG.imap.useTls,
    },
  };
}

/**
 * Creates a new email account in Google Workspace
 *
 * Process:
 * 1. Validates domain and username
 * 2. Generates secure password if not provided
 * 3. Creates user via Admin SDK (license auto-assigned on Flexible Plan)
 * 4. Returns credentials and provisioning result
 *
 * Billing Note:
 * - User will be charged on next month's invoice (prorated)
 * - No manual license assignment needed on Flexible Plan
 *
 * @param params - Account creation parameters
 * @returns EmailAccountResult with credentials or error
 *
 * @example
 * const result = await createEmailAccount({
 *   domain: 'example.com',
 *   username: 'john.doe',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 *
 * if (result.success) {
 *   console.log(`Created: ${result.email}`);
 *   console.log(`SMTP: ${result.credentials.smtp.host}:${result.credentials.smtp.port}`);
 * }
 */
export async function createEmailAccount(
  params: CreateEmailAccountParams
): Promise<EmailAccountResult> {
  const { domain, username, firstName, lastName, password: providedPassword } = params;

  // Validate domain
  const domainValidation = validateDomain(domain);
  if (!domainValidation.valid) {
    return {
      success: false,
      email: `${username}@${domain}`,
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: createProvisioningError(
        'INVALID_DOMAIN',
        domainValidation.error || 'Invalid domain',
        undefined,
        false
      ),
    };
  }

  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return {
      success: false,
      email: `${username}@${domain}`,
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: createProvisioningError(
        'INVALID_USERNAME',
        usernameValidation.error || 'Invalid username',
        undefined,
        false
      ),
    };
  }

  // Generate secure password if not provided
  const password = providedPassword || generateSecurePassword({ length: 20 });

  // Validate provided password if given
  if (providedPassword) {
    const { validatePasswordStrength } = await import('@/lib/utils/password-generator');
    const strength = validatePasswordStrength(providedPassword);

    if (!strength.isValid) {
      return {
        success: false,
        email: `${username}@${domain}`,
        credentials: {} as EmailCredentials,
        provider: 'google_workspace',
        error: createProvisioningError(
          'INVALID_PASSWORD',
          `Password does not meet requirements: ${strength.errors.join(', ')}`,
          { errors: strength.errors },
          false
        ),
      };
    }
  }

  const email = `${username}@${domain}`;

  try {
    // Create user in Google Workspace
    // License is automatically assigned (Flexible Plan default)
    const googleUser = await createGoogleWorkspaceUser(domain, {
      username,
      firstName,
      lastName,
      password,
    });

    // Generate credentials
    const credentials = getGoogleWorkspaceCredentials(email, password);

    return {
      success: true,
      email,
      credentials,
      provider: 'google_workspace',
      userId: googleUser.id || undefined,
    };
  } catch (error) {
    // Map Google API error to structured error
    const provisioningError = mapGoogleApiError(error);

    return {
      success: false,
      email,
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: provisioningError,
    };
  }
}

/**
 * Verifies that an email account exists and is accessible in Google Workspace
 *
 * @param email - Full email address to verify
 * @returns EmailVerificationResult with verification status
 *
 * @example
 * const result = await verifyEmailAccount('john.doe@example.com');
 * if (result.isVerified) {
 *   console.log('Account is active and ready to use');
 * }
 */
export async function verifyEmailAccount(email: string): Promise<EmailVerificationResult> {
  try {
    const user = await getGoogleWorkspaceUser(email);

    // Check if user is suspended or has other issues
    const isActive = !user.suspended && !user.archived;

    return {
      isVerified: true,
      email,
      exists: true,
      canSendEmail: isActive,
      canReceiveEmail: isActive,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // User not found
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      return {
        isVerified: false,
        email,
        exists: false,
        canSendEmail: false,
        canReceiveEmail: false,
        error: 'Email account not found',
      };
    }

    // Other errors
    return {
      isVerified: false,
      email,
      exists: false,
      canSendEmail: false,
      canReceiveEmail: false,
      error: `Verification failed: ${errorMessage}`,
    };
  }
}

/**
 * Deletes an email account from Google Workspace
 *
 * Warning: This is irreversible and will immediately:
 * - Remove user access to Google Workspace services
 * - Delete all associated data (emails, drive files, etc.)
 * - Release the license (prorated credit on next bill)
 *
 * @param email - Full email address to delete
 * @returns Success status and any errors
 *
 * @example
 * const result = await deleteEmailAccount('john.doe@example.com');
 * if (result.success) {
 *   console.log('Account deleted successfully');
 * }
 */
export async function deleteEmailAccount(
  email: string
): Promise<{ success: boolean; error?: EmailProvisioningError }> {
  try {
    await deleteGoogleWorkspaceUser(email);

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: mapGoogleApiError(error),
    };
  }
}
