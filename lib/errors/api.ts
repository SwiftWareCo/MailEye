/**
 * API Integration Error Handlers for SEO Audit System
 *
 * Handles API integration errors for external services like
 * Google Lighthouse, PageSpeed Insights, and other third-party APIs.
 */

import { AuditError, ErrorContext } from './index';

/**
 * Base API integration error class
 */
export class APIError extends AuditError {
  public readonly apiService: string;
  public readonly endpoint?: string;
  public readonly statusCode?: number;
  public readonly requestId?: string;
  public readonly rateLimited: boolean;

  constructor(
    apiService: string,
    message: string,
    code: string,
    context: ErrorContext = {},
    statusCode?: number,
    endpoint?: string,
    requestId?: string,
    rateLimited = false,
    recoverable = true,
    userMessage?: string,
    suggestedAction?: string
  ) {
    super(
      message,
      code,
      { ...context, apiService, endpoint, statusCode, requestId, rateLimited },
      recoverable,
      userMessage || `${apiService} API error occurred`,
      suggestedAction || 'Please try again or contact support if the issue persists'
    );

    this.apiService = apiService;
    this.endpoint = endpoint;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.rateLimited = rateLimited;
  }

  /**
   * Check if this is a quota-related error
   */
  isQuotaError(): boolean {
    return this.rateLimited ||
           this.statusCode === 429 ||
           this.message.toLowerCase().includes('quota') ||
           this.message.toLowerCase().includes('rate limit');
  }

  /**
   * Check if this is an authentication error
   */
  isAuthenticationError(): boolean {
    return this.statusCode === 401 ||
           this.statusCode === 403 ||
           this.message.toLowerCase().includes('unauthorized') ||
           this.message.toLowerCase().includes('api key');
  }

  /**
   * Get recommended retry delay based on API service and error type
   */
  getRetryDelay(): number {
    if (this.isQuotaError()) {
      return APIError.getQuotaRetryDelay(this.apiService);
    }

    if (this.statusCode && this.statusCode >= 500) {
      return 30000; // 30 seconds for server errors
    }

    return 5000; // 5 seconds for other retryable errors
  }

  private static getQuotaRetryDelay(apiService: string): number {
    switch (apiService.toLowerCase()) {
      case 'lighthouse':
      case 'pagespeed insights':
      case 'google lighthouse':
        return 60000; // 1 minute
      case 'google apis':
        return 300000; // 5 minutes
      default:
        return 120000; // 2 minutes default
    }
  }
}

/**
 * Google Lighthouse API error
 */
export class LighthouseAPIError extends APIError {
  public readonly lighthouseVersion?: string;
  public readonly strategy?: 'mobile' | 'desktop';

  constructor(
    message: string,
    context: ErrorContext = {},
    statusCode?: number,
    endpoint?: string,
    requestId?: string,
    lighthouseVersion?: string,
    strategy?: 'mobile' | 'desktop'
  ) {
    const isQuotaError = statusCode === 429 || message.toLowerCase().includes('quota');

    super(
      'Google Lighthouse',
      message,
      'LIGHTHOUSE_API_ERROR',
      { ...context, lighthouseVersion, strategy },
      statusCode,
      endpoint,
      requestId,
      isQuotaError,
      true,
      isQuotaError
        ? 'Lighthouse API quota exceeded'
        : 'Failed to get Lighthouse performance data',
      isQuotaError
        ? 'Please wait before making more requests or upgrade your quota'
        : 'Try again or check if the URL is accessible'
    );

    this.lighthouseVersion = lighthouseVersion;
    this.strategy = strategy;
  }

  /**
   * Check if error is specific to mobile or desktop strategy
   */
  isStrategySpecific(): boolean {
    return Boolean(this.strategy && this.message.includes(this.strategy));
  }

  /**
   * Get alternative strategy suggestion
   */
  getAlternativeStrategy(): 'mobile' | 'desktop' | null {
    if (this.isStrategySpecific()) {
      return this.strategy === 'mobile' ? 'desktop' : 'mobile';
    }
    return null;
  }
}

/**
 * Google PageSpeed Insights API error
 */
export class PageSpeedInsightsAPIError extends APIError {
  public readonly category?: string[];
  public readonly locale?: string;

  constructor(
    message: string,
    context: ErrorContext = {},
    statusCode?: number,
    endpoint?: string,
    requestId?: string,
    category?: string[],
    locale?: string
  ) {
    const isQuotaError = statusCode === 429 || message.toLowerCase().includes('quota');

    super(
      'PageSpeed Insights',
      message,
      'PAGESPEED_INSIGHTS_API_ERROR',
      { ...context, category, locale },
      statusCode,
      endpoint,
      requestId,
      isQuotaError,
      true,
      isQuotaError
        ? 'PageSpeed Insights API quota exceeded'
        : 'Failed to get PageSpeed Insights data',
      isQuotaError
        ? 'Please wait before making more requests or upgrade your quota'
        : 'Try again or check if the URL is accessible for analysis'
    );

    this.category = category;
    this.locale = locale;
  }

  /**
   * Check if specific categories failed
   */
  hasCategoryFailure(): boolean {
    return Boolean(this.category && this.category.length > 0);
  }

  /**
   * Get failed categories
   */
  getFailedCategories(): string[] {
    return this.category || [];
  }
}

/**
 * Generic third-party API error
 */
export class ThirdPartyAPIError extends APIError {
  public readonly provider: string;
  public readonly apiVersion?: string;

  constructor(
    provider: string,
    message: string,
    context: ErrorContext = {},
    statusCode?: number,
    endpoint?: string,
    requestId?: string,
    apiVersion?: string
  ) {
    const isQuotaError = statusCode === 429 ||
                        message.toLowerCase().includes('quota') ||
                        message.toLowerCase().includes('rate limit');

    super(
      provider,
      message,
      'THIRD_PARTY_API_ERROR',
      { ...context, provider, apiVersion },
      statusCode,
      endpoint,
      requestId,
      isQuotaError,
      statusCode !== 401 && statusCode !== 403, // Not recoverable if auth error
      isQuotaError
        ? `${provider} API quota exceeded`
        : `${provider} API error occurred`,
      isQuotaError
        ? 'Please wait before making more requests'
        : 'Check API configuration and try again'
    );

    this.provider = provider;
    this.apiVersion = apiVersion;
  }
}

/**
 * API configuration error
 */
export class APIConfigurationError extends APIError {
  public readonly configField: string;
  public readonly configValue?: string;

  constructor(
    apiService: string,
    configField: string,
    message: string,
    context: ErrorContext = {},
    configValue?: string
  ) {
    super(
      apiService,
      `Configuration error: ${message}`,
      'API_CONFIGURATION_ERROR',
      { ...context, configField, configValue },
      undefined,
      undefined,
      undefined,
      false,
      false, // Configuration errors are not recoverable
      `${apiService} API is not properly configured`,
      `Please check your ${configField} configuration and try again`
    );

    this.configField = configField;
    this.configValue = configValue;
  }

  /**
   * Check if this is an API key issue
   */
  isAPIKeyIssue(): boolean {
    return this.configField.toLowerCase().includes('key') ||
           this.configField.toLowerCase().includes('token');
  }

  /**
   * Get configuration guidance
   */
  getConfigurationGuidance(): string {
    if (this.isAPIKeyIssue()) {
      return `Please ensure your ${this.apiService} API key is valid and has the necessary permissions`;
    }

    return `Please check your ${this.apiService} API configuration for the ${this.configField} field`;
  }
}

/**
 * API response parsing error
 */
export class APIResponseError extends APIError {
  public readonly responseBody?: string;
  public readonly expectedFormat: string;
  public readonly actualFormat?: string;

  constructor(
    apiService: string,
    expectedFormat: string,
    message: string,
    context: ErrorContext = {},
    responseBody?: string,
    actualFormat?: string
  ) {
    super(
      apiService,
      `Response parsing error: ${message}`,
      'API_RESPONSE_ERROR',
      { ...context, expectedFormat, actualFormat, responseBody: responseBody?.substring(0, 500) },
      undefined,
      undefined,
      undefined,
      false,
      true, // Response parsing errors are often recoverable
      `Failed to parse ${apiService} API response`,
      'This might be a temporary API issue - try again'
    );

    this.responseBody = responseBody;
    this.expectedFormat = expectedFormat;
    this.actualFormat = actualFormat;
  }

  /**
   * Check if this is a format mismatch
   */
  isFormatMismatch(): boolean {
    return Boolean(this.expectedFormat && this.actualFormat &&
                  this.expectedFormat !== this.actualFormat);
  }

  /**
   * Get response preview for debugging
   */
  getResponsePreview(): string {
    if (!this.responseBody) return 'No response body available';

    return this.responseBody.length > 200
      ? `${this.responseBody.substring(0, 200)}...`
      : this.responseBody;
  }
}

/**
 * API quota/rate limit error
 */
export class APIQuotaError extends APIError {
  public readonly quotaType: 'requests' | 'daily' | 'monthly' | 'concurrent';
  public readonly resetTime?: Date;
  public readonly retryAfter?: number;
  public readonly limit: number;
  public readonly current: number;

  constructor(
    apiService: string,
    quotaType: 'requests' | 'daily' | 'monthly' | 'concurrent',
    limit: number,
    current: number,
    context: ErrorContext = {},
    resetTime?: Date,
    retryAfter?: number
  ) {
    super(
      apiService,
      `${apiService} ${quotaType} quota exceeded (${current}/${limit})`,
      'API_QUOTA_ERROR',
      { ...context, apiService, quotaType, resetTime, retryAfter },
      429,
      undefined,
      undefined,
      true, // rateLimited = true
      true, // recoverable = true
      `${apiService} ${quotaType} quota exceeded (${current}/${limit})`,
      APIQuotaError.getSuggestedAction(apiService, quotaType, resetTime, retryAfter)
    );

    this.quotaType = quotaType;
    this.resetTime = resetTime;
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.current = current;
  }

  private static getSuggestedAction(
    apiService: string,
    quotaType: string,
    resetTime?: Date,
    retryAfter?: number
  ): string {
    if (retryAfter) {
      return `Wait ${Math.ceil(retryAfter / 60)} minutes before trying again`;
    }

    if (resetTime) {
      const now = new Date();
      const waitTime = Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60));
      return `Quota resets in ${waitTime} minutes`;
    }

    switch (quotaType) {
      case 'daily':
        return 'Daily quota exceeded - try again tomorrow or upgrade your plan';
      case 'monthly':
        return 'Monthly quota exceeded - upgrade your plan for more requests';
      case 'concurrent':
        return 'Too many concurrent requests - wait and try again';
      default:
        return `${apiService} quota exceeded - please wait or upgrade your plan`;
    }
  }

  /**
   * Get time until quota reset
   */
  getTimeUntilReset(): number | null {
    if (this.retryAfter) {
      return this.retryAfter * 1000; // Convert to milliseconds
    }

    if (this.resetTime) {
      return Math.max(0, this.resetTime.getTime() - Date.now());
    }

    return null;
  }

  /**
   * Check if quota will reset soon (within an hour)
   */
  resetsWithinHour(): boolean {
    const resetTime = this.getTimeUntilReset();
    return resetTime !== null && resetTime < 3600000; // 1 hour in milliseconds
  }

  /**
   * Get percentage of limit used
   */
  getLimitUsagePercentage(): number {
    return Math.round((this.current / this.limit) * 100);
  }

  /**
   * Check if close to limit (>80%)
   */
  isNearLimit(): boolean {
    return this.getLimitUsagePercentage() > 80;
  }
}

/**
 * API network connectivity error
 */
export class APINetworkError extends APIError {
  public readonly networkIssue: 'timeout' | 'dns' | 'connection' | 'ssl' | 'proxy';

  constructor(
    apiService: string,
    networkIssue: 'timeout' | 'dns' | 'connection' | 'ssl' | 'proxy',
    message: string,
    context: ErrorContext = {},
    endpoint?: string
  ) {
    super(
      apiService,
      `Network error (${networkIssue}): ${message}`,
      'API_NETWORK_ERROR',
      { ...context, networkIssue },
      undefined,
      endpoint,
      undefined,
      false,
      true, // Network errors are generally recoverable
      `Connection to ${apiService} API failed`,
      APINetworkError.getNetworkSuggestion(networkIssue)
    );

    this.networkIssue = networkIssue;
  }

  private static getNetworkSuggestion(networkIssue: string): string {
    switch (networkIssue) {
      case 'timeout':
        return 'The API request timed out - try again or check your connection';
      case 'dns':
        return 'Could not resolve API server address - check your DNS settings';
      case 'connection':
        return 'Could not connect to API server - check your internet connection';
      case 'ssl':
        return 'SSL/TLS error connecting to API - this may be a temporary issue';
      case 'proxy':
        return 'Proxy connection error - check your proxy settings';
      default:
        return 'Network connectivity issue - check your connection and try again';
    }
  }

  /**
   * Check if this suggests a firewall or proxy issue
   */
  suggestsFirewallIssue(): boolean {
    return this.networkIssue === 'connection' || this.networkIssue === 'proxy';
  }

  /**
   * Check if this is likely a temporary network issue
   */
  isLikelyTemporary(): boolean {
    return this.networkIssue === 'timeout' || this.networkIssue === 'ssl';
  }
}

/**
 * API error handler utilities
 */
export class APIErrorHandler {
  /**
   * Parse and classify API errors from HTTP responses
   */
  static parseAPIError(
    apiService: string,
    response: {
      status?: number;
      statusText?: string;
      data?: any;
      headers?: Record<string, string>;
    },
    context: ErrorContext = {}
  ): APIError {
    const { status, statusText, data, headers } = response;
    const requestId = headers?.['x-request-id'] || headers?.['request-id'];
    const retryAfter = headers?.['retry-after'] ? parseInt(headers['retry-after']) : undefined;

    // Quota/Rate limiting errors
    if (status === 429 || (data && data.error && data.error.message?.includes('quota'))) {
      const quotaType = APIErrorHandler.detectQuotaType(data?.error?.message || statusText);
      const resetTime = headers?.['x-ratelimit-reset']
        ? new Date(parseInt(headers['x-ratelimit-reset']) * 1000)
        : undefined;

      return new APIQuotaError(
        apiService,
        quotaType,
        parseInt(headers?.['x-ratelimit-limit'] || '1000'),
        parseInt(headers?.['x-ratelimit-remaining'] || '0'),
        context,
        resetTime,
        retryAfter
      );
    }

    // Authentication errors
    if (status === 401 || status === 403) {
      return new APIConfigurationError(
        apiService,
        'API Key',
        data?.error?.message || statusText || 'Authentication failed',
        context
      );
    }

    // Service-specific errors
    switch (apiService.toLowerCase()) {
      case 'lighthouse':
      case 'google lighthouse':
        return new LighthouseAPIError(
          data?.error?.message || statusText || 'Lighthouse API error',
          context,
          status,
          undefined,
          requestId
        );

      case 'pagespeed insights':
        return new PageSpeedInsightsAPIError(
          data?.error?.message || statusText || 'PageSpeed Insights API error',
          context,
          status,
          undefined,
          requestId
        );

      default:
        return new APIError(
          apiService,
          data?.error?.message || statusText || 'API error occurred',
          'GENERIC_API_ERROR',
          context,
          status,
          undefined,
          requestId,
          status === 429
        );
    }
  }

  private static detectQuotaType(message?: string): 'requests' | 'daily' | 'monthly' | 'concurrent' {
    if (!message) return 'requests';

    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('daily')) return 'daily';
    if (lowerMessage.includes('monthly')) return 'monthly';
    if (lowerMessage.includes('concurrent')) return 'concurrent';
    return 'requests';
  }

  /**
   * Determine if API error should trigger fallback mechanism
   */
  static shouldUseFallback(error: APIError, fallbackAvailable: boolean): boolean {
    if (!fallbackAvailable) return false;

    // Use fallback for authentication errors
    if (error.isAuthenticationError()) return true;

    // Use fallback for quota errors if it's a different service
    if (error.isQuotaError()) return true;

    // Use fallback for server errors (5xx)
    if (error.statusCode && error.statusCode >= 500) return true;

    return false;
  }

  /**
   * Get retry strategy for API errors
   */
  static getRetryStrategy(error: APIError): {
    shouldRetry: boolean;
    delay: number;
    maxAttempts: number;
    backoff: boolean;
  } {
    // Don't retry authentication or configuration errors
    if (error.isAuthenticationError() || error instanceof APIConfigurationError) {
      return { shouldRetry: false, delay: 0, maxAttempts: 0, backoff: false };
    }

    // Special handling for quota errors
    if (error instanceof APIQuotaError) {
      const timeUntilReset = error.getTimeUntilReset();
      return {
        shouldRetry: error.resetsWithinHour(),
        delay: timeUntilReset || 300000, // 5 minutes default
        maxAttempts: 1,
        backoff: false
      };
    }

    // Server errors (5xx) - retry with backoff
    if (error.statusCode && error.statusCode >= 500) {
      return { shouldRetry: true, delay: 30000, maxAttempts: 3, backoff: true };
    }

    // Network errors - retry with shorter delay
    if (error instanceof APINetworkError) {
      return {
        shouldRetry: error.isLikelyTemporary(),
        delay: 10000,
        maxAttempts: 2,
        backoff: true
      };
    }

    // Default retry strategy for other API errors
    return { shouldRetry: error.recoverable, delay: error.getRetryDelay(), maxAttempts: 2, backoff: true };
  }

  /**
   * Extract useful debugging information from API error
   */
  static getDebugInfo(error: APIError): Record<string, unknown> {
    return {
      apiService: error.apiService,
      statusCode: error.statusCode,
      endpoint: error.endpoint,
      requestId: error.requestId,
      rateLimited: error.rateLimited,
      isQuota: error.isQuotaError(),
      isAuth: error.isAuthenticationError(),
      retryDelay: error.getRetryDelay(),
      context: error.context,
      timestamp: error.timestamp
    };
  }
}