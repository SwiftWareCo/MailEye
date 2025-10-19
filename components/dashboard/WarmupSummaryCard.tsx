/**
 * Warmup Summary Card
 *
 * Dashboard widget showing daily warmup checklist status
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flame, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { getUserWarmupSummary } from '@/server/warmup/warmup.data';
import { getWarmupChecklistStatus } from '@/server/warmup/checklist.actions';

interface WarmupSummaryCardProps {
  userId: string;
}

export async function WarmupSummaryCard({ userId }: WarmupSummaryCardProps) {
  const summary = await getUserWarmupSummary(userId);
  const checklistStatus = await getWarmupChecklistStatus();

  if (summary.totalAccounts === 0) {
    return null; // No warmup accounts yet
  }

  const accounts = checklistStatus.success ? checklistStatus.accounts : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5" />
          Daily Warmup Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {summary.totalOverdue > 0 ? (
                <span className="text-red-500 font-medium">
                  {summary.totalOverdue} overdue
                </span>
              ) : summary.totalPending > 0 ? (
                <span className="text-yellow-500 font-medium">
                  {summary.totalPending} pending
                </span>
              ) : (
                <span className="text-green-500 font-medium">All complete ✓</span>
              )}
            </p>
            {summary.totalAccounts > 0 && (
              <Badge variant="outline">{summary.totalAccounts} accounts warming</Badge>
            )}
          </div>

          {/* Account List */}
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.slice(0, 3).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-2 rounded-md border"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{account.email}</span>
                    <Badge variant="outline" className="text-xs">
                      Day {account.warmupDay}
                    </Badge>
                  </div>
                  {account.isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              ))}
              {accounts.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{accounts.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm font-medium">All checks complete!</p>
              <p className="text-xs text-muted-foreground mt-1">
                No pending warmup tasks for today
              </p>
            </div>
          )}

          {/* Action Button */}
          {accounts.length > 0 && (
            <Button className="w-full" asChild>
              <Link href="/domains">Complete Checklist</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
