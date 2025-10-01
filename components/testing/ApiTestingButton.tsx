'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiTestingModal } from './ApiTestingModal';
import { Settings } from 'lucide-react';

export function ApiTestingButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size='lg' className='gap-2'>
        <Settings className='h-4 w-4' />
        Test API Services
      </Button>
      <ApiTestingModal open={open} onOpenChange={setOpen} />
    </>
  );
}
