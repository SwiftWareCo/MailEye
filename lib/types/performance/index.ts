/**
 * Performance analysis interfaces and types
 *
 * This module provides interfaces for Core Web Vitals analysis,
 * Lighthouse integration, and PageSpeed Insights API integration.
 */

/**
 * Core Web Vitals metrics interface
 */
export interface CoreWebVitals {
  /** Largest Contentful Paint in milliseconds */
  lcp?: number;
  /** Interaction to Next Paint in milliseconds */
  inp?: number;
  /** Cumulative Layout Shift score */
  cls?: number;
}

/**
 * Additional Lighthouse performance metrics
 */
export interface LighthouseMetrics {
  /** First Contentful Paint in milliseconds */
  firstContentfulPaint?: number;
  /** Speed Index score */
  speedIndex?: number;
  /** Total Blocking Time in milliseconds */
  totalBlockingTime?: number;
  /** Time to Interactive in milliseconds */
  timeToInteractive?: number;
  /** First Meaningful Paint in milliseconds */
  firstMeaningfulPaint?: number;
}

/**
 * Performance scores (0-100 scale)
 */
export interface PerformanceScores {
  /** Overall performance score */
  performance: number;
  /** Accessibility score */
  accessibility?: number;
  /** Best practices score */
  bestPractices?: number;
  /** SEO score */
  seo?: number;
  /** Progressive Web App score */
  pwa?: number;
}

/**
 * Device type for performance analysis
 */
export type DeviceType = 'desktop' | 'mobile';

/**
 * Data source for performance metrics
 */
export type DataSource = 'lighthouse' | 'pagespeed';

/**
 * Performance analysis configuration
 */
export interface PerformanceConfig {
  /** Target URL to analyze */
  url: string;
  /** Device type for analysis */
  deviceType: DeviceType;
  /** Categories to analyze */
  categories: string[];
  /** Lighthouse configuration options */
  lighthouseConfig?: LighthouseConfig;
}

/**
 * Lighthouse-specific configuration options
 */
export interface LighthouseConfig {
  /** Disable device emulation */
  disableDeviceEmulation?: boolean;
  /** Custom user agent */
  userAgent?: string;
  /** Network throttling settings */
  throttling?: ThrottlingConfig;
  /** Screen emulation settings */
  screenEmulation?: ScreenEmulationConfig;
}

/**
 * Network throttling configuration
 */
export interface ThrottlingConfig {
  /** Download throughput in Kbps */
  downloadThroughputKbps: number;
  /** Upload throughput in Kbps */
  uploadThroughputKbps: number;
  /** Round trip time in milliseconds */
  rttMs: number;
  /** CPU slowdown multiplier */
  cpuSlowdownMultiplier: number;
}

/**
 * Screen emulation configuration
 */
export interface ScreenEmulationConfig {
  /** Viewport width */
  width: number;
  /** Viewport height */
  height: number;
  /** Device scale factor */
  deviceScaleFactor: number;
  /** Whether device is mobile */
  mobile: boolean;
}

/**
 * Comprehensive performance analysis result
 */
export interface PerformanceAnalysis {
  /** Analysis metadata */
  metadata: {
    url: string;
    deviceType: DeviceType;
    dataSource: DataSource;
    timestamp: Date;
    loadingExperience?: LoadingExperience;
  };

  /** Core Web Vitals metrics */
  coreWebVitals: CoreWebVitals;

  /** Additional Lighthouse metrics */
  lighthouseMetrics: LighthouseMetrics;

  /** Performance scores */
  scores: PerformanceScores;

  /** Performance opportunities */
  opportunities: PerformanceOpportunity[];

  /** Performance diagnostics */
  diagnostics: PerformanceDiagnostic[];

  /** Resource loading information */
  resources?: ResourceTiming[];
}

/**
 * Loading experience data from PageSpeed Insights
 */
export interface LoadingExperience {
  /** Overall loading experience rating */
  overall_category: 'FAST' | 'AVERAGE' | 'SLOW';
  /** Initial URL for the request */
  initial_url: string;
  /** Metrics breakdown */
  metrics: {
    [key: string]: {
      percentile: number;
      distributions: Array<{
        min: number;
        max?: number;
        proportion: number;
      }>;
      category: 'FAST' | 'AVERAGE' | 'SLOW';
    };
  };
}

/**
 * Performance improvement opportunity
 */
export interface PerformanceOpportunity {
  /** Opportunity identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Estimated savings in milliseconds */
  estimatedSavings?: number;
  /** Importance score (0-100) */
  score?: number;
  /** Detailed explanation */
  explanation?: string;
  /** Fix recommendations */
  recommendations: string[];
}

/**
 * Performance diagnostic information
 */
export interface PerformanceDiagnostic {
  /** Diagnostic identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Diagnostic score */
  score: number;
  /** Display value */
  displayValue?: string;
  /** Additional details */
  details?: unknown;
}

/**
 * Resource timing information
 */
export interface ResourceTiming {
  /** Resource URL */
  url: string;
  /** Resource type */
  resourceType: string;
  /** Transfer size in bytes */
  transferSize: number;
  /** Resource size in bytes */
  resourceSize: number;
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Performance analyzer interface for dual API integration
 */
export interface PerformanceAnalyzer {
  /**
   * Analyze performance using Lighthouse
   */
  analyzeLighthouse(config: PerformanceConfig): Promise<PerformanceAnalysis>;

  /**
   * Analyze performance using PageSpeed Insights
   */
  analyzePageSpeed(config: PerformanceConfig): Promise<PerformanceAnalysis>;

  /**
   * Get combined performance analysis with fallback
   */
  analyze(config: PerformanceConfig): Promise<PerformanceAnalysis>;

  /**
   * Calculate Core Web Vitals scores
   */
  calculateCoreWebVitals(metrics: CoreWebVitals): Promise<PerformanceScores>;
}

/**
 * Lighthouse API client interface
 */
export interface LighthouseClient {
  /**
   * Run Lighthouse analysis
   */
  runAudit(url: string, config: LighthouseConfig): Promise<LighthouseResult>;
}

/**
 * PageSpeed Insights API client interface
 */
export interface PageSpeedClient {
  /**
   * Run PageSpeed Insights analysis
   */
  runAudit(url: string, strategy: 'desktop' | 'mobile'): Promise<PageSpeedResult>;
}

/**
 * Lighthouse API result
 */
export interface LighthouseResult {
  /** Lighthouse version */
  lighthouseVersion: string;
  /** Analysis categories */
  categories: Record<string, unknown>;
  /** Detailed audits */
  audits: Record<string, unknown>;
  /** Runtime configuration */
  configSettings: unknown;
  /** Performance timing */
  timing: unknown;
}

/**
 * PageSpeed Insights API result
 */
export interface PageSpeedResult {
  /** Analysis version */
  analysisUTCTimestamp: string;
  /** Loading experience data */
  loadingExperience: LoadingExperience;
  /** Lighthouse result */
  lighthouseResult: LighthouseResult;
}

/**
 * Core Web Vitals thresholds for scoring
 */
export const CORE_WEB_VITALS_THRESHOLDS = {
  LCP: {
    GOOD: 2500,    // <= 2.5s
    NEEDS_IMPROVEMENT: 4000,  // 2.5s - 4s
    // > 4s is POOR
  },
  INP: {
    GOOD: 200,     // <= 200ms
    NEEDS_IMPROVEMENT: 500,   // 200ms - 500ms
    // > 500ms is POOR
  },
  CLS: {
    GOOD: 0.1,     // <= 0.1
    NEEDS_IMPROVEMENT: 0.25,  // 0.1 - 0.25
    // > 0.25 is POOR
  }
} as const;

/**
 * Performance category ratings
 */
export type PerformanceRating = 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';