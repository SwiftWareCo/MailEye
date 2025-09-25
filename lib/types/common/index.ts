/**
 * Common interfaces and utility types
 *
 * This module provides shared types used across the audit system,
 * including error handling, health scoring, and general utilities.
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data (if successful) */
  data?: T;
  /** Error information (if failed) */
  error?: ApiError;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Response timestamp */
  timestamp: Date;
}

/**
 * API error information
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error description */
  details?: string;
  /** Field-specific validation errors */
  fieldErrors?: Record<string, string[]>;
  /** Stack trace (development only) */
  stack?: string;
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  /** Current page number (1-based) */
  page: number;
  /** Items per page */
  limit: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Items in current page */
  items: T[];
  /** Pagination metadata */
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Health score calculation weights
 */
export interface ScoreWeights {
  /** Technical SEO weight (default: 45%) */
  technical: number;
  /** Performance weight (default: 25%) */
  performance: number;
  /** Content quality weight (default: 20%) */
  content: number;
  /** Security weight (default: 10%) */
  security: number;
}

/**
 * Health score breakdown by category
 */
export interface HealthScoreBreakdown {
  /** Overall health score (0-100) */
  overall: number;
  /** Category scores */
  categories: {
    technical: CategoryScore;
    performance: CategoryScore;
    content: CategoryScore;
    security: CategoryScore;
  };
  /** Score calculation timestamp */
  calculatedAt: Date;
  /** Score change from previous audit */
  change?: number;
}

/**
 * Individual category score information
 */
export interface CategoryScore {
  /** Category score (0-100) */
  score: number;
  /** Weight used in overall calculation */
  weight: number;
  /** Weighted contribution to overall score */
  weightedScore: number;
  /** Number of issues in this category */
  issueCount: number;
  /** Issues breakdown by severity */
  issuesBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  /** Score change from previous audit */
  change?: number;
}

/**
 * Trend analysis data point
 */
export interface TrendDataPoint {
  /** Data point timestamp */
  timestamp: Date;
  /** Health score at this point */
  score: number;
  /** Category scores */
  categoryScores: {
    technical: number;
    performance: number;
    content: number;
    security: number;
  };
  /** Number of issues */
  issueCount: number;
  /** Audit session ID */
  sessionId: string;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  /** Time period analyzed */
  period: {
    startDate: Date;
    endDate: Date;
  };
  /** Trend data points */
  dataPoints: TrendDataPoint[];
  /** Overall trend direction */
  overallTrend: 'improving' | 'declining' | 'stable';
  /** Category trends */
  categoryTrends: {
    technical: TrendDirection;
    performance: TrendDirection;
    content: TrendDirection;
    security: TrendDirection;
  };
  /** Key insights */
  insights: TrendInsight[];
}

/**
 * Trend direction analysis
 */
export interface TrendDirection {
  /** Trend direction */
  direction: 'improving' | 'declining' | 'stable';
  /** Change rate (points per day) */
  changeRate: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Statistical significance */
  isSignificant: boolean;
}

/**
 * Trend analysis insight
 */
export interface TrendInsight {
  /** Insight type */
  type: 'improvement' | 'decline' | 'milestone' | 'anomaly';
  /** Insight title */
  title: string;
  /** Detailed description */
  description: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Related category */
  category?: 'technical' | 'performance' | 'content' | 'security';
}

/**
 * URL validation result
 */
export interface UrlValidation {
  /** Whether URL is valid */
  isValid: boolean;
  /** Normalized URL */
  normalizedUrl?: string;
  /** Validation errors */
  errors: string[];
  /** URL components */
  components?: {
    protocol: string;
    hostname: string;
    port?: number;
    pathname: string;
    search: string;
    hash: string;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Cache TTL in seconds */
  ttl: number;
  /** Cache key prefix */
  keyPrefix: string;
  /** Whether to use compression */
  compress: boolean;
  /** Maximum cache size */
  maxSize?: number;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Cache timestamp */
  timestamp: Date;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Cache hit count */
  hitCount: number;
  /** Cache key */
  key: string;
}

/**
 * Background job status
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Background job information
 */
export interface BackgroundJob {
  /** Job identifier */
  id: string;
  /** Job type */
  type: string;
  /** Current job status */
  status: JobStatus;
  /** Job payload */
  payload: Record<string, unknown>;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current operation description */
  currentOperation?: string;
  /** Job result (when completed) */
  result?: unknown;
  /** Error information (when failed) */
  error?: ApiError;
  /** Job creation timestamp */
  createdAt: Date;
  /** Job start timestamp */
  startedAt?: Date;
  /** Job completion timestamp */
  completedAt?: Date;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
}

/**
 * System health check result
 */
export interface HealthCheck {
  /** Overall system health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Individual component checks */
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    lighthouse: ComponentHealth;
    pagespeed: ComponentHealth;
    browser: ComponentHealth;
  };
  /** Health check timestamp */
  timestamp: Date;
  /** Response time in milliseconds */
  responseTime: number;
}

/**
 * Individual component health
 */
export interface ComponentHealth {
  /** Component status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Response time in milliseconds */
  responseTime?: number;
  /** Error message (if unhealthy) */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generic filter interface for list queries
 */
export interface FilterParams {
  /** Search query */
  search?: string;
  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Category filters */
  categories?: string[];
  /** Status filters */
  statuses?: string[];
  /** Custom filters */
  [key: string]: unknown;
}

/**
 * Utility type for making all properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for making all properties required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type for creating update payloads
 */
export type UpdatePayload<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Utility type for database timestamps
 */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}