/**
 * Nameserver Instructions Component
 *
 * Displays registrar-specific instructions for updating nameservers
 * with copy-to-clipboard functionality
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, ExternalLink } from 'lucide-react';
import type { NameserverInstructions } from '@/lib/types/domain';

interface NameserverInstructionsProps {
  instructions: NameserverInstructions;
  domain: string;
}

export function NameserverInstructions({
  instructions,
  domain,
}: NameserverInstructionsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Handle missing or empty nameservers
  const nameservers = instructions.nameservers || [];
  const hasNameservers = nameservers.length > 0;

  return (
    <div className="space-y-6">
      {/* Domain confirmation */}
      <Alert>
        <AlertDescription className="text-sm">
          You&apos;re setting up:{' '}
          <span className="font-semibold text-primary">{domain}</span>
        </AlertDescription>
      </Alert>

      {/* Nameservers card */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">
            Cloudflare Nameservers
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {hasNameservers
              ? `Update your domain to use these nameservers at ${instructions.providerName}`
              : 'Nameservers will be assigned when the Cloudflare zone is created'}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasNameservers ? (
            <Alert>
              <AlertDescription className="text-sm">
                <p className="font-semibold mb-2">⚠️ Nameservers Not Available</p>
                <p className="text-muted-foreground">
                  Cloudflare zone creation failed or is pending. Please ensure your
                  Cloudflare API token has the following permissions:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                  <li>Account → Account Settings → Read</li>
                  <li>Account → Account Zone → Edit</li>
                  <li>Zone → Zone → Edit</li>
                  <li>Zone → DNS → Edit</li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Update your token at:{' '}
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Cloudflare API Tokens
                  </a>
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            nameservers.map((ns, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3"
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
            ))
          )}
        </CardContent>
      </Card>

      {/* Instructions card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Setup Instructions for {instructions.providerName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Follow these steps to update your nameservers
          </p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {instructions.instructions.map((instruction, index) => (
              <li
                key={index}
                className="flex gap-3 text-sm text-muted-foreground"
              >
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs">
                  {index + 1}
                </span>
                <span className="pt-0.5">{instruction}</span>
              </li>
            ))}
          </ol>

          {/* Documentation link */}
          {instructions.documentationUrl && (
            <div className="mt-6 pt-6 border-t border-border">
              <a
                href={instructions.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View {instructions.providerName} Documentation
              </a>
            </div>
          )}

          {/* Estimated time */}
          <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-400">
              <span className="font-semibold">Estimated propagation time:</span>{' '}
              {instructions.estimatedPropagationTime}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Help text */}
      <Alert>
        <AlertDescription className="text-sm">
          <p className="font-semibold mb-2">What happens next?</p>
          <p className="text-muted-foreground">
            After updating your nameservers, propagation can take anywhere from a
            few minutes to 48 hours. Use the &quot;Check Nameservers&quot; button
            in the domain actions menu to verify when propagation is complete.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
