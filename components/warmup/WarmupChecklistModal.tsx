/**
 * Warmup Checklist Modal
 *
 * Displays daily manual warmup checklist for email accounts (Days 1-7)
 * Shows all pending accounts with their 5-task checklist
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface EmailAccountChecklist {
  id: string;
  email: string;
  warmupDay: number;
  tasks: ChecklistTask[];
  lastCompletedAt: Date | null;
}

interface ChecklistTask {
  id: string;
  description: string;
  completed: boolean;
}

interface WarmupChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: EmailAccountChecklist[];
  onMarkComplete: (accountId: string) => Promise<void>;
  onSkip?: (accountId: string, reason: string) => Promise<void>;
}

// Core daily tasks (Days 1-7)
// Simplified to focus on verification - Smartlead automates reply/interaction
const DEFAULT_TASKS: Omit<ChecklistTask, 'completed'>[] = [
  {
    id: 'task-1',
    description: 'Open Gmail inbox',
  },
  {
    id: 'task-2',
    description: 'Verify warmup emails arrived in inbox (not spam folder)',
  },
  {
    id: 'task-3',
    description: 'Check for any delivery issues or warnings',
  },
];

// Additional task for Days 1-2 only (one-time setup)
const getTasksForDay = (warmupDay: number): Omit<ChecklistTask, 'completed'>[] => {
  const tasks = [...DEFAULT_TASKS];

  // Add one-time task for first 2 days
  if (warmupDay <= 2) {
    tasks.push({
      id: 'task-first-time',
      description: 'Mark Smartlead warmup emails as safe/not spam (one-time setup)',
    });
  }

  return tasks;
};

export function WarmupChecklistModal({
  open,
  onOpenChange,
  accounts,
  onMarkComplete,
}: WarmupChecklistModalProps) {
  const [taskStates, setTaskStates] = useState<Record<string, Record<string, boolean>>>({});
  const [loadingAccounts, setLoadingAccounts] = useState<Set<string>>(new Set());

  const handleTaskToggle = (accountId: string, taskId: string) => {
    setTaskStates((prev) => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] || {}),
        [taskId]: !(prev[accountId]?.[taskId] || false),
      },
    }));
  };

  const areAllTasksComplete = (accountId: string, warmupDay: number): boolean => {
    const accountTasks = taskStates[accountId] || {};
    const tasksForDay = getTasksForDay(warmupDay);
    return tasksForDay.every((task) => accountTasks[task.id] === true);
  };

  const handleMarkComplete = async (accountId: string, warmupDay: number) => {
    if (!areAllTasksComplete(accountId, warmupDay)) {
      toast.error('Complete all tasks first', {
        description: 'Please check all tasks before marking as complete.',
      });
      return;
    }

    setLoadingAccounts((prev) => new Set(prev).add(accountId));

    try {
      await onMarkComplete(accountId);
      toast.success('Checklist completed', {
        description: 'Great job! This account is done for today.',
      });

      // Reset tasks for this account
      setTaskStates((prev) => {
        const newState = { ...prev };
        delete newState[accountId];
        return newState;
      });
    } catch (error) {
      toast.error('Failed to save completion', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setLoadingAccounts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  };

  const handleOpenGmail = (email: string) => {
    window.open(`https://mail.google.com/mail/u/${email}`, '_blank');
  };

  const getCompletedCount = () => {
    return accounts.filter((account) => areAllTasksComplete(account.id, account.warmupDay)).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Daily Warmup Checklist</DialogTitle>
          <DialogDescription>
            Quick verification tasks for optimal deliverability (Days 1-7). Smartlead handles automated warmup emails and replies.
            {accounts.length > 0 && (
              <span className="ml-2">
                • {getCompletedCount()}/{accounts.length} completed
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">All checklists complete!</p>
                <p className="text-sm mt-1">No pending warmup tasks for today.</p>
              </div>
            ) : (
              accounts.map((account) => {
                const tasksForDay = getTasksForDay(account.warmupDay);
                const isComplete = areAllTasksComplete(account.id, account.warmupDay);
                const isLoading = loadingAccounts.has(account.id);

                return (
                  <div
                    key={account.id}
                    className="border rounded-lg p-4 space-y-4"
                  >
                    {/* Account Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-medium">{account.email}</h3>
                          <Badge variant="outline" className="text-xs">
                            Day {account.warmupDay}/30
                          </Badge>
                          {isComplete && (
                            <Badge className="text-xs bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          )}
                        </div>
                        {account.lastCompletedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last completed: {new Date(account.lastCompletedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenGmail(account.email)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open Gmail
                      </Button>
                    </div>

                    {/* Task Checklist */}
                    <div className="space-y-2">
                      {tasksForDay.map((task) => {
                        const checked = taskStates[account.id]?.[task.id] || false;

                        return (
                          <div
                            key={task.id}
                            className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50"
                          >
                            <Checkbox
                              id={`${account.id}-${task.id}`}
                              checked={checked}
                              onCheckedChange={() => handleTaskToggle(account.id, task.id)}
                            />
                            <label
                              htmlFor={`${account.id}-${task.id}`}
                              className={`flex-1 text-sm cursor-pointer ${
                                checked ? 'line-through text-muted-foreground' : ''
                              }`}
                            >
                              {task.description}
                            </label>
                            {checked ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleMarkComplete(account.id, account.warmupDay)}
                        disabled={!isComplete || isLoading}
                        className="flex-1"
                      >
                        {isLoading ? 'Saving...' : 'Mark Complete'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement skip with reason dialog
                          toast.info('Skip functionality coming soon');
                        }}
                        disabled={isLoading}
                      >
                        Skip Today
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {accounts.length > 0 && (
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 Tip: Quick daily checks help ensure warmup runs smoothly. Smartlead automates the heavy lifting!
            </p>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
