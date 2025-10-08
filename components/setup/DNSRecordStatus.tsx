/**
 * DNS Record Status Component
 *
 * Individual DNS record status card showing propagation progress
 * Used in DNSStatusMonitor to display status of SPF, DKIM, DMARC, MX, and CNAME records
 */

'use client';

import { CheckCircle, Clock, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { DNSRecordStatus as DNSRecordStatusType } from '@/server/dns/dns-status.data';

interface DNSRecordStatusProps {
  record: DNSRecordStatusType;
  showDetails?: boolean;
}

/**
 * Get color scheme for record type badge
 */
function getRecordTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
  if (type === 'TXT') return 'default';
  if (type === 'MX') return 'secondary';
  return 'outline';
}

/**
 * Get status icon and color
 */
function getStatusDisplay(status: string | null) {
  switch (status) {
    case 'propagated':
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        label: 'Propagated',
      };
    case 'propagating':
      return {
        icon: Loader2,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        label: 'Propagating',
        animate: true,
      };
    case 'pending':
    case 'unknown':
    default:
      return {
        icon: Clock,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        label: 'Pending',
      };
  }
}

/**
 * Truncate DNS record value for display
 */
function truncateValue(value: string, maxLength = 50): string {
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength)}...`;
}

/**
 * Get human-readable name for DNS record
 */
function getRecordName(record: DNSRecordStatusType): string {
  const name = record.name || '';

  // Extract meaningful names from DNS records
  if (name.includes('_dmarc')) return 'DMARC';
  if (name.includes('google._domainkey')) return 'DKIM (Google)';
  if (name === '@' || name === record.name) {
    // Root domain records
    if (record.type === 'TXT') {
      if (record.content?.includes('v=spf1')) return 'SPF';
      if (record.content?.includes('v=DMARC1')) return 'DMARC';
    }
    if (record.type === 'MX') return 'MX (Google)';
  }

  // Tracking domain
  if (name.includes('emailtracking') || name.includes('track')) {
    return 'Email Tracking';
  }

  return name || 'DNS Record';
}

export function DNSRecordStatus({ record, showDetails = false }: DNSRecordStatusProps) {
  const status = getStatusDisplay(record.propagationStatus);
  const StatusIcon = status.icon;
  const recordName = getRecordName(record);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        status.bgColor
      )}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <StatusIcon
          className={cn('h-5 w-5', status.color, status.animate && 'animate-spin')}
        />
      </div>

      {/* Record Details */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Record Name and Type Badge */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{recordName}</span>
          <Badge variant={getRecordTypeBadgeVariant(record.type)} className="text-xs">
            {record.type}
          </Badge>
        </div>

        {/* Status Label */}
        <div className={cn('text-xs', status.color)}>{status.label}</div>

        {/* Record Value (with tooltip for full value) */}
        {showDetails && record.content && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono cursor-help">
                  <span className="truncate">{truncateValue(record.content, 40)}</span>
                  {record.content.length > 40 && (
                    <Info className="h-3 w-3 flex-shrink-0" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md break-all">
                <p className="text-xs font-mono">{record.content}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Propagation Coverage */}
        {record.propagationCoverage !== null && record.propagationCoverage !== undefined && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  record.propagationCoverage === 100 ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${record.propagationCoverage}%` }}
              />
            </div>
            <span className="text-xs font-medium">{record.propagationCoverage}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
