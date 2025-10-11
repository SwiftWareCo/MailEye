/**
 * Domain Details Data Layer
 *
 * Aggregates domain information from multiple tables for detail view
 */

import { db } from '@/lib/db';
import { domains, dnsRecords, emailAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  DomainDetails,
  DNSRecordInfo,
  EmailAccountInfo,
  SetupCompletionStatus,
} from '@/lib/types/domain-details';
import type { Domain } from '@/lib/types/domain';

/**
 * Get comprehensive domain details with DNS records and email accounts
 *
 * @param domainId - Domain ID
 * @param userId - User ID for authorization
 * @returns Aggregated domain details
 */
export async function getDomainDetails(
  domainId: string,
  userId: string
): Promise<DomainDetails | null> {
  try {
    // Fetch domain
    const domain = await db.query.domains.findFirst({
      where: and(eq(domains.id, domainId), eq(domains.userId, userId)),
    });

    if (!domain) {
      return null;
    }

    // Fetch DNS records
    const records = await db.query.dnsRecords.findMany({
      where: eq(dnsRecords.domainId, domainId),
      orderBy: (dnsRecords, { asc }) => [asc(dnsRecords.createdAt)],
    });

    // Fetch email accounts
    const accounts = await db.query.emailAccounts.findMany({
      where: eq(emailAccounts.domainId, domainId),
      orderBy: (emailAccounts, { asc }) => [asc(emailAccounts.createdAt)],
    });

    // Group DNS records by type
    const dnsRecordsByType = {
      SPF: records.filter((r) => r.purpose?.toUpperCase() === 'SPF'),
      DKIM: records.filter((r) => r.purpose?.toUpperCase() === 'DKIM'),
      DMARC: records.filter((r) => r.purpose?.toUpperCase() === 'DMARC'),
      MX: records.filter((r) => r.purpose?.toUpperCase() === 'MX'),
      Tracking: records.filter((r) => r.purpose?.toUpperCase() === 'TRACKING'),
      Other: records.filter(
        (r) =>
          !r.purpose ||
          !['SPF', 'DKIM', 'DMARC', 'MX', 'TRACKING'].includes(
            r.purpose.toUpperCase()
          )
      ),
    };

    // Calculate setup status
    const setupStatus = calculateSetupStatus(
      domain,
      dnsRecordsByType,
      accounts
    );

    return {
      domain: domain as Domain,
      dnsRecords: records as DNSRecordInfo[],
      dnsRecordsByType: dnsRecordsByType as {
        SPF: DNSRecordInfo[];
        DKIM: DNSRecordInfo[];
        DMARC: DNSRecordInfo[];
        MX: DNSRecordInfo[];
        Tracking: DNSRecordInfo[];
        Other: DNSRecordInfo[];
      },
      emailAccounts: accounts as EmailAccountInfo[],
      setupStatus,
    };
  } catch (error) {
    console.error('Error fetching domain details:', error);
    throw new Error('Failed to fetch domain details');
  }
}

/**
 * Calculate setup completion status for all tabs
 */
function calculateSetupStatus(
  domain: Domain,
  dnsRecordsByType: {
    SPF: DNSRecordInfo[];
    DKIM: DNSRecordInfo[];
    DMARC: DNSRecordInfo[];
    MX: DNSRecordInfo[];
    Tracking: DNSRecordInfo[];
    Other: DNSRecordInfo[];
  },
  emailAccounts: EmailAccountInfo[]
): SetupCompletionStatus {
  // DNS tab status
  const hasZone = !!domain.cloudflareZoneId;
  const nameserversVerified = domain.nameserversVerified || false;
  const missingRecords: string[] = [];

  if (dnsRecordsByType.SPF.length === 0) missingRecords.push('SPF');
  if (dnsRecordsByType.DKIM.length === 0) missingRecords.push('DKIM');
  if (dnsRecordsByType.MX.length === 0) missingRecords.push('MX');

  // DNS is complete when core records (SPF, DKIM, MX) are configured
  // DMARC is added automatically after 48 hours
  const dnsComplete = hasZone && nameserversVerified && missingRecords.length === 0;

  // Check DMARC status separately
  const dmarcConfigured = dnsRecordsByType.DMARC.length > 0;
  const dmarcPending = !dmarcConfigured && domain.dnsConfiguredAt && 
    ((Date.now() - domain.dnsConfiguredAt.getTime()) / (1000 * 60 * 60)) < 48;

  // Email accounts tab status
  const accountCount = emailAccounts.length;
  const provisionedCount = emailAccounts.filter(
    (a) => a.status !== 'inactive'
  ).length;
  const emailComplete = accountCount > 0 && provisionedCount > 0;

  // Warmup tab status
  const smartleadConnected = emailAccounts.some((a) => a.smartleadAccountId !== null);
  const accountsConnected = emailAccounts.filter(
    (a) => a.smartleadAccountId !== null
  ).length;
  const warmupInProgress = emailAccounts.filter(
    (a) => a.warmupStatus === 'in_progress'
  ).length;
  const warmupCompleted = emailAccounts.filter(
    (a) => a.warmupStatus === 'completed'
  ).length;
  const warmupComplete =
    accountCount > 0 && accountsConnected === accountCount && warmupCompleted > 0;

  // Overall completion
  const pendingTasks: string[] = [];
  if (!hasZone) pendingTasks.push('Create Cloudflare zone');
  if (!nameserversVerified) pendingTasks.push('Verify nameservers');
  if (missingRecords.length > 0)
    pendingTasks.push(`Configure ${missingRecords.join(', ')} records`);
  if (accountCount === 0) pendingTasks.push('Create email accounts');
  if (accountsConnected < accountCount)
    pendingTasks.push('Connect accounts to Smartlead');

  const totalSteps = 5; // Zone, Nameservers, DNS Records, Email Accounts, Warmup
  let completedSteps = 0;
  if (hasZone) completedSteps++;
  if (nameserversVerified) completedSteps++;
  if (dnsComplete) completedSteps++;
  if (emailComplete) completedSteps++;
  if (warmupComplete) completedSteps++;

  const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

  return {
    overview: {
      isComplete: completionPercentage === 100,
      completionPercentage,
      pendingTasks,
    },
    dns: {
      isComplete: dnsComplete,
      hasZone,
      nameserversVerified,
      recordCount: Object.values(dnsRecordsByType).reduce(
        (sum, records) => sum + records.length,
        0
      ),
      missingRecords,
      dmarcConfigured,
      dmarcPending,
    },
    emailAccounts: {
      isComplete: emailComplete,
      accountCount,
      provisionedCount,
      needsProvisioning: accountCount === 0 || provisionedCount < accountCount,
    },
    warmup: {
      isComplete: warmupComplete,
      smartleadConnected,
      accountsConnected,
      accountsTotal: accountCount,
      warmupInProgress,
      warmupCompleted,
    },
  };
}

/**
 * Get DNS records for a domain
 *
 * @param domainId - Domain ID
 * @returns DNS records
 */
export async function getDomainDNSRecords(
  domainId: string
): Promise<DNSRecordInfo[]> {
  try {
    const records = await db.query.dnsRecords.findMany({
      where: eq(dnsRecords.domainId, domainId),
      orderBy: (dnsRecords, { asc }) => [asc(dnsRecords.purpose), asc(dnsRecords.createdAt)],
    });

    return records as DNSRecordInfo[];
  } catch (error) {
    console.error('Error fetching DNS records:', error);
    throw new Error('Failed to fetch DNS records');
  }
}

/**
 * Get email accounts for a domain
 *
 * @param domainId - Domain ID
 * @returns Email accounts
 */
export async function getDomainEmailAccounts(
  domainId: string
): Promise<EmailAccountInfo[]> {
  try {
    const accounts = await db.query.emailAccounts.findMany({
      where: eq(emailAccounts.domainId, domainId),
      orderBy: (emailAccounts, { asc }) => [asc(emailAccounts.createdAt)],
    });

    return accounts as EmailAccountInfo[];
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    throw new Error('Failed to fetch email accounts');
  }
}
