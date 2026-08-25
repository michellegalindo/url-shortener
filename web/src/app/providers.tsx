import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { queryClient } from './query-client'
import { router } from './router'

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" duration={4000} />
    </QueryClientProvider>
  )
}
