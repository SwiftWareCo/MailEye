import { pgTable, uuid, date, timestamp, integer, boolean, text, uniqueIndex, index } from "drizzle-orm/pg-core";
import { emailAccounts } from "./email-accounts";

/**
 * Warmup Checklist Completions
 * Tracks daily manual warmup checklist completions for email accounts (Days 1-7)
 *
 * Ensures users complete manual interaction tasks during critical warmup period:
 * - Open Gmail and check inbox
 * - Reply to 3-5 warmup emails
 * - Move spam folder emails to inbox
 * - Archive/delete read emails
 * - Mark sender as safe
 */
export const warmupChecklistCompletions = pgTable("warmup_checklist_completions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Email account reference
  emailAccountId: uuid("email_account_id")
    .notNull()
    .references(() => emailAccounts.id, {
      onDelete: "cascade",
      onUpdate: "no action"
    }),

  // Completion tracking
  completionDate: date("completion_date").notNull(), // Which day the checklist is for (YYYY-MM-DD)
  completedAt: timestamp("completed_at", { withTimezone: true }), // When user marked it complete (NULL if not completed)
  warmupDay: integer("warmup_day").notNull(), // Day 1, Day 2, ... Day 30 (relative to account creation)

  // Status flags
  skipped: boolean("skipped").notNull().default(false), // True if user explicitly skipped this day
  skipReason: text("skip_reason"), // Optional reason for skipping

  // Optional notes from user
  notes: text("notes"),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Ensure one checklist per account per day
  uniqueIndex("idx_warmup_checklist_account_date").on(table.emailAccountId, table.completionDate),

  // Index for querying pending checklists
  index("idx_warmup_checklist_pending").on(table.emailAccountId, table.completedAt),

  // Index for user-wide checklist queries
  index("idx_warmup_checklist_date").on(table.completionDate),
]);
