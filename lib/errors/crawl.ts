/**
 * Crawling Error Handlers for SEO Audit System
 *
 * Handles web crawling errors including browser automation failures,
 * page access issues, content parsing errors, and robots.txt violations.
 */

import { AuditError, ErrorContext, SecurityError } from './index';

/**
 * Base crawling error class
 */
export class CrawlError extends AuditError {
  public readonly url: string;
  public readonly crawlStage: 'init' | 'navigate' | 'load' | 'parse' | 'extract' | 'complete';

  constructor(
    message: string,
    url: string,
    crawlStage: 'init' | 'navigate' | 'load' | 'parse' | 'extract' | 'complete',
    code: string,
    context: ErrorContext = {},
    recoverable = true,
    userMessage?: string,
    suggestedAction?: string
  ) {
    super(
      message,
      code,
      { ...context, url, crawlStage },
      recoverable,
      userMessage || `Failed to crawl ${url}`,
      suggestedAction || 'Check if the URL is accessible and try again'
    );

    this.url = url;
    this.crawlStage = crawlStage;
  }

  /**
   * Get crawl stage-specific suggestions
   */
  getStageSpecificSuggestion(): string {
    switch (this.crawlStage) {
      case 'init':
        return 'Check browser configuration and network connectivity';
      case 'navigate':
        return 'Verify the URL is correct and the site is accessible';
      case 'load':
        return 'The page may be slow or have loading issues';
      case 'parse':
        return 'The page structure may be unusual or incomplete';
      case 'extract':
        return 'The page content may not contain expected elements';
      case 'complete':
        return 'The crawling process encountered an unexpected error';
      default:
        return 'Try again or contact support if the issue persists';
    }
  }
}

/**
 * Browser automation failure error
 */
export class BrowserError extends CrawlError {
  public readonly browserType: 'playwright' | 'puppeteer';
  public readonly browserAction: string;
  public readonly viewport?: { width: number; height: number };

  constructor(
    browserType: 'playwright' | 'puppeteer',
    browserAction: string,
    url: string,
    error: string,
    context: ErrorContext = {},
    viewport?: { width: number; height: number }
  ) {
    super(
      `Browser ${browserAction} failed: ${error}`,
      url,
      'init',
      'BROWSER_ERROR',
      { ...context, browserType, browserAction, viewport },
      true,
      `Browser automation failed while ${browserAction.toLowerCase()}`,
      'Try refreshing or switching to mobile view if the issue persists'
    );

    this.browserType = browserType;
    this.browserAction = browserAction;
    this.viewport = viewport;
  }

  /**
   * Check if error suggests browser incompatibility
   */
  suggestsBrowserIncompatibility(): boolean {
    const errorMessage = this.message.toLowerCase();
    return errorMessage.includes('protocol error') ||
           errorMessage.includes('browser disconnected') ||
           errorMessage.includes('execution context');
  }

  /**
   * Get recommended fallback browser
   */
  getRecommendedFallback(): 'playwright' | 'puppeteer' {
    return this.browserType === 'playwright' ? 'puppeteer' : 'playwright';
  }
}

/**
 * Page access error (HTTP status codes, DNS issues, etc.)
 */
export class PageAccessError extends CrawlError {
  public readonly statusCode?: number;
  public readonly httpMethod: string;
  public readonly redirectCount?: number;

  constructor(
    url: string,
    httpMethod = 'GET',
    statusCode?: number,
    context: ErrorContext = {},
    redirectCount?: number
  ) {
    const message = statusCode
      ? `HTTP ${statusCode} error accessing ${url}`
      : `Failed to access ${url}`;

    const userMessage = PageAccessError.getStatusMessage(statusCode);
    const suggestedAction = PageAccessError.getStatusAction(statusCode);

    super(
      message,
      url,
      'navigate',
      'PAGE_ACCESS_ERROR',
      { ...context, statusCode, httpMethod, redirectCount },
      PageAccessError.isRecoverable(statusCode),
      userMessage,
      suggestedAction
    );

    this.statusCode = statusCode;
    this.httpMethod = httpMethod;
    this.redirectCount = redirectCount;
  }

  private static getStatusMessage(statusCode?: number): string {
    if (!statusCode) return 'Unable to connect to the website';

    switch (Math.floor(statusCode / 100)) {
      case 4:
        switch (statusCode) {
          case 401: return 'Authentication required to access this page';
          case 403: return 'Access to this page is forbidden';
          case 404: return 'Page not found';
          case 429: return 'Too many requests - rate limited';
          default: return 'Client error occurred while accessing the page';
        }
      case 5:
        return 'Server error - the website is experiencing issues';
      case 3:
        return 'Page redirected multiple times';
      default:
        return `Unexpected response (${statusCode}) from the website`;
    }
  }

  private static getStatusAction(statusCode?: number): string {
    if (!statusCode) return 'Check your internet connection and try again';

    switch (statusCode) {
      case 401: return 'Check if authentication is required for this URL';
      case 403: return 'Verify you have permission to access this page';
      case 404: return 'Double-check the URL spelling and try again';
      case 429: return 'Wait a few minutes before trying again';
      case 500:
      case 502:
      case 503:
      case 504: return 'The website is temporarily unavailable - try again later';
      default: return 'Try again or contact the website administrator';
    }
  }

  private static isRecoverable(statusCode?: number): boolean {
    if (!statusCode) return true; // Network issues might be temporary

    // 4xx errors are generally not recoverable except for rate limiting
    if (statusCode >= 400 && statusCode < 500) {
      return statusCode === 429; // Rate limiting is recoverable
    }

    // 5xx errors are often temporary
    return statusCode >= 500;
  }

  /**
   * Check if this is a rate limiting error
   */
  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if this suggests the page requires authentication
   */
  requiresAuthentication(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if this is a temporary server error
   */
  isTemporaryServerError(): boolean {
    return Boolean(this.statusCode && this.statusCode >= 500);
  }
}

/**
 * Content parsing error
 */
export class ContentParsingError extends CrawlError {
  public readonly contentType?: string;
  public readonly parsingStage: 'html' | 'css' | 'javascript' | 'metadata' | 'structured-data';
  public readonly selector?: string;

  constructor(
    url: string,
    parsingStage: 'html' | 'css' | 'javascript' | 'metadata' | 'structured-data',
    error: string,
    context: ErrorContext = {},
    contentType?: string,
    selector?: string
  ) {
    super(
      `Failed to parse ${parsingStage}: ${error}`,
      url,
      'parse',
      'CONTENT_PARSING_ERROR',
      { ...context, parsingStage, contentType, selector },
      true,
      `Could not analyze ${parsingStage} content from this page`,
      'The page structure may be unusual - results may be incomplete'
    );

    this.contentType = contentType;
    this.parsingStage = parsingStage;
    this.selector = selector;
  }

  /**
   * Check if this is a critical parsing error that should stop the crawl
   */
  isCritical(): boolean {
    return this.parsingStage === 'html';
  }

  /**
   * Get suggested alternative parsing approach
   */
  getAlternativeApproach(): string {
    switch (this.parsingStage) {
      case 'html':
        return 'Try with a different browser or user agent';
      case 'css':
        return 'Skip CSS analysis and focus on HTML content';
      case 'javascript':
        return 'Disable JavaScript analysis for this page';
      case 'metadata':
        return 'Extract basic metadata only';
      case 'structured-data':
        return 'Skip structured data validation';
      default:
        return 'Continue with partial analysis';
    }
  }
}

/**
 * Robots.txt violation or crawling restriction error
 */
export class RobotsTxtError extends SecurityError {
  public readonly robotsUrl: string;
  public readonly userAgent: string;
  public readonly disallowedPath: string;
  public readonly crawlDelay?: number;

  constructor(
    url: string,
    robotsUrl: string,
    userAgent: string,
    disallowedPath: string,
    crawlDelay?: number,
    context: ErrorContext = {}
  ) {
    const message = `Crawling ${url} is disallowed by robots.txt for user agent '${userAgent}'`;

    super(
      message,
      'ROBOTS_TXT_ERROR',
      { ...context, robotsUrl, userAgent, disallowedPath, crawlDelay },
      'This page cannot be crawled due to robots.txt restrictions'
    );

    this.robotsUrl = robotsUrl;
    this.userAgent = userAgent;
    this.disallowedPath = disallowedPath;
    this.crawlDelay = crawlDelay;
  }

  /**
   * Check if a different user agent might be allowed
   */
  hasAlternativeUserAgent(): boolean {
    return this.userAgent !== '*' && this.userAgent !== 'Googlebot';
  }

  /**
   * Get recommended crawl delay if specified
   */
  getRecommendedDelay(): number {
    return this.crawlDelay || 1000; // Default 1 second if not specified
  }
}

/**
 * Site unavailable or blocked error
 */
export class SiteUnavailableError extends CrawlError {
  public readonly reason: 'blocked' | 'maintenance' | 'dns' | 'ssl' | 'network';
  public readonly blockingService?: string;

  constructor(
    url: string,
    reason: 'blocked' | 'maintenance' | 'dns' | 'ssl' | 'network',
    details: string,
    context: ErrorContext = {},
    blockingService?: string
  ) {
    const message = `Site unavailable (${reason}): ${details}`;

    super(
      message,
      url,
      'navigate',
      'SITE_UNAVAILABLE_ERROR',
      { ...context, reason, blockingService },
      reason !== 'blocked', // Blocked sites are not recoverable
      SiteUnavailableError.getReasonMessage(reason),
      SiteUnavailableError.getReasonAction(reason)
    );

    this.reason = reason;
    this.blockingService = blockingService;
  }

  private static getReasonMessage(reason: string): string {
    switch (reason) {
      case 'blocked':
        return 'This website blocks automated crawling';
      case 'maintenance':
        return 'The website is currently under maintenance';
      case 'dns':
        return 'Could not resolve the website address';
      case 'ssl':
        return 'SSL certificate error preventing secure connection';
      case 'network':
        return 'Network connectivity issue';
      default:
        return 'The website is currently unavailable';
    }
  }

  private static getReasonAction(reason: string): string {
    switch (reason) {
      case 'blocked':
        return 'This site cannot be crawled automatically';
      case 'maintenance':
        return 'Try again later when maintenance is complete';
      case 'dns':
        return 'Check the URL spelling and try again';
      case 'ssl':
        return 'Contact the website administrator about the certificate';
      case 'network':
        return 'Check your internet connection and try again';
      default:
        return 'Try again later or contact support';
    }
  }

  /**
   * Check if this is a permanent block
   */
  isPermanentBlock(): boolean {
    return this.reason === 'blocked' && Boolean(this.blockingService);
  }

  /**
   * Get estimated retry time
   */
  getEstimatedRetryTime(): number {
    switch (this.reason) {
      case 'maintenance':
        return 3600000; // 1 hour
      case 'dns':
        return 300000; // 5 minutes
      case 'ssl':
        return 1800000; // 30 minutes
      case 'network':
        return 60000; // 1 minute
      default:
        return 600000; // 10 minutes
    }
  }
}

/**
 * Crawl quota or resource limit error
 */
export class CrawlLimitError extends CrawlError {
  public readonly limitType: 'pages' | 'requests' | 'bandwidth' | 'time';
  public readonly currentValue: number;
  public readonly limitValue: number;

  constructor(
    limitType: 'pages' | 'requests' | 'bandwidth' | 'time',
    currentValue: number,
    limitValue: number,
    url: string,
    context: ErrorContext = {}
  ) {
    const message = `Crawl ${limitType} limit exceeded: ${currentValue}/${limitValue}`;

    super(
      message,
      url,
      'complete',
      'CRAWL_LIMIT_ERROR',
      { ...context, limitType, currentValue, limitValue },
      false, // Limit errors are not recoverable without user intervention
      `Crawling limit reached (${currentValue} out of ${limitValue} ${limitType})`,
      CrawlLimitError.getLimitAction(limitType)
    );

    this.limitType = limitType;
    this.currentValue = currentValue;
    this.limitValue = limitValue;
  }

  private static getLimitAction(limitType: string): string {
    switch (limitType) {
      case 'pages':
        return 'Reduce the number of pages to crawl or upgrade your plan';
      case 'requests':
        return 'Wait for the request quota to reset or upgrade your plan';
      case 'bandwidth':
        return 'Reduce crawl scope or wait for bandwidth quota to reset';
      case 'time':
        return 'Break the crawl into smaller batches';
      default:
        return 'Upgrade your plan or contact support';
    }
  }

  /**
   * Get percentage of limit used
   */
  getLimitUsagePercentage(): number {
    return Math.round((this.currentValue / this.limitValue) * 100);
  }

  /**
   * Check if close to limit (>80%)
   */
  isNearLimit(): boolean {
    return this.getLimitUsagePercentage() > 80;
  }
}

/**
 * Crawling utilities and helpers
 */
export class CrawlErrorHandler {
  /**
   * Analyze crawl error and provide specific recommendations
   */
  static analyzeCrawlError(error: unknown, url: string, context: ErrorContext = {}): CrawlError {
    if (error instanceof CrawlError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Browser errors
      if (message.includes('browser') || message.includes('playwright') || message.includes('puppeteer')) {
        return new BrowserError('playwright', 'unknown', url, error.message, context);
      }

      // Network/HTTP errors
      if (message.includes('http') || message.includes('status')) {
        const statusMatch = error.message.match(/(\d{3})/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : undefined;
        return new PageAccessError(url, 'GET', statusCode, context);
      }

      // DNS/connectivity errors
      if (message.includes('enotfound') || message.includes('dns') || message.includes('resolve')) {
        return new SiteUnavailableError(url, 'dns', error.message, context);
      }

      // SSL errors
      if (message.includes('ssl') || message.includes('cert') || message.includes('tls')) {
        return new SiteUnavailableError(url, 'ssl', error.message, context);
      }

      // Parsing errors
      if (message.includes('parse') || message.includes('invalid') || message.includes('malformed')) {
        return new ContentParsingError(url, 'html', error.message, context);
      }
    }

    // Default crawl error
    return new CrawlError(
      String(error),
      url,
      'complete',
      'UNKNOWN_CRAWL_ERROR',
      context,
      true,
      'An unexpected error occurred while crawling this page',
      'Try again or skip this page if the issue persists'
    );
  }

  /**
   * Check if crawl should continue after error
   */
  static shouldContinueCrawl(error: CrawlError, crawlContext: {
    totalPages: number;
    completedPages: number;
    errorCount: number;
    maxErrors?: number;
  }): boolean {
    const { totalPages, completedPages, errorCount, maxErrors = 10 } = crawlContext;

    // Don't continue if too many errors
    if (errorCount >= maxErrors) {
      return false;
    }

    // Don't continue if error rate is too high (>50% failure rate)
    const totalAttempted = completedPages + errorCount;
    if (totalAttempted > 5 && (errorCount / totalAttempted) > 0.5) {
      return false;
    }

    // Check error type
    if (error instanceof CrawlLimitError || error instanceof RobotsTxtError) {
      return false;
    }

    if (error instanceof SiteUnavailableError && error.isPermanentBlock()) {
      return false;
    }

    return true;
  }

  /**
   * Get recommended retry strategy for crawl error
   */
  static getRetryStrategy(error: CrawlError): {
    shouldRetry: boolean;
    delay: number;
    maxAttempts: number;
    modifyRequest?: boolean;
  } {
    if (error instanceof PageAccessError) {
      if (error.isRateLimited()) {
        return { shouldRetry: true, delay: 60000, maxAttempts: 3, modifyRequest: true };
      }
      if (error.isTemporaryServerError()) {
        return { shouldRetry: true, delay: 30000, maxAttempts: 2 };
      }
      return { shouldRetry: false, delay: 0, maxAttempts: 0 };
    }

    if (error instanceof BrowserError) {
      return { shouldRetry: true, delay: 5000, maxAttempts: 2, modifyRequest: true };
    }

    if (error instanceof ContentParsingError) {
      return { shouldRetry: true, delay: 1000, maxAttempts: 1, modifyRequest: true };
    }

    if (error instanceof SiteUnavailableError) {
      return {
        shouldRetry: !error.isPermanentBlock(),
        delay: error.getEstimatedRetryTime(),
        maxAttempts: 1
      };
    }

    // Default retry strategy
    return { shouldRetry: error.recoverable, delay: 5000, maxAttempts: 1 };
  }
}