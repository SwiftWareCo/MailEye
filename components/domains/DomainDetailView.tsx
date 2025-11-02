/**
 * Domain Detail View Component
 *
 * Main container for domain details with tabbed interface
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Globe,
  Mail,
  Plus,
} from 'lucide-react';
import { DNSTab } from './tabs/DnsTab';
import { EmailAccountsTable } from '@/components/email-accounts/EmailAccountsTable';
import { EmailAccountCreationModal } from './EmailAccountCreationModal';
import type { DomainDetails, TabBadgeStatus } from '@/lib/types/domain-details';

interface DomainDetailViewProps {
  details: DomainDetails;
  initialTab?: string;
  // Server actions (optional - passed from parent page)
  onVerifyNameservers?: () => void;
  onConfigureEmailDNS?: () => Promise<void>;
  onConfirmManualVerification?: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  onAddDKIMRecord?: (
    hostname: string,
    value: string
  ) => Promise<{ success: boolean; error?: string; recordId?: string }>;
  onCreateDMARCRecord?: () => Promise<{
    success: boolean;
    error?: string;
    hoursRemaining?: number;
    recordId?: string;
  }>;
  onConnectToSmartlead?: (emailAccountId: string) => void;
}

export function DomainDetailView({
  details,
  initialTab = 'dns',
  onVerifyNameservers,
  onConfigureEmailDNS,
  onConfirmManualVerification,
  onAddDKIMRecord,
  onCreateDMARCRecord,
}: DomainDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isCreatingEmail, setIsCreatingEmail] = useState(false);

  const { domain, setupStatus } = details;

  // Handle refresh by invalidating queries instead of reloading page
  const handleRefresh = () => {
    // Invalidate all queries so they refetch when needed
    queryClient.invalidateQueries();
  };

  // Sync active tab with URL when it changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'overview';
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  // Calculate tab badges
  const getTabBadge = (
    tab: string
  ): { status: TabBadgeStatus; label?: string } | null => {
    switch (tab) {
      case 'dns':
        if (setupStatus.dns.isComplete) {
          return { status: 'complete' };
        } else if (setupStatus.dns.missingRecords.length > 0) {
          return {
            status: 'warning',
            label: `${setupStatus.dns.missingRecords.length} missing`,
          };
        } else if (setupStatus.dns.hasZone) {
          return { status: 'in-progress' };
        }
        return { status: 'not-started' };

      case 'email':
        // Combined email accounts + warmup status
        const totalAccounts = setupStatus.emailAccounts.accountCount;
        const connectedAccounts = setupStatus.warmup.accountsConnected;

        if (setupStatus.warmup.isComplete) {
          return { status: 'complete' };
        } else if (connectedAccounts > 0) {
          return {
            status: 'in-progress',
            label: `${connectedAccounts}/${totalAccounts} warmed`,
          };
        } else if (totalAccounts > 0) {
          return {
            status: 'warning',
            label: `${totalAccounts} not connected`,
          };
        }
        return { status: 'not-started' };

      default:
        return null;
    }
  };

  const renderTabBadge = (tab: string) => {
    const badge = getTabBadge(tab);
    if (!badge) return null;

    const getBadgeIcon = (status: TabBadgeStatus) => {
      switch (status) {
        case 'complete':
          return <CheckCircle2 className='h-3 w-3' />;
        case 'in-progress':
          return <Clock className='h-3 w-3' />;
        case 'warning':
          return <AlertCircle className='h-3 w-3' />;
        default:
          return null;
      }
    };

    const getBadgeVariant = (status: TabBadgeStatus) => {
      switch (status) {
        case 'complete':
          return 'default';
        case 'in-progress':
          return 'secondary';
        case 'warning':
          return 'destructive';
        default:
          return 'outline';
      }
    };

    return (
      <Badge variant={getBadgeVariant(badge.status)} className='ml-2 text-xs'>
        {getBadgeIcon(badge.status)}
        {badge.label && <span className='ml-1'>{badge.label}</span>}
      </Badge>
    );
  };

  const handleNavigateToTab = (tab: string) => {
    // Check if tab is locked
    if (isTabLocked(tab)) {
      return; // Don't navigate to locked tabs
    }
    // Update URL without rerendering using History API
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({ tab }, '', url.toString());
  };

  // Determine if a tab is locked based on prerequisites
  const isTabLocked = (tab: string): boolean => {
    switch (tab) {
      case 'dns':
        // DNS tab is always accessible
        return false;
      case 'email':
        // Email tab requires nameservers to be verified AND
        // either manual Google Workspace verification OR DNS records configured
        if (!setupStatus.dns.nameserversVerified) {
          return true;
        }

        // Unlock if user has manually verified in Google Workspace
        if (domain.googleWorkspaceManuallyVerified) {
          return false;
        }

        // Unlock if DNS records are configured (at least DNS setup was attempted)
        if (domain.dnsConfiguredAt) {
          return false;
        }

        return true;
      default:
        return false;
    }
  };

  const getLockedReason = (tab: string): string => {
    switch (tab) {
      case 'email':
        if (!setupStatus.dns.nameserversVerified) {
          return 'Verify nameservers first in the DNS tab';
        }
        if (!domain.googleWorkspaceManuallyVerified && !domain.dnsConfiguredAt) {
          return 'Complete Google Workspace verification or configure DNS records first';
        }
        return '';
      default:
        return '';
    }
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className='container max-w-7xl mx-auto p-6 space-y-6'>
      {/* Back Button */}
      <Button
        variant='ghost'
        size='sm'
        onClick={() => router.push('/domains')}
        className='mb-2'
      >
        <ArrowLeft className='h-4 w-4 mr-2' />
        Back to Domains
      </Button>

      {/* Header Card with Domain Info */}
      <Card>
        <CardContent className='pt-6'>
          <div className='space-y-4'>
            {/* Domain Name and Status */}
            <div className='flex items-start justify-between'>
              <div>
                <h1 className='text-3xl font-bold mb-2'>{domain.domain}</h1>
                <div className='flex items-center gap-3'>
                  <Badge variant={domain.isActive ? 'default' : 'secondary'}>
                    {domain.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge
                    variant={
                      domain.healthScore === 'excellent' ||
                      domain.healthScore === 'good'
                        ? 'default'
                        : domain.healthScore === 'warning'
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    {domain.healthScore || 'Unknown'} Health
                  </Badge>
                  <span className='text-sm text-muted-foreground'>
                    {domain.provider}
                  </span>
                </div>
              </div>
              <div className='text-right text-sm text-muted-foreground'>
                <p>Created: {formatDate(domain.createdAt)}</p>
                {domain.lastVerifiedAt && (
                  <p>Last Verified: {formatDate(domain.lastVerifiedAt)}</p>
                )}
              </div>
            </div>

            {/* Notes if present */}
            {domain.notes && (
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Notes</p>
                <p className='text-sm bg-muted p-3 rounded-md'>{domain.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={handleNavigateToTab}>
          <CardHeader className='border-b'>
            <TabsList className='w-full justify-start'>
              <TooltipProvider>
                <TabsTrigger value='dns'>
                  <Globe className='h-4 w-4 mr-2' />
                  DNS & Nameservers
                  {renderTabBadge('dns')}
                </TabsTrigger>

                {isTabLocked('email') ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value='email'
                        disabled={true}
                        className='relative'
                      >
                        <Mail className='h-4 w-4 mr-2' />
                        Email Accounts & Warmup
                        <Lock className='h-3 w-3 ml-1 text-muted-foreground' />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{getLockedReason('email')}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <TabsTrigger value='email'>
                    <Mail className='h-4 w-4 mr-2' />
                    Email Accounts & Warmup
                    {renderTabBadge('email')}
                  </TabsTrigger>
                )}
              </TooltipProvider>
            </TabsList>
          </CardHeader>
          <CardContent className='p-6'>
            <TabsContent value='dns'>
              <DNSTab
                details={details}
                onVerifyNameservers={onVerifyNameservers}
                onConfigureEmailDNS={onConfigureEmailDNS}
                onConfirmManualVerification={onConfirmManualVerification}
                onAddDKIMRecord={onAddDKIMRecord}
                onCreateDMARCRecord={onCreateDMARCRecord}
              />
            </TabsContent>
            <TabsContent value='email'>
              <div className='space-y-6'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h2 className='text-2xl font-bold'>Email Accounts</h2>
                    <p className='text-sm text-muted-foreground mt-1'>
                      Manage email accounts and warmup settings for {domain.domain}
                    </p>
                  </div>
                  <Button onClick={() => setIsCreatingEmail(true)}>
                    <Plus className='h-4 w-4 mr-2' />
                    Create Email Account
                  </Button>
                </div>

                <EmailAccountsTable
                  domainId={domain.id}
                  emailAccounts={details.emailAccounts}
                  onRefresh={handleRefresh}
                />

                <EmailAccountCreationModal
                  open={isCreatingEmail}
                  onOpenChange={setIsCreatingEmail}
                  domainId={domain.id}
                  domainName={domain.domain}
                />
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
