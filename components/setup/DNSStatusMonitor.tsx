/**
 * DNS Status Monitor Component (Task 7.4)
 *
 * Real-time DNS propagation status display for Setup Wizard Step 4
 * Polls DNS propagation status every 30 seconds and displays:
 * - Overall propagation progress
 * - Individual DNS record statuses (SPF, DKIM, DMARC, MX, Tracking)
 * - ETA for completion
 * - Manual "Check Now" trigger
 */

'use client';

import { useState } from 'react';
import { AlertCircle, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DNSRecordStatus } from './DNSRecordStatus';
import { useDNSStatus } from '@/lib/hooks/use-dns-status';
import { cn } from '@/lib/utils';

interface DNSStatusMonitorProps {
  /** Polling session ID from DNS setup */
  pollingSessionId: string;

  /** Domain being monitored */
  domain: string;

  /** Callback when DNS is fully propagated */
  onComplete?: () => void;

  /** Show detailed record information */
  showDetails?: boolean;
}

/**
 * Format milliseconds into human-readable time
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Completing...';

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return 'Less than 1 minute';
}

/**
 * Get progress status display
 */
function getProgressStatus(progress: number, isComplete: boolean) {
  if (isComplete) {
    return {
      icon: CheckCircle2,
      color: 'text-green-500',
      label: 'Complete',
      description: 'All DNS records have propagated successfully',
    };
  }

  if (progress >= 75) {
    return {
      icon: Clock,
      color: 'text-primary',
      label: 'Nearly Complete',
      description: 'DNS records are propagating across global servers',
    };
  }

  if (progress >= 25) {
    return {
      icon: RefreshCw,
      color: 'text-yellow-500',
      label: 'In Progress',
      description: 'DNS records are propagating. This typically takes 5-15 minutes.',
    };
  }

  return {
    icon: Clock,
    color: 'text-muted-foreground',
    label: 'Starting',
    description: 'DNS propagation is beginning. Please wait...',
  };
}

export function DNSStatusMonitor({
  pollingSessionId,
  domain,
  onComplete,
  showDetails = true,
}: DNSStatusMonitorProps) {
  const [isManualChecking, setIsManualChecking] = useState(false);

  // TanStack Query hook for DNS status polling (30-second intervals)
  const { data, isLoading, error, refetch } = useDNSStatus(pollingSessionId, {
    onComplete,
  });

  // Handle manual "Check Now" button
  const handleManualCheck = async () => {
    setIsManualChecking(true);
    await refetch();
    // Keep button disabled for 2 seconds to prevent spam
    setTimeout(() => setIsManualChecking(false), 2000);
  };

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="space-y-4 py-6">
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading DNS status...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4 py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to Load DNS Status</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </AlertDescription>
        </Alert>
        <Button onClick={handleManualCheck} variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { progress, eta, status, isComplete, records } = data;
  const progressStatus = getProgressStatus(progress.overallProgress, isComplete);
  const ProgressIcon = progressStatus.icon;

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">DNS Propagation Status</h3>
        <p className="text-sm text-muted-foreground">
          Monitoring DNS records for <span className="font-medium">{domain}</span>
        </p>
      </div>

      {/* Overall Progress Card */}
      <div className="p-4 rounded-lg border bg-card space-y-4">
        {/* Status Icon and Label */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-full',
              isComplete ? 'bg-green-500/10' : 'bg-primary/10'
            )}
          >
            <ProgressIcon
              className={cn('h-6 w-6', progressStatus.color, !isComplete && 'animate-spin')}
            />
          </div>
          <div className="flex-1">
            <div className="font-medium">{progressStatus.label}</div>
            <div className="text-xs text-muted-foreground">{progressStatus.description}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progress.overallProgress}%</span>
          </div>
          <Progress value={progress.overallProgress} className="h-2" />
        </div>

        {/* Progress Summary */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{progress.fullyPropagated}</div>
            <div className="text-xs text-muted-foreground">Propagated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {progress.partiallyPropagated}
            </div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {progress.notPropagated}
            </div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>

        {/* ETA Display */}
        {!isComplete && eta.estimatedCompletionTime && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
            <span className="text-sm text-muted-foreground">Estimated Time Remaining</span>
            <span className="text-sm font-medium">
              {formatTimeRemaining(eta.timeRemaining)}
            </span>
          </div>
        )}
      </div>

      {/* Individual DNS Record Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">DNS Records</h4>
          <Button
            onClick={handleManualCheck}
            disabled={isManualChecking || isComplete}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={cn('h-3 w-3 mr-2', isManualChecking && 'animate-spin')}
            />
            Check Now
          </Button>
        </div>

        {/* Record Status Cards */}
        <div className="space-y-2">
          {records.map((record) => (
            <DNSRecordStatus
              key={record.id}
              record={record}
              showDetails={showDetails}
            />
          ))}
        </div>
      </div>

      {/* Session Status Info */}
      {(status === 'timeout' || status === 'cancelled') && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {status === 'timeout' ? 'Polling Timeout' : 'Polling Cancelled'}
          </AlertTitle>
          <AlertDescription>
            {status === 'timeout'
              ? 'DNS propagation is taking longer than expected. Records may still propagate.'
              : 'DNS monitoring was cancelled. You can manually verify DNS records.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Completion Message */}
      {isComplete && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle>DNS Propagation Complete!</AlertTitle>
          <AlertDescription>
            All DNS records have been verified and propagated successfully. Your domain is
            ready for email sending.
          </AlertDescription>
        </Alert>
      )}

      {/* Auto-advance notice */}
      {isComplete && onComplete && (
        <p className="text-center text-sm text-muted-foreground">
          Advancing to next step in 2 seconds...
        </p>
      )}
    </div>
  );
}
