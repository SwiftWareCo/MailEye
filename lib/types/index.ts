/**
 * SEO Site Audit System - Type Definitions
 *
 * This module provides a centralized export point for all TypeScript
 * interfaces and types used throughout the audit system.
 *
 * Organized by functionality:
 * - audit: Core audit orchestration and session management
 * - seo: SEO rule engine and issue detection
 * - performance: Core Web Vitals and Lighthouse integration
 * - crawling: Web crawling and sitemap parsing
 * - common: Shared utilities and error handling
 */

// Core audit system types
export type {
  // Configuration and setup
  CrawlMode,
  AuditStatus,
  AuditConfig,

  // Progress tracking and results
  AuditProgress,
  AuditResults,

  // Main interfaces
  AuditOrchestrator,
  SessionManager,
} from './audit';

// SEO analysis types
export type {
  // Issue classification
  IssueSeverity,
  IssueCategory,

  // Meta data analysis
  MetaTagsAnalysis,
  OpenGraphData,
  TwitterCardData,
  HreflangData,

  // Structured data validation
  StructuredDataValidation,
  StructuredDataError,
  StructuredDataItem,

  // Robots and AI training data
  RobotsAnalysis,
  RobotsDirective,
  LLMSAnalysis,
  LLMSPermission,

  // SEO rule engine
  SEORule,
  SEORuleContext,
  SEORuleResult,
  SEORuleEngine,
  MetaAnalyzer,
} from './seo';

// Performance analysis types
export type {
  // Core metrics
  CoreWebVitals,
  LighthouseMetrics,
  PerformanceScores,
  DeviceType,
  DataSource,
  PerformanceRating,

  // Configuration
  PerformanceConfig,
  LighthouseConfig,
  ThrottlingConfig,
  ScreenEmulationConfig,

  // Analysis results
  PerformanceAnalysis,
  LoadingExperience,
  PerformanceOpportunity,
  PerformanceDiagnostic,
  ResourceTiming,

  // API interfaces
  PerformanceAnalyzer,
  LighthouseClient,
  PageSpeedClient,
  LighthouseResult,
  PageSpeedResult,
} from './performance';

// Web crawling types
export type {
  // Browser automation
  BrowserConfig,
  ViewportConfig,
  TimeoutConfig,

  // Crawl configuration and requests
  CrawlRequest,
  RateLimitConfig,
  SitemapConfig,

  // Crawl results
  CrawlResult,
  CrawlError,
  BatchCrawlResult,
  ImageInfo,

  // Sitemap handling
  SitemapEntry,
  SitemapInfo,
  OrphanDetectionResult,

  // Service interfaces
  PageCrawler,
  SitemapParser,
  RateLimiter,
  RateLimitStatus,
  BatchProcessor,
  BatchConfig,
  BatchProgress,
} from './crawling';

// Common utilities and shared types
export type {
  // API response patterns
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,

  // Health scoring
  ScoreWeights,
  HealthScoreBreakdown,
  CategoryScore,

  // Trend analysis
  TrendDataPoint,
  TrendAnalysis,
  TrendDirection,
  TrendInsight,

  // System utilities
  UrlValidation,
  CacheConfig,
  CacheEntry,
  BackgroundJob,
  JobStatus,
  HealthCheck,
  ComponentHealth,
  FilterParams,

  // Utility types
  PartialBy,
  RequiredBy,
  UpdatePayload,
  Timestamps,
} from './common';

// Re-export database schema types for convenience
export type {
  // Database entity types
  UserActivity,
  NewUserActivity,
  AuditSession,
  NewAuditSession,
  CrawledPage,
  NewCrawledPage,
  SeoIssue,
  NewSeoIssue,
  PerformanceData,
  NewPerformanceData,
  AuditHistory,
  NewAuditHistory,
} from '@/lib/db/schema';

// Constants
export { CORE_WEB_VITALS_THRESHOLDS } from './performance';