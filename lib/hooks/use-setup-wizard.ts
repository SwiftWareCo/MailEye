/**
 * Setup Wizard State Management Hook
 *
 * Manages wizard flow state, navigation, and progress persistence
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

export interface WizardData {
  // Step 1: Domain Connection
  domainId?: string;
  domain?: string;
  provider?: string;

  // Step 2: Nameserver Verification (tracks status)
  nameserversVerified?: boolean;
  skippedVerification?: boolean;

  // Step 3: DNS Configuration (tracks status)
dnsConfigured?: boolean;

  // Step 4: DNS Monitoring
  pollingSessionId?: string;
  dnsFullyPropagated?: boolean;

  // Step 5: Email Provisioning
  emailAccountIds?: string[];

  // Step 6: Smartlead Connection
  smartleadConnected?: boolean;

  // Metadata
  startedAt?: string;
  completedAt?: string;
}

export interface WizardStep {
  id: number;
  label: string;
  shortLabel: string;
  description: string;
  canSkip: boolean;
  requiresValidation: boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    label: 'Domain Connection',
    shortLabel: 'Domain',
    description: 'Connect your domain and create Cloudflare zone',
    canSkip: false,
    requiresValidation: true,
  },
  {
    id: 2,
    label: 'Nameserver Verification',
    shortLabel: 'Nameservers',
    description: 'Verify nameservers point to Cloudflare',
    canSkip: false,
    requiresValidation: true,
  },
  {
    id: 3,
    label: 'DNS Configuration',
    shortLabel: 'DNS Setup',
    description: 'Configure SPF, DKIM, DMARC, and MX records',
    canSkip: false,
    requiresValidation: true,
  },
  {
    id: 4,
    label: 'DNS Propagation',
    shortLabel: 'Monitoring',
    description: 'Monitor DNS propagation status',
    canSkip: true,
    requiresValidation: false,
  },
  {
    id: 5,
    label: 'Email Provisioning',
    shortLabel: 'Email',
    description: 'Create Google Workspace email accounts',
    canSkip: false,
    requiresValidation: true,
  },
  {
    id: 6,
    label: 'Smartlead Integration',
    shortLabel: 'Smartlead',
    description: 'Connect email accounts to Smartlead',
    canSkip: true,
    requiresValidation: false,
  },
  {
    id: 7,
    label: 'Setup Complete',
    shortLabel: 'Complete',
    description: 'Review and finish setup',
    canSkip: false,
    requiresValidation: false,
  },
];

const STORAGE_KEY = 'setup-wizard-state';

export function useSetupWizard() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [isComplete, setIsComplete] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentStep(parsed.currentStep || 1);
        setWizardData(parsed.wizardData || {});
        setIsComplete(parsed.isComplete || false);
      } catch (error) {
        console.error('Failed to parse wizard state:', error);
      }
    }
  }, []);

  // Persist state on changes
  useEffect(() => {
    if (currentStep > 1 || Object.keys(wizardData).length > 0) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStep,
          wizardData,
          isComplete,
        })
      );
    }
  }, [currentStep, wizardData, isComplete]);

  // Update wizard data
  const updateWizardData = useCallback((data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  }, []);

  // Validate current step before proceeding
  const validateCurrentStep = useCallback((): boolean => {
    const step = WIZARD_STEPS[currentStep - 1];
    if (!step.requiresValidation) return true;

    switch (currentStep) {
      case 1: // Domain Connection
        return !!wizardData.domainId;
      case 2: // Nameserver Verification
        return !!wizardData.nameserversVerified || !!wizardData.skippedVerification;
      case 3: // DNS Configuration
        return !!wizardData.dnsConfigured && !!wizardData.pollingSessionId;
      case 4: // DNS Monitoring
        return true; // Can skip
      case 5: // Email Provisioning
        return !!wizardData.emailAccountIds && wizardData.emailAccountIds.length > 0;
      case 6: // Smartlead Connection
        return true; // Can skip
      default:
        return true;
    }
  }, [currentStep, wizardData]);

  // Go to next step
  const goToNextStep = useCallback(() => {
    if (!validateCurrentStep()) {
      console.warn('Cannot proceed: current step validation failed');
      return false;
    }

    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      return true;
    } else {
      // Complete wizard
      setIsComplete(true);
      updateWizardData({ completedAt: new Date().toISOString() });
      return true;
    }
  }, [currentStep, validateCurrentStep, updateWizardData]);

  // Go to previous step
  const goToPrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      return true;
    }
    return false;
  }, [currentStep]);

  // Skip current step (if allowed)
  const skipStep = useCallback(() => {
    const step = WIZARD_STEPS[currentStep - 1];
    if (step.canSkip) {
      setCurrentStep((prev) => prev + 1);
      return true;
    }
    return false;
  }, [currentStep]);

  // Go to specific step (only if it's a completed step)
  const goToStep = useCallback(
    (stepNumber: number) => {
      if (stepNumber >= 1 && stepNumber <= currentStep) {
        setCurrentStep(stepNumber);
        return true;
      }
      return false;
    },
    [currentStep]
  );

  // Reset wizard
  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setWizardData({});
    setIsComplete(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Get current step info
  const getCurrentStep = useCallback(() => {
    return WIZARD_STEPS[currentStep - 1];
  }, [currentStep]);

  // Check if step is completed
  const isStepCompleted = useCallback(
    (stepNumber: number): boolean => {
      return currentStep > stepNumber;
    },
    [currentStep]
  );

  // Check if can go next
  const canGoNext = useCallback((): boolean => {
    return validateCurrentStep() && currentStep < WIZARD_STEPS.length;
  }, [currentStep, validateCurrentStep]);

  // Check if can go previous
  const canGoPrevious = useCallback((): boolean => {
    return currentStep > 1;
  }, [currentStep]);

  // Check if can skip
  const canSkip = useCallback((): boolean => {
    const step = WIZARD_STEPS[currentStep - 1];
    return step.canSkip;
  }, [currentStep]);

  return {
    // State
    currentStep,
    wizardData,
    isComplete,
    steps: WIZARD_STEPS,

    // Actions
    goToNextStep,
    goToPrevious,
    skipStep,
    goToStep,
    resetWizard,
    updateWizardData,

    // Helpers
    getCurrentStep,
    isStepCompleted,
    canGoNext,
    canGoPrevious,
    canSkip,
    validateCurrentStep,
  };
}
