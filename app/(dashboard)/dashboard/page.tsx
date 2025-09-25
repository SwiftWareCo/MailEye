import { requireOnboarding } from '@/server/auth/auth.data';
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
    <div className='space-y-6'>
      {/* Simple Welcome Header */}
      <div className='text-center py-12'>
        <h1 className='text-4xl font-bold text-white mb-4'>
          Welcome back, {userWithMetadata?.displayName || 'User'}!
        </h1>
        <p className='text-gray-300 text-lg'>
          Your MailEye dashboard is ready.
        </p>
      </div>
    </div>
  );
}
