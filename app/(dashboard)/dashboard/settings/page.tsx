import SettingsContent from '@/components/settings/SettingsContent';

export default function SettingsPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black'>
      <div className='max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center mb-4'>
            <a
              href='/dashboard'
              className='inline-flex items-center text-gray-400 hover:text-white'
            >
              <svg
                className='mr-2 h-4 w-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M10 19l-7-7m0 0l7-7m-7 7h18'
                />
              </svg>
              Back to Dashboard
            </a>
          </div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            Account Settings
          </h1>
          <p className='text-gray-400'>
            Manage your account preferences and personal information.
          </p>
        </div>

        {/* Account Settings */}
        <div className='bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700'>
          <h2 className='text-xl font-semibold text-white mb-6'>
            Account Management
          </h2>

          <SettingsContent />
        </div>
      </div>
    </div>
  );
}
