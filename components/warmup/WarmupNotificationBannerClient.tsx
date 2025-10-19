/**
 * Warmup Notification Banner Client Component
 *
 * Client-side banner with modal integration
 */

'use client';

import { useState } from 'react';
import { WarmupNotificationBanner } from './WarmupNotificationBanner';
import { WarmupChecklistModal } from './WarmupChecklistModal';
import {
  getWarmupChecklistStatus,
  markChecklistCompleteAction,
  skipChecklistAction,
} from '@/server/warmup/checklist.actions';
import { toast } from 'sonner';

interface WarmupNotificationBannerClientProps {
  pendingCount: number;
  overdueCount: number;
}

interface ChecklistTask {
  id: string;
  description: string;
  completed: boolean;
}

export function WarmupNotificationBannerClient({
  pendingCount,
  overdueCount,
}: WarmupNotificationBannerClientProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistAccounts, setChecklistAccounts] = useState<Array<{
    id: string;
    email: string;
    warmupDay: number;
    tasks: ChecklistTask[];
    lastCompletedAt: Date | null;
  }>>([]);

  const handleViewChecklist = async () => {
    const result = await getWarmupChecklistStatus();

    if (result.success) {
      setChecklistAccounts(
        result.accounts.map((acc) => ({
          id: acc.id,
          email: acc.email,
          warmupDay: acc.warmupDay,
          tasks: [],
          lastCompletedAt: acc.lastCompletedAt,
        }))
      );
      setShowChecklist(true);
    } else {
      toast.error('Failed to load checklist', {
        description: result.error,
      });
    }
  };

  const handleMarkComplete = async (accountId: string) => {
    const result = await markChecklistCompleteAction(accountId);

    if (result.success) {
      // Remove from checklist
      setChecklistAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
    } else {
      throw new Error(result.error || 'Failed to mark complete');
    }
  };

  const handleSkip = async (accountId: string, reason: string) => {
    const result = await skipChecklistAction(accountId, reason);

    if (result.success) {
      // Remove from checklist
      setChecklistAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
    } else {
      throw new Error(result.error || 'Failed to skip');
    }
  };

  const handleSnooze = () => {
    // Set snooze in localStorage (expires at 6 PM)
    const now = new Date();
    const sixPM = new Date();
    sixPM.setHours(18, 0, 0, 0);

    if (now >= sixPM) {
      sixPM.setDate(sixPM.getDate() + 1);
    }

    localStorage.setItem('warmup_snooze_until', sixPM.toISOString());
    toast.info('Snoozed until 6 PM');
  };

  const handleDismiss = () => {
    // Set dismiss for today
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('warmup_dismissed_date', today);
  };

  return (
    <>
      <WarmupNotificationBanner
        pendingCount={pendingCount}
        overdueCount={overdueCount}
        onViewChecklist={handleViewChecklist}
        onSnooze={handleSnooze}
        onDismiss={handleDismiss}
      />

      <WarmupChecklistModal
        open={showChecklist}
        onOpenChange={setShowChecklist}
        accounts={checklistAccounts}
        onMarkComplete={handleMarkComplete}
        onSkip={handleSkip}
      />
    </>
  );
}
