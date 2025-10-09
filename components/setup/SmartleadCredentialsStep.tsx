/**
 * Smartlead Credentials Setup Step
 *
 * Third step in setup wizard - connects Smartlead for email warmup (OPTIONAL)
 * Can skip if user doesn't want warmup integration
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
  Zap,
  Info,
  ExternalLink,
  CheckCircle,
  ChevronDown,
  Loader2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface SmartleadCredentialsStepProps {
  saveCredentialsAction: (
    apiKey: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSuccess: () => void;
  onSkip: () => void;
  onError?: (error: string) => void;
}

export function SmartleadCredentialsStep({
  saveCredentialsAction,
  onSuccess,
  onSkip,
  onError,
}: SmartleadCredentialsStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError('Please enter your Smartlead API key');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await saveCredentialsAction(apiKey.trim());

    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
      // Auto-advance after brief delay
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } else {
      const errorMessage = result.error || 'Failed to connect Smartlead';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const handleSkip = () => {
    onSkip();
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
            <h3 className="text-xl font-semibold">Smartlead Connected! 🎉</h3>
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
              Smartlead is now connected. Email accounts created through this wizard will
              automatically be added to warmup pools for improved deliverability.
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
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">Connect Smartlead</h3>
          <p className="text-sm text-muted-foreground">
            Optional - Recommended for email warmup and deliverability tracking
          </p>
        </div>
      </div>

      {/* Benefits Alert */}
      <Alert className="border-blue-500/20 bg-blue-500/10">
        <TrendingUp className="h-4 w-4 text-blue-500" />
        <AlertDescription>
          <p className="font-semibold text-blue-500">Why use Smartlead?</p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• <strong>Email Warmup</strong>: Gradually increase sending volume to build domain reputation</li>
            <li>• <strong>Deliverability Tracking</strong>: Monitor inbox placement rates across providers</li>
            <li>• <strong>Campaign Management</strong>: Run cold email campaigns with better results</li>
            <li>• <strong>20-30% Better Deliverability</strong>: Warmed accounts land in inbox more often</li>
          </ul>
        </AlertDescription>
      </Alert>

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
                  Create Smartlead Account (if you don&apos;t have one)
                  <br />
                  <a
                    href="https://smartlead.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 ml-6 mt-1"
                  >
                    Sign up at Smartlead.ai
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>

                <li className="font-medium">
                  Get your API Key
                  <br />
                  <div className="ml-6 space-y-1 text-muted-foreground">
                    <p>
                      Go to{' '}
                      <a
                        href="https://app.smartlead.ai/app/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Smartlead Dashboard
                      </a>{' '}
                      → Settings → API → Copy your API key
                    </p>
                  </div>
                </li>

                <li className="font-medium">
                  Paste the API Key below
                  <br />
                  <span className="text-muted-foreground ml-6">
                    The key will be encrypted and securely stored in your account
                  </span>
                </li>
              </ol>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p className="font-semibold mb-1">Don&apos;t have Smartlead?</p>
                  <p className="text-muted-foreground">
                    You can skip this step and add Smartlead later from your settings. Email
                    accounts will work fine without warmup, but they may have lower deliverability
                    initially.
                  </p>
                </AlertDescription>
              </Alert>
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

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">
            Smartlead API Key
          </Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="Your Smartlead API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isLoading}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Found in Smartlead Dashboard → Settings → API
          </p>
        </div>

        {/* Action Button */}
        <Button
          type="submit"
          disabled={isLoading || !apiKey.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Connect Smartlead
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
