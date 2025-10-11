/**
 * Google Site Verification API Client
 *
 * Provides domain ownership verification functionality via DNS TXT records
 * Requires service account with domain-wide delegation
 */

import { google } from 'googleapis';
import type { GoogleWorkspaceConfig } from './google-workspace';

/**
 * Verification token result from getToken API
 */
export interface VerificationToken {
  method: 'DNS_TXT';
  token: string;
}

/**
 * Verification result from insert API
 */
export interface VerificationResult {
  id: string;
  owners: string[];
  site: {
    type: 'INET_DOMAIN';
    identifier: string;
  };
}

/**
 * Creates an authenticated Site Verification API client
 * Internal helper function used by other exported functions
 */
function getSiteVerificationClient(config: GoogleWorkspaceConfig) {
  // Handle escaped newlines in private key
  const privateKey = config.privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/siteverification',
    ],
    subject: config.adminEmail, // Impersonate admin user
  });

  return google.siteVerification({ version: 'v1', auth });
}

/**
 * Get verification token for DNS TXT record
 *
 * @param domain - Domain to verify (e.g., "example.com")
 * @param config - Google Workspace configuration
 * @returns Verification token to place in DNS TXT record
 */
export async function getVerificationToken(
  domain: string,
  config: GoogleWorkspaceConfig
): Promise<VerificationToken> {
  const client = getSiteVerificationClient(config);

  try {
    const response = await client.webResource.getToken({
      requestBody: {
        site: {
          type: 'INET_DOMAIN',
          identifier: domain,
        },
        verificationMethod: 'DNS_TXT',
      },
    });

    if (!response.data.token) {
      throw new Error('No verification token returned from Google');
    }

    return {
      method: 'DNS_TXT',
      token: response.data.token,
    };
  } catch (error) {
    console.error('Error getting verification token:', error);
    throw error;
  }
}

/**
 * Trigger domain verification after TXT record is placed
 *
 * @param domain - Domain to verify
 * @param config - Google Workspace configuration
 * @returns Verification result
 */
export async function verifyDomain(
  domain: string,
  config: GoogleWorkspaceConfig
): Promise<VerificationResult> {
  const client = getSiteVerificationClient(config);

  try {
    const response = await client.webResource.insert({
      verificationMethod: 'DNS_TXT',
      requestBody: {
        site: {
          type: 'INET_DOMAIN',
          identifier: domain,
        },
      },
    });

    return {
      id: response.data.id || `dns://${domain}/`,
      owners: response.data.owners || [],
      site: {
        type: 'INET_DOMAIN',
        identifier: domain,
      },
    };
  } catch (error) {
    console.error('Error verifying domain:', error);
    throw error;
  }
}

/**
 * Check if domain is already verified
 *
 * Uses webResource.list() instead of get() to avoid 400 errors when domain
 * hasn't been verified yet via webResource.insert()
 *
 * @param domain - Domain to check
 * @param config - Google Workspace configuration
 * @returns true if verified, false otherwise
 */
export async function isDomainVerified(
  domain: string,
  config: GoogleWorkspaceConfig
): Promise<boolean> {
  const client = getSiteVerificationClient(config);

  try {
    // Use list() instead of get() - doesn't throw 400 if domain not verified
    const response = await client.webResource.list();

    // Check if our domain is in the verified list
    const verifiedDomains = (response.data.items || [])
      .filter(item => item.site?.type === 'INET_DOMAIN')
      .map(item => item.site?.identifier || '');

    // Case-insensitive comparison
    return verifiedDomains.some(
      verifiedDomain => verifiedDomain.toLowerCase() === domain.toLowerCase()
    );
  } catch (error) {
    console.error('Error checking domain verification status:', error);
    // If list fails, domain is not verified
    return false;
  }
}
