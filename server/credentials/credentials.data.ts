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
