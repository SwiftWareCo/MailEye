/**
 * Wizard Navigation Component
 *
 * Bottom navigation bar with Previous/Next/Skip buttons
 * Handles loading states and contextual button visibility
 */

'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, SkipForward, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardNavigationProps {
  // Navigation actions
  onPrevious?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  onCancel?: () => void;

  // Button visibility and states
  canGoPrevious: boolean;
  canGoNext: boolean;
  canSkip: boolean;
  isNextLoading?: boolean;
  isSkipLoading?: boolean;

  // Button labels
  nextLabel?: string;
  previousLabel?: string;
  skipLabel?: string;

  // Styling
  className?: string;
}

export function WizardNavigation({
  onPrevious,
  onNext,
  onSkip,
  onCancel,
  canGoPrevious,
  canGoNext,
  canSkip,
  isNextLoading = false,
  isSkipLoading = false,
  nextLabel = 'Next',
  previousLabel = 'Previous',
  skipLabel = 'Skip',
  className,
}: WizardNavigationProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 pt-4 border-t border-border',
        className
      )}
    >
      {/* Left side: Previous & Cancel */}
      <div className="flex items-center gap-2">
        {canGoPrevious && onPrevious && (
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
            disabled={isNextLoading || isSkipLoading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {previousLabel}
          </Button>
        )}

        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isNextLoading || isSkipLoading}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Right side: Skip & Next */}
      <div className="flex items-center gap-2">
        {canSkip && onSkip && (
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            disabled={isNextLoading || isSkipLoading}
          >
            {isSkipLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Skipping...
              </>
            ) : (
              <>
                <SkipForward className="h-4 w-4 mr-2" />
                {skipLabel}
              </>
            )}
          </Button>
        )}

        {onNext && (
          <Button
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isNextLoading || isSkipLoading}
          >
            {isNextLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {nextLabel}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
