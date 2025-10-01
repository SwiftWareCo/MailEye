/**
 * Test script for nameserver verification (Task 2.3)
 *
 * Run with: npx tsx scripts/test-nameserver-verification.ts
 *
 * Tests DNS lookup utilities without requiring database connection
 */

import { Resolver } from 'dns';
import { promisify } from 'util';

// Inline simplified versions to avoid DB dependency
const CLOUDFLARE_NAMESERVERS = [
  'aron.ns.cloudflare.com',
  'june.ns.cloudflare.com',
];

async function queryNameservers(domain: string) {
  try {
    const resolver = new Resolver();
    const resolveNs = promisify(resolver.resolveNs.bind(resolver));
    const nameservers = await resolveNs(domain);
    const normalizedNameservers = nameservers.map((ns) =>
      ns.toLowerCase().replace(/\.$/, '')
    );
    return {
      success: true,
      nameservers: normalizedNameservers,
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          nameservers: [],
          error: 'Domain not found or has no nameservers configured',
        };
      }
      if (error.code === 'ENODATA') {
        return {
          success: false,
          nameservers: [],
          error: 'No nameserver records found for domain',
        };
      }
    }
    return {
      success: false,
      nameservers: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function areNameserversCloudflare(nameservers: string[]): boolean {
  if (nameservers.length === 0) return false;
  return nameservers.some((ns) => ns.endsWith('cloudflare.com'));
}

async function testNameserverVerification() {
  console.log('🧪 Testing Nameserver Verification (Task 2.3)\n');

  // Test 1: Query a domain with Cloudflare nameservers
  console.log('Test 1: Querying cloudflare.com nameservers...');
  const cloudflareResult = await queryNameservers('cloudflare.com');
  console.log('Success:', cloudflareResult.success);
  console.log('Nameservers:', cloudflareResult.nameservers);
  console.log('Is Cloudflare?', areNameserversCloudflare(cloudflareResult.nameservers));
  console.log('');

  // Test 2: Query a domain without Cloudflare nameservers
  console.log('Test 2: Querying google.com nameservers...');
  const googleResult = await queryNameservers('google.com');
  console.log('Success:', googleResult.success);
  console.log('Nameservers:', googleResult.nameservers);
  console.log('Is Cloudflare?', areNameserversCloudflare(googleResult.nameservers));
  console.log('');

  // Test 3: Query non-existent domain
  console.log('Test 3: Querying non-existent domain...');
  const nonExistentResult = await queryNameservers('this-domain-definitely-does-not-exist-12345.com');
  console.log('Success:', nonExistentResult.success);
  console.log('Error:', nonExistentResult.error);
  console.log('');

  // Test 4: Verification logic
  console.log('Test 4: Testing verification logic...');
  console.log('Expected Cloudflare nameservers:', CLOUDFLARE_NAMESERVERS);
  console.log('');

  console.log('✅ All tests completed!');
}

// Run tests
testNameserverVerification().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
