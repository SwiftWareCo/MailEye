import { pgTable, uuid, varchar, timestamp, integer, jsonb, text, index } from "drizzle-orm/pg-core";

/**
 * Batch operations table
 * Tracks bulk operations like domain imports, email account creation, DNS setup
 */
export const batchOperations = pgTable("batch_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // References neon_auth.users_sync(id) - FK constraint added in SQL

  // Operation details
  operationType: varchar("operation_type", { length: 50 }).notNull(), // 'domain_import', 'email_account_creation', 'dns_setup', 'spf_flattening', 'smartlead_sync'
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'failed', 'partial'

  // Progress tracking
  totalItems: integer("total_items").notNull(),
  processedItems: integer("processed_items").default(0),
  successfulItems: integer("successful_items").default(0),
  failedItems: integer("failed_items").default(0),

  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  estimatedCompletionAt: timestamp("estimated_completion_at", { withTimezone: true }),

  // Input/Output
  inputData: jsonb("input_data"), // Original input data (e.g., CSV import data)
  results: jsonb("results"), // Detailed results for each item
  errors: jsonb("errors"), // Array of error details

  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Critical indexes for performance
  userIdIdx: index("idx_batch_operations_user_id").on(table.userId),
  historyIdx: index("idx_batch_operations_history").on(table.userId, table.createdAt, table.status),
  statusIdx: index("idx_batch_operations_status").on(table.status),
}));

/**
 * Batch operation items
 * Individual items within a batch operation for granular tracking
 */
export const batchOperationItems = pgTable("batch_operation_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchOperationId: uuid("batch_operation_id").notNull().references(() => batchOperations.id, { onDelete: "cascade" }),

  // Item details
  itemIndex: integer("item_index").notNull(), // Position in batch (0-based)
  itemData: jsonb("item_data").notNull(), // The specific item being processed

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'processing', 'success', 'failed', 'skipped'

  // Results
  resultData: jsonb("result_data"), // Result of processing this item (e.g., created domain ID)
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 50 }),

  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Critical indexes for performance
  batchIdIdx: index("idx_batch_operation_items_batch_id").on(table.batchOperationId),
  progressIdx: index("idx_batch_operation_items_progress").on(table.batchOperationId, table.status),
}));
