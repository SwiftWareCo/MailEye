/**
 * Google Workspace Credentials Server Actions
 *
 * Handles user Google Workspace Admin SDK credential connection and management
 */

'use server';

import { google } from 'googleapis';
import { updateUserCredentials } from '../credentials/credentials.actions';
import type { GoogleWorkspaceCredentials } from '@/lib/types/credentials';

/**
 * Save user's Google Workspace credentials to Stack Auth metadata
 *
 * Validates credentials by testing Admin SDK access before saving
 */
export async function saveGoogleWorkspaceCredentialsAction(
  serviceAccountEmail: string,
  privateKey: string,
  adminEmail: string,
  customerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!serviceAccountEmail || !privateKey || !adminEmail) {
      return {
        success: false,
        error: 'Service Account Email, Private Key, and Admin Email are required',
      };
    }

    // Verify credentials by testing API call
    try {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
        scopes: [
          'https://www.googleapis.com/auth/admin.directory.user',
          'https://www.googleapis.com/auth/admin.directory.user.security',
        ],
        subject: adminEmail,
      });

      const admin = google.admin({ version: 'directory_v1', auth });

      // Test: Can we list users?
      await admin.users.list({
        customer: customerId || 'my_customer',
        maxResults: 1,
      });
    } catch (error) {
      console.error('Invalid Google Workspace credentials:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Provide helpful error messages
      if (errorMessage.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Invalid service account credentials. Please verify the private key and service account email are correct.',
        };
      }

      if (errorMessage.includes('unauthorized_client')) {
        return {
          success: false,
          error: 'Service account not authorized. Please ensure domain-wide delegation is enabled for this service account.',
        };
      }

      if (errorMessage.includes('access_denied') || errorMessage.includes('403')) {
        return {
          success: false,
          error: 'Access denied. Please verify the admin email has the necessary permissions and domain-wide delegation is configured.',
        };
      }

      return {
        success: false,
        error: `Failed to verify credentials: ${errorMessage}`,
      };
    }

    // Save credentials to Stack Auth metadata (automatically encrypted)
    const credentials: GoogleWorkspaceCredentials = {
      serviceAccountEmail,
      privateKey,
      adminEmail,
      customerId,
      connectedAt: new Date().toISOString(),
    };

    const result = await updateUserCredentials({
      googleWorkspace: credentials,
    });

    if (!result.success) {
      return result;
    }

    console.log('[Google Workspace] User connected Google Workspace account');

    return { success: true };
  } catch (error) {
    console.error('Error saving Google Workspace credentials:', error);
    return {
      success: false,
      error: 'Failed to save credentials. Please try again.',
    };
  }
}

/**
 * Disconnect user's Google Workspace account
 */
export async function disconnectGoogleWorkspaceAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { removeServiceCredentials } = await import(
      '../credentials/credentials.actions'
    );

    const result = await removeServiceCredentials('googleWorkspace');

    if (result.success) {
      console.log('[Google Workspace] User disconnected Google Workspace account');
    }

    return result;
  } catch (error) {
    console.error('Error disconnecting Google Workspace:', error);
    return {
      success: false,
      error: 'Failed to disconnect Google Workspace',
    };
  }
}

/**
 * Test Google Workspace connection
 *
 * Verifies that stored credentials are still valid
 */
export async function testGoogleWorkspaceConnectionAction(): Promise<{
  success: boolean;
  error?: string;
  userCount?: number;
}> {
  try {
    const { getGoogleWorkspaceCredentials } = await import(
      '../credentials/credentials.data'
    );

    const credentials = await getGoogleWorkspaceCredentials();

    if (!credentials) {
      return {
        success: false,
        error: 'Google Workspace not connected',
      };
    }

    // Test connection
    const auth = new google.auth.JWT({
      email: credentials.serviceAccountEmail,
      key: credentials.privateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.user.security',
      ],
      subject: credentials.adminEmail,
    });

    const admin = google.admin({ version: 'directory_v1', auth });

    const response = await admin.users.list({
      customer: credentials.customerId || 'my_customer',
      maxResults: 1,
    });

    return {
      success: true,
      userCount: response.data.users?.length || 0,
    };
  } catch (error) {
    console.error('Error testing Google Workspace connection:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to test connection',
    };
  }
}
