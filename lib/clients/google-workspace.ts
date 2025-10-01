/**
 * Google Workspace Admin SDK Client
 * Provides user creation and management functionality
 * Requires service account with domain-wide delegation
 */

import { google } from 'googleapis';

/**
 * Configuration for Google Workspace service account
 */
export interface GoogleWorkspaceConfig {
  serviceAccountEmail: string;
  privateKey: string;
  adminEmail: string; // Email of admin user for domain-wide delegation
  customerId?: string; // Optional: Google Workspace customer ID
}

/**
 * Gets Google Workspace configuration from environment variables
 */
export function getGoogleWorkspaceConfig(): GoogleWorkspaceConfig {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;

  if (!serviceAccountEmail || !privateKey || !adminEmail) {
    throw new Error(
      'Missing Google Workspace configuration. Required: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_ADMIN_EMAIL'
    );
  }

  return {
    serviceAccountEmail,
    privateKey,
    adminEmail,
    customerId: process.env.GOOGLE_CUSTOMER_ID,
  };
}

/**
 * Creates an authenticated Google Admin SDK client
 */
export function getGoogleAdminClient() {
  const config = getGoogleWorkspaceConfig();

  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.user.security',
    ],
    subject: config.adminEmail, // Impersonate admin user for domain-wide delegation
  });

  return google.admin({ version: 'directory_v1', auth });
}

/**
 * Creates a new Google Workspace user
 */
export async function createGoogleWorkspaceUser(
  domain: string,
  userData: {
    username: string;
    firstName: string;
    lastName: string;
    password: string;
  }
) {
  const admin = getGoogleAdminClient();

  const response = await admin.users.insert({
    requestBody: {
      primaryEmail: `${userData.username}@${domain}`,
      name: {
        givenName: userData.firstName,
        familyName: userData.lastName,
      },
      password: userData.password,
      changePasswordAtNextLogin: false,
    },
  });

  return response.data;
}

/**
 * Lists all users in a Google Workspace domain
 */
export async function listGoogleWorkspaceUsers(domain: string) {
  const admin = getGoogleAdminClient();

  const response = await admin.users.list({
    domain,
    maxResults: 500,
  });

  return response.data.users || [];
}

/**
 * Deletes a Google Workspace user
 */
export async function deleteGoogleWorkspaceUser(email: string) {
  const admin = getGoogleAdminClient();

  await admin.users.delete({
    userKey: email,
  });

  return { success: true };
}

/**
 * Updates a Google Workspace user's password
 */
export async function updateUserPassword(email: string, newPassword: string) {
  const admin = getGoogleAdminClient();

  const response = await admin.users.update({
    userKey: email,
    requestBody: {
      password: newPassword,
      changePasswordAtNextLogin: false,
    },
  });

  return response.data;
}

/**
 * Gets Google Workspace user information
 */
export async function getGoogleWorkspaceUser(email: string) {
  const admin = getGoogleAdminClient();

  const response = await admin.users.get({
    userKey: email,
  });

  return response.data;
}
