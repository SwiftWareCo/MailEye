import { pgTable, uuid, varchar, timestamp, boolean, text, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Domain management table
 * Stores domains used for email sending with their configuration and status
 */
export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // References neon_auth.users_sync(id) - FK constraint added in SQL
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'namecheap', 'godaddy', 'cloudflare', etc.

  // API credentials (encrypted in production)
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),

  // DNS verification
  verificationStatus: varchar("verification_status", { length: 20 }).notNull().default("pending"), // 'pending', 'verified', 'failed'
  verificationToken: varchar("verification_token", { length: 255 }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

  // Domain health
  isActive: boolean("is_active").notNull().default(true),
  healthScore: varchar("health_score", { length: 20 }).default("unknown"), // 'excellent', 'good', 'warning', 'critical', 'unknown'
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),

  // Metadata
  notes: text("notes"),
  metadata: jsonb("metadata"), // Additional provider-specific data

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Critical indexes for performance
  userIdIdx: index("idx_domains_user_id").on(table.userId),
  domainUniqueIdx: uniqueIndex("idx_domains_domain_unique").on(table.domain),
  userActiveIdx: index("idx_domains_user_active").on(table.userId, table.isActive),
}));
