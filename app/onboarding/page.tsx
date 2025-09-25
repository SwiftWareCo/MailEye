import { getUserWithMetadata } from '@/server/auth/auth.data';
import OnboardingForm from '@/components/onboarding/OnboardingForm';

export default async function OnboardingPage() {
  // Authentication and onboarding completion checks are now handled by middleware
  const user = await getUserWithMetadata();

  // At this point, middleware ensures user is authenticated and hasn't completed onboarding
  if (!user) {
    return null; // This shouldn't happen due to middleware, but TypeScript safety
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to MailEye!
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Let's get your account set up to start managing your cold email campaigns.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-green-600 rounded-full">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-300">Account Created</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-600"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full">
                <span className="text-white font-medium text-sm">2</span>
              </div>
              <span className="ml-2 text-sm font-medium text-white">Setup Profile</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-600"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-600 rounded-full">
                <span className="text-gray-400 font-medium text-sm">3</span>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-400">Get Started</span>
            </div>
          </div>
        </div>

        {/* Onboarding Form Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-lg border border-gray-700 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white mb-2">
              Tell us about yourself
            </h2>
            <p className="text-gray-400">
              Help us personalize your MailEye experience with a few quick details.
            </p>
          </div>

          <OnboardingForm user={user} />
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-400">
            This will only take a minute and help us customize your experience.
          </p>
        </div>
      </div>
    </div>
  );
}