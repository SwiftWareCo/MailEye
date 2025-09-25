'use client';

import { AccountSettings } from '@stackframe/stack';
import SettingsForm from './SettingsForm';
import { SettingsIcon } from 'lucide-react';

interface StackAuthSettingsProps {
  preferences: {
    language: string;
    timezone: string;
  };
}

export default function StackAuthSettings({ preferences }: StackAuthSettingsProps) {
  return (
    <div className="stack-auth-wrapper">
      <AccountSettings
        fullPage={false}
        extraItems={[
          {
            title: 'Application Preferences',
            id: 'application-preferences',
            icon: <SettingsIcon />,
            iconName: 'Settings',
            content: (
              <div className="space-y-4">
                <SettingsForm preferences={preferences} />
              </div>
            )
          }
        ]}
      />
    </div>
  );
}