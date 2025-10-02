"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { testCloudflareConnection, testSmartleadConnection, testGoogleWorkspaceConnection } from "@/server/infrastructure/infrastructure.actions"
import { testBasicConfiguration } from "@/server/crawlee/config.test.actions"
import { Separator } from "@/components/ui/separator"

interface ServiceStatus {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

interface ApiTestingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiTestingModal({ open, onOpenChange }: ApiTestingModalProps) {
  const [cloudflareStatus, setCloudflareStatus] = useState<ServiceStatus>({ status: 'idle' });
  const [googleWorkspaceStatus, setGoogleWorkspaceStatus] = useState<ServiceStatus>({ status: 'idle' });
  const [smartleadStatus, setSmartleadStatus] = useState<ServiceStatus>({ status: 'idle' });
  const [crawleeStatus, setCrawleeStatus] = useState<ServiceStatus>({ status: 'idle' });

  const testCloudflare = async () => {
    setCloudflareStatus({ status: 'testing' });
    try {
      const result = await testCloudflareConnection();

      if (result.success) {
        setCloudflareStatus({ status: 'success', message: result.message });
      } else {
        setCloudflareStatus({ status: 'error', message: result.message });
      }
    } catch (error) {
      setCloudflareStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };


  const testGoogleWorkspace = async () => {
    setGoogleWorkspaceStatus({ status: 'testing' });
    try {
      const result = await testGoogleWorkspaceConnection();

      if (result.success) {
        setGoogleWorkspaceStatus({ status: 'success', message: result.message });
      } else {
        setGoogleWorkspaceStatus({ status: 'error', message: result.message });
      }
    } catch (error) {
      setGoogleWorkspaceStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testSmartlead = async () => {
    setSmartleadStatus({ status: 'testing' });
    try {
      const result = await testSmartleadConnection();

      if (result.success) {
        setSmartleadStatus({ status: 'success', message: result.message });
      } else {
        setSmartleadStatus({ status: 'error', message: result.message });
      }
    } catch (error) {
      setSmartleadStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testCrawlee = async () => {
    setCrawleeStatus({ status: 'testing' });
    try {
      const result = await testBasicConfiguration();

      if (result.success) {
        setCrawleeStatus({
          status: 'success',
          message: `Desktop & Mobile configs validated. Viewport: ${result.desktop.viewport.width}×${result.desktop.viewport.height}`
        });
      } else {
        setCrawleeStatus({ status: 'error', message: result.error || 'Configuration test failed' });
      }
    } catch (error) {
      setCrawleeStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const getStatusBadge = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'testing':
        return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Testing</Badge>;
      case 'success':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="secondary">Not Tested</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Service Configuration Testing</DialogTitle>
          <DialogDescription>
            Test your API connections and service configurations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crawlee Configuration Test */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Crawlee Configuration</CardTitle>
                  <CardDescription>Desktop/Mobile presets & User Agent rotation</CardDescription>
                </div>
                {getStatusBadge(crawleeStatus.status)}
              </div>
            </CardHeader>
            <CardContent>
              {crawleeStatus.message && (
                <p className={`text-sm mb-3 ${crawleeStatus.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {crawleeStatus.message}
                </p>
              )}
              <Button
                onClick={testCrawlee}
                disabled={crawleeStatus.status === 'testing'}
                size="sm"
              >
                {crawleeStatus.status === 'testing' ? 'Testing...' : 'Test Configuration'}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          <div className="text-sm font-medium text-muted-foreground">Email Infrastructure APIs</div>
          {/* Cloudflare */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Cloudflare</CardTitle>
                  <CardDescription>DNS Management & Configuration</CardDescription>
                </div>
                {getStatusBadge(cloudflareStatus.status)}
              </div>
            </CardHeader>
            <CardContent>
              {cloudflareStatus.message && (
                <p className={`text-sm mb-3 ${cloudflareStatus.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {cloudflareStatus.message}
                </p>
              )}
              <Button
                onClick={testCloudflare}
                disabled={cloudflareStatus.status === 'testing'}
                size="sm"
              >
                {cloudflareStatus.status === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </CardContent>
          </Card>

          {/* Google Workspace */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Google Workspace</CardTitle>
                  <CardDescription>User Provisioning & Management</CardDescription>
                </div>
                {getStatusBadge(googleWorkspaceStatus.status)}
              </div>
            </CardHeader>
            <CardContent>
              {googleWorkspaceStatus.message && (
                <p className={`text-sm mb-3 ${googleWorkspaceStatus.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {googleWorkspaceStatus.message}
                </p>
              )}
              <Button
                onClick={testGoogleWorkspace}
                disabled={googleWorkspaceStatus.status === 'testing'}
                size="sm"
              >
                {googleWorkspaceStatus.status === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </CardContent>
          </Card>

          {/* Smartlead */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Smartlead</CardTitle>
                  <CardDescription>Email Account Integration</CardDescription>
                </div>
                {getStatusBadge(smartleadStatus.status)}
              </div>
            </CardHeader>
            <CardContent>
              {smartleadStatus.message && (
                <p className={`text-sm mb-3 ${smartleadStatus.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {smartleadStatus.message}
                </p>
              )}
              <Button
                onClick={testSmartlead}
                disabled={smartleadStatus.status === 'testing'}
                size="sm"
              >
                {smartleadStatus.status === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
