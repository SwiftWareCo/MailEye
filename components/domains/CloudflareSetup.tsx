'use client';

/**
 * Cloudflare Setup Component
 *
 * Shown on domains page when user hasn't connected Cloudflare yet
 * Provides instructions and form to connect Cloudflare account
 */

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Cloud, Info, ExternalLink, CheckCircle, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CloudflareSetupProps {
  saveCredentialsAction: (token: string, accountId: string) => Promise<{ success: boolean; error?: string }>;
}

export function CloudflareSetup({ saveCredentialsAction }: CloudflareSetupProps) {
  const router = useRouter();
  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);

  const handleSave = async () => {
    if (!apiToken || !accountId) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const result = await saveCredentialsAction(apiToken, accountId);
    setIsLoading(false);

    if (result.success) {
      toast.success('Cloudflare connected successfully!');
      router.refresh(); // Refresh to show domains page
    } else {
      toast.error(result.error || 'Failed to connect Cloudflare');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="max-w-3xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Cloud className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Connect Your Cloudflare Account</CardTitle>
          <CardDescription>
            To manage domains, you need to connect your Cloudflare account. This is a one-time setup.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Collapsible step-by-step instructions */}
          <Collapsible open={isInstructionsOpen} onOpenChange={setIsInstructionsOpen}>
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">Setup Instructions</h3>
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isInstructionsOpen ? '' : '-rotate-90'}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-4">
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Create Cloudflare Account</strong> (if you don&apos;t have one)
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

                  <li>
                    <strong className="text-foreground">Get Account ID</strong>
                    <br />
                    <a
                      href="https://dash.cloudflare.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 ml-6 mt-1"
                    >
                      Go to Cloudflare Dashboard
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <ul className="list-disc list-inside ml-6 mt-2">
                      <li>Your Account ID appears in the URL after logging in</li>
                      <li>Example: dash.cloudflare.com/<strong className="text-foreground">[your-account-id]</strong>/...</li>
                      <li>Copy this ID from the URL</li>
                    </ul>
                  </li>

                  <li>
                    <strong className="text-foreground">Create API Token</strong>
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li>In the sidebar, click &quot;Manage Account&quot; → &quot;Account API Tokens&quot;</li>
                      <li>Click &quot;Create Token&quot;</li>
                      <li>Use &quot;Edit zone DNS&quot; template OR create custom token</li>
                      <li>
                        Required permissions:
                        <ul className="ml-6 mt-1">
                          <li>• <strong className="text-foreground">Zone → Zone → Edit</strong></li>
                          <li>• <strong className="text-foreground">Zone → DNS → Edit</strong></li>
                        </ul>
                      </li>
                      <li>Click include and all zones</li>
                      <li>Click &quot;Continue to summary&quot; → &quot;Create Token&quot;</li>
                      <li>Copy the token (you won&apos;t see it again!)</li>
                    </ul>
                  </li>

                  <li>
                    <strong className="text-foreground">Paste below and connect!</strong>
                  </li>
                </ol>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Input form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiToken">
                Cloudflare API Token <span className="text-red-500">*</span>
              </Label>
              <Input
                id="apiToken"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste your API token here"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll encrypt and securely store your token
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">
                Cloudflare Account ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Paste your Account ID here"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Found in your dashboard URL (e.g., dash.cloudflare.com/[account-id]/...)
              </p>
            </div>
          </div>

          {/* Action button */}
          <Button
            onClick={handleSave}
            disabled={!apiToken || !accountId || isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              'Connecting...'
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Connect Cloudflare Account
              </>
            )}
          </Button>

          {/* Security note */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Why do we need this?</strong> Your API token allows us to automatically
              create DNS zones and configure email records in your Cloudflare account. We never
              see or store your Cloudflare password. You can revoke this token at any time from
              the Cloudflare dashboard.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
