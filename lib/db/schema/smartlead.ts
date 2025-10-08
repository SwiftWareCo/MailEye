import { pgTable, uuid, varchar, timestamp, text, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { emailAccounts } from "./email-accounts";

/**
 * Smartlead sync configuration
 * Stores API configuration for Smartlead integration
 */
export const smartleadConfig = pgTable("smartlead_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(), // References neon_auth.users_sync(id) - FK constraint added in SQL

  // API credentials
  apiKey: text("api_key").notNull(), // Encrypted Smartlead API key

  // Sync settings
  autoSync: boolean("auto_sync").notNull().default(true),
  syncFrequency: varchar("sync_frequency", { length: 20 }).default("hourly"), // 'realtime', 'hourly', 'daily', 'manual'
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: varchar("last_sync_status", { length: 20 }).default("pending"), // 'success', 'failed', 'pending', 'in_progress'
  lastSyncError: text("last_sync_error"),

  // Metadata
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Critical indexes for performance
  uniqueIndex("idx_smartlead_config_user_id").on(table.userId),
]);

/**
 * Smartlead account mappings
 * Maps local email accounts to Smartlead email accounts
 */
export const smartleadAccountMappings = pgTable("smartlead_account_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailAccountId: uuid("email_account_id")
    .notNull()
    .references(() => emailAccounts.id, {
      onDelete: "cascade",
      onUpdate: "no action"
    })
    .unique(),

  // Smartlead data
  smartleadEmailAccountId: varchar("smartlead_email_account_id", { length: 255 }).notNull().unique(),
  smartleadEmail: varchar("smartlead_email", { length: 255 }).notNull(),

  // Sync status
  syncStatus: varchar("sync_status", { length: 20 }).notNull().default("synced"), // 'synced', 'pending', 'failed', 'conflict'
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncErrors: jsonb("sync_errors"), // Array of sync error messages

  // Smartlead account data snapshot
  smartleadData: jsonb("smartlead_data"), // Full Smartlead account data for reference

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Critical indexes for performance
  uniqueIndex("idx_smartlead_mappings_email_account_id").on(table.emailAccountId),
  uniqueIndex("idx_smartlead_mappings_smartlead_id").on(table.smartleadEmailAccountId),
]);

/**
 * Smartlead sync logs
 * Audit trail of all Smartlead synchronization events
 */
export const smartleadSyncLogs = pgTable("smartlead_sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // References neon_auth.users_sync(id) - FK constraint added in SQL

  // Sync details
  syncType: varchar("sync_type", { length: 50 }).notNull(), // 'full_sync', 'incremental_sync', 'account_import', 'account_export'
  direction: varchar("direction", { length: 10 }).notNull(), // 'import', 'export', 'bidirectional'
  status: varchar("status", { length: 20 }).notNull(), // 'success', 'failed', 'partial'

  // Statistics
  accountsProcessed: jsonb("accounts_processed"), // { total, success, failed }
  changesApplied: jsonb("changes_applied"), // { created, updated, deleted }

  // Error tracking
  errors: jsonb("errors"), // Array of error details
  errorMessage: text("error_message"),

  // Performance
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // Metadata
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Critical indexes for performance
  index("idx_smartlead_sync_logs_user_id").on(table.userId),
  index("idx_smartlead_sync_logs_history").on(table.userId, table.startedAt),
]);
