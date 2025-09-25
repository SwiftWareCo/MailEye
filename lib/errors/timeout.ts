/**
 * Timeout Error Handlers for SEO Audit System
 *
 * Handles various timeout scenarios including function timeouts,
 * network timeouts, and browser automation timeouts.
 */

import { AuditError, ErrorContext } from './index';

/**
 * Base timeout error class
 */
export class TimeoutError extends AuditError {
  public readonly timeoutDuration: number;
  public readonly operation: string;

  constructor(
    operation: string,
    timeoutDuration: number,
    context: ErrorContext = {},
    userMessage?: string,
    suggestedAction?: string,
    code = 'TIMEOUT_ERROR'
  ) {
    const message = `${operation} timed out after ${timeoutDuration}ms`;

    super(
      message,
      code,
      context,
      true, // Generally recoverable
      userMessage || `Operation timed out while ${operation.toLowerCase()}`,
      suggestedAction || 'Please try again with a smaller scope or check your internet connection'
    );

    this.timeoutDuration = timeoutDuration;
    this.operation = operation;
  }

  /**
   * Check if timeout suggests the operation might succeed with more time
   */
  shouldIncreaseTimeout(): boolean {
    // If we're close to completing (based on context), suggest increasing timeout
    const progress = this.context.metadata?.progress as number;
    return progress > 0.5; // If more than 50% complete when timeout occurred
  }
}

/**
 * Vercel function execution timeout error
 */
export class FunctionTimeoutError extends TimeoutError {
  public readonly isVercelLimit: boolean;
  public readonly recommendedBatching: boolean;

  constructor(
    operation: string,
    timeoutDuration: number,
    context: ErrorContext = {},
    isVercelLimit = true
  ) {
    const userMessage = isVercelLimit
      ? 'The audit is taking longer than expected due to platform limits'
      : 'The operation timed out';

    const suggestedAction = isVercelLimit
      ? 'Try auditing fewer pages at once or enable background processing'
      : 'Please try again or reduce the scope of your audit';

    super(
      operation,
      timeoutDuration,
      context,
      userMessage,
      suggestedAction,
      'FUNCTION_TIMEOUT_ERROR'
    );

    this.isVercelLimit = isVercelLimit;
    this.recommendedBatching = isVercelLimit && timeoutDuration >= 60000; // 60 seconds
  }

  /**
   * Get recommended batch size based on timeout duration
   */
  getRecommendedBatchSize(): number {
    const baseUrl = this.context.url;
    const estimatedPageTime = 3000; // 3 seconds per page estimate
    const availableTime = this.timeoutDuration * 0.8; // Use 80% of available time

    return Math.max(1, Math.floor(availableTime / estimatedPageTime));
  }
}

/**
 * Network request timeout error
 */
export class NetworkTimeoutError extends TimeoutError {
  public readonly requestType: 'http' | 'websocket' | 'api';
  public readonly statusCode?: number;

  constructor(
    requestType: 'http' | 'websocket' | 'api',
    timeoutDuration: number,
    context: ErrorContext = {},
    statusCode?: number
  ) {
    const operation = `${requestType.toUpperCase()} request`;

    super(
      operation,
      timeoutDuration,
      context,
      `Network request timed out while loading ${context.url || 'resource'}`,
      'Check your internet connection and try again',
      'NETWORK_TIMEOUT_ERROR'
    );
    this.requestType = requestType;
    this.statusCode = statusCode;
  }

  /**
   * Check if this is likely a server-side timeout
   */
  isServerTimeout(): boolean {
    return this.statusCode === 504 || this.timeoutDuration > 30000;
  }

  /**
   * Check if this is likely a network connectivity issue
   */
  isConnectivityIssue(): boolean {
    return !this.statusCode && this.timeoutDuration < 10000;
  }
}

/**
 * Browser automation timeout error
 */
export class BrowserTimeoutError extends TimeoutError {
  public readonly browserAction: string;
  public readonly selector?: string;
  public readonly browserType: 'playwright' | 'puppeteer';

  constructor(
    browserAction: string,
    browserType: 'playwright' | 'puppeteer',
    timeoutDuration: number,
    context: ErrorContext = {},
    selector?: string
  ) {
    const operation = `Browser ${browserAction}`;
    const selectorInfo = selector ? ` (selector: ${selector})` : '';

    super(
      operation,
      timeoutDuration,
      { ...context, browserType, selector },
      `Page took too long to ${browserAction.toLowerCase()}${selectorInfo}`,
      'The website may be slow to load. Try again or check if the site is accessible.',
      'BROWSER_TIMEOUT_ERROR'
    );
    this.browserAction = browserAction;
    this.selector = selector;
    this.browserType = browserType;
  }

  /**
   * Get suggested alternative approach
   */
  getAlternativeApproach(): string {
    switch (this.browserAction) {
      case 'load':
        return 'Try with mobile viewport or disable images';
      case 'waitForSelector':
        return 'Try with a more specific selector or increase timeout';
      case 'screenshot':
        return 'Try with a smaller viewport or partial screenshot';
      default:
        return 'Try with different browser settings or reduce page complexity';
    }
  }
}

/**
 * Database query timeout error
 */
export class DatabaseTimeoutError extends TimeoutError {
  public readonly queryType: string;
  public readonly tableNames: string[];

  constructor(
    queryType: string,
    timeoutDuration: number,
    tableNames: string[] = [],
    context: ErrorContext = {}
  ) {
    const operation = `Database ${queryType}`;

    super(
      operation,
      timeoutDuration,
      { ...context, queryType, tableNames },
      'Database query took too long to complete',
      'The database may be under heavy load. Please try again.',
      'DATABASE_TIMEOUT_ERROR'
    );
    this.queryType = queryType;
    this.tableNames = tableNames;
  }

  /**
   * Check if this suggests an indexing issue
   */
  suggestsIndexingIssue(): boolean {
    return this.queryType.includes('SELECT') && this.timeoutDuration > 5000;
  }
}

/**
 * API integration timeout error
 */
export class APIIntegrationTimeoutError extends TimeoutError {
  public readonly apiService: string;
  public readonly endpoint?: string;
  public readonly quotaLimited: boolean;

  constructor(
    apiService: string,
    timeoutDuration: number,
    context: ErrorContext = {},
    endpoint?: string,
    quotaLimited = false
  ) {
    const operation = `${apiService} API call`;

    super(
      operation,
      timeoutDuration,
      { ...context, apiService, endpoint, quotaLimited },
      quotaLimited
        ? `${apiService} API quota limit reached`
        : `${apiService} API request timed out`,
      quotaLimited
        ? 'API quota exceeded. Please wait before making more requests.'
        : `${apiService} API is currently slow. Please try again.`,
      'API_INTEGRATION_TIMEOUT_ERROR'
    );
    this.apiService = apiService;
    this.endpoint = endpoint;
    this.quotaLimited = quotaLimited;
  }

  /**
   * Get recommended retry delay based on API service
   */
  getRecommendedRetryDelay(): number {
    if (this.quotaLimited) {
      // Different APIs have different reset periods
      switch (this.apiService.toLowerCase()) {
        case 'lighthouse':
        case 'pagespeed':
          return 60000; // 1 minute
        case 'google apis':
          return 300000; // 5 minutes
        default:
          return 120000; // 2 minutes
      }
    }

    // Standard retry delay for non-quota timeouts
    return Math.min(30000, this.timeoutDuration / 2);
  }
}

/**
 * Timeout detection and handling utilities
 */
export class TimeoutHandler {
  /**
   * Wrap a promise with timeout handling
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
    context: ErrorContext = {}
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(operation, timeoutMs, context));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Create a timeout handler for browser operations
   */
  static createBrowserTimeout(
    browserType: 'playwright' | 'puppeteer',
    action: string,
    timeoutMs: number,
    context: ErrorContext = {},
    selector?: string
  ) {
    return (error: unknown) => {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new BrowserTimeoutError(action, browserType, timeoutMs, context, selector);
      }
      throw error;
    };
  }

  /**
   * Create a timeout handler for network requests
   */
  static createNetworkTimeout(
    requestType: 'http' | 'websocket' | 'api',
    timeoutMs: number,
    context: ErrorContext = {}
  ) {
    return (error: unknown) => {
      if (error instanceof Error && (
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')
      )) {
        throw new NetworkTimeoutError(requestType, timeoutMs, context);
      }
      throw error;
    };
  }

  /**
   * Adaptive timeout calculation based on context
   */
  static calculateAdaptiveTimeout(
    baseTimeout: number,
    context: {
      pageSize?: number;
      complexity?: 'low' | 'medium' | 'high';
      networkSpeed?: 'slow' | 'medium' | 'fast';
      previousAttempts?: number;
    }
  ): number {
    let adjustedTimeout = baseTimeout;

    // Adjust for page complexity
    if (context.complexity === 'high') {
      adjustedTimeout *= 2;
    } else if (context.complexity === 'low') {
      adjustedTimeout *= 0.7;
    }

    // Adjust for network conditions
    if (context.networkSpeed === 'slow') {
      adjustedTimeout *= 1.5;
    } else if (context.networkSpeed === 'fast') {
      adjustedTimeout *= 0.8;
    }

    // Increase timeout on retry attempts
    if (context.previousAttempts) {
      adjustedTimeout *= (1 + context.previousAttempts * 0.3);
    }

    // Page size adjustment (rough estimate)
    if (context.pageSize) {
      const sizeMultiplier = Math.min(2, 1 + (context.pageSize / 1000000)); // 1MB baseline
      adjustedTimeout *= sizeMultiplier;
    }

    return Math.round(adjustedTimeout);
  }

  /**
   * Check if an error is timeout-related
   */
  static isTimeoutError(error: unknown): error is TimeoutError {
    return error instanceof TimeoutError;
  }

  /**
   * Extract timeout information from generic errors
   */
  static extractTimeoutInfo(error: unknown): {
    isTimeout: boolean;
    suggestedTimeout?: number;
    operation?: string;
  } {
    if (error instanceof TimeoutError) {
      return {
        isTimeout: true,
        suggestedTimeout: error.shouldIncreaseTimeout() ? error.timeoutDuration * 1.5 : undefined,
        operation: error.operation,
      };
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const isTimeout = message.includes('timeout') ||
                       message.includes('timed out') ||
                       message.includes('etimedout');

      return {
        isTimeout,
        operation: isTimeout ? 'Unknown operation' : undefined,
      };
    }

    return { isTimeout: false };
  }
}