/**
 * Warmup Status Badge Component
 *
 * Shows warmup checklist status for a domain
 * 🔴 Overdue | 🟡 Pending | 🟢 Complete | ⚪ No connection
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Minus } from 'lucide-react';

export type WarmupStatus = 'overdue' | 'pending' | 'complete' | 'none';

interface WarmupStatusBadgeProps {
  status: WarmupStatus;
  count?: number; // Number of accounts needing attention
}

export function WarmupStatusBadge({ status, count }: WarmupStatusBadgeProps) {
  switch (status) {
    case 'overdue':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {count ? `${count} overdue` : 'Overdue'}
        </Badge>
      );

    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
          <Clock className="h-3 w-3" />
          {count ? `${count} pending` : 'Pending'}
        </Badge>
      );

    case 'complete':
      return (
        <Badge variant="default" className="gap-1 bg-green-500/20 text-green-500 border-green-500/30">
          <CheckCircle2 className="h-3 w-3" />
          Complete
        </Badge>
      );

    case 'none':
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Minus className="h-3 w-3" />
          No warmup
        </Badge>
      );
  }
}
