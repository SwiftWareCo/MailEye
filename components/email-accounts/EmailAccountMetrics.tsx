/**
 * Email Account Metrics Component
 *
 * Displays warmup metrics, health indicators, and checklist history
 */

'use client';

import { useEffect, useState } from 'react';
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
  getEmailAccountWarmupMetricsAction,
  refreshWarmupMetricsAction,
} from '@/server/warmup/metrics.actions';
import {
  getWarmupSettingsAction,
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
}

interface EmailAccountMetricsProps {
  account: EmailAccount;
  userId: string;
}

export function EmailAccountMetrics({ account }: EmailAccountMetricsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<Array<{
    date: string;
    sent: number;
    delivered: number;
    bounced: number;
    replied: number;
    deliverability_rate: number;
  }>>([]);
  const [health, setHealth] = useState<{
    overall: 'healthy' | 'warning' | 'critical';
    inboxPlacement: number;
    bounceRate: number;
    replyRate: number;
    issues: string[];
    recommendations: string[];
  } | null>(null);

  // Warmup settings state
  const [warmupSettings, setWarmupSettings] = useState<{
    warmupEnabled: boolean;
    maxEmailPerDay: number;
    totalWarmupPerDay: number;
    dailyRampup: number;
    replyRatePercentage: number;
  } | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Calculate warmup day
  const warmupDay = Math.floor(
    (new Date().getTime() - new Date(account.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  // Fetch metrics and settings on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Fetch metrics
      const metricsResult = await getEmailAccountWarmupMetricsAction(account.id);
      if (metricsResult.success) {
        setMetrics(metricsResult.metrics || []);
        setHealth(metricsResult.health || null);
      } else {
        toast.error('Failed to load metrics', {
          description: metricsResult.error,
        });
      }

      // Fetch warmup settings if connected
      if (account.smartleadAccountId) {
        setIsLoadingSettings(true);
        const settingsResult = await getWarmupSettingsAction(account.id);
        if (settingsResult.success && settingsResult.settings) {
          setWarmupSettings(settingsResult.settings);
        }
        setIsLoadingSettings(false);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [account.id, account.smartleadAccountId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const result = await refreshWarmupMetricsAction(account.id);

    if (result.success) {
      setMetrics(result.metrics || []);
      setHealth(result.health || null);
      toast.success('Metrics refreshed', {
        description: 'Latest data fetched from Smartlead',
      });
    } else {
      toast.error('Refresh failed', {
        description: result.error,
      });
    }

    setIsRefreshing(false);
  };

  const handleSaveSettings = async () => {
    if (!warmupSettings) return;

    setIsSavingSettings(true);
    try {
      const result = await updateWarmupSettingsAction(account.id, warmupSettings);

      if (result.success) {
        toast.success('Settings saved', {
          description: 'Warmup settings updated in Smartlead',
        });
      } else {
        toast.error('Failed to save settings', {
          description: result.error || 'Please try again',
        });
      }
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error('An error occurred', {
        description: 'Failed to save warmup settings',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetSettings = () => {
    setWarmupSettings({
      warmupEnabled: true,
      maxEmailPerDay: 50,
      totalWarmupPerDay: 40,
      dailyRampup: 5,
      replyRatePercentage: 30,
    });
    toast.info('Settings reset to defaults');
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
              Day {warmupDay} of warmup
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || !account.smartleadAccountId}
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
      {account.smartleadAccountId && warmupSettings && !isLoadingSettings && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Warmup Settings
                </CardTitle>
                <CardDescription>
                  Configure warmup parameters for this email account
                </CardDescription>
              </div>
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
                  disabled={isSavingSettings}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingSettings ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                  Number of warmup emails to send daily
                </p>
              </div>

              {/* Daily Rampup */}
              <div className="space-y-2">
                <Label htmlFor="daily-rampup">
                  Daily Rampup: +{warmupSettings.dailyRampup} emails/day
                </Label>
                <Slider
                  id="daily-rampup"
                  min={1}
                  max={20}
                  step={1}
                  value={[warmupSettings.dailyRampup]}
                  onValueChange={([value]) =>
                    setWarmupSettings({ ...warmupSettings, dailyRampup: value })
                  }
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Increase warmup volume by this amount each day
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
                  Target percentage of warmup emails to reply to
                </p>
              </div>
            </div>
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

      {isLoading && account.smartleadAccountId && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
