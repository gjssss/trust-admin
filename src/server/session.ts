import { createHash, randomBytes } from 'node:crypto'
import { loginSchema, type PublicUser } from '../lib/auth-schema'
import { getDatabase } from './db'
import { ApiError } from './errors'
import { verifyPassword } from './password'
import { checkLoginRateLimit, getAppOrigin } from './security'
import { publicUser, type UserRow } from './users'

export const SESSION_COOKIE_NAME = 'trust_session'
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: getAppOrigin(request).startsWith('https:'),
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  }
}

export async function authenticate(input: unknown): Promise<{
  user: PublicUser
  token: string
  expiresAt: number
}> {
  const parsed = loginSchema.safeParse(input)
  checkLoginRateLimit(parsed.success ? parsed.data.username : '<invalid>')
  if (!parsed.success) {
    await verifyPassword('invalid')
    throw new ApiError(401, '用户名或密码错误')
  }
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(parsed.data.username) as UserRow | undefined
  const validPassword = await verifyPassword(
    parsed.data.password,
    row?.password_hash
  )
  if (!row || !validPassword || row.enabled !== 1) {
    throw new ApiError(401, '用户名或密码错误')
  }

  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS
  return db
    .transaction(() => {
      // 在写锁内重新检查，避免另一进程改密或禁用后仍创建会话。
      const current = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(row.id) as UserRow | undefined
      if (
        !current ||
        current.enabled !== 1 ||
        current.password_hash !== row.password_hash
      ) {
        throw new ApiError(401, '用户名或密码错误')
      }
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
      db.prepare(
        'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
      ).run(hashSessionToken(token), row.id, expiresAt, now)
      return { user: publicUser(current), token, expiresAt }
    })
    .immediate()
}

export function getUserForSession(
  token?: string,
  now = Date.now()
): PublicUser | null {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const row = getDatabase()
    .prepare(
      `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.enabled = 1`
    )
    .get(hashSessionToken(token), now) as UserRow | undefined
  return row ? publicUser(row) : null
}

export function revokeSession(token?: string): void {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return
  getDatabase()
    .prepare('DELETE FROM sessions WHERE token_hash = ?')
    .run(hashSessionToken(token))
}
