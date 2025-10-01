import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  real,
  boolean,
  pgEnum,
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

// SEO Audit System Tables

// Enums for audit system
export const auditStatusEnum = pgEnum('audit_status', ['pending', 'running', 'completed', 'failed']);
export const issueSeverityEnum = pgEnum('issue_severity', ['critical', 'high', 'medium', 'low', 'info']);
export const issueCategoryEnum = pgEnum('issue_category', ['technical', 'content', 'performance', 'security']);

// Audit Sessions - tracks complete audit runs for websites
export const auditSessions = pgTable(
  'audit_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // References neon_auth.users_sync(id)
    url: varchar('url', { length: 2048 }).notNull(),
    status: auditStatusEnum('status').default('pending'),
    crawlMode: varchar('crawl_mode', { length: 20 }).default('desktop'), // desktop, mobile
    pageLimit: integer('page_limit').default(100),
    pagesFound: integer('pages_found').default(0),
    pagesCrawled: integer('pages_crawled').default(0),
    issuesFound: integer('issues_found').default(0),
    healthScore: real('health_score'),
    technicalScore: real('technical_score'),
    performanceScore: real('performance_score'),
    contentScore: real('content_score'),
    securityScore: real('security_score'),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_audit_sessions_user_id').on(table.userId),
    index('idx_audit_sessions_status').on(table.status),
    index('idx_audit_sessions_started_at').on(table.startedAt),
  ]
);

// Crawled Pages - individual pages discovered and analyzed
export const crawledPages = pgTable(
  'crawled_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull().references(() => auditSessions.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 2048 }).notNull(),
    title: varchar('title', { length: 512 }),
    metaDescription: text('meta_description'),
    statusCode: integer('status_code'),
    responseTime: integer('response_time'), // in milliseconds
    contentLength: integer('content_length'),
    isOrphan: boolean('is_orphan').default(false),
    inSitemap: boolean('in_sitemap').default(false),
    crawledAt: timestamp('crawled_at').defaultNow(),
    htmlContent: text('html_content'), // Stored for analysis
    metadata: jsonb('metadata'), // Additional crawl data
  },
  (table) => [
    index('idx_crawled_pages_session_id').on(table.sessionId),
    index('idx_crawled_pages_url').on(table.url),
    index('idx_crawled_pages_status_code').on(table.statusCode),
  ]
);

// SEO Issues - specific problems found on pages
export const seoIssues = pgTable(
  'seo_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull().references(() => auditSessions.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id').references(() => crawledPages.id, { onDelete: 'cascade' }),
    issueType: varchar('issue_type', { length: 100 }).notNull(),
    category: issueCategoryEnum('category').notNull(),
    severity: issueSeverityEnum('severity').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    recommendation: text('recommendation'),
    codeExample: text('code_example'),
    affectedElement: varchar('affected_element', { length: 500 }),
    expectedValue: text('expected_value'),
    actualValue: text('actual_value'),
    detectedAt: timestamp('detected_at').defaultNow(),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_seo_issues_session_id').on(table.sessionId),
    index('idx_seo_issues_page_id').on(table.pageId),
    index('idx_seo_issues_category').on(table.category),
    index('idx_seo_issues_severity').on(table.severity),
    index('idx_seo_issues_issue_type').on(table.issueType),
  ]
);

// Performance Data - Core Web Vitals and other performance metrics
export const performanceData = pgTable(
  'performance_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull().references(() => auditSessions.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id').references(() => crawledPages.id, { onDelete: 'cascade' }),
    // Core Web Vitals
    lcp: real('lcp'), // Largest Contentful Paint
    inp: real('inp'), // Interaction to Next Paint
    cls: real('cls'), // Cumulative Layout Shift
    // Additional Lighthouse metrics
    firstContentfulPaint: real('first_contentful_paint'),
    speedIndex: real('speed_index'),
    totalBlockingTime: real('total_blocking_time'),
    performanceScore: real('performance_score'),
    // Data source
    dataSource: varchar('data_source', { length: 20 }), // 'lighthouse' or 'pagespeed'
    deviceType: varchar('device_type', { length: 20 }), // 'desktop' or 'mobile'
    measuredAt: timestamp('measured_at').defaultNow(),
    metadata: jsonb('metadata'), // Full Lighthouse/PageSpeed response
  },
  (table) => [
    index('idx_performance_data_session_id').on(table.sessionId),
    index('idx_performance_data_page_id').on(table.pageId),
    index('idx_performance_data_data_source').on(table.dataSource),
  ]
);

// Audit History - for tracking score changes over time
export const auditHistory = pgTable(
  'audit_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // References neon_auth.users_sync(id)
    url: varchar('url', { length: 2048 }).notNull(),
    sessionId: uuid('session_id').notNull().references(() => auditSessions.id, { onDelete: 'cascade' }),
    healthScore: real('health_score').notNull(),
    technicalScore: real('technical_score').notNull(),
    performanceScore: real('performance_score').notNull(),
    contentScore: real('content_score').notNull(),
    securityScore: real('security_score').notNull(),
    issuesFound: integer('issues_found').notNull(),
    pagesAnalyzed: integer('pages_analyzed').notNull(),
    recordedAt: timestamp('recorded_at').defaultNow(),
  },
  (table) => [
    index('idx_audit_history_user_id').on(table.userId),
    index('idx_audit_history_url').on(table.url),
    index('idx_audit_history_recorded_at').on(table.recordedAt),
  ]
);

// Type exports for use in application
export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$inferInsert;

// SEO Audit System types
export type AuditSession = typeof auditSessions.$inferSelect;
export type NewAuditSession = typeof auditSessions.$inferInsert;
export type CrawledPage = typeof crawledPages.$inferSelect;
export type NewCrawledPage = typeof crawledPages.$inferInsert;
export type SeoIssue = typeof seoIssues.$inferSelect;
export type NewSeoIssue = typeof seoIssues.$inferInsert;
export type PerformanceData = typeof performanceData.$inferSelect;
export type NewPerformanceData = typeof performanceData.$inferInsert;
export type AuditHistory = typeof auditHistory.$inferSelect;
export type NewAuditHistory = typeof auditHistory.$inferInsert;
