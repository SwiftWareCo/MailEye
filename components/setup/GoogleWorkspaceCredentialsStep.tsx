/**
 * Google Workspace Credentials Setup Step
 *
 * Second step in setup wizard - connects Google Workspace Admin SDK (REQUIRED for DKIM)
 * Collects service account credentials for domain-wide delegation
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Mail,
  Info,
  ExternalLink,
  CheckCircle,
  ChevronDown,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface GoogleWorkspaceCredentialsStepProps {
  saveCredentialsAction: (
    serviceAccountEmail: string,
    privateKey: string,
    adminEmail: string,
    customerId?: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSuccess: () => void;
  onError?: (error: string) => void;
}

export function GoogleWorkspaceCredentialsStep({
  saveCredentialsAction,
  onSuccess,
  onError,
}: GoogleWorkspaceCredentialsStepProps) {
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceAccountEmail.trim() || !privateKey.trim() || !adminEmail.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await saveCredentialsAction(
      serviceAccountEmail.trim(),
      privateKey.trim(),
      adminEmail.trim(),
      customerId.trim() || undefined
    );

    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
      // Auto-advance after brief delay
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } else {
      const errorMessage = result.error || 'Failed to connect Google Workspace';
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
            <h3 className="text-xl font-semibold">Google Workspace Connected! 🎉</h3>
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
              Google Workspace Admin SDK is now connected. We can generate DKIM keys and create
              email accounts for your domains.
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
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Connect Google Workspace</h3>
          <p className="text-sm text-muted-foreground">
            Required for DKIM generation and email account creation
          </p>
        </div>
      </div>

      {/* Why Required Alert */}
      <Alert className="border-yellow-500/20 bg-yellow-500/10">
        <ShieldCheck className="h-4 w-4 text-yellow-500" />
        <AlertDescription>
          <p className="font-semibold text-yellow-500">Why is this required?</p>
          <p className="text-sm text-muted-foreground mt-1">
            DKIM (DomainKeys Identified Mail) is essential for email deliverability. Without it,
            your emails are <strong>40-60% more likely to land in spam</strong>. Google Workspace Admin
            SDK access is needed to automatically generate DKIM keys for your domains.
          </p>
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
                  Create a Google Cloud Project
                  <br />
                  <a
                    href="https://console.cloud.google.com/projectcreate"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 ml-6 mt-1"
                  >
                    Create project in Google Cloud Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>

                <li className="font-medium">
                  Enable Admin SDK API
                  <br />
                  <span className="text-muted-foreground ml-6">
                    Go to{' '}
                    <a
                      href="https://console.cloud.google.com/apis/library/admin.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Admin SDK API
                    </a>{' '}
                    → Click &quot;Enable&quot;
                  </span>
                </li>

                <li className="font-medium">
                  Create Service Account
                  <br />
                  <div className="ml-6 space-y-1 text-muted-foreground">
                    <p>
                      Go to{' '}
                      <a
                        href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Service Accounts
                      </a>{' '}
                      → Create Service Account → Name it (e.g., &quot;email-service&quot;)
                    </p>
                  </div>
                </li>

                <li className="font-medium">
                  Create and Download Private Key
                  <br />
                  <span className="text-muted-foreground ml-6">
                    Click on the service account → Keys tab → Add Key → Create new key → JSON
                    format
                  </span>
                </li>

                <li className="font-medium">
                  Enable Domain-Wide Delegation
                  <br />
                  <div className="ml-6 space-y-1 text-muted-foreground">
                    <p>Service Account → Details tab → Enable domain-wide delegation</p>
                    <p className="text-xs">Required OAuth Scopes:</p>
                    <ul className="text-xs list-disc list-inside ml-4 font-mono">
                      <li>https://www.googleapis.com/auth/admin.directory.user</li>
                      <li>https://www.googleapis.com/auth/admin.directory.user.security</li>
                    </ul>
                  </div>
                </li>

                <li className="font-medium">
                  Authorize in Google Workspace Admin
                  <br />
                  <span className="text-muted-foreground ml-6">
                    Go to{' '}
                    <a
                      href="https://admin.google.com/ac/owl/domainwidedelegation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Domain-wide Delegation
                    </a>{' '}
                    → Add the Client ID with the scopes above
                  </span>
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

        {/* Service Account Email */}
        <div className="space-y-2">
          <Label htmlFor="serviceAccountEmail">
            Service Account Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="serviceAccountEmail"
            type="email"
            placeholder="your-service@project-id.iam.gserviceaccount.com"
            value={serviceAccountEmail}
            onChange={(e) => setServiceAccountEmail(e.target.value)}
            disabled={isLoading}
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            Found in the JSON key file as &quot;client_email&quot;
          </p>
        </div>

        {/* Private Key */}
        <div className="space-y-2">
          <Label htmlFor="privateKey">
            Private Key <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="privateKey"
            placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvQIBADANBg...&#10;-----END PRIVATE KEY-----"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            disabled={isLoading}
            className="font-mono text-xs min-h-[120px]"
            required
          />
          <p className="text-xs text-muted-foreground">
            Found in the JSON key file as &quot;private_key&quot; (including -----BEGIN/END-----)
          </p>
        </div>

        {/* Admin Email */}
        <div className="space-y-2">
          <Label htmlFor="adminEmail">
            Google Workspace Admin Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="adminEmail"
            type="email"
            placeholder="admin@yourdomain.com"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            disabled={isLoading}
            required
          />
          <p className="text-xs text-muted-foreground">
            Email of a Google Workspace Super Admin for domain-wide delegation
          </p>
        </div>

        {/* Customer ID (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="customerId">
            Customer ID <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="customerId"
            type="text"
            placeholder="C0abcd123"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={isLoading}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Found in Google Admin Console → Account → Account settings (uses &quot;my_customer&quot;
            if not provided)
          </p>
        </div>

        {/* Submit Button */}
        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying Credentials...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Connect Google Workspace
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
