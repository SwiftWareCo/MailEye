'use client';

/**
 * Task 2.1.1: Basic Configuration Test Component
 *
 * Simple component to test that our basic Crawlee configuration
 * presets work correctly.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { testBasicConfiguration } from '@/server/crawlee/config.test.actions';
import { Loader2, Monitor, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';

interface TestResult {
  success: boolean;
  error?: string;
  desktop?: {
    success: boolean;
    viewport: { width: number; height: number };
    userAgent: string;
    vercelSettings: { timeout: number; maxConcurrency: number };
  };
  mobile?: {
    success: boolean;
    viewport: { width: number; height: number };
    userAgent: string;
  };
  userAgentRotation?: {
    desktop: string[];
    mobile: string[];
  };
}

export function ConfigTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    try {
      const result = await testBasicConfiguration();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Header */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Task 2.1.1: Basic Configuration Test</h2>
        <p className="text-muted-foreground mb-4">
          Test basic Crawlee configuration with Desktop/Mobile presets and user agent rotation.
        </p>

        <Button
          onClick={handleTest}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Configuration...
            </>
          ) : (
            'Test Basic Configuration'
          )}
        </Button>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Configuration Test Results</h3>
            <Badge variant={testResult.success ? "secondary" : "destructive"}>
              {testResult.success ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Success
                </>
              ) : (
                <>
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Failed
                </>
              )}
            </Badge>
          </div>

          {testResult.error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{testResult.error}</p>
            </div>
          )}

          {/* Desktop Configuration */}
          {testResult.desktop && (
            <div className="mb-6">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Desktop Configuration
              </h4>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <Badge className="ml-2" variant={testResult.desktop.success ? "secondary" : "destructive"}>
                      {testResult.desktop.success ? 'OK' : 'Failed'}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Viewport:</span>
                    <span className="ml-2 text-muted-foreground">
                      {testResult.desktop.viewport.width} × {testResult.desktop.viewport.height}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">User Agent:</span>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {testResult.desktop.userAgent}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Configuration */}
          {testResult.mobile && (
            <div className="mb-6">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile Configuration
              </h4>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <Badge className="ml-2" variant={testResult.mobile.success ? "secondary" : "destructive"}>
                      {testResult.mobile.success ? 'OK' : 'Failed'}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Viewport:</span>
                    <span className="ml-2 text-muted-foreground">
                      {testResult.mobile.viewport.width} × {testResult.mobile.viewport.height}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">User Agent:</span>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {testResult.mobile.userAgent}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Agent Rotation Test */}
          {testResult.userAgentRotation && (
            <div className="mb-6">
              <h4 className="font-medium mb-3">User Agent Rotation Test</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-medium mb-2">Desktop Agents (5 random)</h5>
                  <div className="space-y-1">
                    {testResult.userAgentRotation.desktop.map((agent: string, index: number) => (
                      <p key={index} className="text-xs text-muted-foreground break-all">
                        {index + 1}. {agent.split(' ')[0]}... {/* Show just first part */}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-2">Mobile Agents (5 random)</h5>
                  <div className="space-y-1">
                    {testResult.userAgentRotation.mobile.map((agent: string, index: number) => (
                      <p key={index} className="text-xs text-muted-foreground break-all">
                        {index + 1}. {agent.split(' ')[0]}... {/* Show just first part */}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vercel Settings */}
          {testResult.desktop && (
            <div>
              <h4 className="font-medium mb-3">Vercel Optimization Settings</h4>
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Request Timeout:</span>
                    <span className="ml-2 text-muted-foreground">
                      {testResult.desktop.vercelSettings.timeout}ms
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Max Concurrency:</span>
                    <span className="ml-2 text-muted-foreground">
                      {testResult.desktop.vercelSettings.maxConcurrency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Task Guidelines */}
      <Card className="p-6 bg-muted/50">
        <h3 className="font-medium mb-2">Task 2.1.1 Scope</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>What this tests:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Desktop and Mobile configuration presets</li>
            <li>Basic user agent rotation (3 agents per mode)</li>
            <li>Vercel optimization settings (timeouts, concurrency)</li>
            <li>Viewport configuration for responsive crawling</li>
          </ul>
          <p className="mt-3"><strong>What&apos;s NOT included yet:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Actual crawling functionality (Task 2.1.3+)</li>
            <li>Request handlers (Task 2.1.3)</li>
            <li>Lead extraction (Task 2.1.7)</li>
            <li>Multi-page crawling (Task 2.1.8)</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}