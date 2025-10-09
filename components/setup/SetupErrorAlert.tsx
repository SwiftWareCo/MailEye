/**
 * Setup Error Alert Component
 *
 * Reusable error display component for setup wizard
 * Provides user-friendly error messages with suggested actions
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface SetupErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  helpUrl?: string;
  className?: string;
}

export function SetupErrorAlert({
  title = 'Setup Error',
  message,
  onRetry,
  helpUrl,
  className,
}: SetupErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-3">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm mt-1">{message}</p>
          </div>

          <div className="flex gap-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            )}

            {helpUrl && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8"
              >
                <a
                  href={helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Get Help
                </a>
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Translates technical errors into user-friendly messages
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return translateError(error);
  }

  if (error instanceof Error) {
    return translateError(error.message);
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Maps common error patterns to helpful messages
 */
function translateError(errorMessage: string): string {
  const errorLower = errorMessage.toLowerCase();

  // Database errors
  if (errorLower.includes('relation') && errorLower.includes('does not exist')) {
    return 'Database table missing. Please run database migrations: npm run db:push';
  }

  if (errorLower.includes('unique constraint')) {
    return 'This record already exists. Please use a different value.';
  }

  if (errorLower.includes('foreign key constraint')) {
    return 'Related record not found. Please ensure all dependencies are set up first.';
  }

  // Network errors
  if (errorLower.includes('network') || errorLower.includes('fetch failed')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Authentication errors
  if (errorLower.includes('unauthorized') || errorLower.includes('authentication')) {
    return 'Authentication failed. Please check your credentials and try again.';
  }

  if (errorLower.includes('invalid_grant') || errorLower.includes('invalid grant')) {
    return 'Invalid credentials. Please verify your service account email and private key.';
  }

  if (errorLower.includes('unauthorized_client')) {
    return 'Service account not authorized. Please enable domain-wide delegation in Google Admin Console.';
  }

  // Cloudflare errors
  if (errorLower.includes('cloudflare')) {
    if (errorLower.includes('permission')) {
      return 'Cloudflare API token lacks required permissions. Please ensure it has Zone Edit and DNS Edit permissions.';
    }
    if (errorLower.includes('already exists')) {
      return 'Domain already exists in Cloudflare. Please remove it first or use a different domain.';
    }
  }

  // Google Workspace errors
  if (errorLower.includes('google workspace') || errorLower.includes('admin sdk')) {
    if (errorLower.includes('not connected')) {
      return 'Google Workspace not configured. Please set up Google Workspace credentials in the wizard.';
    }
  }

  // DNS errors
  if (errorLower.includes('dns')) {
    if (errorLower.includes('duplicate')) {
      return 'DNS record already exists. This is usually okay - the existing record will be used.';
    }
    if (errorLower.includes('propagation')) {
      return 'DNS propagation in progress. This can take up to 48 hours to complete globally.';
    }
  }

  // Default: return original message
  return errorMessage;
}
