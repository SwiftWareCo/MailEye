/**
 * Warmup Settings Modal
 *
 * Allows users to configure optimal warmup settings before connecting to Smartlead
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2 } from 'lucide-react';

interface WarmupSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailAddress: string;
  onConnect: (settings: WarmupSettings) => Promise<void>;
}

export interface WarmupSettings {
  warmupEnabled: boolean;
  totalWarmupPerDay: number;
  dailyRampup: number;
  warmupReputation: 'average' | 'good' | 'excellent';
  maxEmailPerDay: number;
}

export function WarmupSettingsModal({
  open,
  onOpenChange,
  emailAddress,
  onConnect,
}: WarmupSettingsModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [settings, setSettings] = useState<WarmupSettings>({
    warmupEnabled: true,
    totalWarmupPerDay: 5, // Start at 5 emails/day
    dailyRampup: 2, // Increase by 2 emails/day
    warmupReputation: 'good',
    maxEmailPerDay: 50,
  });

  // Calculate when warmup reaches 40 emails/day
  const calculateDaysToTarget = () => {
    const targetEmails = 40;
    const startEmails = settings.totalWarmupPerDay;
    const dailyIncrease = settings.dailyRampup;

    if (dailyIncrease <= 0) return 'N/A';

    const days = Math.ceil((targetEmails - startEmails) / dailyIncrease);
    return days > 0 ? `Day ${days}` : 'Already at target';
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect(settings);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Warmup Settings</DialogTitle>
          <DialogDescription>
            Connect {emailAddress} to Smartlead with optimal warmup configuration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommended Settings:</strong> Start at 5 emails/day with +2 daily rampup to reach 40 emails/day by Day 21 (optimal for cold outreach readiness)
            </AlertDescription>
          </Alert>

          {/* Settings Form */}
          <div className="grid gap-4">
            {/* Starting Volume */}
            <div className="grid gap-2">
              <Label htmlFor="totalWarmupPerDay">
                Starting Daily Volume
              </Label>
              <Input
                id="totalWarmupPerDay"
                type="number"
                min={1}
                max={40}
                value={settings.totalWarmupPerDay}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    totalWarmupPerDay: parseInt(e.target.value) || 5,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of warmup emails to send on Day 1 (recommended: 5)
              </p>
            </div>

            {/* Daily Rampup */}
            <div className="grid gap-2">
              <Label htmlFor="dailyRampup">
                Daily Rampup Increase
              </Label>
              <Input
                id="dailyRampup"
                type="number"
                min={1}
                max={5}
                value={settings.dailyRampup}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dailyRampup: parseInt(e.target.value) || 2,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Emails to add each day (recommended: 2) • Reaches 40/day by {calculateDaysToTarget()}
              </p>
            </div>

            {/* Warmup Reputation Target */}
            <div className="grid gap-2">
              <Label htmlFor="warmupReputation">
                Reputation Target
              </Label>
              <Select
                value={settings.warmupReputation}
                onValueChange={(value: 'average' | 'good' | 'excellent') =>
                  setSettings({ ...settings, warmupReputation: value })
                }
              >
                <SelectTrigger id="warmupReputation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="average">Average (30% reply rate)</SelectItem>
                  <SelectItem value="good">Good (40-60% reply rate)</SelectItem>
                  <SelectItem value="excellent">Excellent (70%+ reply rate)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Target reply rate for warmup emails (recommended: Good)
              </p>
            </div>

            {/* Max Email Per Day */}
            <div className="grid gap-2">
              <Label htmlFor="maxEmailPerDay">
                Maximum Daily Capacity
              </Label>
              <Input
                id="maxEmailPerDay"
                type="number"
                min={50}
                max={200}
                value={settings.maxEmailPerDay}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxEmailPerDay: parseInt(e.target.value) || 50,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Total capacity including warmup + cold emails (recommended: 50 for new accounts)
              </p>
            </div>
          </div>

          {/* Settings Summary */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="text-sm font-medium mb-2">Summary</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Starts at {settings.totalWarmupPerDay} emails/day</li>
              <li>• Increases by {settings.dailyRampup} emails daily</li>
              <li>• Reaches 40 emails/day by {calculateDaysToTarget()}</li>
              <li>• Target reputation: {settings.warmupReputation}</li>
              <li>• Max capacity: {settings.maxEmailPerDay} emails/day</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect to Smartlead'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
