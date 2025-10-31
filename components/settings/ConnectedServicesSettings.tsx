/**
 * Connected Services Settings Component
 *
 * Displays and manages all connected third-party services
 * (Cloudflare, Google Workspace, Smartlead)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, Mail, Flame, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { ServiceCredentialsModal } from '@/components/domains/ServiceCredentialsModal';
import { formatDistanceToNow } from 'date-fns';

interface CredentialStatus {
  cloudflare: boolean;
  googleWorkspace: boolean;
  smartlead: boolean;
}

interface CredentialDetailsDisplay {
  cloudflare?: {
    accountId: string;
    apiToken: string;
    connectedAt: string;
  };
  googleWorkspace?: {
    serviceAccountEmail: string;
    adminEmail: string;
    privateKey: string;
    customerId?: string;
    connectedAt: string;
  };
  smartlead?: {
    apiKey: string;
    email?: string;
    hasLoginCredentials: boolean;
    connectedAt: string;
  };
}

interface CredentialDetailsEdit {
  cloudflare?: {
    accountId: string;
  };
  googleWorkspace?: {
    serviceAccountEmail: string;
    adminEmail: string;
    customerId?: string;
  };
  smartlead?: {
    email?: string;
  };
}

interface ConnectedServicesSettingsProps {
  credentialStatus: CredentialStatus;
  credentialDetailsDisplay?: CredentialDetailsDisplay | null;
  credentialDetailsEdit?: CredentialDetailsEdit | null;
}

export default function ConnectedServicesSettings({
  credentialStatus,
  credentialDetailsDisplay,
  credentialDetailsEdit,
}: ConnectedServicesSettingsProps) {
  const [activeService, setActiveService] = useState<
    'cloudflare' | 'googleWorkspace' | 'smartlead' | null
  >(null);

  const services = [
    {
      id: 'cloudflare' as const,
      name: 'Cloudflare',
      icon: Cloud,
      description: 'DNS management and domain configuration',
      configured: credentialStatus.cloudflare,
      displayDetails: credentialDetailsDisplay?.cloudflare,
      editDetails: credentialDetailsEdit?.cloudflare,
      getDetailLines: () => {
        const details = credentialDetailsDisplay?.cloudflare;
        if (!details) return [];
        return [
          `Account ID: ${details.accountId}`,
          `API Token: ${details.apiToken}`,
        ];
      },
    },
    {
      id: 'googleWorkspace' as const,
      name: 'Google Workspace',
      icon: Mail,
      description: 'Email provisioning and DKIM record generation',
      configured: credentialStatus.googleWorkspace,
      displayDetails: credentialDetailsDisplay?.googleWorkspace,
      editDetails: credentialDetailsEdit?.googleWorkspace,
      getDetailLines: () => {
        const details = credentialDetailsDisplay?.googleWorkspace;
        if (!details) return [];
        const lines = [
          `Service Account: ${details.serviceAccountEmail}`,
          `Admin Email: ${details.adminEmail}`,
          `Private Key: ${details.privateKey}`,
        ];
        if (details.customerId) {
          lines.push(`Customer ID: ${details.customerId}`);
        }
        return lines;
      },
    },
    {
      id: 'smartlead' as const,
      name: 'Smartlead',
      icon: Flame,
      description: 'Automated email warmup and deliverability',
      configured: credentialStatus.smartlead,
      displayDetails: credentialDetailsDisplay?.smartlead,
      editDetails: credentialDetailsEdit?.smartlead,
      getDetailLines: () => {
        const details = credentialDetailsDisplay?.smartlead;
        if (!details) return [];
        const lines = [`API Key: ${details.apiKey}`];
        if (details.email) {
          lines.push(`Email: ${details.email}`);
        }
        // Show login credential status
        if (details.hasLoginCredentials) {
          lines.push(`Login: Configured ✓`);
        } else {
          lines.push(`Login: Not configured ⚠️`);
        }
        return lines;
      },
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Manage your connected services and API credentials. All credentials are encrypted and
          stored securely.
        </p>

        <div className="grid gap-4">
          {services.map((service) => {
            const Icon = service.icon;
            const isConfigured = service.configured;
            const detailLines = service.getDetailLines();

            return (
              <Card key={service.id} className="border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`rounded-full p-3 ${
                          isConfigured ? 'bg-green-500/10' : 'bg-muted'
                        }`}
                      >
                        <Icon
                          className={`h-6 w-6 ${
                            isConfigured ? 'text-green-500' : 'text-muted-foreground'
                          }`}
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold">{service.name}</h3>
                          {isConfigured ? (
                            <Badge variant="outline" className="gap-1 border-green-500/50 text-green-500">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-muted-foreground/50">
                              <XCircle className="h-3 w-3" />
                              Not Connected
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {service.description}
                        </p>

                        {isConfigured && detailLines.length > 0 && (
                          <div className="space-y-1 text-xs text-muted-foreground font-mono">
                            {detailLines.map((line, index) => (
                              <div key={index}>{line}</div>
                            ))}
                            {service.displayDetails?.connectedAt && (
                              <div className="mt-2 text-muted-foreground/70">
                                Connected{' '}
                                {formatDistanceToNow(new Date(service.displayDetails.connectedAt), {
                                  addSuffix: true,
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant={isConfigured ? 'outline' : 'default'}
                        onClick={() => setActiveService(service.id)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        {isConfigured ? 'Manage' : 'Connect'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Service credentials modal */}
      <ServiceCredentialsModal
        open={activeService !== null}
        onOpenChange={(open) => !open && setActiveService(null)}
        service={activeService}
        initiallyConfigured={activeService ? credentialStatus[activeService] : false}
        initialValues={credentialDetailsEdit}
      />
    </>
  );
}
