/**
 * Smartlead Credentials Server Actions
 *
 * Handles user Smartlead API credential connection and management
 */

'use server';

import { updateUserCredentials } from '../credentials/credentials.actions';
import type { SmartleadCredentials } from '@/lib/types/credentials';
import { loginToSmartlead } from '@/lib/clients/smartlead';

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';

/**
 * Save user's Smartlead API credentials to Stack Auth metadata
 *
 * Validates credentials by testing API access before saving
 */
export async function saveSmartleadCredentialsAction(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        error: 'API key is required',
      };
    }

    // Verify credentials by testing API call
    try {
      // Test: Can we list campaigns?
      const response = await fetch(
        `${SMARTLEAD_BASE_URL}/campaigns?api_key=${apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Invalid API key';

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          // Keep default error message
        }

        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: 'Invalid Smartlead API key. Please verify your API key is correct.',
          };
        }

        return {
          success: false,
          error: `API validation failed: ${errorMessage}`,
        };
      }

      // Verify response is valid JSON
      await response.json();
    } catch (error) {
      console.error('Invalid Smartlead API key:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('fetch')) {
        return {
          success: false,
          error: 'Unable to connect to Smartlead API. Please check your internet connection.',
        };
      }

      return {
        success: false,
        error: `Failed to verify API key: ${errorMessage}`,
      };
    }

    // Save credentials to Stack Auth metadata (automatically encrypted)
    const credentials: SmartleadCredentials = {
      apiKey,
      connectedAt: new Date().toISOString(),
    };

    const result = await updateUserCredentials({
      smartlead: credentials,
    });

    if (!result.success) {
      return result;
    }

    console.log('[Smartlead] User connected Smartlead account');

    return { success: true };
  } catch (error) {
    console.error('Error saving Smartlead credentials:', error);
    return {
      success: false,
      error: 'Failed to save credentials. Please try again.',
    };
  }
}

/**
 * Save user's Smartlead login credentials (email + password)
 * and obtain bearer token for advanced features
 *
 * This enables access to undocumented Smartlead endpoints that require
 * bearer token authentication (like advanced warmup settings).
 *
 * Credentials are stored encrypted in Stack Auth serverMetadata.
 *
 * @param email - Smartlead account email
 * @param password - Smartlead account password
 */
export async function saveSmartleadLoginCredentialsAction(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; apiKey?: string }> {
  try {
    // Validate input
    if (!email || email.trim().length === 0) {
      return {
        success: false,
        error: 'Email is required',
      };
    }

    if (!password || password.trim().length === 0) {
      return {
        success: false,
        error: 'Password is required',
      };
    }

    // Verify credentials by attempting login
    let loginResponse;
    try {
      loginResponse = await loginToSmartlead(email, password);
    } catch (error) {
      console.error('Smartlead login validation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }

    // Calculate token expiry (JWT tokens typically expire in 24 hours, but we'll be conservative)
    // Default to 23 hours from now
    const tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();

    // Save credentials to Stack Auth metadata (automatically encrypted)
    const credentials: SmartleadCredentials = {
      apiKey: loginResponse.user.api_key, // Extract API key from login response
      email: email,
      password: password, // Encrypted via Stack Auth
      bearerToken: loginResponse.token,
      tokenExpiresAt: tokenExpiresAt,
      connectedAt: new Date().toISOString(),
    };

    const result = await updateUserCredentials({
      smartlead: credentials,
    });

    if (!result.success) {
      return result;
    }

    console.log('[Smartlead] User connected Smartlead account with login credentials');

    return {
      success: true,
      apiKey: loginResponse.user.api_key,
    };
  } catch (error) {
    console.error('Error saving Smartlead login credentials:', error);
    return {
      success: false,
      error: 'Failed to save credentials. Please try again.',
    };
  }
}

/**
 * Disconnect user's Smartlead account
 */
export async function disconnectSmartleadAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { removeServiceCredentials } = await import(
      '../credentials/credentials.actions'
    );

    const result = await removeServiceCredentials('smartlead');

    if (result.success) {
      console.log('[Smartlead] User disconnected Smartlead account');
    }

    return result;
  } catch (error) {
    console.error('Error disconnecting Smartlead:', error);
    return {
      success: false,
      error: 'Failed to disconnect Smartlead',
    };
  }
}

/**
 * Test Smartlead connection
 *
 * Verifies that stored credentials are still valid
 */
export async function testSmartleadConnectionAction(): Promise<{
  success: boolean;
  error?: string;
  campaignCount?: number;
}> {
  try {
    const { getSmartleadCredentials } = await import(
      '../credentials/credentials.data'
    );

    const credentials = await getSmartleadCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Smartlead not connected',
      };
    }

    // Test connection
    const response = await fetch(
      `${SMARTLEAD_BASE_URL}/campaigns?api_key=${credentials.apiKey}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: 'API key is no longer valid',
      };
    }

    const data = await response.json();

    return {
      success: true,
      campaignCount: Array.isArray(data) ? data.length : 0,
    };
  } catch (error) {
    console.error('Error testing Smartlead connection:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test connection',
    };
  }
}
