export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            {/* Back button skeleton */}
            <div className="inline-flex items-center text-muted-foreground mr-4">
              <div className="mr-2 h-4 w-4 bg-muted rounded animate-pulse" />
              <div className="h-4 w-28 bg-muted rounded animate-pulse" />
            </div>
          </div>
          {/* Title skeleton */}
          <div className="h-9 w-48 bg-muted rounded animate-pulse mb-2" />
          {/* Description skeleton */}
          <div className="h-5 w-80 bg-muted rounded animate-pulse" />
        </div>

        {/* Settings Content Skeleton */}
        <div className="bg-card border border-border rounded-lg p-6">
          {/* Tab navigation skeleton */}
          <div className="flex space-x-6 mb-8">
            <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
          </div>

          {/* Form fields skeleton */}
          <div className="space-y-6">
            {/* Language field */}
            <div>
              <div className="h-5 w-16 bg-muted rounded animate-pulse mb-2" />
              <div className="h-10 w-full bg-input border border-border rounded-md animate-pulse" />
            </div>

            {/* Timezone field */}
            <div>
              <div className="h-5 w-20 bg-muted rounded animate-pulse mb-2" />
              <div className="h-10 w-full bg-input border border-border rounded-md animate-pulse" />
            </div>

            {/* Save button skeleton */}
            <div className="flex justify-end pt-4">
              <div className="h-10 w-32 bg-primary/50 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}