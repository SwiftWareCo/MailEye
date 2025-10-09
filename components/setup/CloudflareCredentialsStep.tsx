/**
 * Cloudflare Credentials Setup Step
 *
 * First step in setup wizard - connects Cloudflare account (REQUIRED)
 * Adapted from CloudflareSetup component for wizard flow
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Cloud,
  Info,
  ExternalLink,
  CheckCircle,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface CloudflareCredentialsStepProps {
  saveCredentialsAction: (
    apiToken: string,
    accountId: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSuccess: () => void;
  onError?: (error: string) => void;
}

export function CloudflareCredentialsStep({
  saveCredentialsAction,
  onSuccess,
  onError,
}: CloudflareCredentialsStepProps) {
  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiToken.trim() || !accountId.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await saveCredentialsAction(apiToken.trim(), accountId.trim());

    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
      // Auto-advance after brief delay
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } else {
      const errorMessage = result.error || 'Failed to connect Cloudflare';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
            <CheckCircle className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Cloudflare Connected! 🎉</h3>
            <p className="text-sm text-muted-foreground">
              Moving to next step...
            </p>
          </div>
        </div>

        <Alert className="border-green-500/20 bg-green-500/10">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>
            <p className="font-semibold text-green-500">Connection Successful</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your Cloudflare account is now connected. We can now manage DNS records and zones
              for your domains.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Form state
  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <Cloud className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Connect Cloudflare Account</h3>
          <p className="text-sm text-muted-foreground">
            Required for DNS management and email authentication setup
          </p>
        </div>
      </div>

      {/* Collapsible Instructions */}
      <Collapsible open={isInstructionsOpen} onOpenChange={setIsInstructionsOpen}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Setup Instructions
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isInstructionsOpen ? '' : '-rotate-90'}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li className="font-medium">
                  Create Cloudflare Account (if you don&apos;t have one)
                  <br />
                  <a
                    href="https://dash.cloudflare.com/sign-up"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 ml-6 mt-1"
                  >
                    Sign up at Cloudflare
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>

                <li className="font-medium">
                  Get your Account ID
                  <br />
                  <span className="text-muted-foreground ml-6">
                    Go to{' '}
                    <a
                      href="https://dash.cloudflare.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Cloudflare Dashboard
                    </a>{' '}
                    → Select any domain → Scroll down in Overview page → Copy Account ID
                  </span>
                </li>

                <li className="font-medium">
                  Create an API Token
                  <br />
                  <div className="ml-6 space-y-1 text-muted-foreground">
                    <p>
                      Go to{' '}
                      <a
                        href="https://dash.cloudflare.com/profile/api-tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        API Tokens
                      </a>{' '}
                      → Create Token → Use &quot;Edit zone DNS&quot; template
                    </p>
                    <p className="text-xs">Required permissions:</p>
                    <ul className="text-xs list-disc list-inside ml-4">
                      <li>Zone → Zone → Edit</li>
                      <li>Zone → DNS → Edit</li>
                    </ul>
                  </div>
                </li>
              </ol>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold">Connection Failed</p>
              <p className="text-sm mt-1">{error}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* API Token */}
        <div className="space-y-2">
          <Label htmlFor="apiToken">
            Cloudflare API Token <span className="text-red-500">*</span>
          </Label>
          <Input
            id="apiToken"
            type="password"
            placeholder="Your Cloudflare API Token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            disabled={isLoading}
            required
          />
          <p className="text-xs text-muted-foreground">
            This token is encrypted and securely stored
          </p>
        </div>

        {/* Account ID */}
        <div className="space-y-2">
          <Label htmlFor="accountId">
            Account ID <span className="text-red-500">*</span>
          </Label>
          <Input
            id="accountId"
            type="text"
            placeholder="Your Cloudflare Account ID"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={isLoading}
            className="font-mono"
            required
          />
          <p className="text-xs text-muted-foreground">
            Found in Cloudflare Dashboard → Overview
          </p>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <p className="font-semibold mb-1">Why Cloudflare?</p>
            <p className="text-muted-foreground">
              Cloudflare provides fast, global DNS with automatic propagation. We&apos;ll use it
              to manage DNS records for email authentication (SPF, DKIM, DMARC) and routing.
            </p>
          </AlertDescription>
        </Alert>

        {/* Submit Button */}
        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Cloud className="mr-2 h-4 w-4" />
              Connect Cloudflare
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
