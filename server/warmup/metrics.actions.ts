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
    const stats = await getWarmupStats(smartleadCreds.apiKey, mapping.smartleadEmailAccountId);

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

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Assess health
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
