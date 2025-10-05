/**
 * Unit Tests for Custom Tracking Domain CNAME Setup (Task 3.8)
 *
 * Tests for Smartlead custom tracking domain CNAME generation,
 * subdomain validation, and DNS record creation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTrackingDomainCNAME,
  getTrackingCNAMETarget,
  buildTrackingURL,
  createTrackingDNSRecord,
  validateTrackingSubdomain,
  getSmartleadTrackingInstructions,
  getTrackingSubdomainRecommendations,
  RECOMMENDED_TRACKING_SUBDOMAINS,
} from '../tracking-domain-setup';

describe('generateTrackingDomainCNAME', () => {
  it('should generate valid CNAME record for Smartlead', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'emailtracking',
      provider: 'smartlead',
    });

    expect(result.success).toBe(true);
    expect(result.domain).toBe('example.com');
    expect(result.trackingSubdomain).toBe('emailtracking');
    expect(result.fullTrackingDomain).toBe('emailtracking.example.com');
    expect(result.trackingURL).toBe('http://emailtracking.example.com');
    expect(result.cnameTarget).toBe('open.sleadtrack.com');
    expect(result.errors).toHaveLength(0);
  });

  it('should create correct DNS record structure', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'mycompany.com',
      trackingSubdomain: 'track',
      provider: 'smartlead',
    });

    expect(result.dnsRecord).toEqual({
      name: 'track',
      type: 'CNAME',
      content: 'open.sleadtrack.com',
      ttl: 3600,
      proxied: false,
    });
  });

  it('should accept common tracking subdomains', async () => {
    const commonSubdomains = ['emailtracking', 'track', 'link', 'click', 'email', 'mail'];

    for (const subdomain of commonSubdomains) {
      const result = await generateTrackingDomainCNAME({
        domain: 'example.com',
        trackingSubdomain: subdomain,
        provider: 'smartlead',
      });

      expect(result.success).toBe(true);
      expect(result.trackingSubdomain).toBe(subdomain);
      expect(result.fullTrackingDomain).toBe(`${subdomain}.example.com`);
    }
  });

  it('should reject invalid domain', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'invalid domain',
      trackingSubdomain: 'track',
      provider: 'smartlead',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Invalid domain: invalid domain');
  });

  it('should reject subdomain with uppercase letters', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'EmailTracking',
      provider: 'smartlead',
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
  });

  it('should reject subdomain with spaces', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'email tracking',
      provider: 'smartlead',
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('spaces'))).toBe(true);
  });

  it('should reject subdomain with special characters', async () => {
    const invalidSubdomains = ['track!', 'email@', 'link#test', 'track$'];

    for (const subdomain of invalidSubdomains) {
      const result = await generateTrackingDomainCNAME({
        domain: 'example.com',
        trackingSubdomain: subdomain,
        provider: 'smartlead',
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
    }
  });

  it('should reject subdomain same as domain', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'example.com',
      provider: 'smartlead',
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('cannot be the same'))).toBe(true);
  });

  it('should warn about uncommon subdomains', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'customtracker',
      provider: 'smartlead',
    });

    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('not a common'))).toBe(true);
  });

  it('should warn about long subdomains', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'verylongtrackingsubdomainthatexceeds30characters',
      provider: 'smartlead',
    });

    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('quite long'))).toBe(true);
  });

  it('should include generatedAt timestamp', async () => {
    const before = new Date();
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'track',
      provider: 'smartlead',
    });
    const after = new Date();

    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should handle hyphens in subdomain correctly', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'email-tracking',
      provider: 'smartlead',
    });

    expect(result.success).toBe(true);
    expect(result.fullTrackingDomain).toBe('email-tracking.example.com');
  });

  it('should reject subdomain starting with hyphen', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: '-tracking',
      provider: 'smartlead',
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid subdomain format'))).toBe(true);
  });

  it('should reject subdomain ending with hyphen', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'example.com',
      trackingSubdomain: 'tracking-',
      provider: 'smartlead',
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid subdomain format'))).toBe(true);
  });
});

describe('getTrackingCNAMETarget', () => {
  it('should return correct CNAME target for Smartlead', () => {
    const target = getTrackingCNAMETarget('smartlead');
    expect(target).toBe('open.sleadtrack.com');
  });
});

describe('buildTrackingURL', () => {
  it('should build correct tracking URL', () => {
    const url = buildTrackingURL('emailtracking', 'example.com');
    expect(url).toBe('http://emailtracking.example.com');
  });

  it('should use HTTP (not HTTPS)', () => {
    const url = buildTrackingURL('track', 'mycompany.com');
    expect(url).toMatch(/^http:\/\//);
    expect(url).not.toMatch(/^https:\/\//);
  });

  it('should work with different subdomains', () => {
    const testCases = [
      { subdomain: 'track', domain: 'example.com', expected: 'http://track.example.com' },
      { subdomain: 'link', domain: 'test.io', expected: 'http://link.test.io' },
      { subdomain: 'click', domain: 'company.net', expected: 'http://click.company.net' },
    ];

    testCases.forEach(({ subdomain, domain, expected }) => {
      expect(buildTrackingURL(subdomain, domain)).toBe(expected);
    });
  });
});

describe('createTrackingDNSRecord', () => {
  it('should create CNAME record with correct structure', () => {
    const record = createTrackingDNSRecord('emailtracking', 'open.sleadtrack.com', 3600);

    expect(record).toEqual({
      name: 'emailtracking',
      type: 'CNAME',
      content: 'open.sleadtrack.com',
      ttl: 3600,
      proxied: false,
    });
  });

  it('should use default TTL of 3600 when not specified', () => {
    const record = createTrackingDNSRecord('track', 'open.sleadtrack.com');
    expect(record.ttl).toBe(3600);
  });

  it('should always set proxied to false', () => {
    const record = createTrackingDNSRecord('track', 'open.sleadtrack.com');
    expect(record.proxied).toBe(false);
  });

  it('should accept custom TTL', () => {
    const record = createTrackingDNSRecord('track', 'open.sleadtrack.com', 7200);
    expect(record.ttl).toBe(7200);
  });
});

describe('validateTrackingSubdomain', () => {
  it('should validate correct subdomains', () => {
    const validSubdomains = [
      'emailtracking',
      'track',
      'link',
      'email',
      'e',
      'a1',
      'test-subdomain',
      'email-tracking-123',
    ];

    validSubdomains.forEach(subdomain => {
      const result = validateTrackingSubdomain(subdomain);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject empty subdomain', () => {
    const result = validateTrackingSubdomain('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Tracking subdomain cannot be empty');
  });

  it('should reject subdomain with spaces', () => {
    const result = validateTrackingSubdomain('email tracking');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('spaces'))).toBe(true);
  });

  it('should reject subdomain with uppercase', () => {
    const result = validateTrackingSubdomain('EmailTracking');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
  });

  it('should reject subdomain with special characters', () => {
    const invalidChars = ['track!', 'email@domain', 'link#test', 'track$', 'link_test'];

    invalidChars.forEach(subdomain => {
      const result = validateTrackingSubdomain(subdomain);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
    });
  });

  it('should reject subdomain longer than 63 characters', () => {
    const longSubdomain = 'a'.repeat(64);
    const result = validateTrackingSubdomain(longSubdomain);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('too long'))).toBe(true);
  });

  it('should warn about subdomains longer than 30 characters', () => {
    const longSubdomain = 'a'.repeat(31);
    const result = validateTrackingSubdomain(longSubdomain);
    expect(result.isValid).toBe(true);
    expect(result.warnings.some(w => w.includes('quite long'))).toBe(true);
  });

  it('should reject subdomain starting with hyphen', () => {
    const result = validateTrackingSubdomain('-tracking');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid subdomain format'))).toBe(true);
  });

  it('should reject subdomain ending with hyphen', () => {
    const result = validateTrackingSubdomain('tracking-');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid subdomain format'))).toBe(true);
  });

  it('should warn about consecutive hyphens', () => {
    const result = validateTrackingSubdomain('email--tracking');
    expect(result.isValid).toBe(true);
    expect(result.warnings.some(w => w.includes('consecutive hyphens'))).toBe(true);
  });

  it('should accept single character subdomain', () => {
    const result = validateTrackingSubdomain('t');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept subdomain with numbers', () => {
    const result = validateTrackingSubdomain('track123');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept subdomain starting with number', () => {
    const result = validateTrackingSubdomain('1track');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('getSmartleadTrackingInstructions', () => {
  it('should return array of setup instructions', () => {
    const instructions = getSmartleadTrackingInstructions('http://track.example.com');

    expect(Array.isArray(instructions)).toBe(true);
    expect(instructions.length).toBeGreaterThan(0);
  });

  it('should include the tracking URL in instructions', () => {
    const trackingURL = 'http://emailtracking.mycompany.com';
    const instructions = getSmartleadTrackingInstructions(trackingURL);

    const hasTrackingURL = instructions.some(instruction =>
      instruction.includes(trackingURL)
    );
    expect(hasTrackingURL).toBe(true);
  });

  it('should include Smartlead-specific steps', () => {
    const instructions = getSmartleadTrackingInstructions('http://track.example.com');

    const instructionText = instructions.join(' ').toLowerCase();
    expect(instructionText).toContain('smartlead');
    expect(instructionText).toContain('verify');
    expect(instructionText).toContain('cname');
  });
});

describe('getTrackingSubdomainRecommendations', () => {
  it('should return array of recommended subdomains', () => {
    const recommendations = getTrackingSubdomainRecommendations();

    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it('should return common tracking subdomains', () => {
    const recommendations = getTrackingSubdomainRecommendations();

    expect(recommendations).toContain('emailtracking');
    expect(recommendations).toContain('track');
    expect(recommendations).toContain('link');
  });

  it('should match RECOMMENDED_TRACKING_SUBDOMAINS constant', () => {
    const recommendations = getTrackingSubdomainRecommendations();

    expect(recommendations).toEqual(Array.from(RECOMMENDED_TRACKING_SUBDOMAINS));
  });
});

describe('Integration: Full workflow', () => {
  it('should complete full tracking domain setup workflow', async () => {
    // 1. Validate subdomain
    const subdomainValidation = validateTrackingSubdomain('emailtracking');
    expect(subdomainValidation.isValid).toBe(true);

    // 2. Generate tracking domain CNAME
    const result = await generateTrackingDomainCNAME({
      domain: 'mycompany.com',
      trackingSubdomain: 'emailtracking',
      provider: 'smartlead',
    });
    expect(result.success).toBe(true);

    // 3. Get DNS record for Cloudflare
    const dnsRecord = result.dnsRecord;
    expect(dnsRecord.type).toBe('CNAME');
    expect(dnsRecord.name).toBe('emailtracking');
    expect(dnsRecord.content).toBe('open.sleadtrack.com');

    // 4. Get tracking URL for Smartlead
    const trackingURL = result.trackingURL;
    expect(trackingURL).toBe('http://emailtracking.mycompany.com');

    // 5. Get setup instructions
    const instructions = getSmartleadTrackingInstructions(trackingURL);
    expect(instructions.length).toBeGreaterThan(0);
  });

  it('should handle invalid input gracefully', async () => {
    const result = await generateTrackingDomainCNAME({
      domain: 'invalid domain with spaces',
      trackingSubdomain: 'Invalid Subdomain!',
      provider: 'smartlead',
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('Invalid domain'))).toBe(true);
    expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
  });
});
