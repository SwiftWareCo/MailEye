import Signout from "@/components/auth/Signout";
import { requireOnboarding } from "@/server/auth/auth.data";
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { needsOnboarding, user: userWithMetadata } = await requireOnboarding();

  // If user is not authenticated, Stack Auth middleware will handle redirect
  if (!userWithMetadata) {
    return null;
  }

  // If user needs onboarding, redirect to onboarding page
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header with Settings Link */}
          <div className="flex justify-between items-start mb-8">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold text-white mb-4">
                Welcome to MailEye
              </h1>
              <p className="text-xl text-gray-300 mb-6">
                Hello, {userWithMetadata?.displayName || userWithMetadata?.primaryEmail || "User"}!
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/dashboard/settings"
                className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </a>
              <Signout />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-2">
                Active Campaigns
              </h3>
              <p className="text-3xl font-bold text-blue-400">0</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-2">
                Total Emails Sent
              </h3>
              <p className="text-3xl font-bold text-green-400">0</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-2">
                Response Rate
              </h3>
              <p className="text-3xl font-bold text-purple-400">0%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}