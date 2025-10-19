import { pgTable, uuid, varchar, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { emailAccounts } from "./email-accounts";

/**
 * Smartlead account mappings
 * Maps local email accounts to Smartlead email accounts
 *
 * NOTE: Smartlead API credentials are stored in Stack Auth serverMetadata
 * (see server/credentials/credentials.data.ts for access)
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
