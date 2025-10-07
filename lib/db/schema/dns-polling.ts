import { pgTable, uuid, varchar, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { domains } from "./domains";

/**
 * DNS polling sessions table
 * Tracks active DNS propagation polling sessions for domains
 * Used by the DNS polling job service (Task 4.3)
 */
export const dnsPollingSession = pgTable("dns_polling_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(), // References neon_auth.users_sync(id) - FK constraint added in SQL

  // Session status
  status: varchar("status", { length: 20 }).notNull().default("polling"), // 'polling', 'completed', 'timeout', 'cancelled'

  // Polling configuration
  checkInterval: integer("check_interval").notNull().default(30000), // 30 seconds in milliseconds
  maxDuration: integer("max_duration").notNull().default(172800000), // 48 hours in milliseconds

  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  estimatedCompletion: timestamp("estimated_completion", { withTimezone: true }),

  // Progress tracking
  totalRecords: integer("total_records").notNull().default(0),
  propagatedRecords: integer("propagated_records").notNull().default(0),
  overallProgress: integer("overall_progress").notNull().default(0), // 0-100%

  // Metadata
  metadata: jsonb("metadata"), // Additional session-specific data (e.g., record-level status)

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Critical indexes for performance
  index("idx_dns_polling_session_domain_id").on(table.domainId),
  index("idx_dns_polling_session_user_id").on(table.userId),
  index("idx_dns_polling_session_status").on(table.status),
  index("idx_dns_polling_session_active").on(table.domainId, table.status), // For finding active sessions
]);
