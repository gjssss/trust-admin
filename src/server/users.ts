import { randomUUID } from 'node:crypto'
import {
  createUserSchema,
  updateUserSchema,
  type PublicUser,
} from '../lib/auth-schema'
import { getDatabase } from './db'
import { ApiError } from './errors'
import { hashPassword } from './password'

export type UserRow = {
  id: string
  username: string
  password_hash: string
  role: 'admin' | 'user'
  enabled: number
  created_at: string
  updated_at: string
}

export function publicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function findUser(id: string): UserRow {
  const row = getDatabase()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id) as UserRow | undefined
  if (!row) throw new ApiError(404, '用户不存在')
  return row
}

function assertAdmin(actorId: string): void {
  const actor = getDatabase()
    .prepare(
      "SELECT id FROM users WHERE id = ? AND role = 'admin' AND enabled = 1"
    )
    .get(actorId)
  if (!actor) throw new ApiError(403, '需要管理员权限')
}

function protectLastAdmin(row: UserRow): void {
  if (row.role !== 'admin' || row.enabled !== 1) return
  const result = getDatabase()
    .prepare(
      "SELECT count(*) AS count FROM users WHERE role = 'admin' AND enabled = 1"
    )
    .get() as { count: number }
  if (result.count <= 1) {
    throw new ApiError(409, '必须保留至少一个启用的管理员')
  }
}

function mapWriteError(error: unknown): never {
  if (
    error instanceof Error &&
    'code' in error &&
    error.code === 'SQLITE_CONSTRAINT_UNIQUE'
  ) {
    throw new ApiError(409, '用户名已存在')
  }
  throw error
}

export function listUsers(actorId: string): PublicUser[] {
  return getDatabase().transaction(() => {
    assertAdmin(actorId)
    const rows = getDatabase()
      .prepare('SELECT * FROM users ORDER BY created_at, id')
      .all() as UserRow[]
    return rows.map(publicUser)
  })()
}

export function getUser(actorId: string, id: string): PublicUser {
  return getDatabase().transaction(() => {
    assertAdmin(actorId)
    return publicUser(findUser(id))
  })()
}

export async function createUser(
  actorId: string,
  input: unknown
): Promise<PublicUser> {
  const data = createUserSchema.parse(input)
  assertAdmin(actorId)
  const passwordHash = await hashPassword(data.password)
  try {
    return getDatabase()
      .transaction(() => {
        assertAdmin(actorId)
        const id = randomUUID()
        const now = new Date().toISOString()
        getDatabase()
          .prepare(
            `INSERT INTO users
           (id, username, password_hash, role, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            data.username,
            passwordHash,
            data.role,
            Number(data.enabled),
            now,
            now
          )
        return publicUser(findUser(id))
      })
      .immediate()
  } catch (error) {
    return mapWriteError(error)
  }
}

export async function updateUser(
  actorId: string,
  id: string,
  input: unknown
): Promise<PublicUser> {
  const data = updateUserSchema.parse(input)
  assertAdmin(actorId)
  const passwordHash = data.password
    ? await hashPassword(data.password)
    : undefined
  try {
    return getDatabase()
      .transaction(() => {
        assertAdmin(actorId)
        const previous = findUser(id)
        const role = data.role ?? previous.role
        const enabled =
          data.enabled === undefined ? previous.enabled : Number(data.enabled)
        if (role !== 'admin' || enabled !== 1) protectLastAdmin(previous)
        getDatabase()
          .prepare(
            `UPDATE users SET username = ?, password_hash = ?, role = ?,
           enabled = ?, updated_at = ? WHERE id = ?`
          )
          .run(
            data.username ?? previous.username,
            passwordHash ?? previous.password_hash,
            role,
            enabled,
            new Date().toISOString(),
            id
          )
        if (
          passwordHash ||
          role !== previous.role ||
          enabled !== previous.enabled
        ) {
          getDatabase()
            .prepare('DELETE FROM sessions WHERE user_id = ?')
            .run(id)
        }
        return publicUser(findUser(id))
      })
      .immediate()
  } catch (error) {
    return mapWriteError(error)
  }
}

export function deleteUser(actorId: string, id: string): void {
  getDatabase()
    .transaction(() => {
      assertAdmin(actorId)
      protectLastAdmin(findUser(id))
      getDatabase().prepare('DELETE FROM users WHERE id = ?').run(id)
    })
    .immediate()
}
