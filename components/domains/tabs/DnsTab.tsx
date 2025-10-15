/**
 * DNS Tab Component
 *
 * Shows nameserver status, DNS records, and configuration actions
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Globe,
  AlertCircle,
  RefreshCw,
  Mail,
  ChevronDown,
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { DomainDetails } from '@/lib/types/domain-details';
import { AdditionalDnsActions } from './AdditionalDnsActions';

interface DNSTabProps {
  details: DomainDetails;
  onVerifyNameservers?: () => void;
  onConfigureEmailDNS?: () => Promise<void>;
  onConfirmManualVerification?: () => Promise<{
    success: boolean;
    error?: string;
  }>;
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

export function DNSTab({
  details,
  onVerifyNameservers,
  onConfigureEmailDNS,
  onConfirmManualVerification,
  onAddDKIMRecord,
  onCreateDMARCRecord,
}: DNSTabProps) {
  const router = useRouter();
  const { domain, dnsRecordsByType, setupStatus } = details;
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [nameserversExpanded, setNameserversExpanded] = useState(false);
  const [showManualVerificationModal, setShowManualVerificationModal] =
    useState(false);
  const [isConfirmingVerification, setIsConfirmingVerification] =
    useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const verificationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get DMARC status from setupStatus (calculated server-side)
  const dmarcConfigured = setupStatus.dns.dmarcConfigured;
  const dmarcPending = setupStatus.dns.dmarcPending;

  // Auto-verify nameservers every 30 seconds if not verified
  useEffect(() => {
    if (
      !setupStatus.dns.nameserversVerified &&
      setupStatus.dns.hasZone &&
      onVerifyNameservers
    ) {
      // Verify immediately on mount
      onVerifyNameservers();

      // Then verify every 30 seconds
      verificationIntervalRef.current = setInterval(() => {
        onVerifyNameservers();
      }, 30000); // 30 seconds

      return () => {
        if (verificationIntervalRef.current) {
          clearInterval(verificationIntervalRef.current);
        }
      };
    }

    // Clear interval if nameservers are verified
    if (
      setupStatus.dns.nameserversVerified &&
      verificationIntervalRef.current
    ) {
      clearInterval(verificationIntervalRef.current);
      verificationIntervalRef.current = null;
    }

    return () => {
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
      }
    };
  }, [
    setupStatus.dns.nameserversVerified,
    setupStatus.dns.hasZone,
    onVerifyNameservers,
  ]);

  // Default nameservers to collapsed when verified
  useEffect(() => {
    if (setupStatus.dns.nameserversVerified) {
      setNameserversExpanded(false);
    }
  }, [setupStatus.dns.nameserversVerified]);

  // Handle unified DNS configuration
  const handleConfigureEmailDNS = async () => {
    if (!onConfigureEmailDNS) return;

    setIsConfiguring(true);
    try {
      await onConfigureEmailDNS();
      // After successful DNS setup, show manual verification modal
      setShowManualVerificationModal(true);
    } finally {
      setIsConfiguring(false);
    }
  };

  // Handle manual verification confirmation
  const handleConfirmVerification = async () => {
    if (!onConfirmManualVerification) return;

    setIsConfirmingVerification(true);
    setVerificationError(null);

    try {
      const result = await onConfirmManualVerification();

      if (result.success) {
        // Close modal
        setShowManualVerificationModal(false);

        // Navigate to Email Accounts tab
        // Use hash navigation to switch tabs
        window.location.hash = 'email';

        // Refresh the page to update domain status
        router.refresh();
      } else {
        setVerificationError(result.error || 'Failed to confirm verification');
      }
    } finally {
      setIsConfirmingVerification(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'propagated':
        return (
          <Badge variant='default' className='text-xs'>
            Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant='secondary' className='text-xs'>
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant='destructive' className='text-xs'>
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant='outline' className='text-xs'>
            Unknown
          </Badge>
        );
    }
  };

  return (
    <div className='space-y-6'>
      {/* DNS Infrastructure (merged Cloudflare Zone + Nameservers) */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <Globe className='h-5 w-5' />
              DNS Infrastructure
            </CardTitle>
            {setupStatus.dns.hasZone &&
              !setupStatus.dns.nameserversVerified && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={onVerifyNameservers}
                >
                  <RefreshCw className='h-4 w-4 mr-2' />
                  Verify Nameservers
                </Button>
              )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Cloudflare Zone Section */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium'>Cloudflare Zone</p>
                <p className='text-xs text-muted-foreground font-mono'>
                  {domain.cloudflareZoneId || 'Not created'}
                </p>
              </div>
              {setupStatus.dns.hasZone ? (
                <Badge variant='default' className='text-xs'>
                  Active
                </Badge>
              ) : (
                <Badge variant='secondary' className='text-xs'>
                  Not Created
                </Badge>
              )}
            </div>

            {!setupStatus.dns.hasZone && (
              <div className='bg-yellow-500/10 border border-yellow-500/50 rounded-md p-3'>
                <div className='flex gap-2'>
                  <AlertCircle className='h-5 w-5 text-yellow-500 shrink-0 mt-0.5' />
                  <div>
                    <p className='text-sm font-medium text-yellow-500'>
                      Cloudflare Zone Not Created
                    </p>
                    <p className='text-sm text-muted-foreground mt-1'>
                      A Cloudflare zone is required to manage DNS records.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          {domain.assignedNameservers &&
            domain.assignedNameservers.length > 0 && (
              <div className='border-t' />
            )}

          {/* Nameservers Section */}
          {domain.assignedNameservers &&
          domain.assignedNameservers.length > 0 ? (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <p className='text-sm font-medium'>Nameservers</p>
                {setupStatus.dns.nameserversVerified ? (
                  <Badge variant='default' className='text-xs'>
                    Verified
                  </Badge>
                ) : (
                  <Badge variant='secondary' className='text-xs'>
                    Not Verified
                  </Badge>
                )}
              </div>

              <Collapsible
                open={nameserversExpanded}
                onOpenChange={setNameserversExpanded}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='w-full justify-between'
                  >
                    <span className='text-sm font-medium'>
                      {setupStatus.dns.nameserversVerified ? 'View' : 'Show'}{' '}
                      Assigned Nameservers
                    </span>
                    {nameserversExpanded ? (
                      <ChevronDown className='h-4 w-4' />
                    ) : (
                      <ChevronRight className='h-4 w-4' />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='space-y-2 pt-2'>
                  <div className='space-y-1'>
                    {domain.assignedNameservers.map((ns, index) => (
                      <div
                        key={index}
                        className='flex items-center gap-2 text-sm font-mono bg-muted p-2 rounded'
                      >
                        {setupStatus.dns.nameserversVerified && (
                          <CheckCircle2 className='h-4 w-4 text-green-500' />
                        )}
                        <span>{ns}</span>
                      </div>
                    ))}
                  </div>

                  {!setupStatus.dns.nameserversVerified && (
                    <div className='bg-blue-500/10 border border-blue-500/50 rounded-md p-3'>
                      <p className='text-sm font-medium text-blue-400 mb-1'>
                        Update your domain&apos;s nameservers
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        Change your nameservers at your domain registrar (
                        {domain.provider}) to point to the Cloudflare
                        nameservers listed above.
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            setupStatus.dns.hasZone && (
              <p className='text-sm text-muted-foreground'>
                No nameservers assigned yet.
              </p>
            )
          )}
        </CardContent>
      </Card>
      {/* Additional DNS Configuration */}
      {setupStatus.dns.recordCount > 0 && (
        <AdditionalDnsActions
          domain={domain}
          dmarcConfigured={dmarcConfigured}
          dmarcPending={dmarcPending}
          missingDKIM={setupStatus.dns.missingRecords.includes('DKIM')}
          needsManualVerification={
            !!domain.googleWorkspaceStatus &&
            domain.googleWorkspaceStatus !== 'verified' &&
            !domain.googleWorkspaceManuallyVerified
          }
          onConfirmManualVerification={() => setShowManualVerificationModal(true)}
          onAddDKIMRecord={onAddDKIMRecord}
          onCreateDMARCRecord={onCreateDMARCRecord}
        />
      )}
      {/* DNS Records */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>DNS Records</CardTitle>
            {setupStatus.dns.nameserversVerified && (
              <Button
                size='sm'
                onClick={handleConfigureEmailDNS}
                disabled={isConfiguring}
              >
                {isConfiguring ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Mail className='h-4 w-4 mr-2' />
                    Configure Email DNS
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {setupStatus.dns.recordCount > 0 ? (
            <div className='space-y-6'>
              {/* Missing Records Warning */}
              {setupStatus.dns.missingRecords.length > 0 && (
                <div className='bg-yellow-500/10 border border-yellow-500/50 rounded-md p-3'>
                  <div className='flex gap-2'>
                    <AlertCircle className='h-5 w-5 text-yellow-500 shrink-0 mt-0.5' />
                    <div>
                      <p className='text-sm font-medium text-yellow-500'>
                        Missing DNS Records
                      </p>
                      <p className='text-sm text-muted-foreground mt-1'>
                        The following records are not configured:{' '}
                        {setupStatus.dns.missingRecords.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SPF Records */}
              {dnsRecordsByType.SPF.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold mb-2'>SPF Records</h4>
                  <div className='rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dnsRecordsByType.SPF.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className='font-mono text-xs'>
                              {record.name}
                            </TableCell>
                            <TableCell className='font-mono text-xs max-w-md truncate'>
                              {record.value}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* DKIM Records */}
              {dnsRecordsByType.DKIM.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold mb-2'>DKIM Records</h4>
                  <div className='rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dnsRecordsByType.DKIM.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className='font-mono text-xs'>
                              {record.name}
                            </TableCell>
                            <TableCell className='font-mono text-xs max-w-md truncate'>
                              {record.value}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* DMARC Records */}
              {dnsRecordsByType.DMARC.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold mb-2'>DMARC Records</h4>
                  <div className='rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dnsRecordsByType.DMARC.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className='font-mono text-xs'>
                              {record.name}
                            </TableCell>
                            <TableCell className='font-mono text-xs max-w-md truncate'>
                              {record.value}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* MX Records */}
              {dnsRecordsByType.MX.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold mb-2'>MX Records</h4>
                  <div className='rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dnsRecordsByType.MX.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className='font-mono text-xs'>
                              {record.name}
                            </TableCell>
                            <TableCell className='font-mono text-xs'>
                              {record.value}
                            </TableCell>
                            <TableCell>{record.priority || 'N/A'}</TableCell>
                            <TableCell>
                              {getStatusBadge(record.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className='text-center py-8'>
              <p className='text-sm text-muted-foreground mb-4'>
                No DNS records configured yet
              </p>
              {setupStatus.dns.nameserversVerified && (
                <p className='text-sm text-muted-foreground'>
                  Click &quot;Configure Email DNS&quot; above to set up email
                  records
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Verification Modal */}
      <Dialog
        open={showManualVerificationModal}
        onOpenChange={setShowManualVerificationModal}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <AlertCircle className='h-5 w-5 text-orange-500' />
              Complete Domain Verification in Google Workspace
            </DialogTitle>
            <DialogDescription>
              <span className='font-medium text-orange-700'>Required:</span>{' '}
              Follow these steps to verify {domain.domain} in the Google Admin
              Console
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <Alert className='border-orange-200 bg-orange-50'>
              <AlertCircle className='h-4 w-4 text-orange-600' />
              <AlertDescription>
                <p className='font-medium mb-1 text-orange-800'>Important:</p>
                <p className='text-sm text-orange-700'>
                  The TXT verification record has already been added to your
                  DNS. You <span className='font-semibold'>must</span> click
                  &ldquo;Verify&rdquo; in the Google Admin Console to complete
                  this required step.
                </p>
              </AlertDescription>
            </Alert>

            <div className='space-y-3'>
              <h4 className='font-semibold'>Step-by-Step Instructions:</h4>

              <ol className='space-y-3 list-decimal list-inside'>
                <li className='text-sm'>
                  <span className='font-medium'>Open Google Admin Console</span>
                  <div className='ml-6 mt-1'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        window.open(
                          'https://admin.google.com/ac/domains/manage',
                          '_blank'
                        )
                      }
                    >
                      <ExternalLink className='h-4 w-4 mr-2' />
                      Open admin.google.com
                    </Button>
                  </div>
                </li>

                <li className='text-sm'>
                  <span className='font-medium'>Find your domain</span>
                  <p className='ml-6 text-muted-foreground'>
                    Look for <span className='font-mono'>{domain.domain}</span>{' '}
                    in the domains list
                  </p>
                </li>

                <li className='text-sm'>
                  <span className='font-medium'>
                    Click &ldquo;Verify domain&rdquo;
                  </span>
                  <p className='ml-6 text-muted-foreground'>
                    Next to {domain.domain}
                  </p>
                </li>

                <li className='text-sm'>
                  <span className='font-medium'>
                    Click &ldquo;Get started&rdquo;
                  </span>
                </li>

                <li className='text-sm'>
                  <span className='font-medium'>
                    Select &ldquo;Manual verification&rdquo;
                  </span>
                </li>

                <li className='text-sm'>
                  <span className='font-medium'>
                    Choose &ldquo;Cloudflare&rdquo; as domain host
                  </span>
                </li>

                <li className='text-sm'>
                  <span className='font-medium'>
                    Click &ldquo;Continue&rdquo;
                  </span>
                  <p className='ml-6 text-muted-foreground'>
                    The TXT record is already in place, so you can skip the
                    instructions
                  </p>
                </li>

                <li className='text-sm'>
                  <span className='font-medium'>
                    Click &ldquo;Confirm&rdquo;
                  </span>
                  <p className='ml-6 text-muted-foreground'>
                    Google will verify the TXT record and confirm your domain
                  </p>
                </li>
              </ol>
            </div>

            {verificationError && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>{verificationError}</AlertDescription>
              </Alert>
            )}

            <div className='flex items-center justify-between pt-4 border-t'>
              <p className='text-sm text-muted-foreground'>
                After completing verification in Google Admin Console:
              </p>
              <Button
                onClick={handleConfirmVerification}
                disabled={isConfirmingVerification}
              >
                {isConfirmingVerification ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Confirming...
                  </>
                ) : (
                  "I've Verified in Google Workspace"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
