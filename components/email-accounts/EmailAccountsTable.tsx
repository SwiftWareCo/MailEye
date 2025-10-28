/**
 * Email Accounts Table Component
 *
 * Unified view showing all email accounts with warmup status, Smartlead connection,
 * and quick actions (setup warmup, view metrics, disconnect)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Eye,
  PlayCircle,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SmartleadOAuthGuide } from '@/components/warmup/SmartleadOAuthGuide';
import { disconnectSmartleadAccountAction } from '@/server/smartlead/sync.actions';
import { getDecryptedPasswordAction } from '@/server/email/email.actions';
import type { EmailAccountInfo } from '@/lib/types/domain-details';

interface EmailAccountsTableProps {
  emailAccounts: EmailAccountInfo[];
  onRefresh?: () => void;
}

export function EmailAccountsTable({ emailAccounts, onRefresh }: EmailAccountsTableProps) {
  const router = useRouter();
  const [oauthGuideOpen, setOauthGuideOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string>('');
  const [selectedAccountPassword, setSelectedAccountPassword] = useState<string>('');
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleSetupWarmup = async (account: EmailAccountInfo) => {
    setIsLoadingPassword(true);
    try {
      // Fetch decrypted password for OAuth guide
      const result = await getDecryptedPasswordAction(account.id);

      if (result.success && result.password) {
        setSelectedAccountId(account.id);
        setSelectedAccountEmail(account.email);
        setSelectedAccountPassword(result.password);
        setOauthGuideOpen(true);
      } else {
        toast.error('Failed to retrieve password', {
          description: result.error || 'Unable to open setup guide',
        });
      }
    } catch (error) {
      console.error('Failed to fetch password:', error);
      toast.error('An error occurred', {
        description: 'Unable to retrieve account credentials',
      });
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const handleViewMetrics = (accountId: string) => {
    router.push(`/email-accounts/${accountId}`);
  };

  const handleDisconnect = async (account: EmailAccountInfo) => {
    if (!confirm(`Disconnect ${account.email} from Smartlead? This will stop warmup.`)) {
      return;
    }

    setDisconnectingId(account.id);
    try {
      const result = await disconnectSmartleadAccountAction(account.id);

      if (result.success) {
        toast.success('Disconnected from Smartlead', {
          description: `${account.email} has been disconnected`,
        });
        onRefresh?.();
      } else {
        toast.error('Failed to disconnect', {
          description: result.error || 'Please try again',
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('An error occurred', {
        description: 'Failed to disconnect account',
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const getConnectionBadge = (account: EmailAccountInfo) => {
    if (account.smartleadAccountId) {
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <AlertCircle className="h-3 w-3 mr-1" />
        Not Connected
      </Badge>
    );
  };

  const getWarmupBadge = (account: EmailAccountInfo) => {
    switch (account.warmupStatus) {
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <PlayCircle className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Not Started
          </Badge>
        );
    }
  };

  const getWarmupProgress = (account: EmailAccountInfo) => {
    const dayCount = account.warmupDayCount || 0;
    const maxDays = 30;
    const percentage = Math.min((dayCount / maxDays) * 100, 100);

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Day {dayCount}/{maxDays}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    );
  };

  if (emailAccounts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No email accounts found. Create email accounts first.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email Address</TableHead>
              <TableHead>Smartlead</TableHead>
              <TableHead>Warmup Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Daily Limit</TableHead>
              <TableHead className="text-right">Deliverability</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emailAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">
                  <div>
                    <p>{account.email}</p>
                    {account.displayName && (
                      <p className="text-xs text-muted-foreground">{account.displayName}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getConnectionBadge(account)}</TableCell>
                <TableCell>{getWarmupBadge(account)}</TableCell>
                <TableCell>
                  {account.smartleadAccountId ? (
                    getWarmupProgress(account)
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {account.smartleadAccountId && account.dailyEmailLimit ? (
                    <span className="text-sm">{account.dailyEmailLimit}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {account.smartleadAccountId && account.deliverabilityScore ? (
                    <span className="text-sm font-medium">{account.deliverabilityScore}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!account.smartleadAccountId ? (
                        <DropdownMenuItem
                          onClick={() => handleSetupWarmup(account)}
                          disabled={isLoadingPassword}
                        >
                          {isLoadingPassword ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Setup Warmup
                            </>
                          )}
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => handleViewMetrics(account.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDisconnect(account)}
                            disabled={disconnectingId === account.id}
                            className="text-destructive focus:text-destructive"
                          >
                            {disconnectingId === account.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Disconnecting...
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Disconnect
                              </>
                            )}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Smartlead OAuth Guide Modal */}
      <SmartleadOAuthGuide
        open={oauthGuideOpen}
        onOpenChange={setOauthGuideOpen}
        email={selectedAccountEmail}
        password={selectedAccountPassword}
        emailAccountId={selectedAccountId}
        onSyncSuccess={onRefresh}
      />
    </>
  );
}
