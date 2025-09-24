import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// Note: Users are managed by Stack Auth and synced to neon_auth.users_sync table
// We reference this table directly instead of maintaining a separate user_profiles table

// Activity Log for dashboard - references Stack Auth users_sync table
export const userActivities = pgTable(
  'user_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // References neon_auth.users_sync(id)
    activityType: varchar('activity_type', { length: 50 }).notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_user_activities_user_id').on(table.userId),
    index('idx_user_activities_created_at').on(table.createdAt),
  ]
);

// Campaigns - references Stack Auth users_sync table
export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // References neon_auth.users_sync(id)
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).default('draft'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('idx_campaigns_user_id').on(table.userId)]
);

// Type exports for use in application
export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
