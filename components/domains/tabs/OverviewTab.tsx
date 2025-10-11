/**
 * Overview Tab Component
 *
 * Shows domain setup checklist
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { SetupChecklist } from '../SetupChecklist';
import type { DomainDetails } from '@/lib/types/domain-details';

interface OverviewTabProps {
  details: DomainDetails;
  onNavigateToTab?: (tab: string) => void;
}

export function OverviewTab({ details, onNavigateToTab }: OverviewTabProps) {
  const { setupStatus } = details;

  return (
    <div className="space-y-6">
      {/* Setup Checklist - Primary Content */}
      <SetupChecklist
        setupStatus={setupStatus}
        onNavigateToTab={onNavigateToTab}
      />

      {/* Success Card - Only show when complete */}
      {setupStatus.overview.isComplete && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold mb-1">Setup Complete!</h3>
              <p className="text-sm text-muted-foreground">
                Your domain is fully configured and ready for email campaigns.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
