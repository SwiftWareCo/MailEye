import { getSettingsPageData } from '@/server/auth/auth.data';
import { redirect } from 'next/navigation';
import StackAuthSettings from './StackAuthSettings';

export default async function SettingsContent() {
  const {
    needsOnboarding,
    user,
    preferences,
    credentialStatus,
    credentialDetailsDisplay,
    credentialDetailsEdit,
  } = await getSettingsPageData();

  // If user is not authenticated, Stack Auth middleware will handle redirect
  if (!user) {
    return null;
  }

  // If user needs onboarding, redirect to onboarding page
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  return (
    <>
      {/* User Info Summary */}
      <div className="mb-6 p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">
              {user.displayName || user.primaryEmail}
            </h3>
            <p className="text-sm text-gray-400">{user.primaryEmail}</p>
          </div>
          <div className="flex items-center">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.primaryEmailVerified
                  ? 'bg-green-900/20 border border-green-700 text-green-400'
                  : 'bg-yellow-900/20 border border-yellow-700 text-yellow-400'
              }`}
            >
              {user.primaryEmailVerified ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Verified
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Pending Verification
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Embedded Stack Auth Settings */}
      <StackAuthSettings
        preferences={preferences || {
          language: 'en',
          timezone: 'UTC',
        }}
        credentialStatus={credentialStatus}
        credentialDetailsDisplay={credentialDetailsDisplay}
        credentialDetailsEdit={credentialDetailsEdit}
      />
    </>
  );
}