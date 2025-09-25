/**
 * Comprehensive Error Handling Framework for SEO Audit System
 *
 * Provides base error classes and utilities for consistent error handling
 * across timeout, crawling, and API integration scenarios.
 */

export interface ErrorContext {
  url?: string;
  timestamp?: Date;
  userAgent?: string;
  retryCount?: number;
  metadata?: Record<string, unknown>;
  // API-related context
  apiService?: string;
  endpoint?: string;
  requestId?: string;
  rateLimited?: boolean;
  lighthouseVersion?: string;
  strategy?: 'mobile' | 'desktop';
  category?: string[];
  locale?: string;
  provider?: string;
  apiVersion?: string;
  configField?: string;
  configValue?: string;
  expectedFormat?: string;
  actualFormat?: string;
  responseBody?: string;
  quotaType?: string;
  resetTime?: Date;
  retryAfter?: number;
  networkIssue?: string;
  // Crawling-related context
  crawlStage?: string;
  browserType?: string;
  browserAction?: string;
  viewport?: { width: number; height: number };
  statusCode?: number;
  httpMethod?: string;
  redirectCount?: number;
  contentType?: string;
  parsingStage?: string;
  selector?: string;
  robotsUrl?: string;
  disallowedPath?: string;
  crawlDelay?: number;
  reason?: string;
  blockingService?: string;
  limitType?: string;
  currentValue?: number;
  limitValue?: number;
  // Timeout-related context
  timeoutDuration?: number;
  operation?: string;
  queryType?: string;
  tableNames?: string[];
  // Other context
  originalError?: string;
  quotaLimited?: boolean;
}

export interface UserFriendlyError {
  message: string;
  code: string;
  recoverable: boolean;
  userMessage: string;
  suggestedAction?: string;
}

/**
 * Base error class with enhanced context and user-friendly messaging
 */
export class AuditError extends Error {
  public readonly code: string;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;
  public readonly userMessage: string;
  public readonly suggestedAction?: string;

  constructor(
    message: string,
    code: string,
    context: ErrorContext = {},
    recoverable = false,
    userMessage?: string,
    suggestedAction?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = { ...context, timestamp: new Date() };
    this.timestamp = new Date();
    this.recoverable = recoverable;
    this.userMessage = userMessage || message;
    this.suggestedAction = suggestedAction;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to user-friendly format
   */
  toUserFriendly(): UserFriendlyError {
    return {
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      userMessage: this.userMessage,
      suggestedAction: this.suggestedAction,
    };
  }

  /**
   * Get detailed error information for logging
   */
  getDetails() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      stack: this.stack,
    };
  }

  /**
   * Check if this error should trigger a retry
   */
  shouldRetry(): boolean {
    return this.recoverable && (this.context.retryCount || 0) < 3;
  }
}

/**
 * Configuration error for invalid audit settings
 */
export class ConfigurationError extends AuditError {
  constructor(
    message: string,
    context: ErrorContext = {},
    userMessage?: string,
    suggestedAction?: string
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      context,
      false,
      userMessage || 'Invalid audit configuration provided',
      suggestedAction || 'Please check your audit settings and try again'
    );
  }
}

/**
 * Validation error for invalid input data
 */
export class ValidationError extends AuditError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    context: ErrorContext = {},
    suggestedAction?: string
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      context,
      false,
      `Invalid ${field || 'input'}: ${message}`,
      suggestedAction || `Please provide a valid ${field || 'input'} and try again`
    );
    this.field = field;
    this.value = value;
  }
}

/**
 * Resource limit error for quota/rate limiting
 */
export class ResourceLimitError extends AuditError {
  public readonly resourceType: string;
  public readonly limit: number;
  public readonly current: number;

  constructor(
    resourceType: string,
    limit: number,
    current: number,
    context: ErrorContext = {},
    suggestedAction?: string
  ) {
    const message = `${resourceType} limit exceeded: ${current}/${limit}`;
    super(
      message,
      'RESOURCE_LIMIT_ERROR',
      context,
      true,
      `You've reached your ${resourceType.toLowerCase()} limit`,
      suggestedAction || 'Please wait before trying again or upgrade your plan'
    );
    this.resourceType = resourceType;
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Security error for blocked or unsafe operations
 */
export class SecurityError extends AuditError {
  public readonly securityReason: string;

  constructor(
    message: string,
    securityReason: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      'SECURITY_ERROR',
      context,
      false,
      userMessage || 'This operation was blocked for security reasons',
      'Please ensure the URL is accessible and not restricted'
    );
    this.securityReason = securityReason;
  }
}

/**
 * Error aggregator for handling multiple errors
 */
export class AggregateError extends AuditError {
  public readonly errors: AuditError[];

  constructor(
    errors: AuditError[],
    message?: string,
    context: ErrorContext = {}
  ) {
    const errorCount = errors.length;
    const defaultMessage = `Multiple errors occurred (${errorCount} total)`;

    super(
      message || defaultMessage,
      'AGGREGATE_ERROR',
      context,
      errors.some(e => e.recoverable),
      `${errorCount} issues were encountered during the audit`,
      'Please review the individual errors and address them accordingly'
    );
    this.errors = errors;
  }

  /**
   * Get all user-friendly errors
   */
  getAllUserFriendlyErrors(): UserFriendlyError[] {
    return this.errors.map(error => error.toUserFriendly());
  }

  /**
   * Get errors by type
   */
  getErrorsByType<T extends AuditError>(errorType: new (...args: unknown[]) => T): T[] {
    return this.errors.filter((error): error is T => error instanceof errorType);
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  /**
   * Handle and classify errors consistently
   */
  static handle(error: unknown, context: ErrorContext = {}): AuditError {
    if (error instanceof AuditError) {
      return error;
    }

    if (error instanceof Error) {
      return new AuditError(
        error.message,
        'UNKNOWN_ERROR',
        { ...context, originalError: error.name },
        false,
        'An unexpected error occurred',
        'Please try again or contact support if the issue persists'
      );
    }

    return new AuditError(
      String(error),
      'UNKNOWN_ERROR',
      context,
      false,
      'An unexpected error occurred',
      'Please try again or contact support if the issue persists'
    );
  }

  /**
   * Check if an error is recoverable and should be retried
   */
  static shouldRetry(error: unknown): boolean {
    if (error instanceof AuditError) {
      return error.shouldRetry();
    }
    return false;
  }

  /**
   * Extract user-friendly error information
   */
  static toUserFriendly(error: unknown): UserFriendlyError {
    if (error instanceof AuditError) {
      return error.toUserFriendly();
    }

    return {
      message: error instanceof Error ? error.message : String(error),
      code: 'UNKNOWN_ERROR',
      recoverable: false,
      userMessage: 'An unexpected error occurred',
      suggestedAction: 'Please try again or contact support if the issue persists',
    };
  }

  /**
   * Log error with appropriate level based on severity
   */
  static log(error: unknown, logger = console) {
    const auditError = ErrorHandler.handle(error);
    const details = auditError.getDetails();

    if (auditError.recoverable) {
      logger.warn('Recoverable error occurred:', details);
    } else {
      logger.error('Non-recoverable error occurred:', details);
    }
  }
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
  /**
   * Retry operation with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
    context: ErrorContext = {}
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const auditError = ErrorHandler.handle(error, {
          ...context,
          retryCount: attempt,
        });

        // Don't retry if error is not recoverable
        if (!auditError.shouldRetry() || attempt === maxRetries) {
          throw auditError;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw ErrorHandler.handle(lastError, context);
  }

  /**
   * Fallback operation when primary fails
   */
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      const auditError = ErrorHandler.handle(error, context);

      // Log the primary error but attempt fallback
      ErrorHandler.log(auditError);

      try {
        return await fallback();
      } catch (fallbackError) {
        // If fallback also fails, throw aggregate error
        const fallbackAuditError = ErrorHandler.handle(fallbackError, context);
        throw new AggregateError([auditError, fallbackAuditError]);
      }
    }
  }
}

// Re-export all error types for convenience
export * from './timeout';
export * from './crawl';
export * from './api';