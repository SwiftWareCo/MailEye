/**
 * Email Account Creation Modal Component
 *
 * Modal for creating Google Workspace email accounts
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
import { Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EmailAccountCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainName: string;
  createEmailAccountAction: (
    emailPrefix: string,
    displayName: string,
    count?: number
  ) => Promise<{ success: boolean; error?: string; accounts?: unknown[] }>;
}

export function EmailAccountCreationModal({
  open,
  onOpenChange,
  domainName,
  createEmailAccountAction,
}: EmailAccountCreationModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [emailPrefix, setEmailPrefix] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(1);

  const resetForm = () => {
    setEmailPrefix('');
    setDisplayName('');
    setBatchMode(false);
    setBatchCount(1);
    setError(null);
    setSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createEmailAccountAction(
      emailPrefix.trim(),
      displayName.trim(),
      batchMode ? batchCount : undefined
    );

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        handleOpenChange(false);
        router.refresh();
      }, 2000);
    } else {
      setError(result.error || 'Failed to create email account(s)');
    }

    setLoading(false);
  };

  const fullEmail = emailPrefix ? `${emailPrefix}@${domainName}` : `user@${domainName}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Create Email Account
          </DialogTitle>
          <DialogDescription>
            Provision a new Google Workspace email account for {domainName}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Account Created!</h3>
              <p className="text-muted-foreground text-center">
                {batchMode
                  ? `${batchCount} email account(s) created successfully`
                  : `${fullEmail} created successfully`}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Batch mode toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="batch-mode"
                checked={batchMode}
                onChange={(e) => setBatchMode(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="batch-mode" className="cursor-pointer">
                Create multiple accounts
              </Label>
            </div>

            {!batchMode ? (
              <>
                {/* Single account mode */}
                <div className="space-y-2">
                  <Label htmlFor="email-prefix">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email-prefix"
                      type="text"
                      placeholder="john.doe"
                      value={emailPrefix}
                      onChange={(e) => setEmailPrefix(e.target.value)}
                      disabled={loading}
                      required
                      className="font-mono"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      @{domainName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the username part of the email (before @)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display-name">
                    Display Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="display-name"
                    type="text"
                    placeholder="John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The name that will appear in emails
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/50 rounded-md p-3">
                  <p className="text-sm">
                    <span className="font-medium">Preview:</span>{' '}
                    <span className="font-mono text-blue-400">{fullEmail}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Batch mode */}
                <div className="space-y-2">
                  <Label htmlFor="batch-prefix">
                    Email Prefix <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="batch-prefix"
                      type="text"
                      placeholder="sender"
                      value={emailPrefix}
                      onChange={(e) => setEmailPrefix(e.target.value)}
                      disabled={loading}
                      required
                      className="font-mono"
                    />
                    <span className="text-sm text-muted-foreground">
                      [1-{batchCount}]@{domainName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Accounts will be created as {emailPrefix}1@{domainName},{' '}
                    {emailPrefix}2@{domainName}, etc.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batch-count">
                    Number of Accounts <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="batch-count"
                    type="number"
                    min="1"
                    max="50"
                    value={batchCount}
                    onChange={(e) =>
                      setBatchCount(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    How many accounts to create (max 50)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batch-display-name">
                    Display Name Prefix <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="batch-display-name"
                    type="text"
                    placeholder="Sender"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Names will be &quot;{displayName} 1&quot;, &quot;{displayName} 2&quot;, etc.
                  </p>
                </div>

                <Alert>
                  <AlertDescription className="text-sm">
                    Creating {batchCount} account(s) with prefix &quot;{emailPrefix}&quot;
                  </AlertDescription>
                </Alert>
              </>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !emailPrefix || !displayName}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : batchMode ? (
                  `Create ${batchCount} Account(s)`
                ) : (
                  'Create Account'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
