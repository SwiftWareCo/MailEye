/**
 * Email Accounts Tab Component
 *
 * Shows provisioned Google Workspace email accounts and credentials
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { LockedTabContent } from '../LockedTabContent';
import { EmailAccountCreationModal } from '../EmailAccountCreationModal';
import type { DomainDetails } from '@/lib/types/domain-details';

interface EmailAccountsTabProps {
  details: DomainDetails;
  onCreateAccount?: (
    emailPrefix: string,
    displayName: string,
    count?: number
  ) => Promise<{ success: boolean; error?: string; accounts?: unknown[] }>;
  onNavigateToTab?: (tab: string) => void;
}

export function EmailAccountsTab({
  details,
  onCreateAccount,
  onNavigateToTab,
}: EmailAccountsTabProps) {
  const { domain, emailAccounts, setupStatus } = details;
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check if tab should be locked
  const isLocked = !setupStatus.dns.isComplete || !setupStatus.dns.nameserversVerified;

  // If locked, show locked content
  if (isLocked) {
    const prerequisites = [];
    if (!setupStatus.dns.nameserversVerified) {
      prerequisites.push('Verify your domain\'s nameservers in the DNS tab');
    }
    if (!setupStatus.dns.isComplete) {
      prerequisites.push('Configure all required DNS records (SPF, DMARC, MX minimum)');
    }

    return (
      <LockedTabContent
        title="Email Accounts Locked"
        description="Complete DNS setup before creating email accounts. Email accounts require properly configured DNS records to function correctly."
        prerequisites={prerequisites}
        onNavigateToTab={onNavigateToTab}
        unlockTab="dns"
      />
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'warming':
        return <Badge variant="secondary">Warming</Badge>;
      case 'inactive':
        return <Badge variant="outline">Inactive</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReputationBadge = (score: string | null) => {
    if (!score) return <Badge variant="outline">Unknown</Badge>;

    switch (score.toLowerCase()) {
      case 'excellent':
        return <Badge variant="default" className="bg-green-500">Excellent</Badge>;
      case 'good':
        return <Badge variant="default">Good</Badge>;
      case 'fair':
        return <Badge variant="secondary">Fair</Badge>;
      case 'poor':
        return <Badge variant="destructive">Poor</Badge>;
      default:
        return <Badge variant="outline">{score}</Badge>;
    }
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Accounts Summary
            </CardTitle>
            {setupStatus.dns.isComplete && onCreateAccount && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Accounts</p>
              <p className="text-2xl font-bold">{setupStatus.emailAccounts.accountCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">
                {emailAccounts.filter((a) => a.status === 'active').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Warming</p>
              <p className="text-2xl font-bold">
                {emailAccounts.filter((a) => a.status === 'warming').length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites Check */}
      {!setupStatus.dns.isComplete && (
        <Card className="border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-500">
                  DNS Configuration Required
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete DNS setup before creating email accounts. Navigate to the DNS tab to configure required records.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Accounts Table */}
      {emailAccounts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reputation</TableHead>
                    <TableHead>Warmup Progress</TableHead>
                    <TableHead>Smartlead</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-sm">
                        {account.email}
                      </TableCell>
                      <TableCell>{account.displayName || '-'}</TableCell>
                      <TableCell>{getStatusBadge(account.status)}</TableCell>
                      <TableCell>{getReputationBadge(account.reputationScore)}</TableCell>
                      <TableCell>
                        {account.warmupStatus === 'completed' ? (
                          <div className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">Complete</span>
                          </div>
                        ) : account.warmupStatus === 'in_progress' ? (
                          <div className="flex items-center gap-1 text-yellow-500">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">
                              Day {account.warmupDayCount || 0}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Not started
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.smartleadAccountId ? (
                          <Badge variant="default" className="text-xs">
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Not connected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <Mail className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              No email accounts yet
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {setupStatus.dns.isComplete
                ? 'Create email accounts to start sending cold emails. Each account will be provisioned in Google Workspace.'
                : 'Complete DNS setup first, then you can create email accounts.'}
            </p>
            {setupStatus.dns.isComplete && onCreateAccount && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Account
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Account Creation Modal */}
      {onCreateAccount && (
        <EmailAccountCreationModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          domainName={domain.domain}
          createEmailAccountAction={onCreateAccount}
        />
      )}
    </div>
  );
}
