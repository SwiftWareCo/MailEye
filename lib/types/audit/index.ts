/**
 * Core audit system interfaces and types
 *
 * This module provides the main interfaces for the audit orchestrator
 * and audit session management functionality.
 */

import type { CrawledPage, SeoIssue, PerformanceData } from '@/lib/db/schema';

/**
 * Crawl mode configuration for website analysis
 */
export type CrawlMode = 'desktop' | 'mobile';

/**
 * Audit status progression through the audit lifecycle
 */
export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Configuration options for starting an audit session
 */
export interface AuditConfig {
  /** Target website URL to audit */
  url: string;
  /** Crawl mode - desktop or mobile viewport */
  crawlMode: CrawlMode;
  /** Maximum number of pages to crawl (default: 100) */
  pageLimit?: number;
  /** Optional custom user agent string */
  userAgent?: string;
  /** Timeout in seconds for page loading (default: 30) */
  timeout?: number;
  /** Whether to respect robots.txt (default: true) */
  respectRobots?: boolean;
}

/**
 * Real-time progress information during audit execution
 */
export interface AuditProgress {
  /** Current audit session ID */
  sessionId: string;
  /** Current status of the audit */
  status: AuditStatus;
  /** Total pages discovered so far */
  pagesFound: number;
  /** Pages successfully crawled */
  pagesCrawled: number;
  /** SEO issues detected */
  issuesFound: number;
  /** Current health score (if calculated) */
  healthScore?: number;
  /** Estimated completion percentage (0-100) */
  progressPercent: number;
  /** Current operation being performed */
  currentOperation?: string;
  /** Any error message if status is 'failed' */
  errorMessage?: string;
  /** Timestamp when audit started */
  startedAt: Date;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * Comprehensive audit results with all analyzed data
 */
export interface AuditResults {
  /** Audit session metadata */
  session: {
    id: string;
    url: string;
    status: AuditStatus;
    crawlMode: CrawlMode;
    startedAt: Date;
    completedAt?: Date;
    duration?: number; // in seconds
  };

  /** Overall health scoring */
  scores: {
    overall: number;
    technical: number;
    performance: number;
    content: number;
    security: number;
  };

  /** Summary statistics */
  summary: {
    pagesAnalyzed: number;
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };

  /** Detailed results */
  pages: CrawledPage[];
  issues: SeoIssue[];
  performanceData: PerformanceData[];
}

/**
 * Main audit orchestrator interface
 * Coordinates crawling, analysis, and scoring components
 */
export interface AuditOrchestrator {
  /**
   * Start a new audit session
   */
  startAudit(userId: string, config: AuditConfig): Promise<string>;

  /**
   * Get real-time progress for an audit session
   */
  getProgress(sessionId: string): Promise<AuditProgress>;

  /**
   * Get complete audit results
   */
  getResults(sessionId: string): Promise<AuditResults>;

  /**
   * Cancel a running audit
   */
  cancelAudit(sessionId: string): Promise<void>;

  /**
   * Get audit history for a user
   */
  getHistory(userId: string, limit?: number): Promise<AuditResults[]>;
}

/**
 * Batch processing configuration for handling large sites
 */
export interface BatchConfig {
  /** Number of pages to process in each batch */
  batchSize: number;
  /** Delay between batches in milliseconds */
  batchDelay: number;
  /** Maximum concurrent requests per batch */
  concurrency: number;
}

/**
 * Session management interface for tracking audit state
 */
export interface SessionManager {
  /**
   * Create a new audit session
   */
  createSession(userId: string, config: AuditConfig): Promise<string>;

  /**
   * Update session progress
   */
  updateProgress(sessionId: string, progress: Partial<AuditProgress>): Promise<void>;

  /**
   * Mark session as completed
   */
  completeSession(sessionId: string, results: AuditResults): Promise<void>;

  /**
   * Mark session as failed
   */
  failSession(sessionId: string, error: string): Promise<void>;

  /**
   * Get session status
   */
  getSession(sessionId: string): Promise<AuditProgress | null>;
}