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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  ShieldCheck,
  Mail,
  Eye,
  ChevronDown,
  Info,
  TrendingUp,
  AlertTriangle,
  XCircle,
  MinusCircle,
} from 'lucide-react';
import { useDNSSetup } from '@/lib/hooks/use-dns-setup';
import type { DNSSetupResult } from '@/server/dns/dns-manager';
import type { PollingSession } from '@/server/dns/polling-job';

interface DNSRecord {
  name: string;
  type: string;
  icon: React.ReactNode;
  description: string;
  whatIsIt: string;
  whyImportant: string;
  deliverabilityImpact: string;
}

const DNS_RECORDS: DNSRecord[] = [
  {
    name: 'SPF',
    type: 'TXT',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'Sender Policy Framework - Prevents email spoofing',
    whatIsIt: 'SPF (Sender Policy Framework) is a DNS record that specifies which mail servers are authorized to send emails on behalf of your domain.',
    whyImportant: 'Without SPF, anyone can impersonate your domain. Email providers check SPF to verify sender authenticity. Missing SPF results in 40-60% of emails landing in spam.',
    deliverabilityImpact: 'SPF alone improves deliverability by ~40%. Combined with DKIM and DMARC, you can achieve 95%+ inbox placement.',
  },
  {
    name: 'DKIM',
    type: 'TXT',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'DomainKeys Identified Mail - Email authentication',
    whatIsIt: 'DKIM adds a digital signature to every email sent from your domain. The signature is verified using a public key stored in your DNS.',
    whyImportant: 'DKIM proves emails haven\'t been tampered with in transit. Major email providers (Gmail, Outlook) heavily favor DKIM-signed emails. Without DKIM, your domain reputation suffers significantly.',
    deliverabilityImpact: 'DKIM is critical for reaching Gmail inboxes. Emails without DKIM are 3x more likely to be marked as spam. Essential for cold email campaigns.',
  },
  {
    name: 'DMARC',
    type: 'TXT',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'Email authentication policy and reporting',
    whatIsIt: 'DMARC tells email providers what to do with emails that fail SPF or DKIM checks. It also provides reports on email authentication results.',
    whyImportant: 'DMARC protects your brand from phishing attacks and domain spoofing. Starting in 2024, Gmail and Yahoo require DMARC for bulk senders. It\'s now mandatory for professional email.',
    deliverabilityImpact: 'Proper DMARC configuration (starting with p=none) improves sender reputation. After monitoring, moving to p=quarantine or p=reject provides maximum protection.',
  },
  {
    name: 'MX',
    type: 'MX',
    icon: <Mail className="h-4 w-4" />,
    description: 'Mail Exchange - Google Workspace mail routing',
    whatIsIt: 'MX records direct incoming email to your mail servers. For Google Workspace, these point to Google\'s infrastructure.',
    whyImportant: 'Without proper MX records, you won\'t receive emails. Google Workspace MX records are specifically optimized for reliability and spam filtering.',
    deliverabilityImpact: 'While MX records don\'t directly affect outbound deliverability, using Google Workspace MX records leverages Google\'s excellent sender reputation.',
  },
  {
    name: 'Tracking',
    type: 'CNAME',
    icon: <Eye className="h-4 w-4" />,
    description: 'Email tracking domain for Smartlead',
    whatIsIt: 'A custom tracking subdomain (e.g., track.yourdomain.com) that routes through Smartlead for click and open tracking.',
    whyImportant: 'Using a branded tracking domain instead of a shared one improves trust and deliverability. Generic tracking domains are often flagged by spam filters.',
    deliverabilityImpact: 'Custom tracking domains can improve click-through rates by 15-25% and reduce spam complaints by using your domain\'s reputation.',
  },
];

interface DNSConfigurationStepProps {
  domainId: string;
  domain: string;
  setupDNSAction: (
    domainId: string,
    options?: { dkimPublicKey?: string }
  ) => Promise<DNSSetupResult>;
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
  const [dkimPublicKey, setDkimPublicKey] = useState('');
  const [showDkimInput, setShowDkimInput] = useState(false);

  // Use DNS setup hook - wrap setupDNSAction to pass dkimPublicKey
  const wrappedSetupDNSAction = async (domainId: string) => {
    return setupDNSAction(domainId, {
      dkimPublicKey: dkimPublicKey.trim() || undefined,
    });
  };

  const {
    setupDNS,
    isLoading,
    isSuccess,
    result,
    error: setupError,
  } = useDNSSetup({
    setupDNSAction: wrappedSetupDNSAction,
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

      {/* DNS Records Overview with Collapsible Explanations */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Server className="h-4 w-4" />
          DNS Records to Configure
        </h4>

        {DNS_RECORDS.map((record, index) => {
          // Get status for this record type from result
          const recordResult = result?.batchResult?.results?.find(
            r => r.record?.purpose?.toLowerCase() === record.name.toLowerCase()
          );

          const isConfigured = isSuccess && recordResult;
          const isSkipped = recordResult?.skipped;
          const hasFailed = recordResult && !recordResult.success;

          return (
            <Collapsible key={index}>
              <Card className={
                isConfigured && !isSkipped && !hasFailed
                  ? 'border-green-500/20 bg-green-500/5'
                  : isSkipped
                  ? 'border-yellow-500/20 bg-yellow-500/5'
                  : hasFailed
                  ? 'border-red-500/20 bg-red-500/5'
                  : ''
              }>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
                      isConfigured && !isSkipped && !hasFailed
                        ? 'bg-green-500/10'
                        : isSkipped
                        ? 'bg-yellow-500/10'
                        : hasFailed
                        ? 'bg-red-500/10'
                        : 'bg-primary/10'
                    }`}>
                      {record.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{record.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {record.type}
                        </Badge>
                        {isConfigured && !isSkipped && !hasFailed && (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Created
                          </Badge>
                        )}
                        {isSkipped && (
                          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
                            <MinusCircle className="h-3 w-3 mr-1" />
                            Skipped
                          </Badge>
                        )}
                        {hasFailed && (
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{record.description}</p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="font-medium text-xs text-muted-foreground flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          What is {record.name}?
                        </p>
                        <p className="text-xs mt-1">{record.whatIsIt}</p>
                      </div>

                      <div>
                        <p className="font-medium text-xs text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Why is it important?
                        </p>
                        <p className="text-xs mt-1">{record.whyImportant}</p>
                      </div>

                      <div>
                        <p className="font-medium text-xs text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Deliverability Impact
                        </p>
                        <p className="text-xs mt-1">{record.deliverabilityImpact}</p>
                      </div>
                    </div>

                    {/* Show record details if configured */}
                    {isConfigured && recordResult?.record && (
                      <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border">
                        <p className="text-xs font-medium mb-2">Record Details:</p>
                        <div className="space-y-1 text-xs font-mono">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <span>{recordResult.record.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name:</span>
                            <span>{recordResult.record.name}</span>
                          </div>
                          {recordResult.record.content && (
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Value:</span>
                              <span className="break-all text-xs bg-background p-2 rounded border">
                                {recordResult.record.content.length > 100
                                  ? `${recordResult.record.content.substring(0, 100)}...`
                                  : recordResult.record.content}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Show skip/failure reason */}
                    {isSkipped && recordResult?.reason && (
                      <Alert className="border-yellow-500/20 bg-yellow-500/10">
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                        <AlertDescription className="text-xs">
                          <strong>Skipped:</strong> {recordResult.reason}
                        </AlertDescription>
                      </Alert>
                    )}

                    {hasFailed && recordResult?.error && (
                      <Alert variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          <strong>Error:</strong> {recordResult.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Configuration Info */}
      <Alert>
        <Server className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <p className="font-semibold mb-2">What happens next?</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• SPF record will be flattened to avoid DNS lookup limits</li>
            <li>• DKIM keys will be generated for Google Workspace (manual setup required)</li>
            <li>• DMARC policy will be set to &quot;none&quot; (monitoring mode)</li>
            <li>• MX records will point to Google&apos;s mail servers</li>
            <li>• Tracking domain will be configured for Smartlead</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Optional DKIM Public Key Input */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              DKIM Public Key (Optional)
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDkimInput(!showDkimInput)}
            >
              {showDkimInput ? 'Hide' : 'Add DKIM Key'}
            </Button>
          </CardTitle>
        </CardHeader>
        {showDkimInput && (
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dkim-key" className="text-sm">
                Paste your DKIM public key from Google Workspace Admin Console
              </Label>
              <Textarea
                id="dkim-key"
                placeholder="v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
                value={dkimPublicKey}
                onChange={(e) => setDkimPublicKey(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <p className="font-semibold mb-1">How to get your DKIM public key:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Ensure Gmail has been enabled for 24-72 hours</li>
                  <li>Go to <a href="https://admin.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">admin.google.com</a></li>
                  <li>Navigate to Apps → Google Workspace → Gmail → Authenticate email</li>
                  <li>Select your domain and click &quot;Generate new record&quot;</li>
                  <li>Choose 2048-bit key length</li>
                  <li>Copy the generated public key and paste it above</li>
                </ol>
                <p className="mt-2 text-muted-foreground">
                  If you skip this step, DNS setup will continue without DKIM. You can add it later.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

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
