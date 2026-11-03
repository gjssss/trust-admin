import { getCurrentUser } from '@/server/auth'
import { redirect } from 'next/navigation'
import { Users } from '@/features/users'

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role !== 'admin') redirect('/403')
  return <Users />
}
