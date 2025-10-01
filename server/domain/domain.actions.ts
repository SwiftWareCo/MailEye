/**
 * Domain Server Actions
 *
 * Server Actions for domain mutations (create, update, delete)
 * Called from Client Components with userId bound from Server Component
 */

'use server';

import { connectDomain } from './domain-orchestrator';
import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  DomainConnectionInput,
  DomainConnectionResult,
} from '@/lib/types/domain';

/**
 * Server Action: Connect a new domain
 * Validates, creates domain record, and returns nameserver instructions
 *
 * @param userId - User ID (bound from Server Component)
 * @param input - Domain connection input from form
 */
export async function connectDomainAction(
  userId: string,
  input: DomainConnectionInput
): Promise<DomainConnectionResult> {
  try {
    // Call orchestrator to handle domain connection
    const result = await connectDomain(input, userId);
    return result;
  } catch (error) {
    console.error('Error in connectDomainAction:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Server Action: Delete a domain
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to delete
 */
export async function deleteDomainAction(
  userId: string,
  domainId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete domain (with user ownership check)
    const result = await db
      .delete(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .returning();

    if (result.length === 0) {
      return {
        success: false,
        error: 'Domain not found or you do not have permission to delete it',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting domain:', error);
    return {
      success: false,
      error: 'Failed to delete domain',
    };
  }
}

/**
 * Server Action: Update domain notes
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to update
 * @param notes - New notes value
 */
export async function updateDomainNotesAction(
  userId: string,
  domainId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(domains)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error('Error updating domain notes:', error);
    return {
      success: false,
      error: 'Failed to update notes',
    };
  }
}

/**
 * Server Action: Toggle domain active status
 *
 * @param userId - User ID (bound from Server Component)
 * @param domainId - Domain ID to update
 * @param isActive - New active status
 */
export async function toggleDomainActiveAction(
  userId: string,
  domainId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(domains)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error('Error toggling domain status:', error);
    return {
      success: false,
      error: 'Failed to update domain status',
    };
  }
}
