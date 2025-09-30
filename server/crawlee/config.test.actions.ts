'use server';

/**
 * Task 2.1.1: Basic Configuration Test Actions
 *
 * Simple server actions to test that our basic Crawlee configuration
 * works correctly for Desktop/Mobile presets.
 */

import { BasicCrawleeConfig } from './config';

export interface ConfigTestResult {
  success: boolean;
  mode: 'desktop' | 'mobile';
  userAgent: string;
  viewport: {
    width: number;
    height: number;
    isMobile: boolean;
  };
  randomUserAgent: string;
  vercelSettings: {
    timeout: number;
    maxConcurrency: number;
  };
  error?: string;
}

/**
 * Test desktop configuration preset
 */
export async function testDesktopConfig(): Promise<ConfigTestResult> {
  try {
    const config = BasicCrawleeConfig.createBasicConfig('desktop');
    const randomUserAgent = BasicCrawleeConfig.getRandomUserAgent('desktop');
    const vercelSettings = BasicCrawleeConfig.getVercelSettings();

    return {
      success: true,
      mode: 'desktop',
      userAgent: config.userAgent,
      viewport: {
        width: config.viewport.width,
        height: config.viewport.height,
        isMobile: config.viewport.isMobile,
      },
      randomUserAgent,
      vercelSettings: {
        timeout: vercelSettings.requestTimeout,
        maxConcurrency: vercelSettings.maxConcurrency,
      },
    };
  } catch (error) {
    return {
      success: false,
      mode: 'desktop',
      userAgent: '',
      viewport: { width: 0, height: 0, isMobile: false },
      randomUserAgent: '',
      vercelSettings: { timeout: 0, maxConcurrency: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test mobile configuration preset
 */
export async function testMobileConfig(): Promise<ConfigTestResult> {
  try {
    const config = BasicCrawleeConfig.createBasicConfig('mobile');
    const randomUserAgent = BasicCrawleeConfig.getRandomUserAgent('mobile');
    const vercelSettings = BasicCrawleeConfig.getVercelSettings();

    return {
      success: true,
      mode: 'mobile',
      userAgent: config.userAgent,
      viewport: {
        width: config.viewport.width,
        height: config.viewport.height,
        isMobile: config.viewport.isMobile,
      },
      randomUserAgent,
      vercelSettings: {
        timeout: vercelSettings.requestTimeout,
        maxConcurrency: vercelSettings.maxConcurrency,
      },
    };
  } catch (error) {
    return {
      success: false,
      mode: 'mobile',
      userAgent: '',
      viewport: { width: 0, height: 0, isMobile: false },
      randomUserAgent: '',
      vercelSettings: { timeout: 0, maxConcurrency: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test user agent rotation functionality
 */
export async function testUserAgentRotation(): Promise<{
  success: boolean;
  desktop: string[];
  mobile: string[];
  error?: string;
}> {
  try {
    // Generate 5 random user agents for each mode to test rotation
    const desktopAgents: string[] = [];
    const mobileAgents: string[] = [];

    for (let i = 0; i < 5; i++) {
      desktopAgents.push(BasicCrawleeConfig.getRandomUserAgent('desktop'));
      mobileAgents.push(BasicCrawleeConfig.getRandomUserAgent('mobile'));
    }

    return {
      success: true,
      desktop: desktopAgents,
      mobile: mobileAgents,
    };
  } catch (error) {
    return {
      success: false,
      desktop: [],
      mobile: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Comprehensive configuration test
 */
export async function testBasicConfiguration(): Promise<{
  success: boolean;
  desktop: ConfigTestResult;
  mobile: ConfigTestResult;
  userAgentRotation: {
    desktop: string[];
    mobile: string[];
  };
  error?: string;
}> {
  try {
    const [desktopTest, mobileTest, rotationTest] = await Promise.all([
      testDesktopConfig(),
      testMobileConfig(),
      testUserAgentRotation(),
    ]);

    return {
      success: desktopTest.success && mobileTest.success && rotationTest.success,
      desktop: desktopTest,
      mobile: mobileTest,
      userAgentRotation: {
        desktop: rotationTest.desktop,
        mobile: rotationTest.mobile,
      },
    };
  } catch (error) {
    return {
      success: false,
      desktop: {
        success: false,
        mode: 'desktop',
        userAgent: '',
        viewport: { width: 0, height: 0, isMobile: false },
        randomUserAgent: '',
        vercelSettings: { timeout: 0, maxConcurrency: 0 },
      },
      mobile: {
        success: false,
        mode: 'mobile',
        userAgent: '',
        viewport: { width: 0, height: 0, isMobile: false },
        randomUserAgent: '',
        vercelSettings: { timeout: 0, maxConcurrency: 0 },
      },
      userAgentRotation: { desktop: [], mobile: [] },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}