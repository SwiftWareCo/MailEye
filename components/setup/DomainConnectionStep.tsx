/**
 * Domain Connection Step Component
 *
 * Wizard step for connecting a domain (Task 7.2)
 * Adapted from DomainConnectionModal to work within wizard flow
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Globe, CheckCircle2 } from 'lucide-react';
import { NameserverInstructions } from '@/components/domains/NameserverInstructions';
import { useConnectDomain } from '@/lib/hooks/use-domains';
import type {
  DomainProvider,
  DomainConnectionInput,
  DomainConnectionResult,
  NameserverInstructions as NameserverInstructionsType,
} from '@/lib/types/domain';

const PROVIDERS: { value: DomainProvider; label: string }[] = [
  { value: 'godaddy', label: 'GoDaddy' },
  { value: 'namecheap', label: 'Namecheap' },
  { value: 'cloudflare', label: 'Cloudflare' },
  { value: 'google-domains', label: 'Google Domains' },
  { value: 'name.com', label: 'Name.com' },
  { value: 'hover', label: 'Hover' },
  { value: 'other', label: 'Other' },
];

interface DomainConnectionStepProps {
  userId: string;
  connectDomainAction: (input: DomainConnectionInput) => Promise<DomainConnectionResult>;
  onSuccess: (domainId: string, domain: string, nameserverInstructions: NameserverInstructionsType) => void;
  onError?: (error: string) => void;
}

export function DomainConnectionStep({
  userId,
  connectDomainAction,
  onSuccess,
  onError,
}: DomainConnectionStepProps) {
  const [domain, setDomain] = useState('');
  const [provider, setProvider] = useState<DomainProvider>('other');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<DomainConnectionResult | null>(null);

  // Use TanStack Query mutation
  const connectMutation = useConnectDomain(userId, connectDomainAction);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    connectMutation.mutate(
      {
        domain: domain.trim(),
        provider,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (connectionResult) => {
          setResult(connectionResult);
          if (!connectionResult.success) {
            const errorMessages = connectionResult.validationErrors || [
              connectionResult.error || 'Failed to connect domain',
            ];
            setErrors(errorMessages);
            if (onError) {
              onError(errorMessages[0]);
            }
          } else if (connectionResult.domain && connectionResult.nameserverInstructions) {
            // Success - notify parent wizard
            onSuccess(
              connectionResult.domain.id,
              connectionResult.domain.domain,
              connectionResult.nameserverInstructions
            );
          }
        },
      }
    );
  };

  // If domain connected successfully, show nameserver instructions
  const showInstructions = result?.success && result.nameserverInstructions && result.domain;

  if (showInstructions) {
    // Determine if this is a resumed setup
    const isResuming = result.isResuming;
    const title = isResuming ? 'Resuming Domain Setup' : 'Domain Connected Successfully!';
    const subtitle = isResuming
      ? 'Continuing setup for existing domain'
      : 'Now update your nameservers to complete setup';

    // Success state - show nameserver instructions
    return (
      <div className="space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>

        <NameserverInstructions
          instructions={result.nameserverInstructions!}
          domain={result.domain!.domain}
        />

        <Alert>
          <AlertDescription className="text-sm">
            <p className="font-semibold mb-2">Next Steps</p>
            <p className="text-muted-foreground">
              After updating your nameservers at {result.nameserverInstructions!.providerName},
              click &quot;Next&quot; below to proceed with verification. The wizard will guide
              you through the verification process.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Form state - show connection form
  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <Globe className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Connect Your Domain</h3>
          <p className="text-sm text-muted-foreground">
            Add a domain to set up email infrastructure and authentication
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error display */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm">
                    {error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Domain input */}
        <div className="space-y-2">
          <Label htmlFor="domain">
            Domain Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="domain"
            type="text"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={connectMutation.isPending}
            className="font-mono"
            required
          />
          <p className="text-xs text-muted-foreground">
            Enter your root domain (e.g., example.com, not www.example.com)
          </p>
        </div>

        {/* Provider selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">Domain Registrar</Label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as DomainProvider)}
            disabled={connectMutation.isPending}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Where did you purchase/register this domain?
          </p>
        </div>

        {/* Notes (optional) */}
        <div className="space-y-2">
          <Label htmlFor="notes">
            Notes <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="notes"
            type="text"
            placeholder="e.g., Production domain for client XYZ"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={connectMutation.isPending}
          />
        </div>

        {/* Info alert */}
        <Alert>
          <AlertDescription className="text-sm">
            <p className="font-semibold mb-1">What happens next?</p>
            <p className="text-muted-foreground">
              After connecting, you&apos;ll receive step-by-step instructions to update
              your domain&apos;s nameservers to Cloudflare. This allows us to automatically
              configure email authentication (SPF, DKIM, DMARC) and create email accounts.
            </p>
          </AlertDescription>
        </Alert>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={connectMutation.isPending || !domain.trim()}
          className="w-full"
        >
          {connectMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting Domain...
            </>
          ) : (
            <>
              <Globe className="mr-2 h-4 w-4" />
              Connect Domain
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
