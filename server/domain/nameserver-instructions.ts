/**
 * Nameserver Instructions Generator (Task 2.2)
 *
 * Generates registrar-specific instructions for updating nameservers to Cloudflare
 */

import type {
  DomainProvider,
  NameserverInstructions,
} from '@/lib/types/domain';

/**
 * Cloudflare nameservers
 * Users need to point their domains to these nameservers
 */
export const CLOUDFLARE_NAMESERVERS = [
  'ns1.cloudflare.com',
  'ns2.cloudflare.com',
];

/**
 * Generate nameserver instructions based on registrar
 */
export function generateNameserverInstructions(
  provider: DomainProvider
): NameserverInstructions {
  switch (provider) {
    case 'godaddy':
      return {
        provider,
        providerName: 'GoDaddy',
        nameservers: CLOUDFLARE_NAMESERVERS,
        instructions: [
          'Log in to your GoDaddy account',
          'Navigate to "My Products" > "Domains"',
          'Click on the domain you want to connect',
          'Scroll down to "Additional Settings" section',
          'Click "Manage DNS"',
          'Click "Change Nameservers"',
          'Select "I\'ll use my own nameservers"',
          'Enter the Cloudflare nameservers shown below',
          'Click "Save" and wait for propagation (usually 15-30 minutes)',
        ],
        documentationUrl: 'https://www.godaddy.com/help/change-nameservers-for-my-domains-664',
        estimatedPropagationTime: '15-30 minutes',
      };

    case 'namecheap':
      return {
        provider,
        providerName: 'Namecheap',
        nameservers: CLOUDFLARE_NAMESERVERS,
        instructions: [
          'Log in to your Namecheap account',
          'Click "Domain List" in the left sidebar',
          'Click "Manage" next to your domain',
          'Find the "Nameservers" section',
          'Select "Custom DNS" from the dropdown',
          'Enter the Cloudflare nameservers shown below',
          'Click the green checkmark to save',
          'Wait for propagation (usually 30 minutes to 2 hours)',
        ],
        documentationUrl: 'https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/',
        estimatedPropagationTime: '30 minutes to 2 hours',
      };

    case 'cloudflare':
      return {
        provider,
        providerName: 'Cloudflare',
        nameservers: CLOUDFLARE_NAMESERVERS,
        instructions: [
          'Your domain is already registered with Cloudflare',
          'No nameserver changes needed!',
          'We\'ll automatically configure DNS records',
          'Click "Continue" to proceed',
        ],
        documentationUrl: 'https://developers.cloudflare.com/dns/',
        estimatedPropagationTime: 'Immediate',
      };

    case 'google-domains':
      return {
        provider,
        providerName: 'Google Domains',
        nameservers: CLOUDFLARE_NAMESERVERS,
        instructions: [
          'Log in to Google Domains',
          'Select your domain',
          'Click on "DNS" in the left menu',
          'Scroll to "Name servers" section',
          'Select "Use custom name servers"',
          'Enter the Cloudflare nameservers shown below',
          'Click "Save"',
          'Wait for propagation (usually 24-48 hours)',
        ],
        documentationUrl: 'https://support.google.com/domains/answer/3290309',
        estimatedPropagationTime: '24-48 hours',
      };

    case 'name.com':
      return {
        provider,
        providerName: 'Name.com',
        nameservers: CLOUDFLARE_NAMESERVERS,
        instructions: [
          'Log in to your Name.com account',
          'Click on "My Domains"',
          'Select your domain',
          'Click "Manage Nameservers"',
          'Select "Use Name.com\'s nameservers" and change to custom',
          'Enter the Cloudflare nameservers shown below',
          'Click "Submit"',
          'Wait for propagation (usually 1-2 hours)',
        ],
        documentationUrl: 'https://www.name.com/support/articles/205934547-Changing-nameservers-for-DNS-management',
        estimatedPropagationTime: '1-2 hours',
      };

    case 'hover':
      return {
        provider,
        providerName: 'Hover',
        nameservers: CLOUDFLARE_NAMESERVERS,
        instructions: [
          'Log in to your Hover account',
          'Go to "Domains" tab',
          'Click on your domain name',
          'Click "Edit" next to "Nameservers"',
          'Select "Use custom nameservers"',
          'Enter the Cloudflare nameservers shown below',
          'Click "Save Nameservers"',
          'Wait for propagation (usually 2-4 hours)',
        ],
        documentationUrl: 'https://help.hover.com/hc/en-us/articles/217282457-How-to-Edit-DNS-records-A-AAAA-CNAME-MX-TXT-SRV-',
        estimatedPropagationTime: '2-4 hours',
      };

    case 'other':
    default:
      return {
        provider: 'other',
        providerName: 'Your Registrar',
        nameservers: CLOUDFLARE_NAMESERVERS,
        instructions: [
          'Log in to your domain registrar account',
          'Find your domain in the domain list',
          'Look for "Nameservers", "DNS Settings", or "Name Server Management"',
          'Change nameservers to "Custom" or "Use my own nameservers"',
          'Enter the Cloudflare nameservers shown below',
          'Save your changes',
          'Wait for propagation (typically 1-48 hours depending on registrar)',
        ],
        documentationUrl: 'https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/',
        estimatedPropagationTime: '1-48 hours (varies by registrar)',
      };
  }
}

/**
 * Get simplified instructions for copy-paste
 */
export function getNameserverList(): string[] {
  return CLOUDFLARE_NAMESERVERS;
}

/**
 * Validate if nameservers match Cloudflare
 */
export function areCloudflareNameservers(nameservers: string[]): boolean {
  const normalized = nameservers.map((ns) => ns.toLowerCase().trim());
  return CLOUDFLARE_NAMESERVERS.every((cf) =>
    normalized.some((ns) => ns.includes(cf.toLowerCase()))
  );
}
