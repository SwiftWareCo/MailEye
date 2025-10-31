'use client';

import { AccountSettings } from '@stackframe/stack';
import SettingsForm from './SettingsForm';
import ConnectedServicesSettings from './ConnectedServicesSettings';
import { SettingsIcon, Plug } from 'lucide-react';

interface StackAuthSettingsProps {
  preferences: {
    language: string;
    timezone: string;
  };
  credentialStatus: {
    cloudflare: boolean;
    googleWorkspace: boolean;
    smartlead: boolean;
  };
  credentialDetailsDisplay?: {
    cloudflare?: {
      accountId: string;
      apiToken: string;
      connectedAt: string;
    };
    googleWorkspace?: {
      serviceAccountEmail: string;
      adminEmail: string;
      privateKey: string;
      customerId?: string;
      connectedAt: string;
    };
    smartlead?: {
      apiKey: string;
      email?: string;
      hasLoginCredentials: boolean;
      connectedAt: string;
    };
  } | null;
  credentialDetailsEdit?: {
    cloudflare?: {
      accountId: string;
    };
    googleWorkspace?: {
      serviceAccountEmail: string;
      adminEmail: string;
      customerId?: string;
    };
    smartlead?: {
      email?: string;
    };
  } | null;
}

export default function StackAuthSettings({
  preferences,
  credentialStatus,
  credentialDetailsDisplay,
  credentialDetailsEdit,
}: StackAuthSettingsProps) {
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
            ),
          },
          {
            title: 'Connected Services',
            id: 'connected-services',
            icon: <Plug />,
            iconName: 'Key',
            content: (
              <div className="space-y-4">
                <ConnectedServicesSettings
                  credentialStatus={credentialStatus}
                  credentialDetailsDisplay={credentialDetailsDisplay}
                  credentialDetailsEdit={credentialDetailsEdit}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}