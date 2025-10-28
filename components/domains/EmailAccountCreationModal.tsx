/**
 * Email Account Creation Modal Component
 *
 * Modal for creating Google Workspace email accounts with support for:
 * - Single account creation
 * - Batch creation with prefix (quick setup)
 * - Batch creation with custom names (full control)
 */

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Loader2, AlertCircle, CheckCircle2, Mail, Plus, Trash2, Sparkles } from 'lucide-react';
import { batchCreateEmailAccountsAction } from '@/server/email/email.actions';
import { toast } from 'sonner';

interface EmailAccountCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainId: string;
  domainName: string;
}

export function EmailAccountCreationModal({
  open,
  onOpenChange,
  domainId,
  domainName,
}: EmailAccountCreationModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [emailPrefix, setEmailPrefix] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(3);
  const [customNamesMode, setCustomNamesMode] = useState(false);
  const [customAccounts, setCustomAccounts] = useState<Array<{ username: string; displayName: string }>>([
    { username: '', displayName: '' },
    { username: '', displayName: '' },
    { username: '', displayName: '' },
  ]);

  const resetForm = () => {
    setEmailPrefix('');
    setDisplayName('');
    setBatchMode(false);
    setBatchCount(3);
    setCustomNamesMode(false);
    setCustomAccounts([
      { username: '', displayName: '' },
      { username: '', displayName: '' },
      { username: '', displayName: '' },
    ]);
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

    try {
      // Custom names mode - pass array of accounts
      if (customNamesMode) {
        // Filter out empty accounts
        const filledAccounts = customAccounts.filter(
          (acc) => acc.username.trim() && acc.displayName.trim()
        );

        if (filledAccounts.length === 0) {
          setError('At least one account must have a username and display name');
          setLoading(false);
          return;
        }

        // Validate usernames (no spaces, no special chars except dots/hyphens)
        const invalidUsernames = filledAccounts.filter((acc) =>
          /[^a-zA-Z0-9.-]/.test(acc.username)
        );

        if (invalidUsernames.length > 0) {
          setError('Usernames can only contain letters, numbers, dots, and hyphens');
          setLoading(false);
          return;
        }

        // Check for duplicate usernames
        const usernames = filledAccounts.map((acc) => acc.username.toLowerCase());
        const uniqueUsernames = new Set(usernames);
        if (usernames.length !== uniqueUsernames.size) {
          setError('Duplicate usernames detected. Each username must be unique.');
          setLoading(false);
          return;
        }

        // Call batch creation action with custom accounts
        const result = await batchCreateEmailAccountsAction({
          domainId,
          emailPrefix: '',
          displayNamePrefix: '',
          count: filledAccounts.length,
          customAccounts: filledAccounts,
        });

        if (result.success || result.successfulAccounts > 0) {
          setSuccess(true);
          // Invalidate caches after success
          queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
          queryClient.invalidateQueries({ queryKey: ['domain-setup-status', domainId] });
          toast.success('Email account(s) created successfully!');

          setTimeout(() => {
            handleOpenChange(false);
          }, 1500);
        } else {
          setError(result.results[0]?.error || 'Failed to create email account(s)');
          toast.error('Failed to create email accounts');
        }

        setLoading(false);
        return;
      }

      // Regular mode (single or batch with prefix)
      const result = await batchCreateEmailAccountsAction({
        domainId,
        emailPrefix: emailPrefix.trim(),
        displayNamePrefix: displayName.trim(),
        count: batchMode ? batchCount : 1,
      });

      if (result.success || result.successfulAccounts > 0) {
        setSuccess(true);
        // Invalidate caches after success
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
        queryClient.invalidateQueries({ queryKey: ['domain-setup-status', domainId] });
        toast.success(`${result.successfulAccounts} email account(s) created successfully!`);

        setTimeout(() => {
          handleOpenChange(false);
        }, 1500);
      } else {
        setError(result.results[0]?.error || 'Failed to create email account(s)');
        toast.error('Failed to create email accounts');
      }

      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error('Error creating email accounts', { description: errorMessage });
      setLoading(false);
    }
  };

  const addCustomAccount = () => {
    if (customAccounts.length < 5) {
      setCustomAccounts([...customAccounts, { username: '', displayName: '' }]);
    }
  };

  const removeCustomAccount = (index: number) => {
    if (customAccounts.length > 1) {
      setCustomAccounts(customAccounts.filter((_, i) => i !== index));
    }
  };

  const updateCustomAccount = (index: number, field: 'username' | 'displayName', value: string) => {
    const updated = [...customAccounts];
    updated[index][field] = value;
    setCustomAccounts(updated);
  };

  const generateSuggestedNames = () => {
    // Best practice: Use common first names for cold email accounts
    const commonNames = [
      { username: 'john', displayName: 'John from ' + domainName.split('.')[0] },
      { username: 'sarah', displayName: 'Sarah from ' + domainName.split('.')[0] },
      { username: 'alex', displayName: 'Alex from ' + domainName.split('.')[0] },
      { username: 'maria', displayName: 'Maria from ' + domainName.split('.')[0] },
      { username: 'david', displayName: 'David from ' + domainName.split('.')[0] },
    ];

    setCustomAccounts(commonNames.slice(0, customAccounts.length));
  };

  const fullEmail = emailPrefix ? `${emailPrefix}@${domainName}` : `user@${domainName}`;
  const totalAccountsToCreate = customNamesMode
    ? customAccounts.filter((acc) => acc.username.trim() && acc.displayName.trim()).length
    : batchMode
    ? batchCount
    : 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Create Email Account
          </DialogTitle>
          <DialogDescription>
            Provision new Google Workspace email account(s) for {domainName}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Account(s) Created!</h3>
              <p className="text-muted-foreground text-center">
                {customNamesMode || batchMode
                  ? `${totalAccountsToCreate} email account(s) created successfully`
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
                onChange={(e) => {
                  setBatchMode(e.target.checked);
                  if (!e.target.checked) {
                    setCustomNamesMode(false);
                  }
                }}
                className="rounded border-input"
              />
              <Label htmlFor="batch-mode" className="cursor-pointer">
                Create multiple accounts
              </Label>
            </div>

            {/* Custom names mode toggle (only show when batch mode is on) */}
            {batchMode && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom-names-mode"
                  checked={customNamesMode}
                  onChange={(e) => setCustomNamesMode(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="custom-names-mode" className="cursor-pointer">
                  Specify custom names for each account (recommended for cold email)
                </Label>
              </div>
            )}

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
                      placeholder="john"
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
                    Use a real first name (e.g., john, sarah, alex)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display-name">
                    Display Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="display-name"
                    type="text"
                    placeholder="John from AcmeCorp"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Keep it under 30 characters for mobile visibility
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/50 rounded-md p-3">
                  <p className="text-sm">
                    <span className="font-medium">Preview:</span>{' '}
                    <span className="font-mono text-blue-400">{fullEmail}</span>
                  </p>
                </div>
              </>
            ) : customNamesMode ? (
              <>
                {/* Custom names mode */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Custom Email Accounts (max 5)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateSuggestedNames}
                      disabled={loading}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Suggest Names
                    </Button>
                  </div>

                  {customAccounts.map((account, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          type="text"
                          placeholder="Username (e.g., john)"
                          value={account.username}
                          onChange={(e) => updateCustomAccount(index, 'username', e.target.value)}
                          disabled={loading}
                          className="font-mono"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          type="text"
                          placeholder="Display Name (e.g., John from Acme)"
                          value={account.displayName}
                          onChange={(e) => updateCustomAccount(index, 'displayName', e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomAccount(index)}
                        disabled={loading || customAccounts.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {customAccounts.length < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomAccount}
                      disabled={loading}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Account
                    </Button>
                  )}

                  <Alert>
                    <AlertDescription className="text-sm">
                      <strong>Best Practice:</strong> Use real first names (john, sarah, alex) instead of
                      generic names (sender1, user2). This improves deliverability for cold emails.
                    </AlertDescription>
                  </Alert>
                </div>
              </>
            ) : (
              <>
                {/* Batch mode with prefix */}
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
                    max="5"
                    value={batchCount}
                    onChange={(e) =>
                      setBatchCount(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))
                    }
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Industry best practice: 3-5 accounts per domain (max 5)
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
                    Creating {batchCount} account(s) with prefix &quot;{emailPrefix}&quot;.{' '}
                    <strong>Tip:</strong> Use custom names mode for better cold email deliverability.
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
                disabled={
                  loading ||
                  (!customNamesMode && (!emailPrefix || !displayName)) ||
                  (customNamesMode &&
                    customAccounts.every((acc) => !acc.username.trim() || !acc.displayName.trim()))
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create ${totalAccountsToCreate} Account${totalAccountsToCreate > 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
