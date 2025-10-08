/**
 * Setup Wizard Component
 *
 * Main wizard container that orchestrates the email infrastructure setup flow
 * Handles step routing, state management, and navigation
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Wand2 } from 'lucide-react';
import { useSetupWizard } from '@/lib/hooks/use-setup-wizard';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { DomainConnectionStep } from './DomainConnectionStep';
import { NameserverVerificationStep } from './NameserverVerificationStep';
import { DNSConfigurationStep } from './DNSConfigurationStep';
import { DNSStatusMonitor } from './DNSStatusMonitor';
import type { DomainConnectionInput, DomainConnectionResult } from '@/lib/types/domain';
import type { NameserverVerificationResult } from '@/server/domain/nameserver-verifier';
import type { DNSSetupResult } from '@/server/dns/dns-manager';
import type { EmailAccountResult } from '@/lib/types/email';
import type { SmartleadConnectionResult } from '@/lib/types/smartlead';
import type { PollingSession } from '@/server/dns/polling-job';

interface SetupWizardProps {
  // User context
  userId: string;

  // Trigger button props
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'secondary';

  // Server Actions (passed from parent page - all required for wizard flow)
  connectDomainAction: (input: DomainConnectionInput) => Promise<DomainConnectionResult>;
  verifyNameserversAction: (domainId: string) => Promise<NameserverVerificationResult>;
  setupDNSAction: (domainId: string) => Promise<DNSSetupResult>;
  startPollingAction: (
    domainId: string
  ) => Promise<{ success: boolean; data?: PollingSession; error?: string }>;
  createEmailAccountAction: (params: {
    domainId: string;
    username: string;
    firstName: string;
    lastName: string;
  }) => Promise<EmailAccountResult>;
  connectToSmartleadAction: (emailAccountId: string) => Promise<SmartleadConnectionResult>;
}

export function SetupWizard({
  userId,
  triggerLabel = 'Start Setup Wizard',
  triggerVariant = 'default',
  connectDomainAction,
  verifyNameserversAction,
  setupDNSAction,
  startPollingAction,
  // createEmailAccountAction,
  // connectToSmartleadAction,
}: SetupWizardProps) {
  const [open, setOpen] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  // const [isProcessing, setIsProcessing] = useState(false);

  const {
    currentStep,
    wizardData,
    isComplete,
    steps,
    goToNextStep,
    goToPrevious,
    skipStep,
    goToStep,
    // resetWizard, // Will be used in future tasks
    updateWizardData,
    getCurrentStep,
    isStepCompleted,
    canGoNext,
    canGoPrevious,
    canSkip,
  } = useSetupWizard();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && currentStep > 1 && !isComplete) {
      // Show confirmation if wizard is in progress
      setShowCancelDialog(true);
    } else {
      setOpen(newOpen);
    }
  };

  const handleCancelConfirm = () => {
    setShowCancelDialog(false);
    setOpen(false);
    // Note: We don't reset wizard state - user can resume later
  };

  const handleClose = () => {
    setOpen(false);
  };

  const currentStepInfo = getCurrentStep();

  // Render current step content
  const renderStepContent = () => {
    // Placeholder components for now
    // These will be replaced with actual step components in tasks 7.2-7.11
    switch (currentStep) {
      case 1:
        return (
          <DomainConnectionStep
            userId={userId}
            connectDomainAction={connectDomainAction}
            onSuccess={(domainId, domain, nameserverInstructions) => {
              // Update wizard state with domain information
              updateWizardData({
                domainId,
                domain,
                provider: nameserverInstructions.provider,
              });
              // Automatically advance to next step after successful connection
              setTimeout(() => {
                goToNextStep();
              }, 1000);
            }}
            onError={(error) => {
              console.error('Domain connection error:', error);
            }}
          />
        );

      case 2:
        return (
          <NameserverVerificationStep
            domainId={wizardData.domainId || ''}
            domain={wizardData.domain || ''}
            verifyNameserversAction={verifyNameserversAction}
            onVerified={() => {
              // Update wizard state and advance
              updateWizardData({ nameserversVerified: true });
              goToNextStep();
            }}
            onSkip={() => {
              // Allow advanced users to skip verification
              updateWizardData({ nameserversVerified: false, skippedVerification: true });
              goToNextStep();
            }}
          />
        );

      case 3:
        return (
          <DNSConfigurationStep
            domainId={wizardData.domainId || ''}
            domain={wizardData.domain || ''}
            setupDNSAction={setupDNSAction}
            startPollingAction={startPollingAction}
            onSuccess={(pollingSessionId) => {
              // Update wizard state with polling session ID
              updateWizardData({
                dnsConfigured: true,
                pollingSessionId,
              });
              // Auto-advance to DNS monitoring step
              goToNextStep();
            }}
            onError={(error) => {
              console.error('DNS setup error:', error);
            }}
          />
        );

      case 4:
        return (
          <DNSStatusMonitor
            pollingSessionId={wizardData.pollingSessionId || ''}
            domain={wizardData.domain || ''}
            onComplete={() => {
              // Update wizard state and advance to email provisioning
              updateWizardData({ dnsFullyPropagated: true });
              goToNextStep();
            }}
            showDetails={true}
          />
        );

      case 5:
        return (
          <div className="space-y-4 py-6">
            <h3 className="text-lg font-semibold">Step 5: Email Account Provisioning</h3>
            <p className="text-sm text-muted-foreground">
              Create Google Workspace email accounts for your domain.
            </p>
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-sm">Email account creation form will go here...</p>
              <p className="text-xs text-muted-foreground mt-2">
                This is a placeholder. Component to be implemented in Task 7.6
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
              Simulate Account Creation
            </Button>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4 py-6">
            <h3 className="text-lg font-semibold">Step 6: Smartlead Integration</h3>
            <p className="text-sm text-muted-foreground">
              Connect your email accounts to Smartlead for cold email campaigns.
            </p>
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-sm">Smartlead connection UI will go here...</p>
              <p className="text-xs text-muted-foreground mt-2">
                This is a placeholder. Component to be implemented in Task 7.8
              </p>
            </div>
            <Button
              onClick={() => {
                updateWizardData({ smartleadConnected: true });
                goToNextStep();
              }}
            >
              Simulate Smartlead Connection
            </Button>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4 py-6">
            <h3 className="text-lg font-semibold">Setup Complete! 🎉</h3>
            <p className="text-sm text-muted-foreground">
              Your email infrastructure is ready for cold email campaigns.
            </p>
            <div className="bg-primary/10 p-4 rounded-md border border-primary/20">
              <p className="text-sm font-medium">What&apos;s been set up:</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>✓ Domain connected: {wizardData.domain || 'N/A'}</li>
                <li>✓ DNS records configured (SPF, DKIM, DMARC, MX)</li>
                <li>
                  ✓ Email accounts created: {wizardData.emailAccountIds?.length || 0}{' '}
                  accounts
                </li>
                {wizardData.smartleadConnected && <li>✓ Connected to Smartlead</li>}
              </ul>
            </div>
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-xs text-muted-foreground">
                This is a placeholder. Component to be implemented in Task 7.11
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant={triggerVariant}>
            <Wand2 className="h-4 w-4 mr-2" />
            {triggerLabel}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-5xl! max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Infrastructure Setup Wizard</DialogTitle>
            <DialogDescription>
              {currentStepInfo.description} (Step {currentStep} of {steps.length})
            </DialogDescription>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="py-4 border-b border-border">
            <WizardProgress
              steps={steps}
              currentStep={currentStep}
              isStepCompleted={isStepCompleted}
              onStepClick={goToStep}
              variant="horizontal"
            />
          </div>

          {/* Step Content (scrollable) */}
          <div className="flex-1 overflow-y-auto px-1">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          {currentStep < 7 && (
            <WizardNavigation
              onPrevious={canGoPrevious() ? goToPrevious : undefined}
              onNext={canGoNext() ? goToNextStep : undefined}
              onSkip={canSkip() ? skipStep : undefined}
              onCancel={() => setShowCancelDialog(true)}
              canGoPrevious={canGoPrevious()}
              canGoNext={canGoNext()}
              canSkip={canSkip()}
              isNextLoading={false}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Setup Wizard?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress has been saved. You can resume the setup wizard later from where you
              left off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Setup</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm}>
              Exit Wizard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
