/**
 * Domain Management Types
 * Type definitions for domain connection, validation, and management
 */

/**
 * Domain verification status
 */
export type DomainVerificationStatus =
  | 'pending'           // Initial state, awaiting nameserver update
  | 'pending_nameservers' // Waiting for user to update nameservers
  | 'verifying'         // Actively checking nameserver propagation
  | 'verified'          // Nameservers verified, ready for DNS setup
  | 'failed';           // Verification failed

/**
 * Domain health status
 */
export type DomainHealthScore =
  | 'excellent'   // All checks passing
  | 'good'        // Minor issues
  | 'warning'     // Needs attention
  | 'critical'    // Serious issues
  | 'unknown';    // Not yet checked

/**
 * Supported domain registrars
 */
export type DomainProvider =
  | 'godaddy'
  | 'namecheap'
  | 'cloudflare'
  | 'google-domains'
  | 'name.com'
  | 'hover'
  | 'other';

/**
 * Domain record from database
 */
export interface Domain {
  id: string;
  userId: string;
  domain: string;
  provider: string;

  // API credentials (optional)
  apiKey?: string | null;
  apiSecret?: string | null;

  // Verification
  verificationStatus: string;
  verificationToken?: string | null;
  lastVerifiedAt?: Date | null;

  // Health
  isActive: boolean;
  healthScore?: string | null;
  lastHealthCheckAt?: Date | null;

  // Metadata
  notes?: string | null;
  metadata?: unknown; // Drizzle jsonb type returns unknown

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Domain connection input
 */
export interface DomainConnectionInput {
  domain: string;
  provider?: DomainProvider;
  notes?: string;
}

/**
 * Domain validation result
 */
export interface DomainValidationResult {
  isValid: boolean;
  sanitizedDomain?: string;
  errors: string[];
  warnings?: string[];
}

/**
 * Nameserver instruction set
 */
export interface NameserverInstructions {
  provider: DomainProvider;
  providerName: string;
  nameservers: string[];
  instructions: string[];
  documentationUrl?: string;
  estimatedPropagationTime: string;
}

/**
 * Domain connection result
 */
export interface DomainConnectionResult {
  success: boolean;
  domain?: Domain;
  nameserverInstructions?: NameserverInstructions;
  error?: string;
  validationErrors?: string[];
}

/**
 * Domain duplicate check result
 */
export interface DomainDuplicateCheck {
  isDuplicate: boolean;
  existingDomain?: Domain;
  message?: string;
}
