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
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DomainStatusBadge } from './DomainStatusBadge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ViewInstructionsModal } from './ViewInstructionsModal';
import { useDeleteDomain } from '@/lib/hooks/use-domains';
import type { Domain } from '@/lib/types/domain';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';

interface DomainListProps {
  userId: string;
  domains: Domain[];
  deleteDomainAction: (domainId: string) => Promise<{ success: boolean; error?: string }>;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;
}

export function DomainList({
  userId,
  domains,
  deleteDomainAction,
  verifyNameserversAction,
}: DomainListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, { success: boolean; message: string; isVerified: boolean }>>({});

  // Use TanStack Query mutation for delete
  const deleteMutation = useDeleteDomain(userId, deleteDomainAction);

  const handleVerifyNameservers = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const result = await verifyNameserversAction(domainId);
      setVerificationResults(prev => ({
        ...prev,
        [domainId]: {
          success: result.success,
          message: result.message,
          isVerified: result.isVerified,
        },
      }));

      // Refresh page after successful verification to update domain status
      if (result.isVerified) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResults(prev => ({
        ...prev,
        [domainId]: {
          success: false,
          message: 'Failed to verify nameservers',
          isVerified: false,
        },
      }));
    } finally {
      setVerifyingDomainId(null);
    }
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
            Connect your first domain to start setting up email infrastructure,
            authentication, and cold email campaigns.
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

      {/* Domain stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-white">
              {domains.length}
            </div>
            <div className="text-sm text-muted-foreground">Total Domains</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {domains.filter((d) => d.verificationStatus === 'verified').length}
            </div>
            <div className="text-sm text-muted-foreground">Verified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">
              {
                domains.filter(
                  (d) =>
                    d.verificationStatus === 'pending' ||
                    d.verificationStatus === 'pending_nameservers' ||
                    d.verificationStatus === 'verifying'
                ).length
              }
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
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

                  {/* Verification Status Message */}
                  {verificationResults[domain.id] ? (
                    <div className={`mt-3 flex items-center gap-2 text-sm ${
                      verificationResults[domain.id].isVerified
                        ? 'text-green-500'
                        : 'text-yellow-500'
                    }`}>
                      {verificationResults[domain.id].isVerified ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{verificationResults[domain.id].message}</span>
                    </div>
                  ) : domain.verificationStatus === 'pending_nameservers' && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      <span>Waiting for nameserver propagation (can take up to 48 hours)</span>
                    </div>
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
                    {/* Check Nameservers - only for pending_nameservers status */}
                    {domain.verificationStatus === 'pending_nameservers' && (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleVerifyNameservers(domain.id)}
                          disabled={verifyingDomainId === domain.id}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${verifyingDomainId === domain.id ? 'animate-spin' : ''}`} />
                          {verifyingDomainId === domain.id ? 'Checking...' : 'Check Nameservers'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}

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
