/**
 * Domain Connection Modal Component
 *
 * Modal dialog for connecting a new domain
 * Uses TanStack Query mutation with toast notifications
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Globe } from 'lucide-react';
import { NameserverInstructions } from './NameserverInstructions';
import { useConnectDomain } from '@/lib/hooks/use-domains';
import type {
  DomainProvider,
  DomainConnectionInput,
  DomainConnectionResult,
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

interface DomainConnectionModalProps {
  userId: string;
  connectDomainAction: (input: DomainConnectionInput) => Promise<DomainConnectionResult>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DomainConnectionModal({
  userId,
  connectDomainAction,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DomainConnectionModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [provider, setProvider] = useState<DomainProvider>('other');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<DomainConnectionResult | null>(null);

  // Use controlled props if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

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
            setErrors(
              connectionResult.validationErrors || [
                connectionResult.error || 'Failed to connect domain',
              ]
            );
          }
        },
      }
    );
  };

  const handleReset = () => {
    setDomain('');
    setProvider('other');
    setNotes('');
    setErrors([]);
    setResult(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    // Reset form when closing
    if (!newOpen) {
      handleReset();
    }
  };

  // If domain connected successfully, show nameserver instructions
  const showInstructions = result?.success && result.nameserverInstructions && result.domain;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {showInstructions ? (
          // Success state - show nameserver instructions
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Domain Connected Successfully!</DialogTitle>
              <DialogDescription>
                Now update your nameservers to complete setup
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <NameserverInstructions
                instructions={result.nameserverInstructions!}
                domain={result.domain!.domain}
              />
              <div className="mt-6 flex justify-end">
                <Button onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Form state - show connection form
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Connect Your Domain
              </DialogTitle>
              <DialogDescription>
                Add a domain to set up email infrastructure and authentication
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
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
                    After connecting, you&apos;ll receive step-by-step instructions
                    to update your domain&apos;s nameservers to Cloudflare. This
                    allows us to automatically configure email authentication (SPF,
                    DKIM, DMARC) and create email accounts.
                  </p>
                </AlertDescription>
              </Alert>

              {/* Submit button */}
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={connectMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={connectMutation.isPending || !domain.trim()}
                >
                  {connectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Domain'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
