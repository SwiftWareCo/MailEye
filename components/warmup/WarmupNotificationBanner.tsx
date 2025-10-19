/**
 * Warmup Notification Banner
 *
 * Top-level persistent banner that shows when warmup checklists need attention
 * Appears on all pages to ensure users never miss their daily manual checks (Days 1-7)
 */

'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, X, Clock } from 'lucide-react';

interface WarmupNotificationBannerProps {
  pendingCount: number;
  overdueCount: number;
  onViewChecklist: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

export function WarmupNotificationBanner({
  pendingCount,
  overdueCount,
  onViewChecklist,
  onSnooze,
  onDismiss,
}: WarmupNotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Don't show if no pending accounts or banner was dismissed
  if (!isVisible || (pendingCount === 0 && overdueCount === 0)) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  const handleSnooze = () => {
    setIsVisible(false);
    onSnooze();
  };

  // Determine urgency level
  const isUrgent = overdueCount > 0;
  const variant = isUrgent ? 'destructive' : 'default';

  return (
    <Alert
      variant={variant}
      className="relative border-l-4 rounded-none"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          {isUrgent ? (
            <span>
              <strong className="font-semibold">
                ⚠️ {overdueCount} email account{overdueCount > 1 ? 's' : ''} overdue
              </strong>{' '}
              - Manual warmup checks missed. Complete them now to maintain sender reputation.
            </span>
          ) : (
            <span>
              <strong className="font-semibold">
                {pendingCount} email account{pendingCount > 1 ? 's need' : ' needs'} manual warmup checks
              </strong>{' '}
              - Complete your daily tasks to ensure optimal deliverability (Days 1-7).
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isUrgent ? 'secondary' : 'outline'}
            onClick={onViewChecklist}
          >
            View Checklist
          </Button>

          {!isUrgent && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSnooze}
              className="gap-1"
            >
              <Clock className="h-3 w-3" />
              Snooze until 6 PM
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
