/**
 * Web crawling interfaces and types
 *
 * This module provides interfaces for browser automation, sitemap parsing,
 * rate limiting, and crawl result management.
 */

/**
 * Browser automation configuration
 */
export interface BrowserConfig {
  /** Browser type to use */
  browserType: 'chromium' | 'firefox' | 'webkit';
  /** Whether to run in headless mode */
  headless: boolean;
  /** Custom user agent */
  userAgent?: string;
  /** Viewport configuration */
  viewport: ViewportConfig;
  /** Timeout settings */
  timeouts: TimeoutConfig;
  /** Whether to ignore SSL errors */
  ignoreSSLErrors?: boolean;
  /** Additional browser launch args */
  args?: string[];
}

/**
 * Viewport configuration for browser emulation
 */
export interface ViewportConfig {
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Device scale factor */
  deviceScaleFactor: number;
  /** Whether this is a mobile viewport */
  isMobile: boolean;
  /** Whether device has touch capability */
  hasTouch: boolean;
}

/**
 * Timeout configuration for page operations
 */
export interface TimeoutConfig {
  /** Navigation timeout in milliseconds */
  navigation: number;
  /** Element wait timeout in milliseconds */
  element: number;
  /** Script execution timeout in milliseconds */
  script: number;
}

/**
 * Crawl request configuration
 */
export interface CrawlRequest {
  /** Target URL to crawl */
  url: string;
  /** Crawl mode (desktop/mobile) */
  mode: 'desktop' | 'mobile';
  /** Maximum pages to crawl */
  maxPages: number;
  /** Maximum depth to crawl */
  maxDepth?: number;
  /** Respect robots.txt */
  respectRobots: boolean;
  /** Rate limiting configuration */
  rateLimiting: RateLimitConfig;
  /** Browser configuration */
  browserConfig: BrowserConfig;
  /** Sitemap discovery settings */
  sitemapConfig: SitemapConfig;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Requests per second limit */
  requestsPerSecond: number;
  /** Delay between requests in milliseconds */
  delayMs: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
  /** Burst capacity for requests */
  burstCapacity?: number;
}

/**
 * Sitemap discovery and parsing configuration
 */
export interface SitemapConfig {
  /** Whether to discover sitemaps */
  discoverSitemaps: boolean;
  /** Custom sitemap URLs */
  customSitemaps?: string[];
  /** Follow sitemap index files */
  followSitemapIndex: boolean;
  /** Maximum sitemap entries to process */
  maxSitemapEntries?: number;
}

/**
 * Individual page crawl result
 */
export interface CrawlResult {
  /** Page URL that was crawled */
  url: string;
  /** HTTP status code */
  statusCode: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Page title */
  title?: string;
  /** Meta description */
  metaDescription?: string;
  /** Raw HTML content */
  htmlContent: string;
  /** Content length in bytes */
  contentLength: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Whether page is orphaned (not in sitemap) */
  isOrphan: boolean;
  /** Whether page was found in sitemap */
  inSitemap: boolean;
  /** Links discovered on this page */
  links: string[];
  /** Images found on page */
  images: ImageInfo[];
  /** Crawl timestamp */
  crawledAt: Date;
  /** Any error that occurred */
  error?: CrawlError;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Image information extracted during crawling
 */
export interface ImageInfo {
  /** Image source URL */
  src: string;
  /** Alt text */
  alt?: string;
  /** Image width */
  width?: number;
  /** Image height */
  height: number;
  /** Whether image is lazy loaded */
  isLazyLoaded: boolean;
}

/**
 * Crawl error information
 */
export interface CrawlError {
  /** Error type */
  type: 'timeout' | 'network' | 'blocked' | 'parsing' | 'unknown';
  /** Error message */
  message: string;
  /** Error code (if applicable) */
  code?: string;
  /** Stack trace (for debugging) */
  stack?: string;
}

/**
 * Batch processing result for multiple pages
 */
export interface BatchCrawlResult {
  /** Batch identifier */
  batchId: string;
  /** URLs processed in this batch */
  urls: string[];
  /** Successful crawl results */
  results: CrawlResult[];
  /** Failed crawl attempts */
  failures: Array<{url: string; error: CrawlError}>;
  /** Batch processing time */
  processingTime: number;
  /** Batch completion timestamp */
  completedAt: Date;
}

/**
 * Sitemap entry information
 */
export interface SitemapEntry {
  /** URL from sitemap */
  url: string;
  /** Last modified date */
  lastmod?: Date;
  /** Change frequency */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** Priority (0.0-1.0) */
  priority?: number;
  /** Additional sitemap properties */
  metadata?: Record<string, unknown>;
}

/**
 * Parsed sitemap information
 */
export interface SitemapInfo {
  /** Sitemap URL */
  url: string;
  /** Sitemap type */
  type: 'urlset' | 'sitemapindex';
  /** Parsed entries */
  entries: SitemapEntry[];
  /** Nested sitemaps (for sitemap index) */
  nestedSitemaps?: string[];
  /** Parse timestamp */
  parsedAt: Date;
  /** Parse errors encountered */
  parseErrors: string[];
}

/**
 * Orphan page detection result
 */
export interface OrphanDetectionResult {
  /** Pages found during crawling but not in sitemap */
  orphanPages: string[];
  /** Pages in sitemap but not crawlable */
  missingPages: string[];
  /** Summary statistics */
  summary: {
    totalPages: number;
    sitemapPages: number;
    crawledPages: number;
    orphanCount: number;
    missingCount: number;
  };
}

/**
 * Main page crawler interface
 */
export interface PageCrawler {
  /**
   * Crawl a single page
   */
  crawlPage(url: string, config: BrowserConfig): Promise<CrawlResult>;

  /**
   * Crawl multiple pages in batches
   */
  crawlBatch(urls: string[], config: CrawlRequest): Promise<BatchCrawlResult>;

  /**
   * Start crawling a website
   */
  crawlWebsite(request: CrawlRequest): Promise<AsyncIterable<CrawlResult>>;

  /**
   * Stop crawling operation
   */
  stopCrawling(): Promise<void>;
}

/**
 * Sitemap parser interface
 */
export interface SitemapParser {
  /**
   * Discover sitemap URLs from robots.txt and common locations
   */
  discoverSitemaps(baseUrl: string): Promise<string[]>;

  /**
   * Parse a sitemap XML file
   */
  parseSitemap(sitemapUrl: string): Promise<SitemapInfo>;

  /**
   * Parse sitemap index file and return nested sitemaps
   */
  parseSitemapIndex(indexUrl: string): Promise<string[]>;

  /**
   * Get all URLs from sitemaps
   */
  getAllUrls(sitemapUrls: string[]): Promise<SitemapEntry[]>;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /**
   * Wait for rate limit before proceeding
   */
  waitForSlot(): Promise<void>;

  /**
   * Check if request can proceed immediately
   */
  canProceed(): boolean;

  /**
   * Record a completed request
   */
  recordRequest(): void;

  /**
   * Reset rate limiter state
   */
  reset(): void;

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus;
}

/**
 * Rate limiter status information
 */
export interface RateLimitStatus {
  /** Current requests per second */
  currentRps: number;
  /** Remaining capacity */
  remainingCapacity: number;
  /** Time until next available slot */
  nextAvailableMs: number;
  /** Total requests processed */
  totalRequests: number;
}

/**
 * Batch processor interface
 */
export interface BatchProcessor {
  /**
   * Process URLs in batches with rate limiting
   */
  processBatches<T>(
    items: string[],
    processor: (item: string) => Promise<T>,
    config: BatchConfig
  ): Promise<T[]>;

  /**
   * Get processing progress
   */
  getProgress(): BatchProgress;
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  /** Items per batch */
  batchSize: number;
  /** Delay between batches */
  batchDelay: number;
  /** Maximum concurrent operations */
  maxConcurrency: number;
  /** Retry failed items */
  retryFailed: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Batch processing progress
 */
export interface BatchProgress {
  /** Total items to process */
  totalItems: number;
  /** Items processed successfully */
  processedItems: number;
  /** Items that failed processing */
  failedItems: number;
  /** Current batch number */
  currentBatch: number;
  /** Total batches */
  totalBatches: number;
  /** Processing start time */
  startTime: Date;
  /** Estimated completion time */
  estimatedCompletion?: Date;
}