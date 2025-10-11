/**
 * Setup Checklist Component
 *
 * Displays domain setup progress as an expandable checklist
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import type { SetupCompletionStatus } from '@/lib/types/domain-details';

interface SetupChecklistProps {
  setupStatus: SetupCompletionStatus;
  onNavigateToTab?: (tab: string) => void;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'not-started' | 'warning';
  tab?: string;
  instructions?: string[];
  warningMessage?: string;
}

export function SetupChecklist({
  setupStatus,
  onNavigateToTab,
}: SetupChecklistProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Build checklist items based on setup status
  const checklistItems: ChecklistItem[] = [
    {
      id: 'cloudflare-zone',
      title: 'Cloudflare Zone Created',
      description: 'Domain added to Cloudflare DNS management',
      status: setupStatus.dns.hasZone ? 'completed' : 'not-started',
      tab: 'dns',
      instructions: [
        'Go to the DNS tab',
        'Your domain is automatically added to Cloudflare when connected',
        'If missing, reconnect your domain from the Domains page',
      ],
    },
    {
      id: 'nameservers',
      title: 'Nameservers Verified',
      description: 'Domain pointing to Cloudflare nameservers',
      status: setupStatus.dns.nameserversVerified
        ? 'completed'
        : setupStatus.dns.hasZone
        ? 'in-progress'
        : 'not-started',
      tab: 'dns',
      instructions: [
        'Update your domain\'s nameservers at your registrar',
        'Point to the Cloudflare nameservers shown in the DNS tab',
        'Verification can take up to 24 hours (usually under 5 minutes)',
        'Click "Verify" in the DNS tab to check status',
      ],
    },
    {
      id: 'dns-records',
      title: 'Core DNS Records Configured',
      description: 'SPF and MX records set up for email sending',
      status: setupStatus.dns.isComplete
        ? 'completed'
        : setupStatus.dns.recordCount > 0
        ? setupStatus.dns.missingRecords.length > 0
          ? 'warning'
          : 'in-progress'
        : 'not-started',
      tab: 'dns',
      instructions: [
        'Click "Configure Email DNS" in the DNS tab',
        'SPF and MX records will be created automatically',
        'This configures basic email sending capability',
        'DNS propagation usually takes 5-10 minutes',
      ],
      warningMessage: setupStatus.dns.missingRecords.length > 0
        ? `Missing core records: ${setupStatus.dns.missingRecords.filter(r => ['SPF', 'MX'].includes(r)).join(', ') || setupStatus.dns.missingRecords.join(', ')}`
        : undefined,
    },
    {
      id: 'dkim-setup',
      title: 'DKIM Records Added (Optional)',
      description: 'Enhanced email authentication with DKIM',
      status: !setupStatus.dns.missingRecords.includes('DKIM')
        ? 'completed'
        : setupStatus.dns.recordCount > 0
        ? 'warning'
        : 'not-started',
      tab: 'dns',
      instructions: [
        'DKIM is optional but recommended for better deliverability',
        'Manually add DKIM record in the DNS tab using "Additional DNS Actions"',
        'Generate DKIM key in Google Workspace Admin Console first',
        'DKIM improves email authentication and sender reputation',
      ],
      warningMessage: setupStatus.dns.recordCount > 0 && setupStatus.dns.missingRecords.includes('DKIM')
        ? 'DKIM not configured - add manually in DNS tab for better deliverability'
        : undefined,
    },
    {
      id: 'dmarc-setup',
      title: 'DMARC Policy Configured (Auto-generated)',
      description: 'DMARC added 48 hours after DNS setup',
      status: setupStatus.dns.dmarcConfigured
        ? 'completed'
        : setupStatus.dns.dmarcPending
        ? 'in-progress'
        : 'not-started',
      tab: 'dns',
      instructions: [
        'DMARC is automatically added 48 hours after DNS configuration',
        'This delay ensures SPF/DKIM records are fully propagated',
        'DMARC policy will be set to "none" for monitoring',
        'No action required - system handles this automatically',
      ],
      warningMessage: setupStatus.dns.dmarcPending
        ? 'DMARC will be configured automatically after 48-hour waiting period'
        : undefined,
    },
    {
      id: 'email-accounts',
      title: 'Email Accounts Provisioned',
      description: 'Google Workspace email accounts created',
      status: setupStatus.emailAccounts.isComplete
        ? 'completed'
        : setupStatus.emailAccounts.accountCount > 0
        ? 'in-progress'
        : 'not-started',
      tab: 'email',
      instructions: [
        'Complete DNS setup first (SPF, DMARC, MX records minimum)',
        'Go to the Email Accounts tab',
        'Click "Create Account" to provision new email addresses',
        'Each account will be created in Google Workspace automatically',
      ],
    },
    {
      id: 'smartlead-connection',
      title: 'Smartlead Connected (Optional)',
      description: 'Email warmup integration configured',
      status: setupStatus.warmup.smartleadConnected
        ? setupStatus.warmup.isComplete
          ? 'completed'
          : 'in-progress'
        : 'not-started',
      tab: 'warmup',
      instructions: [
        'Connect Smartlead in the Domains page (if not already connected)',
        'Create at least one email account first',
        'Go to the Warmup tab',
        'Click "Connect" for each email account to enable warmup',
      ],
    },
    {
      id: 'warmup-active',
      title: 'Email Warmup Started',
      description: 'Accounts warming up to build sender reputation',
      status: setupStatus.warmup.warmupInProgress > 0 ||
        setupStatus.warmup.warmupCompleted > 0
        ? setupStatus.warmup.isComplete
          ? 'completed'
          : 'in-progress'
        : 'not-started',
      tab: 'warmup',
      instructions: [
        'Connect email accounts to Smartlead first',
        'Warmup will start automatically',
        'Typical warmup period is 30 days',
        'Monitor progress in the Warmup tab',
      ],
    },
  ];

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="text-xs bg-green-500">
            Complete
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge variant="secondary" className="text-xs">
            In Progress
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="destructive" className="text-xs">
            Action Required
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Not Started
          </Badge>
        );
    }
  };

  const completedCount = checklistItems.filter(
    (item) => item.status === 'completed'
  ).length;
  const totalCount = checklistItems.length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Setup Checklist</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {completedCount} of {totalCount} completed
            </span>
            <Badge variant={completionPercentage === 100 ? 'default' : 'secondary'}>
              {completionPercentage}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {checklistItems.map((item) => {
            const isExpanded = expandedItems.includes(item.id);
            const hasContent = item.instructions || item.warningMessage;

            return (
              <Collapsible
                key={item.id}
                open={isExpanded}
                onOpenChange={() => hasContent && toggleItem(item.id)}
              >
                <div
                  className={`rounded-lg border ${
                    item.status === 'warning'
                      ? 'border-orange-500/50 bg-orange-500/5'
                      : 'border-border'
                  } p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{item.title}</h4>
                            {getStatusBadge(item.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        {hasContent && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>

                      {item.warningMessage && (
                        <div className="mt-2 p-2 bg-orange-500/10 rounded text-sm text-orange-400">
                          {item.warningMessage}
                        </div>
                      )}

                      <CollapsibleContent className="mt-3">
                        {item.instructions && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Instructions:</p>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                              {item.instructions.map((instruction, idx) => (
                                <li key={idx}>{instruction}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {item.tab && item.status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigateToTab?.(item.tab!)}
                            className="mt-3"
                          >
                            Go to {item.tab.charAt(0).toUpperCase() + item.tab.slice(1)} Tab
                          </Button>
                        )}
                      </CollapsibleContent>
                    </div>
                  </div>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
