/**
 * Credential Setup Banner Component
 *
 * Displays missing service credentials with setup CTAs
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Cloud, Mail, Flame } from 'lucide-react';
import { ServiceCredentialsModal } from './ServiceCredentialsModal';
import { useState } from 'react';

interface CredentialStatus {
  cloudflare: boolean;
  googleWorkspace: boolean;
  smartlead: boolean;
}

interface CredentialSetupBannerProps {
  credentialStatus: CredentialStatus;
}

export function CredentialSetupBanner({
  credentialStatus,
}: CredentialSetupBannerProps) {
  const [activeService, setActiveService] = useState<
    'cloudflare' | 'googleWorkspace' | 'smartlead' | null
  >(null);

  const { cloudflare, googleWorkspace, smartlead } = credentialStatus;
  const allConfigured = cloudflare && googleWorkspace && smartlead;
  const hasCloudflare = cloudflare;

  // Don't show banner if all services are configured
  if (allConfigured) {
    return null;
  }

  const services = [
    {
      id: 'cloudflare' as const,
      name: 'Cloudflare',
      icon: Cloud,
      description: 'Required for DNS management and domain setup',
      configured: cloudflare,
      required: true,
    },
    {
      id: 'googleWorkspace' as const,
      name: 'Google Workspace',
      icon: Mail,
      description: 'Required for DKIM record generation and email provisioning',
      configured: googleWorkspace,
      required: false,
    },
    {
      id: 'smartlead' as const,
      name: 'Smartlead',
      icon: Flame,
      description: 'Optional for automated email warmup',
      configured: smartlead,
      required: false,
    },
  ];

  return (
    <>
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-1">
                {!hasCloudflare
                  ? 'Connect Your Services to Get Started'
                  : 'Optional Services Available'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {!hasCloudflare
                  ? 'Connect to Cloudflare to manage domains and configure email infrastructure.'
                  : 'Connect additional services to unlock more features.'}
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-full p-2 ${
                        service.configured
                          ? 'bg-green-500/10'
                          : 'bg-muted'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          service.configured
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{service.name}</span>
                        {service.required ? (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Optional
                          </Badge>
                        )}
                        {service.configured && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {service.description}
                      </p>
                    </div>
                  </div>
                  {!service.configured && (
                    <Button
                      size="sm"
                      onClick={() => setActiveService(service.id)}
                    >
                      Connect
                    </Button>
                  )}
                  {service.configured && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveService(service.id)}
                    >
                      Manage
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Service credentials modal */}
      <ServiceCredentialsModal
        open={activeService !== null}
        onOpenChange={(open) => !open && setActiveService(null)}
        service={activeService}
        initiallyConfigured={
          activeService
            ? credentialStatus[activeService]
            : false
        }
      />
    </>
  );
}
