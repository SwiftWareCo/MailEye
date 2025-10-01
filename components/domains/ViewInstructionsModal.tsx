/**
 * View Instructions Modal Component
 *
 * Modal to view nameserver setup instructions for a domain
 * Accessible from the domain actions menu
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NameserverInstructions } from './NameserverInstructions';
import { generateNameserverInstructions } from '@/server/domain/nameserver-instructions';
import type { Domain, DomainProvider } from '@/lib/types/domain';

interface ViewInstructionsModalProps {
  domain: Domain;
  children: React.ReactNode;
}

export function ViewInstructionsModal({
  domain,
  children,
}: ViewInstructionsModalProps) {
  const [open, setOpen] = useState(false);

  // Generate instructions based on domain's provider
  const instructions = generateNameserverInstructions(
    (domain.provider as DomainProvider) || 'other'
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nameserver Setup Instructions</DialogTitle>
          <DialogDescription>
            Follow these instructions to complete your domain setup
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <NameserverInstructions
            instructions={instructions}
            domain={domain.domain}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
