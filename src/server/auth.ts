import { cookies } from 'next/headers'
import { type PublicUser } from '../lib/auth-schema'
import { ApiError } from './errors'
import { getUserForSession, SESSION_COOKIE_NAME } from './session'

export { SESSION_COOKIE_NAME } from './session'

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies()
  return getUserForSession(cookieStore.get(SESSION_COOKIE_NAME)?.value)
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, '请先登录')
  return user
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser()
  if (user.role !== 'admin') throw new ApiError(403, '需要管理员权限')
  return user
}
