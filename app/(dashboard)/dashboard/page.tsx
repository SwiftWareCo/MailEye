import { requireOnboarding } from '@/server/auth/auth.data';
import { redirect } from 'next/navigation';
import { db, auditSessions } from '@/lib/db';
import { eq } from 'drizzle-orm';

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

  // Quick database test - fetch audit sessions for the current user
  let auditSessionsCount = 0;
  let dbTestResult = 'Not tested';

  try {
    const userSessions = await db
      .select()
      .from(auditSessions)
      .where(eq(auditSessions.userId, userWithMetadata.id))
      .limit(10);

    auditSessionsCount = userSessions.length;
    dbTestResult = 'Database connection successful';
  } catch (error) {
    console.error('Database test failed:', error);
    dbTestResult = `Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
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

      {/* Database Test Results */}
      <div className='max-w-2xl mx-auto bg-gray-800/50 p-6 rounded-lg border border-gray-700'>
        <h2 className='text-xl font-semibold text-white mb-4'>Database Test Results</h2>
        <div className='space-y-2'>
          <p className='text-gray-300'>
            <span className='font-medium'>Status:</span>{' '}
            <span className={dbTestResult.includes('successful') ? 'text-green-400' : 'text-red-400'}>
              {dbTestResult}
            </span>
          </p>
          <p className='text-gray-300'>
            <span className='font-medium'>Audit Sessions Found:</span> {auditSessionsCount}
          </p>
          <p className='text-gray-300'>
            <span className='font-medium'>User ID:</span> {userWithMetadata.id}
          </p>
        </div>
      </div>
    </div>
  );
}
