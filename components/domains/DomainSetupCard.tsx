/**
 * Domain Setup Card Component
 *
 * Compact progress display for domain setup status on domains list
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { SetupCompletionStatus } from '@/lib/types/domain-details';

interface DomainSetupCardProps {
  setupStatus: SetupCompletionStatus;
  compact?: boolean;
}

export function DomainSetupCard({
  setupStatus,
  compact = true,
}: DomainSetupCardProps) {
  const { completionPercentage, pendingTasks } = setupStatus.overview;
  const isComplete = completionPercentage === 100;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Setup Progress
          </span>
          <span className="text-xs font-semibold">
            {completionPercentage}%
          </span>
        </div>
        <Progress value={completionPercentage} className="h-1.5" />
        {isComplete && (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-green-600">Setup Complete</span>
          </div>
        )}
        {!isComplete && pendingTasks.length > 0 && (
          <div className="flex items-start gap-1">
            <Clock className="h-3.5 w-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-yellow-600">
              {pendingTasks.length} pending
            </span>
          </div>
        )}
      </div>
    );
  }

  // Full view (for domain list item)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Setup Progress</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{completionPercentage}%</span>
          {isComplete && (
            <Badge variant="default" className="text-xs bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
          {!isComplete && completionPercentage >= 50 && (
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              In Progress
            </Badge>
          )}
          {completionPercentage < 50 && (
            <Badge variant="outline" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Started
            </Badge>
          )}
        </div>
      </div>

      <Progress value={completionPercentage} className="h-2" />

      {pendingTasks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Pending Tasks:
          </p>
          <ul className="space-y-0.5">
            {pendingTasks.slice(0, 3).map((task, idx) => (
              <li key={idx} className="text-xs text-muted-foreground">
                • {task}
              </li>
            ))}
            {pendingTasks.length > 3 && (
              <li className="text-xs text-muted-foreground">
                • +{pendingTasks.length - 3} more tasks
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
