/**
 * Task 2.1.1: Basic Crawlee Configuration Setup
 *
 * This file contains ONLY basic configuration for Desktop/Mobile presets
 * and simple user agent rotation. No advanced features.
 */

import type { ViewportConfig } from '@/lib/types/crawling';

/**
 * Basic crawl mode preset for Desktop/Mobile
 */
export interface CrawlModePreset {
  userAgent: string;
  viewport: ViewportConfig;
  device?: string;
}

/**
 * Desktop and Mobile presets with basic user agents and viewports
 */
export const CRAWL_MODE_PRESETS: Record<'desktop' | 'mobile', CrawlModePreset> = {
  desktop: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
  },
  mobile: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    viewport: {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    device: 'iPhone 12',
  },
};

/**
 * Basic user agent pool for simple rotation
 */
export const BASIC_USER_AGENTS = {
  desktop: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  ],
  mobile: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  ],
};

/**
 * Basic Vercel optimization settings for timeouts and memory
 */
export const VERCEL_OPTIMIZATION = {
  requestTimeout: 8000, // 8 seconds to stay under Vercel 10s limit
  maxConcurrency: 2, // Conservative for Vercel memory limits
  maxMemoryUsage: 512, // MB limit for functions
};

/**
 * Simple configuration manager for Task 2.1.1
 */
export class BasicCrawleeConfig {
  /**
   * Get basic preset for desktop or mobile mode
   */
  static getPreset(mode: 'desktop' | 'mobile'): CrawlModePreset {
    return CRAWL_MODE_PRESETS[mode];
  }

  /**
   * Get random user agent for the specified mode
   */
  static getRandomUserAgent(mode: 'desktop' | 'mobile'): string {
    const agents = BASIC_USER_AGENTS[mode];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Get basic Vercel-optimized settings
   */
  static getVercelSettings() {
    return VERCEL_OPTIMIZATION;
  }

  /**
   * Create basic Crawlee configuration object
   */
  static createBasicConfig(mode: 'desktop' | 'mobile') {
    const preset = this.getPreset(mode);
    const vercelSettings = this.getVercelSettings();

    return {
      mode,
      userAgent: preset.userAgent,
      viewport: preset.viewport,
      device: preset.device,
      timeout: vercelSettings.requestTimeout,
      maxConcurrency: vercelSettings.maxConcurrency,
    };
  }
}