/**
 * Warmup Tab Component
 *
 * Shows Smartlead connection status and warmup progress for email accounts
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Flame,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { LockedTabContent } from '../LockedTabContent';
import { SmartleadOAuthGuide } from '@/components/warmup/SmartleadOAuthGuide';
import { getEmailAccountPasswordAction } from '@/server/email/email.actions';
import type { DomainDetails } from '@/lib/types/domain-details';

interface WarmupTabProps {
  details: DomainDetails;
  onConnectToSmartlead?: (emailAccountId: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onRefresh?: () => void;
}

export function WarmupTab({
  details,
  onNavigateToTab,
  onRefresh,
}: WarmupTabProps) {
  const { emailAccounts, setupStatus } = details;
  const router = useRouter();
  const [oauthGuideOpen, setOauthGuideOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string>('');
  const [selectedAccountPassword, setSelectedAccountPassword] = useState<string>('');

  // Check if tab should be locked
  const isLocked = setupStatus.emailAccounts.accountCount === 0;

  // If locked, show locked content
  if (isLocked) {
    return (
      <LockedTabContent
        title="Warmup Locked"
        description="Create at least one email account before configuring warmup. Email warmup requires active email accounts to build sender reputation."
        prerequisites={[
          'Complete DNS setup (SPF, DMARC, MX records minimum)',
          'Create at least one email account in the Email Accounts tab',
          'Connect to Smartlead in the Domains page (optional)',
        ]}
        onNavigateToTab={onNavigateToTab}
        unlockTab="email"
      />
    );
  }

  const getWarmupStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      case 'not_started':
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const calculateWarmupProgress = (dayCount: number | null): number => {
    if (!dayCount) return 0;
    // Typical warmup is 30 days
    return Math.min((dayCount / 30) * 100, 100);
  };

  const handleOpenOAuthGuide = async (accountId: string, email: string) => {
    setSelectedAccountId(accountId);
    setSelectedAccountEmail(email);

    // Fetch password for this account
    const result = await getEmailAccountPasswordAction(accountId);

    if (result.success && result.password) {
      setSelectedAccountPassword(result.password);
      setOauthGuideOpen(true);
    } else {
      toast.error('Failed to load account details', {
        description: result.error || 'Could not retrieve password',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Warmup Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Connected</p>
              <p className="text-2xl font-bold">
                {setupStatus.warmup.accountsConnected}/{setupStatus.warmup.accountsTotal}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">
                {setupStatus.warmup.warmupInProgress}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">
                {setupStatus.warmup.warmupCompleted}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Smartlead</p>
              <div className="flex items-center gap-2">
                {setupStatus.warmup.smartleadConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Not connected
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites Check */}
      {emailAccounts.length === 0 && (
        <Card className="border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-500">
                  Email Accounts Required
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create email accounts first before configuring warmup. Navigate to the Email Accounts tab to get started.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warmup Progress Table */}
      {emailAccounts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Account Warmup Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Daily Limit</TableHead>
                    <TableHead>Reputation</TableHead>
                    <TableHead>Smartlead</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-sm">
                        {account.email}
                      </TableCell>
                      <TableCell>
                        {getWarmupStatusBadge(account.warmupStatus)}
                      </TableCell>
                      <TableCell>
                        {account.warmupStatus === 'in_progress' ||
                        account.warmupStatus === 'completed' ? (
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex items-center justify-between text-xs">
                              <span>Day {account.warmupDayCount || 0}/30</span>
                              <span>
                                {Math.round(
                                  calculateWarmupProgress(account.warmupDayCount)
                                )}
                                %
                              </span>
                            </div>
                            <Progress
                              value={calculateWarmupProgress(account.warmupDayCount)}
                              className="h-1.5"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.dailyEmailLimit ? (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-sm">{account.dailyEmailLimit}/day</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.deliverabilityScore !== null ? (
                          <div className="space-y-1 min-w-[80px]">
                            <div className="flex items-center justify-between text-xs">
                              <span>{account.deliverabilityScore}/100</span>
                            </div>
                            <Progress
                              value={account.deliverabilityScore}
                              className="h-1.5"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.smartleadAccountId ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Not connected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!account.smartleadAccountId ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenOAuthGuide(account.id, account.email)}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Setup Warmup
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/email-accounts/${account.id}`)}
                          >
                            View Metrics
                          </Button>
                        )}
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
              <Flame className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              No warmup configured yet
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              Create email accounts first, then connect them to Smartlead for automated warmup.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Warmup Info Card */}
      <Card className="border-blue-500/50">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Flame className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-400">
                About Email Warmup
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Email warmup gradually increases your sending volume over 30 days to build sender reputation.
                Smartlead automates this process by sending emails between your accounts and responding naturally.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smartlead OAuth Guide Modal */}
      <SmartleadOAuthGuide
        open={oauthGuideOpen}
        onOpenChange={setOauthGuideOpen}
        email={selectedAccountEmail}
        password={selectedAccountPassword}
        emailAccountId={selectedAccountId}
        onSyncSuccess={onRefresh}
      />
    </div>
  );
}
