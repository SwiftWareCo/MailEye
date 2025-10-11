/**
 * Domain Detail View Component
 *
 * Main container for domain details with tabbed interface
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  LayoutDashboard,
  Globe,
  Mail,
  Flame,
} from 'lucide-react';
import { OverviewTab } from './tabs/OverviewTab';
import { DNSTab } from './tabs/DnsTab';
import { EmailAccountsTab } from './tabs/EmailAccountsTab';
import { WarmupTab } from './tabs/WarmupTab';
import type { DomainDetails, TabBadgeStatus } from '@/lib/types/domain-details';

interface DomainDetailViewProps {
  details: DomainDetails;
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
  onCreateEmailAccount?: (
    emailPrefix: string,
    displayName: string,
    count?: number
  ) => Promise<{ success: boolean; error?: string; accounts?: unknown[] }>;
  onConnectToSmartlead?: (emailAccountId: string) => void;
}

export function DomainDetailView({
  details,
  onVerifyNameservers,
  onConfigureEmailDNS,
  onConfirmManualVerification,
  onAddDKIMRecord,
  onCreateEmailAccount,
  onConnectToSmartlead,
}: DomainDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  const { domain, setupStatus } = details;

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
        if (setupStatus.emailAccounts.isComplete) {
          return { status: 'complete' };
        } else if (setupStatus.emailAccounts.accountCount > 0) {
          return {
            status: 'in-progress',
            label: `${setupStatus.emailAccounts.accountCount}`,
          };
        }
        return { status: 'not-started' };

      case 'warmup':
        if (setupStatus.warmup.isComplete) {
          return { status: 'complete' };
        } else if (setupStatus.warmup.smartleadConnected) {
          return {
            status: 'in-progress',
            label: `${setupStatus.warmup.accountsConnected}/${setupStatus.warmup.accountsTotal}`,
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
    setActiveTab(tab);
  };

  // Determine if a tab is locked based on prerequisites
  const isTabLocked = (tab: string): boolean => {
    switch (tab) {
      case 'overview':
      case 'dns':
        // Overview and DNS tabs are always accessible
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
      case 'warmup':
        // Warmup tab requires at least one email account
        return setupStatus.emailAccounts.accountCount === 0;
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
      case 'warmup':
        return 'Create email accounts first';
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

            {/* Setup Progress Bar */}
            <div>
              <div className='flex items-center justify-between mb-2'>
                <span className='text-sm font-medium'>Setup Progress</span>
                <span className='text-sm font-semibold'>
                  {setupStatus.overview.completionPercentage}%
                </span>
              </div>
              <div className='w-full bg-secondary rounded-full h-2'>
                <div
                  className='bg-primary h-2 rounded-full transition-all'
                  style={{
                    width: `${setupStatus.overview.completionPercentage}%`,
                  }}
                />
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
                <TabsTrigger value='overview'>
                  <LayoutDashboard className='h-4 w-4 mr-2' />
                  Overview
                  {setupStatus.overview.isComplete &&
                    renderTabBadge('overview')}
                </TabsTrigger>

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
                        Email Accounts
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
                    Email Accounts
                    {renderTabBadge('email')}
                  </TabsTrigger>
                )}

                {isTabLocked('warmup') ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value='warmup'
                        disabled={true}
                        className='relative'
                      >
                        <Flame className='h-4 w-4 mr-2' />
                        Warmup & Integration
                        <Lock className='h-3 w-3 ml-1 text-muted-foreground' />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{getLockedReason('warmup')}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <TabsTrigger value='warmup'>
                    <Flame className='h-4 w-4 mr-2' />
                    Warmup & Integration
                    {renderTabBadge('warmup')}
                  </TabsTrigger>
                )}
              </TooltipProvider>
            </TabsList>
          </CardHeader>
          <CardContent className='p-6'>
            <TabsContent value='overview'>
              <OverviewTab
                details={details}
                onNavigateToTab={handleNavigateToTab}
              />
            </TabsContent>
            <TabsContent value='dns'>
              <DNSTab
                details={details}
                onVerifyNameservers={onVerifyNameservers}
                onConfigureEmailDNS={onConfigureEmailDNS}
                onConfirmManualVerification={onConfirmManualVerification}
                onAddDKIMRecord={onAddDKIMRecord}
              />
            </TabsContent>
            <TabsContent value='email'>
              <EmailAccountsTab
                details={details}
                onCreateAccount={onCreateEmailAccount}
                onNavigateToTab={handleNavigateToTab}
              />
            </TabsContent>
            <TabsContent value='warmup'>
              <WarmupTab
                details={details}
                onConnectToSmartlead={onConnectToSmartlead}
                onNavigateToTab={handleNavigateToTab}
              />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
