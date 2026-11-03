import { getCurrentUser } from '@/server/auth'
import { redirect } from 'next/navigation'
import { AuthProvider } from '@/context/auth-provider'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const dynamic = 'force-dynamic'
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  return (
    <AuthProvider user={user} key={user.id}>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </AuthProvider>
  )
}
