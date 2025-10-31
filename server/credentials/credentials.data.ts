/**
 * Centralized Credentials Data Layer
 *
 * Single source of truth for retrieving user credentials from Stack Auth serverMetadata
 */

import 'server-only';
import { stackServerApp } from '@/stack/server';
import type {
  CloudflareCredentials,
  GoogleWorkspaceCredentials,
  SmartleadCredentials,
  UserCredentials,
} from '@/lib/types/credentials';

/**
 * Get all user credentials from Stack Auth serverMetadata
 */
export async function getUserCredentials(): Promise<UserCredentials | null> {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return null;
    }

    return (user.serverMetadata || {}) as UserCredentials;
  } catch (error) {
    console.error('Error getting user credentials:', error);
    return null;
  }
}

/**
 * Get Cloudflare credentials for authenticated user
 * @returns Cloudflare credentials or null if not configured
 */
export async function getCloudflareCredentials(): Promise<CloudflareCredentials | null> {
  try {
    const credentials = await getUserCredentials();
    return credentials?.cloudflare || null;
  } catch (error) {
    console.error('Error getting Cloudflare credentials:', error);
    return null;
  }
}

/**
 * Get Google Workspace credentials for authenticated user
 * @returns Google Workspace credentials or null if not configured
 */
export async function getGoogleWorkspaceCredentials(): Promise<GoogleWorkspaceCredentials | null> {
  try {
    const credentials = await getUserCredentials();
    return credentials?.googleWorkspace || null;
  } catch (error) {
    console.error('Error getting Google Workspace credentials:', error);
    return null;
  }
}

/**
 * Get Smartlead credentials for authenticated user
 * @returns Smartlead credentials or null if not configured
 */
export async function getSmartleadCredentials(): Promise<SmartleadCredentials | null> {
  try {
    const credentials = await getUserCredentials();
    return credentials?.smartlead || null;
  } catch (error) {
    console.error('Error getting Smartlead credentials:', error);
    return null;
  }
}

/**
 * Check if user has configured Cloudflare credentials
 */
export async function hasCloudflareCredentials(): Promise<boolean> {
  const credentials = await getCloudflareCredentials();
  return credentials !== null && !!credentials.apiToken && !!credentials.accountId;
}

/**
 * Check if user has configured Google Workspace credentials
 */
export async function hasGoogleWorkspaceCredentials(): Promise<boolean> {
  const credentials = await getGoogleWorkspaceCredentials();
  return (
    credentials !== null &&
    !!credentials.serviceAccountEmail &&
    !!credentials.privateKey &&
    !!credentials.adminEmail
  );
}

/**
 * Check if user has configured Smartlead credentials
 */
export async function hasSmartleadCredentials(): Promise<boolean> {
  const credentials = await getSmartleadCredentials();
  return credentials !== null && !!credentials.apiKey;
}

/**
 * Get credential setup status for all services
 */
export async function getCredentialSetupStatus(): Promise<{
  cloudflare: boolean;
  googleWorkspace: boolean;
  smartlead: boolean;
}> {
  const [cloudflare, googleWorkspace, smartlead] = await Promise.all([
    hasCloudflareCredentials(),
    hasGoogleWorkspaceCredentials(),
    hasSmartleadCredentials(),
  ]);

  return {
    cloudflare,
    googleWorkspace,
    smartlead,
  };
}

/**
 * Mask sensitive string for display purposes
 * Examples:
 *   "abc123def456" → "abc***456"
 *   "user@example.com" → "use***com"
 *   "short" → "s***t"
 */
function maskSensitiveString(value: string, showChars: number = 3): string {
  if (value.length <= showChars * 2) {
    return value.substring(0, 1) + '***' + value.substring(value.length - 1);
  }
  return value.substring(0, showChars) + '***' + value.substring(value.length - showChars);
}

/**
 * Mask email address for display
 * Example: "user@example.com" → "use***@exa***com"
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return maskSensitiveString(email);

  const maskedLocal = local.length > 3 ? local.substring(0, 3) + '***' : local;
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map((part, i) => {
    if (i === domainParts.length - 1) return part; // Keep TLD
    return part.length > 3 ? part.substring(0, 3) + '***' : part;
  }).join('.');

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Get credential details with masked sensitive info for safe display in UI
 * Returns ALL credential fields that users input (sensitive ones masked)
 */
export async function getCredentialDetailsForDisplay(): Promise<{
  cloudflare?: {
    accountId: string;
    apiToken: string;
    connectedAt: string;
  };
  googleWorkspace?: {
    serviceAccountEmail: string;
    adminEmail: string;
    privateKey: string;
    customerId?: string;
    connectedAt: string;
  };
  smartlead?: {
    apiKey: string;
    email?: string;
    hasLoginCredentials: boolean;
    connectedAt: string;
  };
} | null> {
  try {
    const credentials = await getUserCredentials();

    if (!credentials) {
      return null;
    }

    const details: {
      cloudflare?: {
        accountId: string;
        apiToken: string;
        connectedAt: string;
      };
      googleWorkspace?: {
        serviceAccountEmail: string;
        adminEmail: string;
        privateKey: string;
        customerId?: string;
        connectedAt: string;
      };
      smartlead?: {
        apiKey: string;
        email?: string;
        hasLoginCredentials: boolean;
        connectedAt: string;
      };
    } = {};

    // Cloudflare - mask both accountId and apiToken
    if (credentials.cloudflare) {
      details.cloudflare = {
        accountId: maskSensitiveString(credentials.cloudflare.accountId),
        apiToken: maskSensitiveString(credentials.cloudflare.apiToken),
        connectedAt: credentials.cloudflare.connectedAt,
      };
    }

    // Google Workspace - mask all fields
    if (credentials.googleWorkspace) {
      details.googleWorkspace = {
        serviceAccountEmail: maskEmail(credentials.googleWorkspace.serviceAccountEmail),
        adminEmail: maskEmail(credentials.googleWorkspace.adminEmail),
        privateKey: '-----BEGIN***END-----', // Heavily masked
        customerId: credentials.googleWorkspace.customerId
          ? maskSensitiveString(credentials.googleWorkspace.customerId)
          : undefined,
        connectedAt: credentials.googleWorkspace.connectedAt,
      };
    }

    // Smartlead - mask API key and email, show login credential status
    if (credentials.smartlead) {
      const hasLoginCredentials = !!(
        credentials.smartlead.email && credentials.smartlead.password
      );

      details.smartlead = {
        apiKey: maskSensitiveString(credentials.smartlead.apiKey),
        email: credentials.smartlead.email ? maskEmail(credentials.smartlead.email) : undefined,
        hasLoginCredentials,
        connectedAt: credentials.smartlead.connectedAt,
      };
    }

    return details;
  } catch (error) {
    console.error('Error getting credential details for display:', error);
    return null;
  }
}

/**
 * Get credential details for editing (UNMASKED non-sensitive fields)
 * Returns actual values for fields that are safe to pre-fill in forms
 * Excludes sensitive fields (passwords, tokens, private keys)
 */
export async function getCredentialDetailsForEditing(): Promise<{
  cloudflare?: {
    accountId: string;
  };
  googleWorkspace?: {
    serviceAccountEmail: string;
    adminEmail: string;
    customerId?: string;
  };
  smartlead?: {
    email?: string;
  };
} | null> {
  try {
    const credentials = await getUserCredentials();

    if (!credentials) {
      return null;
    }

    const details: {
      cloudflare?: {
        accountId: string;
      };
      googleWorkspace?: {
        serviceAccountEmail: string;
        adminEmail: string;
        customerId?: string;
      };
      smartlead?: {
        email?: string;
      };
    } = {};

    // Cloudflare - return UNMASKED accountId (safe to pre-fill)
    if (credentials.cloudflare) {
      details.cloudflare = {
        accountId: credentials.cloudflare.accountId,
      };
    }

    // Google Workspace - return UNMASKED emails and customer ID
    if (credentials.googleWorkspace) {
      details.googleWorkspace = {
        serviceAccountEmail: credentials.googleWorkspace.serviceAccountEmail,
        adminEmail: credentials.googleWorkspace.adminEmail,
        customerId: credentials.googleWorkspace.customerId,
      };
    }

    // Smartlead - return UNMASKED email if exists
    if (credentials.smartlead) {
      details.smartlead = {
        email: credentials.smartlead.email,
      };
    }

    return details;
  } catch (error) {
    console.error('Error getting credential details for editing:', error);
    return null;
  }
}

/**
 * Get a valid Smartlead bearer token
 *
 * This function:
 * 1. Checks if a cached bearer token exists and is valid
 * 2. If expired or missing, uses stored login credentials to get a fresh token
 3. Updates the token in Stack Auth serverMetadata
 * 4. Returns the bearer token
 *
 * @returns Valid bearer token or null if credentials not configured
 * @throws Error if login credentials are missing or login fails
 */
export async function getSmartleadBearerToken(): Promise<string | null> {
  try {
    const credentials = await getSmartleadCredentials();

    if (!credentials) {
      return null;
    }

    // Check if we have a cached token and it's still valid
    if (credentials.bearerToken && credentials.tokenExpiresAt) {
      const expiresAt = new Date(credentials.tokenExpiresAt);
      const now = new Date();

      // If token expires in more than 1 hour, use it
      if (expiresAt.getTime() - now.getTime() > 60 * 60 * 1000) {
        return credentials.bearerToken;
      }
    }

    // Token is expired or missing - need to refresh
    if (!credentials.email || !credentials.password) {
      throw new Error(
        'Smartlead login credentials not configured. Please save your Smartlead login credentials.'
      );
    }

    // Get fresh token by logging in
    const { loginToSmartlead } = await import('@/lib/clients/smartlead');
    let loginResponse;

    try {
      loginResponse = await loginToSmartlead(credentials.email, credentials.password);
    } catch (error) {
      console.error('[Smartlead] Failed to refresh bearer token:', error);
      throw new Error(
        'Failed to refresh Smartlead bearer token. Please verify your login credentials.'
      );
    }

    // Calculate new expiry (23 hours from now)
    const tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();

    // Update stored credentials with fresh token
    const { updateUserCredentials } = await import('./credentials.actions');
    await updateUserCredentials({
      smartlead: {
        ...credentials,
        bearerToken: loginResponse.token,
        tokenExpiresAt: tokenExpiresAt,
      },
    });

    console.log('[Smartlead] Bearer token refreshed successfully');

    return loginResponse.token;
  } catch (error) {
    console.error('Error getting Smartlead bearer token:', error);
    throw error;
  }
}
