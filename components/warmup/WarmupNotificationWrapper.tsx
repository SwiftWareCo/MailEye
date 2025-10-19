/**
 * Warmup Notification Wrapper
 *
 * Server component that fetches warmup status and renders notification banner
 */

import { getUserWarmupSummary } from '@/server/warmup/warmup.data';
import { WarmupNotificationBannerClient } from './WarmupNotificationBannerClient';

interface WarmupNotificationWrapperProps {
  userId: string;
}

export async function WarmupNotificationWrapper({ userId }: WarmupNotificationWrapperProps) {
  const summary = await getUserWarmupSummary(userId);

  // Only show banner if there are pending or overdue accounts
  if (summary.totalPending === 0 && summary.totalOverdue === 0) {
    return null;
  }

return (
    <WarmupNotificationBannerClient
      pendingCount={summary.totalPending}
      overdueCount={summary.totalOverdue}
    />
  );
}
