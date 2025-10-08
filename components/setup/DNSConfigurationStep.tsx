/**
 * DNS Configuration Step Component (Task 7.3a)
 *
 * Wizard step that configures SPF, DKIM, DMARC, MX, and tracking domain DNS records
 * Auto-starts DNS polling session and advances to monitoring step
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  ShieldCheck,
  Mail,
  Eye,
} from 'lucide-react';
import { useDNSSetup } from '@/lib/hooks/use-dns-setup';
import type { DNSSetupResult } from '@/server/dns/dns-manager';
import type { PollingSession } from '@/server/dns/polling-job';

interface DNSRecord {
  name: string;
  type: string;
  icon: React.ReactNode;
  description: string;
}

const DNS_RECORDS: DNSRecord[] = [
  {
    name: 'SPF',
    type: 'TXT',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'Sender Policy Framework - Prevents email spoofing',
  },
  {
    name: 'DKIM',
    type: 'TXT',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'DomainKeys Identified Mail - Email authentication',
  },
  {
    name: 'DMARC',
    type: 'TXT',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'Email authentication policy and reporting',
  },
  {
    name: 'MX',
    type: 'MX',
    icon: <Mail className="h-4 w-4" />,
    description: 'Mail Exchange - Google Workspace mail routing',
  },
  {
    name: 'Tracking',
    type: 'CNAME',
    icon: <Eye className="h-4 w-4" />,
    description: 'Email tracking domain for Smartlead',
  },
];

interface DNSConfigurationStepProps {
  domainId: string;
  domain: string;
  setupDNSAction: (domainId: string) => Promise<DNSSetupResult>;
  startPollingAction: (
    domainId: string
  ) => Promise<{ success: boolean; data?: PollingSession; error?: string }>;
  onSuccess: (pollingSessionId: string) => void;
  onError?: (error: string) => void;
}

export function DNSConfigurationStep({
  domainId,
  domain,
  setupDNSAction,
  startPollingAction,
  onSuccess,
  onError,
}: DNSConfigurationStepProps) {
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Use DNS setup hook
  const {
    setupDNS,
    isLoading,
    isSuccess,
    result,
    error: setupError,
  } = useDNSSetup({
    setupDNSAction,
    startPollingAction,
    onSuccess: async (pollingSessionId) => {
      // Auto-advance after brief delay
      setIsAdvancing(true);
      setTimeout(() => {
        onSuccess(pollingSessionId);
      }, 1500);
    },
    onError: (errorMessage) => {
      if (onError) {
        onError(errorMessage);
      }
    },
  });

  const handleConfigureDNS = () => {
    setupDNS(domainId);
  };

  // Get status icon and badge
  const getStatusIcon = () => {
    if (isSuccess && !isAdvancing) {
      return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    } else if (isSuccess && isAdvancing) {
      return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
    } else if (setupError) {
      return <AlertCircle className="h-6 w-6 text-red-500" />;
    } else if (isLoading) {
      return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
    } else {
      return <Server className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    if (isSuccess && !isAdvancing) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          Configured
        </Badge>
      );
    } else if (isSuccess && isAdvancing) {
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Advancing...
        </Badge>
      );
    } else if (setupError) {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          Error
        </Badge>
      );
    } else if (isLoading) {
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Configuring...
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-muted text-muted-foreground">
          Ready
        </Badge>
      );
    }
  };

  // Show success with auto-advance
  if (isSuccess && isAdvancing) {
    return (
      <div className="space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">DNS Records Configured! 🎉</h3>
            <p className="text-sm text-muted-foreground">
              Starting DNS propagation monitoring...
            </p>
          </div>
        </div>

        <Alert className="border-green-500/20 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription>
            <p className="font-semibold text-green-500">Configuration Complete</p>
            <p className="text-sm text-muted-foreground mt-1">
              All DNS records have been created. We&apos;ll now monitor their propagation across
              global nameservers.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          {getStatusIcon()}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">DNS Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure email authentication records for {domain}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* DNS Records Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            DNS Records to Configure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DNS_RECORDS.map((record, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 border border-border"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                {record.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{record.name}</p>
                  <Badge variant="outline" className="text-xs">
                    {record.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{record.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Configuration Info */}
      <Alert>
        <Server className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <p className="font-semibold mb-2">What happens next?</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• SPF record will be flattened to avoid DNS lookup limits</li>
            <li>• DKIM keys will be generated for Google Workspace</li>
            <li>• DMARC policy will be set to &quot;none&quot; (monitoring mode)</li>
            <li>• MX records will point to Google&apos;s mail servers</li>
            <li>• Tracking domain will be configured for Smartlead</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Configure Button */}
      <Button
        onClick={handleConfigureDNS}
        disabled={isLoading || isSuccess}
        size="lg"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Configuring DNS Records...
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Configuration Complete
          </>
        ) : (
          <>
            <Server className="mr-2 h-4 w-4" />
            Configure DNS Records
          </>
        )}
      </Button>

      {/* Success Summary */}
      {isSuccess && result && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              Configuration Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Records created:</span>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                {result.recordsCreated}
              </Badge>
            </div>
            {result.recordsFailed > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Records failed:</span>
                <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                  {result.recordsFailed}
                </Badge>
              </div>
            )}
            {result.recordsSkipped > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Records skipped (duplicates):</span>
                <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  {result.recordsSkipped}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {isSuccess && result && result.warnings.length > 0 && (
        <Alert className="border-yellow-500/20 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription>
            <p className="font-semibold text-yellow-500 mb-2">Warnings</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {result.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {setupError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-1">Configuration Failed</p>
            <p className="text-sm">{setupError}</p>
            <Button
              onClick={handleConfigureDNS}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Retry Configuration
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Errors List (if result has errors) */}
      {isSuccess && result && result.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">Some records failed to create</p>
            <ul className="space-y-1 text-sm">
              {result.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
