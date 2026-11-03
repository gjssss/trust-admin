'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PublicUser } from '@/lib/auth-schema'

const AuthContext = createContext<{
  user: PublicUser | null
  logout: () => Promise<void>
} | null>(null)

export function AuthProvider({
  user,
  children,
}: {
  user: PublicUser | null
  children: ReactNode
}) {
  const client = useQueryClient()
  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' })
    if (!response.ok && response.status !== 401)
      throw new Error('退出失败，请重试')
    client.clear()
    window.location.replace('/sign-in')
  }
  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is required')
  return context
}
