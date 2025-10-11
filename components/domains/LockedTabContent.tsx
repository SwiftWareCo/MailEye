/**
 * Locked Tab Content Component
 *
 * Shows when a tab is locked due to missing prerequisites
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface LockedTabContentProps {
  title: string;
  description: string;
  prerequisites: string[];
  onNavigateToTab?: (tab: string) => void;
  unlockTab?: string;
}

export function LockedTabContent({
  title,
  description,
  prerequisites,
  onNavigateToTab,
  unlockTab,
}: LockedTabContentProps) {
  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-yellow-500/10 p-6 mb-4">
          <Lock className="h-12 w-12 text-yellow-500" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          {description}
        </p>

        <div className="w-full max-w-md space-y-3">
          <p className="text-sm font-medium">Prerequisites:</p>
          <ul className="space-y-2">
            {prerequisites.map((prereq, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>{prereq}</span>
              </li>
            ))}
          </ul>
        </div>

        {unlockTab && onNavigateToTab && (
          <Button
            onClick={() => onNavigateToTab(unlockTab)}
            className="mt-6"
          >
            Go to {unlockTab.charAt(0).toUpperCase() + unlockTab.slice(1)} Tab
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
