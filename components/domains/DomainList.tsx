/**
 * Domain List Component
 *
 * Displays user's domains with status, search, and management actions
 * Uses TanStack Query mutations with optimistic updates
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  MoreVertical,
  Trash2,
  Globe,
  Calendar,
  FileText,
  PlayCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DomainStatusBadge } from './DomainStatusBadge';
import { WarmupStatusBadge } from './WarmupStatusBadge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ViewInstructionsModal } from './ViewInstructionsModal';
import { useDeleteDomain } from '@/lib/hooks/use-domains';
import { useRouter } from 'next/navigation';
import type { Domain } from '@/lib/types/domain';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';

interface DomainWarmupStatus {
  domainId: string;
  status: 'overdue' | 'pending' | 'complete' | 'none';
  pendingCount: number;
  overdueCount: number;
  totalAccounts: number;
}

interface DomainListProps {
  userId: string;
  domains: Domain[];
  warmupStatuses: DomainWarmupStatus[];
  deleteDomainAction: (domainId: string) => Promise<{ success: boolean; error?: string }>;
  verifyNameserversAction?: (domainId: string) => Promise<NameserverVerificationResult>;
}

export function DomainList({
  userId,
  domains,
  warmupStatuses,
  deleteDomainAction,
}: DomainListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Use TanStack Query mutation for delete
  const deleteMutation = useDeleteDomain(userId, deleteDomainAction);

  // Helper to get warmup status for a domain
  const getWarmupStatus = (domainId: string) => {
    return warmupStatuses.find((s) => s.domainId === domainId);
  };

  const handleViewDetails = (domainId: string) => {
    router.push(`/domains/${domainId}`);
  };

  const filteredDomains = domains.filter((domain) =>
    domain.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (domainId: string) => {
    deleteMutation.mutate(domainId);
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Empty state
  if (domains.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-primary/10 p-6 mb-4">
            <Globe className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No domains yet
          </h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Click &quot;Start Setup Wizard&quot; above to set up your first domain with
            guided steps for DNS configuration, email account creation, and Smartlead
            integration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search domains..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Domain list */}
      <div className="space-y-3">
        {filteredDomains.map((domain) => (
          <Card key={domain.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                {/* Domain info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {domain.domain}
                    </h3>
                    <DomainStatusBadge status={domain.verificationStatus} />
                    {(() => {
                      const warmupStatus = getWarmupStatus(domain.id);
                      if (warmupStatus && warmupStatus.status !== 'none') {
                        return (
                          <WarmupStatusBadge
                            status={warmupStatus.status}
                            count={warmupStatus.status === 'overdue' ? warmupStatus.overdueCount : warmupStatus.pendingCount}
                          />
                        );
                      }
                      return null;
                    })()}
                    {!domain.isActive && (
                      <Badge variant="outline" className="text-gray-400">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span className="capitalize">{domain.provider}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Added {formatDate(domain.createdAt)}</span>
                    </div>
                    {domain.lastVerifiedAt && (
                      <div className="flex items-center gap-1">
                        <span>Verified {formatDate(domain.lastVerifiedAt)}</span>
                      </div>
                    )}
                  </div>

                  {domain.notes && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {domain.notes}
                    </p>
                  )}
                </div>

                {/* Actions menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-4"
                      disabled={deleteMutation.isPending}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewDetails(domain.id)}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <ViewInstructionsModal domain={domain}>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Setup Instructions
                      </DropdownMenuItem>
                    </ViewInstructionsModal>

                    <DropdownMenuSeparator />

                    <ConfirmDialog
                      trigger={
                        <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-red-400 focus:text-red-400 w-full">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Domain
                        </div>
                      }
                      title="Delete Domain"
                      description={`Are you sure you want to delete ${domain.domain}? This will remove all associated DNS records and email configurations. This action cannot be undone.`}
                      confirmText="Delete Domain"
                      onConfirm={() => handleDelete(domain.id)}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No results */}
      {filteredDomains.length === 0 && searchQuery && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No domains found
            </h3>
            <p className="text-muted-foreground text-center">
              No domains match &quot;{searchQuery}&quot;
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
