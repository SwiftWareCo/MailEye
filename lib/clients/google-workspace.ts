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
  },
  config?: GoogleWorkspaceConfig
) {
  const admin = config
    ? getGoogleAdminClientWithCredentials(config)
    : getGoogleAdminClient();

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
export async function getGoogleWorkspaceUser(
  email: string,
  config?: GoogleWorkspaceConfig
) {
  const admin = config
    ? getGoogleAdminClientWithCredentials(config)
    : getGoogleAdminClient();

  const response = await admin.users.get({
    userKey: email,
  });

  return response.data;
}

/**
 * Creates an authenticated Google Admin SDK client with custom credentials
 */
export function getGoogleAdminClientWithCredentials(config: GoogleWorkspaceConfig) {
  // Handle escaped newlines in private key (common when stored in JSON/databases)
  const privateKey = config.privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.user.security',
      'https://www.googleapis.com/auth/admin.directory.domain',
      'https://www.googleapis.com/auth/siteverification', // For domain verification
    ],
    subject: config.adminEmail,
  });

  return google.admin({ version: 'directory_v1', auth });
}

/**
 * Adds a domain to Google Workspace
 * Requires domain-wide delegation with admin.directory.domain scope
 *
 * @param domain - Domain name to add (e.g., "example.com")
 * @param config - Google Workspace configuration
 * @returns Domain object from Google API
 */
export async function addDomainToGoogleWorkspace(
  domain: string,
  config: GoogleWorkspaceConfig
) {
  const admin = getGoogleAdminClientWithCredentials(config);
  const customerId = config.customerId || 'my_customer';

  try {
    const response = await admin.domains.insert({
      customer: customerId,
      requestBody: {
        domainName: domain,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error adding domain to Google Workspace:', error);
    throw error;
  }
}

/**
 * Removes a domain from Google Workspace
 *
 * @param domain - Domain name to remove
 * @param config - Google Workspace configuration
 */
export async function removeDomainFromGoogleWorkspace(
  domain: string,
  config: GoogleWorkspaceConfig
) {
  const admin = getGoogleAdminClientWithCredentials(config);
  const customerId = config.customerId || 'my_customer';

  try {
    await admin.domains.delete({
      customer: customerId,
      domainName: domain,
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing domain from Google Workspace:', error);
    throw error;
  }
}

/**
 * Gets domain information from Google Workspace
 *
 * @param domain - Domain name to check
 * @param config - Google Workspace configuration
 * @returns Domain object or null if not found
 */
export async function getGoogleWorkspaceDomain(
  domain: string,
  config: GoogleWorkspaceConfig
) {
  const admin = getGoogleAdminClientWithCredentials(config);
  const customerId = config.customerId || 'my_customer';

  try {
    const response = await admin.domains.get({
      customer: customerId,
      domainName: domain,
    });

    return response.data;
  } catch (error) {
    // If domain not found, return null
    if ((error as { code?: number }).code === 404) {
      return null;
    }

    console.error('Error getting domain from Google Workspace:', error);
    throw error;
  }
}

/**
 * Lists all domains in Google Workspace
 *
 * @param config - Google Workspace configuration
 * @returns Array of domain objects
 */
export async function listGoogleWorkspaceDomains(config: GoogleWorkspaceConfig) {
  const admin = getGoogleAdminClientWithCredentials(config);
  const customerId = config.customerId || 'my_customer';

  try {
    const response = await admin.domains.list({
      customer: customerId,
    });

    return response.data.domains || [];
  } catch (error) {
    console.error('Error listing domains from Google Workspace:', error);
    throw error;
  }
}
