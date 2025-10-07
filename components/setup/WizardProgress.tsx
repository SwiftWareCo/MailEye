/**
 * Wizard Progress Indicator Component
 *
 * Visual step tracker showing current progress through wizard
 * Displays 7 steps with icons, labels, and status indicators
 */

'use client';

import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WizardStep } from '@/lib/hooks/use-setup-wizard';

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
  isStepCompleted: (stepNumber: number) => boolean;
  onStepClick?: (stepNumber: number) => void;
  variant?: 'horizontal' | 'vertical';
}

export function WizardProgress({
  steps,
  currentStep,
  isStepCompleted,
  onStepClick,
  variant = 'horizontal',
}: WizardProgressProps) {
  if (variant === 'vertical') {
    return (
      <div className="space-y-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isCompleted = isStepCompleted(stepNumber);
          const isClickable = isCompleted && onStepClick;

          return (
            <button
              key={step.id}
              onClick={() => isClickable && onStepClick(stepNumber)}
              disabled={!isClickable}
              className={cn(
                'flex items-start gap-3 w-full text-left p-2 rounded-md transition-colors',
                isClickable && 'hover:bg-accent cursor-pointer',
                !isClickable && 'cursor-default',
                isActive && 'bg-accent/50'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'font-medium text-sm',
                    isCompleted && 'text-primary',
                    isActive && 'text-foreground',
                    !isActive && !isCompleted && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {step.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isCompleted = isStepCompleted(stepNumber);
          const isClickable = isCompleted && onStepClick;
          const isLast = stepNumber === steps.length;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step indicator */}
              <button
                onClick={() => isClickable && onStepClick(stepNumber)}
                disabled={!isClickable}
                className={cn(
                  'flex flex-col items-center gap-2 group',
                  isClickable && 'cursor-pointer',
                  !isClickable && 'cursor-default'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isActive && !isCompleted && 'border-primary bg-background',
                    !isActive && !isCompleted && 'border-muted bg-muted text-muted-foreground',
                    isClickable && 'group-hover:scale-110 group-hover:border-primary'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <span className="text-sm font-medium">{stepNumber}</span>
                  )}
                </div>

                {/* Label */}
                <div className="text-center">
                  <div
                    className={cn(
                      'text-xs font-medium transition-colors',
                      isCompleted && 'text-primary',
                      isActive && 'text-foreground',
                      !isActive && !isCompleted && 'text-muted-foreground',
                      isClickable && 'group-hover:text-primary'
                    )}
                  >
                    {step.shortLabel}
                  </div>
                </div>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 transition-colors',
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step description (mobile friendly) */}
      <div className="mt-4 text-center">
        <p className="text-sm text-muted-foreground">
          {steps[currentStep - 1].description}
        </p>
      </div>
    </div>
  );
}
