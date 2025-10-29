/**
 * Smartlead OAuth Connection Guide Modal
 *
 * Shows users their email password and step-by-step instructions
 * to connect their email account to Smartlead using Google OAuth.
 */

'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Mail,
  Key,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { syncSmartleadAccountAction } from '@/server/smartlead/sync.actions';

interface SmartleadOAuthGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  password: string;
  emailAccountId: string;
  onSyncSuccess?: () => void;
}

export function SmartleadOAuthGuide({
  open,
  onOpenChange,
  email,
  password,
  emailAccountId,
  onSyncSuccess,
}: SmartleadOAuthGuideProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Password copied to clipboard');
    } catch {
      toast.error('Failed to copy password');
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success('Email copied to clipboard');
    } catch {
      toast.error('Failed to copy email');
    }
  };

  const handleOpenSmartlead = () => {
    window.open('https://app.smartlead.ai/app/email-accounts', '_blank');
  };

  // Sync with Smartlead mutation
  const {
    mutate: syncAccount,
    isPending: isSyncing,
  } = useMutation({
    mutationFn: () => syncSmartleadAccountAction(emailAccountId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Successfully connected to Smartlead!', {
          description: `${result.email} is now synced and ready for warmup`,
        });
        onSyncSuccess?.();
        onOpenChange(false);
      } else {
        toast.error('Failed to verify connection', {
          description: result.error || 'Please try again',
        });
      }
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast.error('An error occurred', {
        description: 'Failed to sync with Smartlead',
      });
    },
  });

  const handleComplete = () => {
    if (!completed) {
      toast.error('Please check the box to confirm completion');
      return;
    }

    syncAccount();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-5 w-5" />
            Connect to Smartlead Warmup
          </DialogTitle>
          <DialogDescription>
            Follow these steps to connect your email to Smartlead using Google OAuth
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email and Password Display */}
          <div className="space-y-4 p-4 rounded-lg border bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  value={email}
                  readOnly
                  className="font-mono bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyEmail}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Password
              </Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  readOnly
                  className="font-mono bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPassword(!showPassword)}
                  className="shrink-0"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPassword}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Save this password securely. You&apos;ll need it to log into Gmail.
              </p>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Step-by-Step Guide</h3>

            {/* Step 1 */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  1
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="font-medium">Log into Gmail (First Time)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Go to <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mail.google.com</a></li>
                    <li>Sign in with the email and password above</li>
                    <li>Optional: Change your password to something memorable</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  2
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="font-medium">Connect to Smartlead</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Click &ldquo;Open Smartlead Dashboard&rdquo; button below</li>
                    <li>In Smartlead: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Email Accounts → Add Mailbox</span></li>
                    <li>Select <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Private Infra</span> → <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Google OAuth</span></li>
                    <li>Choose your email (<span className="font-mono text-xs">{email}</span>) and authorize</li>
                  </ul>
                  <Button
                    onClick={handleOpenSmartlead}
                    className="mt-2 w-full sm:w-auto"
                  >
                    Open Smartlead Dashboard
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="font-medium">Return Here When Complete</h4>
                  <p className="text-sm text-muted-foreground">
                    After successfully connecting in Smartlead, return to this page and check the box below
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Completion Checkbox */}
          <div className="flex items-start space-x-3 p-4 rounded-lg border bg-green-500/10 border-green-500/50">
            <Checkbox
              id="completed"
              checked={completed}
              onCheckedChange={(checked) => setCompleted(checked === true)}
              className="mt-1"
            />
            <div className="space-y-1 flex-1">
              <label
                htmlFor="completed"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                I&apos;ve successfully connected this email to Smartlead
              </label>
              <p className="text-xs text-muted-foreground">
                Check this box after completing the OAuth connection in Smartlead
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSyncing}>
              Close
            </Button>
            <Button onClick={handleComplete} disabled={!completed || isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying Connection...
                </>
              ) : (
                "I'm Done"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
