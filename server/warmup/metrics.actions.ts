/**
 * Warmup Metrics Server Actions
 *
 * Fetches and processes warmup statistics from Smartlead API
 */

'use server';

import { stackServerApp } from '@/stack/server';
import { db } from '@/lib/db';
import { emailAccounts, smartleadAccountMappings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getWarmupStats } from '@/lib/clients/smartlead';
import { getSmartleadCredentials } from '@/server/credentials/credentials.data';

interface WarmupMetrics {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  replied: number;
  deliverability_rate: number;
}

interface SmartleadStatsResponse {
  id: number;
  sent_count: string | number;
  spam_count: string | number;
  warmup_email_received_count: string | number;
  inbox_count: string | number;
  stats_by_date: Array<{
    date: string;
    sent_count: number;
    reply_count: number;
    save_from_spam_count: number;
    id: number;
  }>;
}

interface WarmupHealthAssessment {
  overall: 'healthy' | 'warning' | 'critical';
  inboxPlacement: number;
  bounceRate: number;
  replyRate: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Get warmup metrics for an email account from Smartlead
 */
export async function getEmailAccountWarmupMetricsAction(emailAccountId: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Verify account belongs to user
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, emailAccountId),
        eq(emailAccounts.userId, user.id)
      ),
    });

    if (!account) {
      return { success: false, error: 'Email account not found' };
    }

    // Check if account is connected to Smartlead
    const mapping = await db.query.smartleadAccountMappings.findFirst({
      where: eq(smartleadAccountMappings.emailAccountId, emailAccountId),
    });

    if (!mapping) {
      return {
        success: false,
        error: 'Account not connected to Smartlead',
        metrics: [],
      };
    }

    // Get user's Smartlead credentials
    const smartleadCreds = await getSmartleadCredentials();
    if (!smartleadCreds || !smartleadCreds.apiKey) {
      return {
        success: false,
        error: 'Smartlead credentials not configured',
        metrics: [],
      };
    }

    // Fetch warmup stats from Smartlead (last 7 days)
    const statsResponse = await getWarmupStats(smartleadCreds.apiKey, mapping.smartleadEmailAccountId);


    // Transform Smartlead API response to WarmupMetrics format
    const stats = transformSmartleadStatsToMetrics(statsResponse as SmartleadStatsResponse);


    // Calculate health assessment
    const healthAssessment = calculateHealthAssessment(stats);


    return {
      success: true,
      metrics: stats as WarmupMetrics[],
      health: healthAssessment,
      accountEmail: account.email,
      smartleadAccountId: mapping.smartleadEmailAccountId,
    };
  } catch (error) {
    console.error('Failed to fetch warmup metrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics: [],
    };
  }
}

/**
 * Refresh warmup metrics from Smartlead API
 * Forces a fresh fetch instead of using cached data
 */
export async function refreshWarmupMetricsAction(emailAccountId: string) {
  // Same as getEmailAccountWarmupMetricsAction but could add cache-busting logic
  return await getEmailAccountWarmupMetricsAction(emailAccountId);
}

/**
 * Transform Smartlead API response to WarmupMetrics format
 */
function transformSmartleadStatsToMetrics(response: SmartleadStatsResponse): WarmupMetrics[] {
  if (!response.stats_by_date || !Array.isArray(response.stats_by_date)) {
    return [];
  }

  // Calculate ACTUAL inbox placement from aggregate data
  // SmartLead API provides total counts but not per-day inbox/spam breakdown
  const totalSent = Number(response.sent_count) || 0;
  const totalInbox = Number(response.inbox_count) || 0;

  // IMPORTANT: save_from_spam_count = emails RESCUED from spam (moved to inbox)
  // This is a POSITIVE metric but does NOT represent total inbox placement
  // Actual inbox placement = inbox_count / sent_count (from aggregate data)
  const actualInboxRate = totalSent > 0 ? (totalInbox / totalSent) * 100 : 0;

  // Apply aggregate inbox rate to each day since per-day inbox data is not available
  return response.stats_by_date.map((dayStats) => {
    const sent = dayStats.sent_count || 0;
    const replied = dayStats.reply_count || 0;

    return {
      date: dayStats.date,
      sent,
      delivered: sent, // Assume all sent emails were delivered (bounces not available per-day)
      bounced: 0, // Per-day bounce data not provided by SmartLead API
      replied,
      deliverability_rate: actualInboxRate, // Use aggregate inbox rate for all days
    };
  });
}

/**
 * Calculate health assessment from warmup metrics
 */
function calculateHealthAssessment(metrics: WarmupMetrics[]): WarmupHealthAssessment {
  if (metrics.length === 0) {
    return {
      overall: 'warning',
      inboxPlacement: 0,
      bounceRate: 0,
      replyRate: 0,
      issues: ['No metrics available yet'],
      recommendations: ['Wait for warmup emails to be sent'],
    };
  }

  // Calculate averages from last 7 days
  const avgDeliverability = metrics.reduce((sum, m) => sum + m.deliverability_rate, 0) / metrics.length;
  const totalSent = metrics.reduce((sum, m) => sum + m.sent, 0);
  const totalBounced = metrics.reduce((sum, m) => sum + m.bounced, 0);
  const totalReplied = metrics.reduce((sum, m) => sum + m.replied, 0);

  const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
  const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

  // Early warmup handling: Don't assess health critically if < 20 emails sent
  // Not enough data to make accurate assessments during first few days
  if (totalSent < 20) {
    return {
      overall: 'healthy', // Don't mark as critical during early warmup
      inboxPlacement: avgDeliverability,
      bounceRate,
      replyRate,
      issues: [], // No issues during warmup start
      recommendations: [
        'Warmup just started - keep sending emails daily',
        'Reply to warmup emails manually to improve engagement',
        `${totalSent} emails sent so far - continue for at least 20 emails before full assessment`,
      ],
    };
  }

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Assess health (only for accounts with 20+ emails)
  let overall: 'healthy' | 'warning' | 'critical' = 'healthy';

  // Critical issues
  if (avgDeliverability < 72) {
    overall = 'critical';
    issues.push(`Inbox placement critically low: ${avgDeliverability.toFixed(0)}%`);
    recommendations.push('Check spam folder and move emails to inbox');
    recommendations.push('Verify DNS records (SPF, DKIM, DMARC)');
    recommendations.push('Reduce sending volume temporarily');
  }

  if (bounceRate > 3) {
    overall = 'critical';
    issues.push(`High bounce rate: ${bounceRate.toFixed(1)}%`);
    recommendations.push('Verify email addresses before sending');
    recommendations.push('Check SMTP configuration');
  }

  // Warning issues
  if (avgDeliverability >= 72 && avgDeliverability < 90) {
    if (overall === 'healthy') overall = 'warning';
    issues.push(`Inbox placement below optimal: ${avgDeliverability.toFixed(0)}%`);
    recommendations.push('Continue manual warmup checks daily');
    recommendations.push('Reply to more warmup emails naturally');
  }

  if (bounceRate > 1 && bounceRate <= 3) {
    if (overall === 'healthy') overall = 'warning';
    issues.push(`Elevated bounce rate: ${bounceRate.toFixed(1)}%`);
    recommendations.push('Monitor email list quality');
  }

  if (replyRate < 20 && overall !== 'critical') {
    if (overall === 'healthy') overall = 'warning';
    issues.push(`Low reply rate: ${replyRate.toFixed(0)}%`);
    recommendations.push('Reply to more warmup emails manually');
  }

  // Healthy state recommendations
  if (overall === 'healthy') {
    recommendations.push('Maintain current warmup schedule');
    recommendations.push('Continue monitoring metrics daily');
    if (avgDeliverability >= 90) {
      recommendations.push('Account is ready for cold outreach after Day 21');
    }
  }

  return {
    overall,
    inboxPlacement: avgDeliverability,
    bounceRate,
    replyRate,
    issues,
    recommendations,
  };
}

/**
 * Get Email Account Warmup Data (Combined)
 *
 * Fetches both metrics and settings in a single server action call
 * This is more efficient than making two separate requests
 *
 * @param emailAccountId - Email account ID
 * @returns Combined metrics and settings data
 */
export async function getEmailAccountWarmupDataAction(
  emailAccountId: string
): Promise<{
  success: boolean;
  metrics?: Array<{
    date: string;
    sent: number;
    delivered: number;
    bounced: number;
    replied: number;
    deliverability_rate: number;
  }>;
  health?: WarmupHealthAssessment;
  settings?: {
    warmupEnabled: boolean;
    maxEmailPerDay: number;
    warmupMinCount: number;
    warmupMaxCount: number;
    dailyRampup: number;
    replyRatePercentage: number;
    isRampupEnabled?: boolean;
    weekdaysOnly?: boolean;
    autoAdjust?: boolean;
    warmupTrackingDomain?: boolean;
  };
  error?: string;
}> {
  const user = await stackServerApp.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Import settings action
    const { getWarmupSettingsAction } = await import('./settings.actions');

    // Fetch both metrics and settings in parallel
    const [metricsResult, settingsResult] = await Promise.all([
      getEmailAccountWarmupMetricsAction(emailAccountId),
      getWarmupSettingsAction(emailAccountId),
    ]);

    if (!metricsResult.success) {
      return {
        success: false,
        error: metricsResult.error,
      };
    }

    return {
      success: true,
      metrics: metricsResult.metrics,
      health: metricsResult.health,
      settings: settingsResult.success ? settingsResult.settings : undefined,
    };
  } catch (error) {
    console.error('Failed to fetch warmup data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
