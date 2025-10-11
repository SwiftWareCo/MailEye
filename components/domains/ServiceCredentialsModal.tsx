/**
 * Service Credentials Modal Component
 *
 * Modal for setting up Cloudflare, Google Workspace, and Smartlead credentials
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Cloud, Mail, Flame, CheckCircle2 } from 'lucide-react';
import { saveCloudflareCredentialsAction } from '@/server/cloudflare/cloudflare.actions';
import { saveGoogleWorkspaceCredentialsAction } from '@/server/google-workspace/google-workspace.actions';
import { saveSmartleadCredentialsAction } from '@/server/smartlead/credentials.actions';
import { disconnectCloudflareAction } from '@/server/cloudflare/cloudflare.actions';
import { disconnectGoogleWorkspaceAction } from '@/server/google-workspace/google-workspace.actions';
import { disconnectSmartleadAction } from '@/server/smartlead/credentials.actions';
import { useRouter } from 'next/navigation';

interface ServiceCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: 'cloudflare' | 'googleWorkspace' | 'smartlead' | null;
  initiallyConfigured: boolean;
}

export function ServiceCredentialsModal({
  open,
  onOpenChange,
  service,
  initiallyConfigured,
}: ServiceCredentialsModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Cloudflare state
  const [cfApiToken, setCfApiToken] = useState('');
  const [cfAccountId, setCfAccountId] = useState('');

  // Google Workspace state
  const [gwServiceAccountEmail, setGwServiceAccountEmail] = useState('');
  const [gwPrivateKey, setGwPrivateKey] = useState('');
  const [gwAdminEmail, setGwAdminEmail] = useState('');
  const [gwCustomerId, setGwCustomerId] = useState('');

  // Smartlead state
  const [slApiKey, setSlApiKey] = useState('');

  const resetForm = () => {
    setCfApiToken('');
    setCfAccountId('');
    setGwServiceAccountEmail('');
    setGwPrivateKey('');
    setGwAdminEmail('');
    setGwCustomerId('');
    setSlApiKey('');
    setError(null);
    setSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const handleSaveCloudflare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await saveCloudflareCredentialsAction(cfApiToken.trim(), cfAccountId.trim());

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        handleOpenChange(false);
        router.refresh();
      }, 1500);
    } else {
      setError(result.error || 'Failed to save Cloudflare credentials');
    }

    setLoading(false);
  };

  const handleSaveGoogleWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await saveGoogleWorkspaceCredentialsAction(
      gwServiceAccountEmail.trim(),
      gwPrivateKey.trim(),
      gwAdminEmail.trim(),
      gwCustomerId.trim() || undefined
    );

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        handleOpenChange(false);
        router.refresh();
      }, 1500);
    } else {
      setError(result.error || 'Failed to save Google Workspace credentials');
    }

    setLoading(false);
  };

  const handleSaveSmartlead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await saveSmartleadCredentialsAction(slApiKey.trim());

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        handleOpenChange(false);
        router.refresh();
      }, 1500);
    } else {
      setError(result.error || 'Failed to save Smartlead credentials');
    }

    setLoading(false);
  };

  const handleDisconnect = async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    let result;
    if (service === 'cloudflare') {
      result = await disconnectCloudflareAction();
    } else if (service === 'googleWorkspace') {
      result = await disconnectGoogleWorkspaceAction();
    } else if (service === 'smartlead') {
      result = await disconnectSmartleadAction();
    }

    if (result?.success) {
      setSuccess(true);
      setTimeout(() => {
        handleOpenChange(false);
        router.refresh();
      }, 1500);
    } else {
      setError(result?.error || 'Failed to disconnect service');
    }

    setLoading(false);
  };

  const getServiceConfig = () => {
    switch (service) {
      case 'cloudflare':
        return {
          name: 'Cloudflare',
          icon: Cloud,
          description: 'Connect your Cloudflare account to manage DNS and domains',
        };
      case 'googleWorkspace':
        return {
          name: 'Google Workspace',
          icon: Mail,
          description: 'Connect Google Workspace for email provisioning and DKIM',
        };
      case 'smartlead':
        return {
          name: 'Smartlead',
          icon: Flame,
          description: 'Connect Smartlead for automated email warmup',
        };
      default:
        return null;
    }
  };

  const serviceConfig = getServiceConfig();

  if (!service || !serviceConfig) {
    return null;
  }

  const ServiceIcon = serviceConfig.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServiceIcon className="h-5 w-5 text-primary" />
            {serviceConfig.name} Connection
          </DialogTitle>
          <DialogDescription>{serviceConfig.description}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {initiallyConfigured ? 'Settings Updated!' : 'Connected Successfully!'}
              </h3>
              <p className="text-muted-foreground">Redirecting...</p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Cloudflare Form */}
            {service === 'cloudflare' && (
              <form onSubmit={handleSaveCloudflare} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cf-api-token">
                    API Token <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cf-api-token"
                    type="password"
                    placeholder="Your Cloudflare API token"
                    value={cfApiToken}
                    onChange={(e) => setCfApiToken(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Create an API token in Cloudflare Dashboard → My Profile → API Tokens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cf-account-id">
                    Account ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cf-account-id"
                    type="text"
                    placeholder="Your Cloudflare account ID"
                    value={cfAccountId}
                    onChange={(e) => setCfAccountId(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Find your Account ID in Cloudflare Dashboard → Overview
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  {initiallyConfigured && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={loading}
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || !cfApiToken || !cfAccountId}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Save & Verify'
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* Google Workspace Form */}
            {service === 'googleWorkspace' && (
              <form onSubmit={handleSaveGoogleWorkspace} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gw-service-account">
                    Service Account Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="gw-service-account"
                    type="email"
                    placeholder="service-account@project.iam.gserviceaccount.com"
                    value={gwServiceAccountEmail}
                    onChange={(e) => setGwServiceAccountEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gw-private-key">
                    Private Key <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="gw-private-key"
                    placeholder="-----BEGIN PRIVATE KEY-----..."
                    value={gwPrivateKey}
                    onChange={(e) => setGwPrivateKey(e.target.value)}
                    disabled={loading}
                    rows={4}
                    className="font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gw-admin-email">
                    Admin Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="gw-admin-email"
                    type="email"
                    placeholder="admin@yourdomain.com"
                    value={gwAdminEmail}
                    onChange={(e) => setGwAdminEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gw-customer-id">
                    Customer ID <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="gw-customer-id"
                    type="text"
                    placeholder="C01234567"
                    value={gwCustomerId}
                    onChange={(e) => setGwCustomerId(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  {initiallyConfigured && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={loading}
                    >
                      Disconnect
                    </Button>
                  )}
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
                      !gwServiceAccountEmail ||
                      !gwPrivateKey ||
                      !gwAdminEmail
                    }
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Save & Verify'
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* Smartlead Form */}
            {service === 'smartlead' && (
              <form onSubmit={handleSaveSmartlead} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sl-api-key">
                    API Key <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sl-api-key"
                    type="password"
                    placeholder="Your Smartlead API key"
                    value={slApiKey}
                    onChange={(e) => setSlApiKey(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Find your API key in Smartlead → Settings → API
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  {initiallyConfigured && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={loading}
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || !slApiKey}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Save & Verify'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
