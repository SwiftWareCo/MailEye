import { pgTable, uuid, varchar, timestamp, text, integer, jsonb, index } from "drizzle-orm/pg-core";
import { domains } from "./domains";

/**
 * DNS records table
 * Stores all DNS records for domains (A, MX, TXT, CNAME, etc.)
 */
export const dnsRecords = pgTable("dns_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),

  // DNS record details
  recordType: varchar("record_type", { length: 10 }).notNull(), // 'A', 'MX', 'TXT', 'CNAME', 'SPF', 'DKIM', 'DMARC'
  name: varchar("name", { length: 255 }).notNull(), // e.g., '@', 'mail', '_dmarc', 'selector._domainkey'
  value: text("value").notNull(), // The DNS record value
  ttl: integer("ttl").default(3600), // Time to live in seconds
  priority: integer("priority"), // For MX records

  // Status tracking
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'active', 'failed', 'deleted'
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  propagationStatus: varchar("propagation_status", { length: 20 }).default("unknown"), // 'propagated', 'pending', 'failed', 'unknown'

  // Metadata
  purpose: varchar("purpose", { length: 50 }), // 'email_verification', 'spf', 'dkim', 'dmarc', 'mx', 'custom'
  metadata: jsonb("metadata"), // Additional record-specific data

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Critical indexes for performance
  domainIdIdx: index("idx_dns_records_domain_id").on(table.domainId),
  domainTypeIdx: index("idx_dns_records_domain_type").on(table.domainId, table.recordType),
}));
