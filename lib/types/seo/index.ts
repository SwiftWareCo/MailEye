/**
 * SEO analysis interfaces and types
 *
 * This module provides interfaces for SEO rule engine, issue detection,
 * and structured data validation functionality.
 */

/**
 * SEO issue severity levels
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * SEO issue categories for organization
 */
export type IssueCategory = 'technical' | 'content' | 'performance' | 'security';

/**
 * Structured data validation results
 */
export interface StructuredDataValidation {
  /** Whether structured data is present */
  hasStructuredData: boolean;
  /** Schema.org types found */
  schemaTypes: string[];
  /** Validation errors found */
  errors: StructuredDataError[];
  /** Valid structured data items */
  validItems: StructuredDataItem[];
}

/**
 * Individual structured data error
 */
export interface StructuredDataError {
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Line number in HTML (if available) */
  line?: number;
  /** Affected property */
  property?: string;
}

/**
 * Valid structured data item
 */
export interface StructuredDataItem {
  /** Schema.org type */
  type: string;
  /** Structured data properties */
  properties: Record<string, unknown>;
  /** Format (JSON-LD, Microdata, RDFa) */
  format: 'json-ld' | 'microdata' | 'rdfa';
}

/**
 * Meta tags analysis result
 */
export interface MetaTagsAnalysis {
  /** Page title */
  title?: string;
  /** Meta description */
  description?: string;
  /** Meta keywords */
  keywords?: string;
  /** Open Graph tags */
  openGraph: OpenGraphData;
  /** Twitter Card tags */
  twitterCard: TwitterCardData;
  /** Meta robots directive */
  robots?: string;
  /** Canonical URL */
  canonical?: string;
  /** Language/hreflang tags */
  hreflang: HreflangData[];
  /** Viewport meta tag */
  viewport?: string;
  /** Character encoding */
  charset?: string;
}

/**
 * Open Graph metadata
 */
export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
  locale?: string;
}

/**
 * Twitter Card metadata
 */
export interface TwitterCardData {
  card?: string;
  title?: string;
  description?: string;
  image?: string;
  site?: string;
  creator?: string;
}

/**
 * Hreflang data for internationalization
 */
export interface HreflangData {
  /** Language code */
  lang: string;
  /** Target URL */
  href: string;
}

/**
 * Robots.txt analysis result
 */
export interface RobotsAnalysis {
  /** Whether robots.txt exists */
  exists: boolean;
  /** Raw robots.txt content */
  content?: string;
  /** Parsed directives */
  directives: RobotsDirective[];
  /** Syntax errors found */
  errors: string[];
  /** Sitemap URLs referenced */
  sitemaps: string[];
  /** Whether crawling is allowed for user agent */
  crawlAllowed: boolean;
}

/**
 * Individual robots.txt directive
 */
export interface RobotsDirective {
  /** User agent this directive applies to */
  userAgent: string;
  /** Directive type (Allow, Disallow, etc.) */
  directive: string;
  /** Path or pattern */
  path: string;
}

/**
 * LLMS.txt (AI training data) analysis result
 */
export interface LLMSAnalysis {
  /** Whether llms.txt exists */
  exists: boolean;
  /** Raw llms.txt content */
  content?: string;
  /** AI training permissions */
  permissions: LLMSPermission[];
  /** Format validation errors */
  errors: string[];
  /** Whether AI training is permitted */
  aiTrainingAllowed: boolean;
}

/**
 * LLMS.txt permission entry
 */
export interface LLMSPermission {
  /** AI model or company */
  model: string;
  /** Permission level (allow, disallow) */
  permission: 'allow' | 'disallow';
  /** Specific paths or patterns */
  paths?: string[];
}

/**
 * SEO rule interface for modular rule engine
 */
export interface SEORule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Issue category */
  category: IssueCategory;
  /** Default severity level */
  severity: IssueSeverity;
  /** Whether rule is enabled by default */
  enabled: boolean;
  /** Rule execution function */
  execute: (context: SEORuleContext) => Promise<SEORuleResult[]>;
}

/**
 * Context provided to SEO rules during execution
 */
export interface SEORuleContext {
  /** Page URL being analyzed */
  url: string;
  /** Raw HTML content */
  htmlContent: string;
  /** Parsed meta tags */
  metaTags: MetaTagsAnalysis;
  /** Structured data validation */
  structuredData: StructuredDataValidation;
  /** Response headers */
  headers: Record<string, string>;
  /** HTTP status code */
  statusCode: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Robots.txt analysis */
  robotsAnalysis?: RobotsAnalysis;
  /** LLMS.txt analysis */
  llmsAnalysis?: LLMSAnalysis;
}

/**
 * Result returned by SEO rule execution
 */
export interface SEORuleResult {
  /** Rule that generated this result */
  ruleId: string;
  /** Issue severity (can override rule default) */
  severity: IssueSeverity;
  /** Issue title */
  title: string;
  /** Detailed description */
  description: string;
  /** Fix recommendation */
  recommendation: string;
  /** Code example for fix */
  codeExample?: string;
  /** Affected HTML element or selector */
  affectedElement?: string;
  /** Expected value */
  expectedValue?: string;
  /** Actual value found */
  actualValue?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * SEO rule engine interface
 */
export interface SEORuleEngine {
  /**
   * Register a new SEO rule
   */
  registerRule(rule: SEORule): void;

  /**
   * Execute all enabled rules for a page
   */
  analyzeePage(context: SEORuleContext): Promise<SEORuleResult[]>;

  /**
   * Execute specific rules by ID
   */
  executeRules(context: SEORuleContext, ruleIds: string[]): Promise<SEORuleResult[]>;

  /**
   * Get all registered rules
   */
  getRules(): SEORule[];

  /**
   * Enable or disable a rule
   */
  toggleRule(ruleId: string, enabled: boolean): void;
}

/**
 * Meta analyzer interface for extracting metadata
 */
export interface MetaAnalyzer {
  /**
   * Extract and analyze meta tags from HTML content
   */
  analyzeMetaTags(htmlContent: string, url: string): Promise<MetaTagsAnalysis>;

  /**
   * Validate structured data in HTML content
   */
  validateStructuredData(htmlContent: string): Promise<StructuredDataValidation>;
}