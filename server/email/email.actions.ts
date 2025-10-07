/**
 * Email Provisioning Server Actions
 *
 * Wraps email account creation functions for use in wizard
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { createEmailAccount } from './google-workspace-provisioner';
import type { EmailAccountResult, CreateEmailAccountParams, EmailCredentials } from '@/lib/types/email';
import { getDomainById } from '../domain/domain.data';

/**
 * Create Email Account Action
 *
 * Creates a Google Workspace email account
 */
export async function createEmailAccountAction(params: {
  domainId: string;
  username: string;
  firstName: string;
  lastName: string;
}): Promise<EmailAccountResult> {
  // Authenticate user
  const user = await stackServerApp.getUser();
  if (!user) {
    return {
      success: false,
      email: '',
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: {
        type: 'UNKNOWN_ERROR',
        message: 'Authentication required',
        details: {},
        retryable: false,
      },
    };
  }

  // Get domain
  const domain = await getDomainById(params.domainId, user.id);
  if (!domain) {
    return {
      success: false,
      email: '',
      credentials: {} as EmailCredentials,
      provider: 'google_workspace',
      error: {
        type: 'DOMAIN_NOT_FOUND',
        message: 'Domain not found',
        details: {},
        retryable: false,
      },
    };
  }

  // Provision account
  const provisionParams: CreateEmailAccountParams = {
    domain: domain.domain,
    username: params.username,
    firstName: params.firstName,
    lastName: params.lastName,
  };

  const result = await createEmailAccount(provisionParams);
  return result;
}
