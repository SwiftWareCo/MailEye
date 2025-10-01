/**
 * Domain Validation Utilities (Task 2.1)
 *
 * Provides domain format validation, sanitization, and duplicate checking
 * for domain connection workflow.
 */

import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  DomainValidationResult,
  DomainDuplicateCheck,
} from '@/lib/types/domain';

/**
 * RFC 1035 compliant domain validation regex
 * - Allows alphanumeric characters and hyphens
 * - Labels cannot start or end with hyphen
 * - Maximum 253 characters total
 * - Each label max 63 characters
 */
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Sanitize domain input
 * - Remove http/https protocols
 * - Remove www prefix
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove trailing slashes
 */
export function sanitizeDomain(input: string): string {
  let sanitized = input.trim().toLowerCase();

  // Remove protocol
  sanitized = sanitized.replace(/^https?:\/\//, '');

  // Remove www prefix
  sanitized = sanitized.replace(/^www\./, '');

  // Remove trailing slash and path
  sanitized = sanitized.split('/')[0];

  // Remove port if present
  sanitized = sanitized.split(':')[0];

  return sanitized;
}

/**
 * Validate domain format
 * Checks RFC 1035 compliance and detects common issues
 */
export function validateDomainFormat(domain: string): DomainValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check empty
  if (!domain || domain.trim().length === 0) {
    errors.push('Domain cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Sanitize first
  const sanitized = sanitizeDomain(domain);

  // Check length
  if (sanitized.length > 253) {
    errors.push('Domain exceeds maximum length of 253 characters');
  }

  // Check for spaces
  if (sanitized.includes(' ')) {
    errors.push('Domain cannot contain spaces');
  }

  // Check for invalid characters
  if (!/^[a-z0-9.-]+$/.test(sanitized)) {
    errors.push('Domain contains invalid characters (only letters, numbers, dots, and hyphens allowed)');
  }

  // Check for consecutive dots
  if (sanitized.includes('..')) {
    errors.push('Domain cannot contain consecutive dots');
  }

  // Check starts/ends with dot or hyphen
  if (sanitized.startsWith('.') || sanitized.startsWith('-')) {
    errors.push('Domain cannot start with a dot or hyphen');
  }
  if (sanitized.endsWith('.') || sanitized.endsWith('-')) {
    errors.push('Domain cannot end with a dot or hyphen');
  }

  // Check RFC 1035 format
  if (!DOMAIN_REGEX.test(sanitized)) {
    errors.push('Invalid domain format');
  }

  // Check for subdomain (should be root domain only)
  const labels = sanitized.split('.');
  if (labels.length > 2) {
    // Check if it's actually a subdomain vs multi-part TLD
    const commonMultiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.za'];
    const lastTwo = labels.slice(-2).join('.');

    if (!commonMultiPartTLDs.includes(lastTwo) && labels.length > 2) {
      warnings.push('Please use root domain only (e.g., example.com instead of sub.example.com)');
    }
  }

  // Check for minimum TLD length
  const tld = labels[labels.length - 1];
  if (tld.length < 2) {
    errors.push('Top-level domain must be at least 2 characters');
  }

  // Check each label length
  for (const label of labels) {
    if (label.length > 63) {
      errors.push(`Label "${label}" exceeds maximum length of 63 characters`);
    }
  }

  return {
    isValid: errors.length === 0,
    sanitizedDomain: errors.length === 0 ? sanitized : undefined,
    errors,
    warnings,
  };
}

/**
 * Check if domain already exists in database
 */
export async function checkDomainDuplicate(
  domain: string,
  userId: string
): Promise<DomainDuplicateCheck> {
  const sanitized = sanitizeDomain(domain);

  try {
    // Check if domain exists for this user
    const existingDomain = await db.query.domains.findFirst({
      where: and(
        eq(domains.domain, sanitized),
        eq(domains.userId, userId)
      ),
    });

    if (existingDomain) {
      return {
        isDuplicate: true,
        existingDomain,
        message: 'You have already connected this domain',
      };
    }

    // Check if domain exists for another user (global check)
    const globalDomain = await db.query.domains.findFirst({
      where: eq(domains.domain, sanitized),
    });

    if (globalDomain) {
      return {
        isDuplicate: true,
        message: 'This domain is already connected to another account',
      };
    }

    return {
      isDuplicate: false,
    };
  } catch (error) {
    console.error('Error checking domain duplicate:', error);
    throw new Error('Failed to check domain availability');
  }
}

/**
 * Complete domain validation (format + duplicate check)
 * Use this for form validation before domain connection
 */
export async function validateDomain(
  domain: string,
  userId: string
): Promise<DomainValidationResult> {
  // First validate format
  const formatValidation = validateDomainFormat(domain);

  if (!formatValidation.isValid || !formatValidation.sanitizedDomain) {
    return formatValidation;
  }

  // Then check for duplicates
  try {
    const duplicateCheck = await checkDomainDuplicate(
      formatValidation.sanitizedDomain,
      userId
    );

    if (duplicateCheck.isDuplicate) {
      return {
        isValid: false,
        sanitizedDomain: formatValidation.sanitizedDomain,
        errors: [duplicateCheck.message || 'Domain already exists'],
        warnings: formatValidation.warnings,
      };
    }

    return formatValidation;
  } catch (error) {
    return {
      isValid: false,
      sanitizedDomain: formatValidation.sanitizedDomain,
      errors: ['Failed to validate domain availability'],
      warnings: formatValidation.warnings,
    };
  }
}

/**
 * Detect domain registrar/provider from domain name
 * This is a heuristic based on common patterns
 */
export function detectProvider(_domain: string): string {
  // Simple detection - can be enhanced with WHOIS lookup in future
  // For now, return 'other' and let user select
  return 'other';
}
