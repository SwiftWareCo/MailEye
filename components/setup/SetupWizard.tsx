/**
 * Setup Wizard Component (Full-Page)
 *
 * Main wizard container that orchestrates the email infrastructure setup flow
 * Now renders as a full page instead of a dialog modal
 * Handles step routing, state management, and navigation
 */

'use client';

import { useSetupWizard } from '@/lib/hooks/use-setup-wizard';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { CloudflareCredentialsStep } from './CloudflareCredentialsStep';
import { GoogleWorkspaceCredentialsStep } from './GoogleWorkspaceCredentialsStep';
import { SmartleadCredentialsStep } from './SmartleadCredentialsStep';
import { DomainConnectionStep } from './DomainConnectionStep';
import { NameserverVerificationStep } from './NameserverVerificationStep';
import { DNSConfigurationStep } from './DNSConfigurationStep';
import { DNSStatusMonitor } from './DNSStatusMonitor';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import type { DomainConnectionInput, DomainConnectionResult } from '@/lib/types/domain';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';
import type { DNSSetupResult } from '@/server/dns/dns-manager';
import type { EmailAccountResult } from '@/lib/types/email';
import type { SmartleadConnectionResult } from '@/lib/types/smartlead';
import type { PollingSession } from '@/server/dns/polling-job';

interface SetupWizardProps {
  // User context
  userId: string;

  // Credential setup status (to skip already configured steps)
  credentialStatus: {
    cloudflare: boolean;
    googleWorkspace: boolean;
    smartlead: boolean;
  };

  // Server Actions (passed from parent page)
  saveCloudflareCredentialsAction: (
    apiToken: string,
    accountId: string
  ) => Promise<{ success: boolean; error?: string }>;
  saveGoogleWorkspaceCredentialsAction: (
    serviceAccountEmail: string,
    privateKey: string,
    adminEmail: string,
    customerId?: string
  ) => Promise<{ success: boolean; error?: string }>;
  saveSmartleadCredentialsAction: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  connectDomainAction: (input: DomainConnectionInput) => Promise<DomainConnectionResult>;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;
  setupDNSAction: (domainId: string) => Promise<DNSSetupResult>;
  startPollingAction: (
    domainId: string
  ) => Promise<{ success: boolean; data?: PollingSession; error?: string }>;
  // TODO: Implement email provisioning and warmup steps
  createEmailAccountAction?: (params: {
    domainId: string;
    username: string;
    firstName: string;
    lastName: string;
  }) => Promise<EmailAccountResult>;
  connectToSmartleadAction?: (emailAccountId: string) => Promise<SmartleadConnectionResult>;
}

export function SetupWizard({
  userId,
  credentialStatus,
  saveCloudflareCredentialsAction,
  saveGoogleWorkspaceCredentialsAction,
  saveSmartleadCredentialsAction,
  connectDomainAction,
  verifyNameserversAction,
  setupDNSAction,
  startPollingAction,
}: SetupWizardProps) {
  const router = useRouter();

  // Calculate initial step based on credential status
  const getInitialStep = () => {
    if (!credentialStatus.cloudflare) return 1; // Cloudflare
    if (!credentialStatus.googleWorkspace) return 2; // Google Workspace
    if (!credentialStatus.smartlead) return 3; // Smartlead (optional, but show)
    return 4; // Domain connection (all credentials configured)
  };

  const {
    currentStep,
    wizardData,
    steps,
    goToNextStep,
    goToPrevious,
    skipStep,
    goToStep,
    updateWizardData,
    getCurrentStep,
    isStepCompleted,
    canGoNext,
    canGoPrevious,
    canSkip,
  } = useSetupWizard(getInitialStep(), credentialStatus);

  const currentStepInfo = getCurrentStep();

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Cloudflare Credentials
        return (
          <CloudflareCredentialsStep
            saveCredentialsAction={saveCloudflareCredentialsAction}
            onSuccess={() => {
              updateWizardData({ cloudflareConnected: true });
              goToNextStep();
            }}
            onError={(error) => {
              console.error('Cloudflare connection error:', error);
            }}
          />
        );

      case 2: // Google Workspace Credentials
        return (
          <GoogleWorkspaceCredentialsStep
            saveCredentialsAction={saveGoogleWorkspaceCredentialsAction}
            onSuccess={() => {
              updateWizardData({ googleWorkspaceConnected: true });
              goToNextStep();
            }}
            onError={(error) => {
              console.error('Google Workspace connection error:', error);
            }}
          />
        );

      case 3: // Smartlead Credentials (Optional)
        return (
          <SmartleadCredentialsStep
            saveCredentialsAction={saveSmartleadCredentialsAction}
            onSuccess={() => {
              updateWizardData({ smartleadConnected: true });
              goToNextStep();
            }}
            onSkip={() => {
              updateWizardData({ smartleadConnected: false });
              goToNextStep();
            }}
            onError={(error) => {
              console.error('Smartlead connection error:', error);
            }}
          />
        );

      case 4: // Domain Connection
        return (
          <DomainConnectionStep
            userId={userId}
            connectDomainAction={connectDomainAction}
            onSuccess={(domainId, domain, nameserverInstructions) => {
              updateWizardData({
                domainId,
                domain,
                provider: nameserverInstructions.provider,
              });
              setTimeout(() => {
                goToNextStep();
              }, 1000);
            }}
            onError={(error) => {
              console.error('Domain connection error:', error);
            }}
          />
        );

      case 5: // Nameserver Verification
        return (
          <NameserverVerificationStep
            domainId={wizardData.domainId || ''}
            domain={wizardData.domain || ''}
            verifyNameserversAction={verifyNameserversAction}
            onVerified={() => {
              updateWizardData({ nameserversVerified: true });
              goToNextStep();
            }}
            onSkip={() => {
              updateWizardData({ nameserversVerified: false, skippedVerification: true });
              goToNextStep();
            }}
          />
        );

      case 6: // DNS Configuration
        return (
          <DNSConfigurationStep
            domainId={wizardData.domainId || ''}
            domain={wizardData.domain || ''}
            setupDNSAction={setupDNSAction}
            startPollingAction={startPollingAction}
            onSuccess={(pollingSessionId) => {
              updateWizardData({
                dnsConfigured: true,
                pollingSessionId,
              });
              goToNextStep();
            }}
            onError={(error) => {
              console.error('DNS setup error:', error);
            }}
          />
        );

      case 7: // DNS Propagation Monitoring
        return (
          <DNSStatusMonitor
            pollingSessionId={wizardData.pollingSessionId || ''}
            domain={wizardData.domain || ''}
            onComplete={() => {
              updateWizardData({ dnsFullyPropagated: true });
              goToNextStep();
            }}
            showDetails={true}
          />
        );

      case 8: // Email Provisioning
        return (
          <div className="space-y-4 py-6">
            <h3 className="text-lg font-semibold">Email Account Provisioning</h3>
            <p className="text-sm text-muted-foreground">
              Create Google Workspace email accounts for your domain.
            </p>
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-sm">Email account creation form will go here...</p>
              <p className="text-xs text-muted-foreground mt-2">
                Component to be implemented
              </p>
            </div>
            <Button
              onClick={() => {
                updateWizardData({
                  emailAccountIds: ['email-1', 'email-2'],
                });
                goToNextStep();
              }}
            >
              Continue (Placeholder)
            </Button>
          </div>
        );

      case 9: // Email Warmup
        return (
          <div className="space-y-4 py-6">
            <h3 className="text-lg font-semibold">Email Warmup Setup</h3>
            <p className="text-sm text-muted-foreground">
              Connect email accounts to Smartlead for warmup.
            </p>
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-sm">Warmup configuration UI will go here...</p>
              <p className="text-xs text-muted-foreground mt-2">
                Component to be implemented
              </p>
            </div>
            <Button
              onClick={() => {
                updateWizardData({ warmupConfigured: true });
                goToNextStep();
              }}
            >
              Continue (Placeholder)
            </Button>
          </div>
        );

      case 10: // Setup Complete
        return (
          <div className="space-y-4 py-6">
            <h3 className="text-lg font-semibold">Setup Complete! 🎉</h3>
            <p className="text-sm text-muted-foreground">
              Your email infrastructure is ready for cold email campaigns.
            </p>
            <div className="bg-primary/10 p-4 rounded-md border border-primary/20">
              <p className="text-sm font-medium">What&apos;s been set up:</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>✓ Cloudflare connected</li>
                <li>✓ Google Workspace connected</li>
                {wizardData.smartleadConnected && <li>✓ Smartlead connected</li>}
                <li>✓ Domain connected: {wizardData.domain || 'N/A'}</li>
                <li>✓ DNS records configured (SPF, DKIM, DMARC, MX)</li>
                <li>
                  ✓ Email accounts created: {wizardData.emailAccountIds?.length || 0}{' '}
                  accounts
                </li>
              </ul>
            </div>
            <Button
              onClick={() => router.push('/dashboard/domains')}
              className="w-full"
              size="lg"
            >
              Go to Domains Dashboard
            </Button>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-6xl h-full max-h-[90vh]">
        {/* Floating Card Container with Sidebar Layout */}
        <div className="bg-card/50 backdrop-blur-lg border rounded-2xl shadow-2xl overflow-hidden h-full flex">
          {/* Left Sidebar - Steps */}
          <div className="w-80 border-r bg-card/80 flex flex-col">
            {/* Sidebar Header */}
            <div className="px-6 py-6 border-b">
              <h2 className="text-lg font-semibold">Setup Steps</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Step {currentStep} of {steps.length}
              </p>
            </div>

            {/* Progress Steps - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <WizardProgress
                steps={steps}
                currentStep={currentStep}
                isStepCompleted={isStepCompleted}
                onStepClick={goToStep}
                variant="vertical"
              />
            </div>

            {/* Navigation Buttons - Fixed at bottom */}
            {currentStep < 10 && (
              <div className="px-4 py-4 border-t space-y-2">
                {/* Next Button */}
                {canGoNext() && (
                  <Button
                    onClick={goToNextStep}
                    disabled={!canGoNext()}
                    className="w-full"
                  >
                    Next
                  </Button>
                )}

                {/* Skip Button */}
                {canSkip() && (
                  <Button
                    onClick={skipStep}
                    variant="outline"
                    className="w-full"
                  >
                    Skip
                  </Button>
                )}

                {/* Previous Button */}
                {canGoPrevious() && (
                  <Button
                    onClick={goToPrevious}
                    variant="ghost"
                    className="w-full"
                  >
                    Previous
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right Content Area - Scrollable */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Content Header */}
            <div className="px-8 py-6 border-b">
              <h1 className="text-2xl font-bold">{currentStepInfo.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {currentStepInfo.description}
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-8 py-8">
              {renderStepContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
