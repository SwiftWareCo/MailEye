import { pgTable, uuid, varchar, timestamp, boolean, text, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { domains } from "./domains";

/**
 * Email accounts table
 * Stores individual email addresses with warmup tracking
 */
export const emailAccounts = pgTable("email_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // References neon_auth.users_sync(id) - FK constraint added in SQL
  domainId: uuid("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),

  // Email account details
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password"), // Encrypted password for SMTP/IMAP access
  displayName: varchar("display_name", { length: 255 }),

  // SMTP/IMAP configuration
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port").default(587),
  smtpUsername: varchar("smtp_username", { length: 255 }),
  imapHost: varchar("imap_host", { length: 255 }),
  imapPort: integer("imap_port").default(993),
  imapUsername: varchar("imap_username", { length: 255 }),

  // Status
  status: varchar("status", { length: 20 }).notNull().default("inactive"), // 'inactive', 'warming', 'active', 'suspended', 'blocked'
  isVerified: boolean("is_verified").notNull().default(false),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

  // Warmup tracking
  warmupStatus: varchar("warmup_status", { length: 20 }).default("not_started"), // 'not_started', 'in_progress', 'completed', 'paused'
  warmupStartedAt: timestamp("warmup_started_at", { withTimezone: true }),
  warmupCompletedAt: timestamp("warmup_completed_at", { withTimezone: true }),
  warmupDayCount: integer("warmup_day_count").default(0), // Days into warmup
  dailyEmailLimit: integer("daily_email_limit").default(10), // Current daily sending limit
  dailyEmailsSent: integer("daily_emails_sent").default(0), // Emails sent today
  lastEmailSentAt: timestamp("last_email_sent_at", { withTimezone: true }),

  // Health metrics
  deliverabilityScore: integer("deliverability_score"), // 0-100
  bounceRate: integer("bounce_rate").default(0), // Percentage
  spamComplaintRate: integer("spam_complaint_rate").default(0), // Percentage
  reputationScore: varchar("reputation_score", { length: 20 }).default("unknown"), // 'excellent', 'good', 'fair', 'poor', 'unknown'

  // Integration
  smartleadAccountId: uuid("smartlead_account_id"), // Link to Smartlead if synced

  // Metadata
  notes: text("notes"),
  metadata: jsonb("metadata"), // Additional account-specific data

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Critical indexes for performance
  index("idx_email_accounts_user_id").on(table.userId),
  index("idx_email_accounts_domain_id").on(table.domainId),
  uniqueIndex("idx_email_accounts_email_unique").on(table.email),
  index("idx_email_accounts_user_status").on(table.userId, table.status),
  index("idx_email_accounts_warmup_status").on(table.warmupStatus),
]);

/**
 * Warmup schedule table
 * Tracks daily warmup progression for email accounts
 */
export const warmupSchedule = pgTable("warmup_schedule", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailAccountId: uuid("email_account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),

  // Schedule details
  day: integer("day").notNull(), // Warmup day number (1-30+)
  targetSends: integer("target_sends").notNull(), // Target emails to send this day
  actualSends: integer("actual_sends").default(0), // Actual emails sent this day

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'skipped'
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // Performance
  bounces: integer("bounces").default(0),
  opens: integer("opens").default(0),
  replies: integer("replies").default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Critical indexes for performance
  index("idx_warmup_schedule_email_account_id").on(table.emailAccountId),
  index("idx_warmup_schedule_daily_processing").on(table.scheduledDate, table.status),
]);

/**
 * Email activity log
 * Tracks all email sending activity for monitoring and analytics
 */
export const emailActivityLog = pgTable("email_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailAccountId: uuid("email_account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),

  // Email details
  recipient: varchar("recipient", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  messageId: varchar("message_id", { length: 255 }), // Email Message-ID header

  // Status tracking
  status: varchar("status", { length: 20 }).notNull(), // 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'replied', 'spam'
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }),
  repliedAt: timestamp("replied_at", { withTimezone: true }),

  // Error tracking
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),

  // Metadata
  campaignId: uuid("campaign_id"), // If part of a campaign
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Critical indexes for performance
  index("idx_email_activity_log_email_account_id").on(table.emailAccountId),
  index("idx_email_activity_log_sent_at").on(table.sentAt),
  index("idx_email_activity_log_analytics").on(table.emailAccountId, table.sentAt, table.status),
]);
