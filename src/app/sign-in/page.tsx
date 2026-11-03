import { getCurrentUser } from '@/server/auth'
import { redirect } from 'next/navigation'
import { SignIn } from '@/features/auth/sign-in'

export const dynamic = 'force-dynamic'
export default async function SignInPage() {
  if (await getCurrentUser()) redirect('/')
  return <SignIn />
}
