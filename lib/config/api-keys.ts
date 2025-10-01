/**
 * API Key Configuration and Validation
 * Validates presence of required API keys for email infrastructure services
 */

export interface CloudflareConfig {
  apiToken: string;
  accountId: string;
  zoneId?: string; // Optional: zones are created per-domain
}

export interface GoDaddyConfig {
  apiKey: string;
  apiSecret: string;
  environment: 'ote' | 'production';
  baseUrl: string;
}

export interface SmartleadConfig {
  apiKey: string;
}

export interface EmailInfrastructureConfig {
  cloudflare: CloudflareConfig;
  godaddy: GoDaddyConfig;
  smartlead: SmartleadConfig;
}

class ApiKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyValidationError';
  }
}

/**
 * Validates that all required Cloudflare environment variables are present
 */
function validateCloudflareConfig(): CloudflareConfig {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID; // Optional

  if (!apiToken || !accountId) {
    throw new ApiKeyValidationError(
      'Missing Cloudflare configuration. Required: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID'
    );
  }

  return {
    apiToken,
    accountId,
    zoneId,
  };
}

/**
 * Validates that all required GoDaddy environment variables are present
 */
function validateGoDaddyConfig(): GoDaddyConfig {
  const apiKey = process.env.GODADDY_API_KEY;
  const apiSecret = process.env.GODADDY_API_SECRET;
  const environment = (process.env.GODADDY_ENVIRONMENT || 'ote') as
    | 'ote'
    | 'production';

  if (!apiKey || !apiSecret) {
    throw new ApiKeyValidationError(
      'Missing GoDaddy configuration. Required: GODADDY_API_KEY, GODADDY_API_SECRET'
    );
  }

  const baseUrl =
    environment === 'ote'
      ? 'https://api.ote-godaddy.com'
      : 'https://api.godaddy.com';

  return {
    apiKey,
    apiSecret,
    environment,
    baseUrl,
  };
}

/**
 * Validates that all required Smartlead environment variables are present
 */
function validateSmartleadConfig(): SmartleadConfig {
  const apiKey = process.env.SMARTLEAD_API_KEY;

  if (!apiKey) {
    throw new ApiKeyValidationError(
      'Missing Smartlead configuration. Required: SMARTLEAD_API_KEY'
    );
  }

  return {
    apiKey,
  };
}

/**
 * Validates all email infrastructure API configurations
 * @throws {ApiKeyValidationError} If any required configuration is missing
 */
export function validateEmailInfrastructureConfig(): EmailInfrastructureConfig {
  return {
    cloudflare: validateCloudflareConfig(),
    godaddy: validateGoDaddyConfig(),
    smartlead: validateSmartleadConfig(),
  };
}

/**
 * Checks if a specific service configuration is available
 */
export function isServiceConfigured(
  service: 'cloudflare' | 'godaddy' | 'smartlead'
): boolean {
  try {
    switch (service) {
      case 'cloudflare':
        validateCloudflareConfig();
        return true;
      case 'godaddy':
        validateGoDaddyConfig();
        return true;
      case 'smartlead':
        validateSmartleadConfig();
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Gets the configuration for a specific service
 */
export function getServiceConfig(service: 'cloudflare'): CloudflareConfig;
export function getServiceConfig(service: 'godaddy'): GoDaddyConfig;
export function getServiceConfig(service: 'smartlead'): SmartleadConfig;
export function getServiceConfig(
  service: 'cloudflare' | 'godaddy' | 'smartlead'
) {
  switch (service) {
    case 'cloudflare':
      return validateCloudflareConfig();
    case 'godaddy':
      return validateGoDaddyConfig();
    case 'smartlead':
      return validateSmartleadConfig();
    default:
      throw new ApiKeyValidationError(`Unknown service: ${service}`);
  }
}
