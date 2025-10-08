/**
 * Centralized Credentials Actions
 *
 * Server actions for managing user credentials in Stack Auth serverMetadata
 */

'use server';

import { stackServerApp } from '@/stack/server';
import type { UserCredentials } from '@/lib/types/credentials';

/**
 * Update user credentials in Stack Auth serverMetadata
 *
 * Merges new credentials with existing ones
 */
export async function updateUserCredentials(
  updates: Partial<UserCredentials>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'User not found. Please log in and try again.',
      };
    }

    // Get existing credentials
    const existingCredentials = (user.serverMetadata || {}) as UserCredentials;

    // Merge with updates
    const updatedCredentials: UserCredentials = {
      ...existingCredentials,
      ...updates,
    };

    // Save to Stack Auth
    await user.update({
      serverMetadata: updatedCredentials as Record<string, unknown>,
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating user credentials:', error);
    return {
      success: false,
      error: 'Failed to save credentials. Please try again.',
    };
  }
}

/**
 * Remove specific service credentials
 */
export async function removeServiceCredentials(
  service: 'cloudflare' | 'googleWorkspace' | 'smartlead'
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Get existing credentials
    const existingCredentials = (user.serverMetadata || {}) as UserCredentials;

    // Remove the specified service
    delete existingCredentials[service];

    // Save updated credentials
    await user.update({
      serverMetadata: existingCredentials as ReadonlyJson,
    });

    console.log(`[Credentials] Removed ${service} credentials for user ${user.id}`);

    return { success: true };
  } catch (error) {
    console.error(`Error removing ${service} credentials:`, error);
    return {
      success: false,
      error: `Failed to remove ${service} credentials`,
    };
  }
}

/**
 * Clear all user credentials
 */
export async function clearAllCredentials(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Clear all credentials
    await user.update({
      serverMetadata: {},
    });

    console.log(`[Credentials] Cleared all credentials for user ${user.id}`);

    return { success: true };
  } catch (error) {
    console.error('Error clearing credentials:', error);
    return {
      success: false,
      error: 'Failed to clear credentials',
    };
  }
}
