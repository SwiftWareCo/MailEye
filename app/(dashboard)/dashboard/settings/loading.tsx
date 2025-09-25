export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            {/* Back button skeleton */}
            <div className="inline-flex items-center text-gray-600 mr-4">
              <div className="mr-2 h-4 w-4 bg-gray-600 rounded animate-pulse" />
              <div className="h-4 w-28 bg-gray-600 rounded animate-pulse" />
            </div>
          </div>
          {/* Title skeleton */}
          <div className="h-9 w-48 bg-gray-600 rounded animate-pulse mb-2" />
          {/* Description skeleton */}
          <div className="h-5 w-80 bg-gray-600 rounded animate-pulse" />
        </div>

        {/* Settings Content Skeleton */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          {/* Tab navigation skeleton */}
          <div className="flex space-x-6 mb-8">
            <div className="h-6 w-20 bg-gray-600 rounded animate-pulse" />
            <div className="h-6 w-16 bg-gray-600 rounded animate-pulse" />
            <div className="h-6 w-24 bg-gray-600 rounded animate-pulse" />
          </div>

          {/* Form fields skeleton */}
          <div className="space-y-6">
            {/* Language field */}
            <div>
              <div className="h-5 w-16 bg-gray-600 rounded animate-pulse mb-2" />
              <div className="h-10 w-full bg-gray-700/50 border border-gray-600 rounded-md animate-pulse" />
            </div>

            {/* Timezone field */}
            <div>
              <div className="h-5 w-20 bg-gray-600 rounded animate-pulse mb-2" />
              <div className="h-10 w-full bg-gray-700/50 border border-gray-600 rounded-md animate-pulse" />
            </div>

            {/* Save button skeleton */}
            <div className="flex justify-end pt-4">
              <div className="h-10 w-32 bg-blue-600/50 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}