import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  text,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Domain management table
 * Stores domains used for email sending with their configuration and status
 */
export const domains = pgTable(
  'domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // References neon_auth.users_sync(id) - FK constraint added in SQL
    domain: varchar('domain', { length: 255 }).notNull().unique(),
    provider: varchar('provider', { length: 50 }).notNull(), // 'namecheap', 'godaddy', 'cloudflare', etc.

    // API credentials (encrypted in production)
    apiKey: text('api_key'),
    apiSecret: text('api_secret'),

    // Cloudflare zone integration
    cloudflareZoneId: varchar('cloudflare_zone_id', { length: 255 }), // Cloudflare zone ID from API
    assignedNameservers: jsonb('assigned_nameservers').$type<string[]>(), // Cloudflare-assigned nameservers

    // DNS verification
    verificationStatus: varchar('verification_status', { length: 20 })
      .notNull()
      .default('pending'), // 'pending', 'verified', 'failed'
    verificationToken: varchar('verification_token', { length: 255 }),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    nameserversVerified: boolean('nameservers_verified').default(false), // Track if nameservers point to Cloudflare

    // Domain health
    isActive: boolean('is_active').notNull().default(true),
    healthScore: varchar('health_score', { length: 20 }).default('unknown'), // 'excellent', 'good', 'warning', 'critical', 'unknown'
    lastHealthCheckAt: timestamp('last_health_check_at', {
      withTimezone: true,
    }),

    // Google Workspace integration
    googleWorkspaceStatus: varchar('google_workspace_status', { length: 30 }), // 'pending_verification', 'verified', 'verification_failed', null if not added
    googleWorkspaceVerificationToken: text(
      'google_workspace_verification_token'
    ), // Verification token from Site Verification API (google-site-verification=...)
    googleWorkspaceVerificationMethod: varchar(
      'google_workspace_verification_method',
      { length: 20 }
    ), // 'DNS_TXT'
    googleWorkspaceVerificationRecordId: varchar(
      'google_workspace_verification_record_id',
      { length: 255 }
    ), // Cloudflare DNS record ID for the verification TXT record
    googleWorkspaceManuallyVerified: boolean(
      'google_workspace_manually_verified'
    ).default(false), // User confirmed manual verification in Google Admin Console
    googleWorkspaceAddedAt: timestamp('google_workspace_added_at', {
      withTimezone: true,
    }),
    googleWorkspaceVerifiedAt: timestamp('google_workspace_verified_at', {
      withTimezone: true,
    }),

    // Metadata
    notes: text('notes'),
    metadata: jsonb('metadata'), // Additional provider-specific data

    // Add DNS configured timestamp field
    dnsConfiguredAt: timestamp('dns_configured_at', { withTimezone: true }), // When DNS records were first configured

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Critical indexes for performance
    index('idx_domains_user_id').on(table.userId),
    uniqueIndex('idx_domains_domain_unique').on(table.domain),
    index('idx_domains_user_active').on(table.userId, table.isActive),
  ]
);
