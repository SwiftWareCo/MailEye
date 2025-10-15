/**
 * Additional DNS Actions Component
 *
 * Handles manual Google Workspace verification, DKIM setup, and DMARC status
 */

'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Key,
  Settings,
  Shield,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { Domain } from '@/lib/types/domain';

interface AdditionalDnsActionsProps {
  domain: Domain;
  dmarcConfigured: boolean;
  dmarcPending: boolean;
  missingDKIM: boolean;
  needsManualVerification: boolean;
  onConfirmManualVerification: () => void;
  onAddDKIMRecord?: (
    hostname: string,
    value: string
  ) => Promise<{
    success: boolean;
    error?: string;
    recordId?: string;
  }>;
  onCreateDMARCRecord?: () => Promise<{
    success: boolean;
    error?: string;
    hoursRemaining?: number;
    recordId?: string;
  }>;
}

export function AdditionalDnsActions({
  domain,
  dmarcConfigured,
  dmarcPending,
  missingDKIM,
  needsManualVerification,
  onConfirmManualVerification,
  onAddDKIMRecord,
  onCreateDMARCRecord,
}: AdditionalDnsActionsProps) {
  const [showAdditionalActions, setShowAdditionalActions] = useState(false);
  const [showDKIMForm, setShowDKIMForm] = useState(false);
  const [dkimHostname, setDkimHostname] = useState('');
  const [dkimValue, setDkimValue] = useState('');
  const [isAddingDKIM, setIsAddingDKIM] = useState(false);
  const [dkimError, setDkimError] = useState<string | null>(null);
  const [isCreatingDMARC, setIsCreatingDMARC] = useState(false);
  const [dmarcError, setDmarcError] = useState<string | null>(null);

  const handleAddDKIMRecord = async () => {
    if (!onAddDKIMRecord || !dkimHostname.trim() || !dkimValue.trim()) {
      return;
    }

    setIsAddingDKIM(true);
    setDkimError(null);

    try {
      const result = await onAddDKIMRecord(
        dkimHostname.trim(),
        dkimValue.trim()
      );

      if (result.success) {
        setDkimHostname('');
        setDkimValue('');
        setShowDKIMForm(false);
        window.location.reload();
      } else {
        setDkimError(result.error || 'Failed to add DKIM record');
      }
    } catch {
      setDkimError('An unexpected error occurred');
    } finally {
      setIsAddingDKIM(false);
    }
  };

  const handleCreateDMARCRecord = async () => {
    if (!onCreateDMARCRecord) {
      return;
    }

    setIsCreatingDMARC(true);
    setDmarcError(null);

    try {
      const result = await onCreateDMARCRecord();

      if (result.success) {
        window.location.reload();
      } else {
        setDmarcError(result.error || 'Failed to create DMARC record');
      }
    } catch {
      setDmarcError('An unexpected error occurred');
    } finally {
      setIsCreatingDMARC(false);
    }
  };

  // Calculate if DMARC is ready (48+ hours after DNS setup)
  const dmarcReadyToCreate =
    !dmarcConfigured &&
    domain.dnsConfiguredAt &&
    ((Date.now() - new Date(domain.dnsConfiguredAt).getTime()) / (1000 * 60 * 60)) >= 48;

  return (
    <Card className='border-muted bg-card'>
      <CardHeader className='border-b'>
        <Collapsible
          open={showAdditionalActions}
          onOpenChange={setShowAdditionalActions}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant='ghost'
              className='w-full justify-between p-0 h-auto hover:bg-transparent'
            >
              <div className='flex items-center gap-2'>
                <Settings className='h-5 w-5' />
                <span className='font-medium'>
                  Additional DNS Configuration
                </span>
                {(needsManualVerification || missingDKIM || dmarcPending) && (
                  <Badge variant='secondary' className='ml-2'>
                    Action Required
                  </Badge>
                )}
              </div>
              {showAdditionalActions ? (
                <ChevronDown className='h-4 w-4' />
              ) : (
                <ChevronRight className='h-4 w-4' />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className='space-y-4 pt-4'>
            {/* Manual Verification Section */}
            {needsManualVerification && (
              <div className='bg-orange-950/40 border border-orange-900/50 rounded-md p-4'>
                <div className='flex gap-2'>
                  <AlertCircle className='h-5 w-5 text-orange-400 shrink-0 mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-orange-300 mb-2'>
                      Google Workspace Verification Required
                    </p>
                    <p className='text-sm text-muted-foreground mb-3'>
                      Complete domain verification in your Google Admin Console.
                    </p>
                    <Button
                      size='sm'
                      onClick={onConfirmManualVerification}
                      className='bg-orange-600 hover:bg-orange-700 text-white'
                    >
                      <ExternalLink className='h-4 w-4 mr-2' />
                      Complete Verification
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* DKIM Setup Section */}
            {missingDKIM && (
              <div className='bg-blue-950/40 border border-blue-900/50 rounded-md p-4'>
                <div className='flex gap-2'>
                  <Key className='h-5 w-5 text-blue-400 shrink-0 mt-0.5' />
                  <div className='flex-1'>
                    <div className='flex items-center justify-between mb-2'>
                      <p className='text-sm font-medium text-blue-300'>
                        DKIM Configuration Required
                      </p>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setShowDKIMForm(!showDKIMForm)}
                      >
                        {showDKIMForm ? 'Cancel' : 'Add DKIM Record'}
                      </Button>
                    </div>

                    <p className='text-sm text-muted-foreground mb-3'>
                      DKIM (DomainKeys Identified Mail) is required for Google
                      Workspace email authentication.
                    </p>

                    {showDKIMForm && (
                      <div className='space-y-3 mt-4 p-3 bg-blue-950/30 rounded border border-blue-900/30'>
                        <div className='space-y-2'>
                          <label className='text-xs font-medium text-blue-300'>
                            DKIM Hostname
                          </label>
                          <Input
                            placeholder='google._domainkey'
                            value={dkimHostname}
                            onChange={(e) => setDkimHostname(e.target.value)}
                            className='text-sm bg-background/50 border-muted text-foreground placeholder:text-muted-foreground'
                          />
                        </div>

                        <div className='space-y-2'>
                          <label className='text-xs font-medium text-blue-300'>
                            DKIM Value
                          </label>
                          <Input
                            placeholder='v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgK...'
                            value={dkimValue}
                            onChange={(e) => setDkimValue(e.target.value)}
                            className='text-sm font-mono bg-background/50 border-muted text-foreground placeholder:text-muted-foreground'
                          />
                        </div>

                        {dkimError && (
                          <p className='text-xs text-red-400'>{dkimError}</p>
                        )}

                        <div className='flex gap-2'>
                          <Button
                            size='sm'
                            onClick={handleAddDKIMRecord}
                            disabled={
                              isAddingDKIM ||
                              !dkimHostname.trim() ||
                              !dkimValue.trim()
                            }
                          >
                            {isAddingDKIM ? (
                              <>
                                <Loader2 className='h-3 w-3 mr-2 animate-spin' />
                                Adding...
                              </>
                            ) : (
                              'Add DKIM Record'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    <ol className='text-sm text-muted-foreground space-y-1 mt-3 list-decimal list-inside'>
                      <li>
                        Go to Google Admin Console → Apps → Google Workspace →
                        Gmail → Authenticate email
                      </li>
                      <li>Select your domain ({domain.domain})</li>
                      <li>Click &ldquo;Generate new record&rdquo;</li>
                      <li>Choose 2048-bit key length</li>
                      <li>Copy the hostname and DKIM value above</li>
                      <li>
                        Click &ldquo;Add DKIM Record&rdquo; to save and deploy
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* DMARC Status Section */}
            <div className='bg-purple-950/40 border border-purple-900/50 rounded-md p-4'>
              <div className='flex gap-2'>
                <Shield className='h-5 w-5 text-purple-400 shrink-0 mt-0.5' />
                <div className='flex-1'>
                  <div className='flex items-center justify-between mb-2'>
                    <p className='text-sm font-medium text-purple-300'>
                      DMARC Protection
                    </p>
                    {dmarcConfigured ? (
                      <Badge variant='default' className='text-xs'>
                        <CheckCircle2 className='h-3 w-3 mr-1' />
                        Configured
                      </Badge>
                    ) : dmarcReadyToCreate ? (
                      <Badge variant='default' className='text-xs bg-green-600 hover:bg-green-700'>
                        <CheckCircle2 className='h-3 w-3 mr-1' />
                        Ready
                      </Badge>
                    ) : dmarcPending ? (
                      <Badge variant='secondary' className='text-xs'>
                        <Clock className='h-3 w-3 mr-1' />
                        Pending (48h)
                      </Badge>
                    ) : (
                      <Badge variant='outline' className='text-xs'>
                        Not Started
                      </Badge>
                    )}
                  </div>

                  <p className='text-sm text-muted-foreground mb-2'>
                    {dmarcConfigured
                      ? 'DMARC is configured and protecting your domain from email spoofing.'
                      : dmarcReadyToCreate
                      ? 'DMARC is ready to be configured. Click the button below to create the record.'
                      : dmarcPending
                      ? `DMARC will be available in ${Math.ceil(
                          48 -
                            (Date.now() -
                              new Date(domain.dnsConfiguredAt!).getTime()) /
                              (1000 * 60 * 60)
                        )} hours. This waiting period ensures SPF and DKIM are properly propagated.`
                      : 'DMARC enhances email security and will be available 48 hours after DNS setup.'}
                  </p>

                  {dmarcReadyToCreate && onCreateDMARCRecord && (
                    <Button
                      size='sm'
                      onClick={handleCreateDMARCRecord}
                      disabled={isCreatingDMARC}
                      className='bg-purple-600 hover:bg-purple-700 text-white'
                    >
                      {isCreatingDMARC ? (
                        <>
                          <Loader2 className='h-3 w-3 mr-2 animate-spin' />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Shield className='h-3 w-3 mr-2' />
                          Create DMARC Now
                        </>
                      )}
                    </Button>
                  )}

                  {dmarcError && (
                    <p className='text-xs text-red-400 mt-2'>{dmarcError}</p>
                  )}

                  {dmarcConfigured && (
                    <div className='mt-2 p-2 bg-purple-950/30 rounded text-xs border border-purple-900/30'>
                      <code className='text-purple-300'>
                        v=DMARC1; p=none; rua=mailto:dmarc@{domain.domain}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
}
