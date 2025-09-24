'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Optimized for Server Components + mutations pattern
            staleTime: 5 * 60 * 1000, // 5 minutes - prevents immediate refetch after server-side data
            gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
          },
          mutations: {
            // Mutations will trigger router.refresh() to update Server Components
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}