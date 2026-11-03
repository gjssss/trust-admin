'use client'

import { useState, type ReactNode } from 'react'
import { AxiosError } from 'axios'
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { DirectionProvider } from '@/context/direction-provider'
import { FontProvider } from '@/context/font-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { Toaster } from '@/components/ui/sonner'

function handleError(error: unknown) {
  if (error instanceof AxiosError && error.response?.status === 401) {
    if (window.location.pathname !== '/sign-in')
      window.location.replace(
        `/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
      )
    return
  }
  if (error instanceof AxiosError && error.response?.status === 403)
    toast.error('没有执行此操作的权限')
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleError }),
        mutationCache: new MutationCache({ onError: handleError }),
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            retry: (count, error) =>
              !(
                error instanceof AxiosError &&
                [401, 403].includes(error.response?.status ?? 0)
              ) && count < (process.env.NODE_ENV === 'production' ? 3 : 0),
          },
        },
      })
  )
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <FontProvider>
          <DirectionProvider>
            {children}
            <Toaster duration={5000} />
          </DirectionProvider>
        </FontProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
