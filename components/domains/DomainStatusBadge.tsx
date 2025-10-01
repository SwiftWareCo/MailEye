/**
 * Domain Status Badge Component
 *
 * Displays visual status indicator for domain verification states
 */

import { Badge } from '@/components/ui/badge';

interface DomainStatusBadgeProps {
  status: string;
  className?: string;
}

export function DomainStatusBadge({
  status,
  className,
}: DomainStatusBadgeProps) {
  const getStatusConfig = (
    status: string
  ): {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    color: string;
  } => {
    switch (status) {
      case 'verified':
        return {
          label: 'Verified',
          variant: 'default',
          color: 'bg-green-500/10 text-green-500 border-green-500/20',
        };
      case 'verifying':
        return {
          label: 'Verifying',
          variant: 'secondary',
          color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        };
      case 'pending_nameservers':
        return {
          label: 'Pending Setup',
          variant: 'secondary',
          color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        };
      case 'pending':
        return {
          label: 'Pending',
          variant: 'secondary',
          color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        };
      case 'failed':
        return {
          label: 'Failed',
          variant: 'destructive',
          color: 'bg-red-500/10 text-red-500 border-red-500/20',
        };
      default:
        return {
          label: 'Unknown',
          variant: 'outline',
          color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge
      variant={config.variant}
      className={`${config.color} ${className || ''}`}
    >
      {config.label}
    </Badge>
  );
}
