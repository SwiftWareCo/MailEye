/**
 * Nameserver Verification Step Component (Task 7.3)
 *
 * Wizard step that polls nameserver verification status every 30 seconds
 * and auto-advances when nameservers are verified
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Server,
} from 'lucide-react';
import { useNameserverVerification } from '@/lib/hooks/use-nameserver-verification';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';

interface NameserverVerificationStepProps {
  domainId: string;
  domain: string;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;
  onVerified: () => void;
  onSkip?: () => void;
}

export function NameserverVerificationStep({
  domainId,
  domain,
  verifyNameserversAction,
  onVerified,
  onSkip,
}: NameserverVerificationStepProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(new Date());

  // Use verification hook with polling
  const {
    data,
    isLoading,
    isVerified,
    currentNameservers,
    expectedNameservers,
    message,
    verificationError,
    checkNow,
    isFetching,
  } = useNameserverVerification({
    domainId,
    verifyNameserversAction,
    enabled: true,
    onVerified: () => {
      // Start auto-advance countdown when verified
      setAutoAdvanceCountdown(2);
    },
  });

  // Update last checked timestamp whenever data changes
  useEffect(() => {
    if (data) {
      setLastCheckedAt(new Date());
    }
  }, [data]);

  // Handle auto-advance countdown
  useEffect(() => {
    if (autoAdvanceCountdown !== null && autoAdvanceCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoAdvanceCountdown(autoAdvanceCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (autoAdvanceCountdown === 0) {
      onVerified();
      return;
    }
    return undefined;
  }, [autoAdvanceCountdown, onVerified]);

  // Copy to clipboard functionality
  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Handle manual check
  const handleCheckNow = async () => {
    await checkNow();
  };

  // Determine status icon and color
  const getStatusIcon = () => {
    if (isVerified) {
      return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    } else if (verificationError) {
      return <AlertCircle className="h-6 w-6 text-red-500" />;
    } else if (isFetching) {
      return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
    } else {
      return <Clock className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getStatusBadge = () => {
    if (isVerified) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          Verified
        </Badge>
      );
    } else if (verificationError) {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          Error
        </Badge>
      );
    } else if (isFetching) {
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Checking...
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          Pending
        </Badge>
      );
    }
  };

  // Format time since last check
  const getTimeSinceLastCheck = () => {
    const seconds = Math.floor((new Date().getTime() - lastCheckedAt.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  // Show auto-advance notification
  if (autoAdvanceCountdown !== null && autoAdvanceCountdown > 0) {
    return (
      <div className="space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Nameservers Verified! 🎉</h3>
            <p className="text-sm text-muted-foreground">
              Advancing to DNS configuration in {autoAdvanceCountdown} seconds...
            </p>
          </div>
        </div>

        <Alert className="border-green-500/20 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription>
            <p className="font-semibold text-green-500">Verification Complete</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your nameservers are now pointing to Cloudflare. We&apos;ll proceed with DNS
              record configuration.
            </p>
          </AlertDescription>
        </Alert>

        <Button onClick={onVerified} className="w-full" size="lg">
          Continue to DNS Setup Now
        </Button>
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
          <h3 className="text-xl font-semibold">Nameserver Verification</h3>
          <p className="text-sm text-muted-foreground">
            Verifying DNS propagation for {domain}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Verification Status</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last checked: {getTimeSinceLastCheck()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Message */}
          <Alert variant={verificationError ? 'destructive' : 'default'}>
            <AlertDescription className="text-sm">
              {message || 'Checking nameserver status...'}
            </AlertDescription>
          </Alert>

          {/* Check Now Button */}
          <Button
            onClick={handleCheckNow}
            disabled={isFetching}
            variant="outline"
            className="w-full"
          >
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Nameservers...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Now
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Nameserver Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Nameserver Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Expected Nameservers */}
          <div>
            <p className="text-sm font-medium mb-2">Expected (Cloudflare):</p>
            <div className="space-y-2">
              {expectedNameservers.map((ns, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-green-500/10 px-4 py-3 border border-green-500/20"
                >
                  <code className="text-sm font-mono text-foreground">{ns}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(ns, index)}
                    className="h-8"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        <span className="text-green-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Current Nameservers */}
          {currentNameservers.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Current (Detected):</p>
              <div className="space-y-2">
                {currentNameservers.map((ns, index) => {
                  const isMatch = expectedNameservers.some((expected) =>
                    ns.toLowerCase().includes(expected.toLowerCase().split('.')[0])
                  );
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                        isMatch
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-yellow-500/10 border-yellow-500/20'
                      }`}
                    >
                      <code className="text-sm font-mono text-foreground">{ns}</code>
                      {isMatch && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isLoading && currentNameservers.length === 0 && (
            <Alert>
              <AlertDescription className="text-sm">
                No nameservers detected yet. DNS queries may be timing out or the domain may
                not be reachable.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Propagation Info */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <p className="font-semibold mb-2">DNS Propagation</p>
          <p className="text-muted-foreground">
            Nameserver changes typically propagate within <strong>15 minutes to 48 hours</strong>
            {' '}depending on your registrar. We&apos;ll automatically check every 30 seconds
            and advance to the next step when verified.
          </p>
          {onSkip && (
            <p className="text-muted-foreground mt-2">
              <strong>Advanced users:</strong> You can skip this verification if you&apos;re
              confident your nameservers are configured correctly.
            </p>
          )}
        </AlertDescription>
      </Alert>

      {/* Skip Option for Advanced Users */}
      {onSkip && !isVerified && (
        <div className="pt-4 border-t border-border">
          <Button
            onClick={onSkip}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            Skip Verification (Advanced)
          </Button>
        </div>
      )}
    </div>
  );
}
