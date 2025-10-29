/**
 * Email Account Metrics Component
 *
 * Displays warmup metrics, health indicators, and checklist history
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Settings,
  Save,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  refreshWarmupMetricsAction,
  getEmailAccountWarmupDataAction,
} from '@/server/warmup/metrics.actions';
import {
  updateWarmupSettingsAction,
} from '@/server/warmup/settings.actions';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

interface EmailAccount {
  id: string;
  email: string;
  createdAt: Date;
  smartleadAccountId: string | null;
  warmupStartedAt: Date | null;
}

interface EmailAccountMetricsProps {
  account: EmailAccount;
  userId: string;
}

export function EmailAccountMetrics({ account }: EmailAccountMetricsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [warmupSettings, setWarmupSettings] = useState<{
    warmupEnabled: boolean;
    maxEmailPerDay: number;
    totalWarmupPerDay: number;
    dailyRampup: number;
    replyRatePercentage: number;
  } | null>(null);
  const [initialSettings, setInitialSettings] = useState<typeof warmupSettings>(null);

  // Fetch metrics and settings with combined query (more efficient than 2 separate requests)
  const {
    data: warmupData,
    isPending: isLoadingMetrics,
  } = useQuery({
    queryKey: ['email-account-warmup-data', account.id],
    queryFn: () => getEmailAccountWarmupDataAction(account.id),
    enabled: !!account.id,
    staleTime: 60000, // Cache for 1 minute to avoid refetch on remount
  });

  const metrics = warmupData?.metrics || [];
  const health = warmupData?.health || null;

  // Update local state when settings are fetched
  if (warmupData?.success && warmupData.settings && !warmupSettings) {
    setWarmupSettings(warmupData.settings);
    setInitialSettings(warmupData.settings);
  }

  // Calculate unsaved changes
  const hasUnsavedChanges = warmupSettings && initialSettings
    ? JSON.stringify(warmupSettings) !== JSON.stringify(initialSettings)
    : false;

  // Refresh metrics mutation
  const {
    mutate: refreshMetrics,
    isPending: isRefreshing,
  } = useMutation({
    mutationFn: () => refreshWarmupMetricsAction(account.id),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate and refetch metrics query
        queryClient.invalidateQueries({ queryKey: ['email-account-metrics', account.id] });
        toast.success('Metrics refreshed', {
          description: 'Latest data fetched from Smartlead',
        });
      } else {
        toast.error('Refresh failed', {
          description: result.error,
        });
      }
    },
    onError: () => {
      toast.error('Refresh failed', {
        description: 'Unable to refresh metrics',
      });
    },
  });

  // Save settings mutation
  const {
    mutate: saveSettings,
    isPending: isSavingSettings,
  } = useMutation({
    mutationFn: (settings: typeof warmupSettings) =>
      updateWarmupSettingsAction(account.id, settings!),
    onSuccess: () => {
      // Clear unsaved indicator by updating initialSettings
      setInitialSettings(warmupSettings);
      toast.success('Settings saved', {
        description: 'Warmup settings updated in Smartlead',
      });
    },
    onError: (error) => {
      toast.error('Failed to save settings', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },
  });

  // Calculate warmup day - only if warmup has started
  const warmupDay = account.warmupStartedAt
    ? Math.floor(
        (new Date().getTime() - new Date(account.warmupStartedAt).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    : null;

  const handleRefresh = () => {
    refreshMetrics();
  };

  const handleSaveSettings = () => {
    if (!warmupSettings) return;
    saveSettings(warmupSettings);
  };

  const handleResetSettings = () => {
    const defaults = {
      warmupEnabled: true,
      maxEmailPerDay: 50, // Max total emails (warmup + campaigns) per day
      totalWarmupPerDay: 5, // Start at 5 emails/day (SmartLead recommends 5-8 for new accounts)
      dailyRampup: 5, // Increase by 5 emails/day (SmartLead requires minimum 5)
      replyRatePercentage: 30, // 30-40% reply rate initially (can increase to 60-70% after 2 weeks)
    };
    setWarmupSettings(defaults);
    setInitialSettings(defaults);
    toast.info('Settings reset to SmartLead recommended defaults');
  };

  const getHealthBadge = () => {
    if (!health) return null;

    switch (health.overall) {
      case 'healthy':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Attention
          </Badge>
        );
      case 'critical':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Critical
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{account.email}</h1>
              {getHealthBadge()}
            </div>
            <p className="text-muted-foreground mt-1">
              <Calendar className="h-4 w-4 inline mr-1" />
              {warmupDay ? `Day ${warmupDay} of warmup` : 'Warmup not started - Set up Smartlead to begin'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || !account.smartleadAccountId || hasUnsavedChanges}
            title={hasUnsavedChanges ? 'Save changes before refreshing' : 'Refresh warmup metrics'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`https://mail.google.com/mail/u/${account.email}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Gmail
          </Button>
        </div>
      </div>

      {/* Not Connected State */}
      {!account.smartleadAccountId && (
        <Card className="border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-500">Not Connected to Smartlead</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect this account to Smartlead to enable warmup metrics and tracking.
                  Go back to the domain page to setup warmup.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warmup Settings Card */}
      {account.smartleadAccountId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Warmup Settings
                  {warmupSettings && hasUnsavedChanges && (
                    <Badge variant="secondary" className="ml-auto">
                      Unsaved Changes
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Configure warmup parameters for this email account
                </CardDescription>
              </div>
              {warmupSettings && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetSettings}
                    disabled={isSavingSettings}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings || !hasUnsavedChanges}
                    title={!hasUnsavedChanges ? 'No changes to save' : 'Save warmup settings'}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingSettings ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!warmupSettings ? (
              // Loading skeleton
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-10 w-full bg-muted rounded animate-pulse" />
                    <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              // Loaded form
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Warmup Enabled Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="warmup-enabled">Warmup Enabled</Label>
                    <Switch
                      id="warmup-enabled"
                      checked={warmupSettings.warmupEnabled}
                      onCheckedChange={(checked) =>
                        setWarmupSettings({ ...warmupSettings, warmupEnabled: checked })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enable or disable warmup for this account
                  </p>
                </div>

                {/* Max Emails Per Day */}
                <div className="space-y-2">
                  <Label htmlFor="max-email-per-day">
                    Max Emails Per Day: {warmupSettings.maxEmailPerDay}
                  </Label>
                  <Slider
                    id="max-email-per-day"
                    min={10}
                    max={200}
                    step={5}
                    value={[warmupSettings.maxEmailPerDay]}
                    onValueChange={([value]) =>
                      setWarmupSettings({ ...warmupSettings, maxEmailPerDay: value })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum total emails (warmup + campaigns) per day
                  </p>
                </div>

                {/* Total Warmup Per Day */}
                <div className="space-y-2">
                  <Label htmlFor="total-warmup-per-day">
                    Warmup Emails Per Day: {warmupSettings.totalWarmupPerDay}
                  </Label>
                  <Slider
                    id="total-warmup-per-day"
                    min={5}
                    max={100}
                    step={5}
                    value={[warmupSettings.totalWarmupPerDay]}
                    onValueChange={([value]) =>
                      setWarmupSettings({ ...warmupSettings, totalWarmupPerDay: value })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of warmup emails to send daily (SmartLead recommends starting at 5-8, max 40-50)
                  </p>
                </div>

                {/* Daily Rampup */}
                <div className="space-y-2">
                  <Label htmlFor="daily-rampup">
                    Daily Rampup: +{warmupSettings.dailyRampup} emails/day
                  </Label>
                  <Slider
                    id="daily-rampup"
                    min={5}
                    max={20}
                    step={1}
                    value={[warmupSettings.dailyRampup]}
                    onValueChange={([value]) =>
                      setWarmupSettings({ ...warmupSettings, dailyRampup: value })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Increase warmup volume by this amount each day (SmartLead requires minimum 5)
                  </p>
                </div>

                {/* Reply Rate Percentage */}
                <div className="space-y-2">
                  <Label htmlFor="reply-rate">
                    Reply Rate Target: {warmupSettings.replyRatePercentage}%
                  </Label>
                  <Slider
                    id="reply-rate"
                    min={10}
                    max={100}
                    step={5}
                    value={[warmupSettings.replyRatePercentage]}
                    onValueChange={([value]) =>
                      setWarmupSettings({ ...warmupSettings, replyRatePercentage: value })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Target percentage of warmup emails to reply to (SmartLead recommends 30-40% initially, 60-70% after 2 weeks)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Health Overview */}
      {health && account.smartleadAccountId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inbox Placement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {health.inboxPlacement.toFixed(0)}%
                </span>
                {health.inboxPlacement >= 90 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <Progress value={health.inboxPlacement} className="mt-2 h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {health.inboxPlacement >= 90
                  ? 'Excellent deliverability'
                  : 'Below optimal range'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bounce Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {health.bounceRate.toFixed(1)}%
                </span>
                {health.bounceRate <= 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
              <Progress value={Math.min(health.bounceRate * 10, 100)} className="mt-2 h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {health.bounceRate <= 1 ? 'Healthy range' : 'Elevated'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reply Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {health.replyRate.toFixed(0)}%
                </span>
                {health.replyRate >= 30 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-yellow-500" />
                )}
              </div>
              <Progress value={health.replyRate} className="mt-2 h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {health.replyRate >= 30 ? 'Good engagement' : 'Needs improvement'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7-Day Metrics Chart */}
      {metrics.length > 0 && account.smartleadAccountId && (
        <Card>
          <CardHeader>
            <CardTitle>7-Day Warmup Performance</CardTitle>
            <CardDescription>
              Daily email delivery and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#3b82f6" name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="#10b981" name="Delivered" />
                <Line type="monotone" dataKey="replied" stroke="#8b5cf6" name="Replied" />
                <Line type="monotone" dataKey="bounced" stroke="#ef4444" name="Bounced" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Issues and Recommendations */}
      {health && (health.issues.length > 0 || health.recommendations.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {health.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-500">Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {health.issues.map((issue: string, index: number) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {health.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {health.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isLoadingMetrics && account.smartleadAccountId && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
