import Database from 'better-sqlite3'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { closeDatabase, getDatabase } from '../src/server/db'
import { ApiError, handleApiError } from '../src/server/errors'
import { hashPassword, verifyPassword } from '../src/server/password'
import { checkLoginRateLimit, validateOrigin } from '../src/server/security'
import {
  authenticate,
  getUserForSession,
  hashSessionToken,
  revokeSession,
  SESSION_DURATION_MS,
  sessionCookieOptions,
} from '../src/server/session'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '../src/server/users'

let directory: string
let sequence = 0
let adminName: string
const savedEnvironment = { ...process.env }
const password = 'Test-password-2026'

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'trust-admin-auth-'))
  process.env.DATABASE_PATH = join(directory, 'auth.sqlite')
  adminName = `admin-${++sequence}`
  process.env.ADMIN_USERNAME = adminName
  process.env.ADMIN_PASSWORD = password
  process.env.APP_ORIGIN = 'https://trust.example'
})

afterEach(() => {
  closeDatabase()
  rmSync(directory, { recursive: true, force: true })
  for (const key of [
    'DATABASE_PATH',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'APP_ORIGIN',
    'NODE_ENV',
  ]) {
    if (savedEnvironment[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnvironment[key]
  }
})

function adminLogin() {
  return authenticate({ username: adminName, password })
}

function hasStatus(status: number) {
  return (error: unknown) =>
    error instanceof ApiError && error.status === status
}

test('导入不创建数据库，首次初始化设置 WAL、外键和唯一管理员', async () => {
  assert.equal(existsSync(process.env.DATABASE_PATH!), false)
  const db = getDatabase()
  assert.equal(db.pragma('journal_mode', { simple: true }), 'wal')
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1)
  const admin = (await adminLogin()).user
  assert.equal(admin.role, 'admin')
  assert.equal(admin.enabled, true)
  assert.deepEqual(Object.keys(admin).sort(), [
    'createdAt',
    'enabled',
    'id',
    'role',
    'updatedAt',
    'username',
  ])
  assert.equal(listUsers(admin.id).length, 1)
  assert.equal(
    db
      .prepare("SELECT value FROM app_metadata WHERE key = 'initialized'")
      .get() !== undefined,
    true
  )
})

test('初始化失败整体回滚，修正环境变量后可以重新初始化', async () => {
  delete process.env.ADMIN_PASSWORD
  assert.throws(() => getDatabase(), /ADMIN_PASSWORD/)
  const raw = new Database(process.env.DATABASE_PATH!)
  assert.equal(
    raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
      .length,
    0
  )
  raw.close()
  process.env.ADMIN_PASSWORD = password
  assert.equal((await adminLogin()).user.role, 'admin')
})

test('初始化幂等且不使用环境变量重置管理员，不在空表重新播种', async () => {
  const first = (await adminLogin()).user
  closeDatabase()
  process.env.ADMIN_USERNAME = 'replacement-admin'
  delete process.env.ADMIN_PASSWORD
  const db = getDatabase()
  assert.equal(listUsers(first.id)[0].username, adminName)
  db.prepare('DELETE FROM users').run()
  closeDatabase()
  assert.equal(
    (
      getDatabase().prepare('SELECT count(*) AS count FROM users').get() as {
        count: number
      }
    ).count,
    0
  )
})

test('无初始化标记但已有用户时拒绝启动且不修改已有数据', async () => {
  const admin = (await adminLogin()).user
  getDatabase()
    .prepare("DELETE FROM app_metadata WHERE key = 'initialized'")
    .run()
  closeDatabase()
  assert.throws(() => getDatabase(), /缺少初始化标记但已有用户/)
  const raw = new Database(process.env.DATABASE_PATH!)
  try {
    assert.equal(raw.prepare('SELECT id FROM users').get() !== undefined, true)
    assert.equal(
      (raw.prepare('SELECT id FROM users').get() as { id: string }).id,
      admin.id
    )
    assert.equal(
      raw
        .prepare("SELECT value FROM app_metadata WHERE key = 'initialized'")
        .get(),
      undefined
    )
  } finally {
    raw.close()
  }
})

test('生产初始化脚本先校验 APP_ORIGIN，再访问数据库', () => {
  const script = new URL('../scripts/init-db.ts', import.meta.url)
  for (const origin of ['', 'not-a-url']) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      APP_ORIGIN: origin,
    }
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', script.pathname],
      { env, encoding: 'utf8' }
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /APP_ORIGIN/)
    assert.equal(existsSync(process.env.DATABASE_PATH!), false)
  }
})

test('异步 scrypt 计算期间事件循环仍可运行', async () => {
  let completed = false
  const pending = hashPassword(password).then(() => {
    completed = true
  })
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(completed, false)
  await pending
})

test('scrypt 使用随机盐，拒绝错误密码和损坏摘要', async () => {
  const one = await hashPassword(password)
  const two = await hashPassword(password)
  assert.notEqual(one, two)
  assert.equal(one.includes(password), false)
  assert.equal(await verifyPassword(password, one), true)
  assert.equal(await verifyPassword('incorrect', one), false)
  assert.equal(await verifyPassword(password, 'broken'), false)
  assert.equal(await verifyPassword(password), false)
})

test('未知用户、错误密码、禁用用户和非法字段使用同一登录错误', async () => {
  const admin = (await adminLogin()).user
  await createUser(admin.id, {
    username: 'disabled-user',
    password,
    enabled: false,
  })
  const cases = [
    { username: 'does-not-exist', password },
    { username: adminName, password: 'wrong-password' },
    { username: 'disabled-user', password },
    { username: '', password: '' },
  ]
  for (const input of cases) {
    await assert.rejects(
      () => authenticate(input),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 401 &&
        error.message === '用户名或密码错误'
    )
  }
})

test('会话只存摘要，7 天到期，注销后不可复用', async () => {
  const login = await adminLogin()
  const row = getDatabase().prepare('SELECT * FROM sessions').get() as {
    token_hash: string
    created_at: number
    expires_at: number
  }
  assert.equal(row.token_hash, hashSessionToken(login.token))
  assert.notEqual(row.token_hash, login.token)
  assert.equal(row.expires_at - row.created_at, SESSION_DURATION_MS)
  assert.equal(getUserForSession(login.token)?.id, login.user.id)
  assert.equal(getUserForSession(login.token, login.expiresAt), null)
  assert.equal(getUserForSession('invalid-token'), null)
  revokeSession(login.token)
  assert.equal(getUserForSession(login.token), null)
})

test('CRUD 隔离普通用户权限并检测重复用户名', async () => {
  const admin = (await adminLogin()).user
  const user = await createUser(admin.id, { username: 'normal-user', password })
  assert.equal(user.role, 'user')
  assert.throws(() => listUsers(user.id), hasStatus(403))
  await assert.rejects(
    () => createUser(user.id, { username: 'another-user', password }),
    hasStatus(403)
  )
  await assert.rejects(
    () => updateUser(user.id, user.id, { role: 'admin' }),
    hasStatus(403)
  )
  assert.throws(() => deleteUser(user.id, admin.id), hasStatus(403))
  await assert.rejects(
    () => createUser(admin.id, { username: 'NORMAL-USER', password }),
    hasStatus(409)
  )
  assert.equal(
    (await updateUser(admin.id, user.id, { username: 'renamed-user' }))
      .username,
    'renamed-user'
  )
  deleteUser(admin.id, user.id)
  assert.equal(listUsers(admin.id).length, 1)
})

test('改密、角色修改和启用状态修改均撤销会话，删除级联清理', async () => {
  const admin = (await adminLogin()).user
  const user = await createUser(admin.id, {
    username: 'session-user',
    password,
  })
  let login = await authenticate({ username: user.username, password })
  await updateUser(admin.id, user.id, { password: 'Changed-password-2026' })
  assert.equal(getUserForSession(login.token), null)
  await assert.rejects(
    () => authenticate({ username: user.username, password }),
    hasStatus(401)
  )
  login = await authenticate({
    username: user.username,
    password: 'Changed-password-2026',
  })
  await updateUser(admin.id, user.id, { role: 'admin' })
  assert.equal(getUserForSession(login.token), null)
  login = await authenticate({
    username: user.username,
    password: 'Changed-password-2026',
  })
  await updateUser(admin.id, user.id, { enabled: false })
  assert.equal(getUserForSession(login.token), null)
  await updateUser(admin.id, user.id, { enabled: true })
  login = await authenticate({
    username: user.username,
    password: 'Changed-password-2026',
  })
  deleteUser(admin.id, user.id)
  assert.equal(getUserForSession(login.token), null)
})

test('异步验密和哈希期间撤权，写事务重新检查用户状态和操作者权限', async () => {
  const admin = (await adminLogin()).user
  const other = await createUser(admin.id, {
    username: 'race-admin',
    password,
    role: 'admin',
  })
  const pendingLogin = authenticate({ username: other.username, password })
  await updateUser(admin.id, other.id, { enabled: false })
  await assert.rejects(pendingLogin, hasStatus(401))
  await updateUser(admin.id, other.id, { enabled: true })
  const pendingCreate = createUser(other.id, {
    username: 'race-created',
    password,
  })
  await updateUser(admin.id, other.id, { role: 'user' })
  await assert.rejects(pendingCreate, hasStatus(403))
  assert.equal(
    listUsers(admin.id).some((user) => user.username === 'race-created'),
    false
  )
})

test('最后启用管理员不能删除、降级或停用，禁用管理员不计入人数', async () => {
  const admin = (await adminLogin()).user
  await createUser(admin.id, {
    username: 'disabled-admin',
    password,
    role: 'admin',
    enabled: false,
  })
  assert.throws(() => deleteUser(admin.id, admin.id), hasStatus(409))
  await assert.rejects(
    () => updateUser(admin.id, admin.id, { role: 'user' }),
    hasStatus(409)
  )
  await assert.rejects(
    () => updateUser(admin.id, admin.id, { enabled: false }),
    hasStatus(409)
  )
  const other = await createUser(admin.id, {
    username: 'second-admin',
    password,
    role: 'admin',
  })
  await updateUser(admin.id, admin.id, { role: 'user' })
  assert.throws(() => deleteUser(admin.id, other.id), hasStatus(403))
  assert.throws(() => deleteUser(other.id, other.id), hasStatus(409))
  assert.equal(
    listUsers(other.id).filter((user) => user.role === 'admin' && user.enabled)
      .length,
    1
  )
})

test('同源校验拒绝缺失/跨站 Origin，Cookie 安全属性由 APP_ORIGIN 决定', async () => {
  const request = new Request('http://internal:3000/api/auth/login', {
    method: 'POST',
    headers: { origin: 'https://trust.example' },
  })
  assert.doesNotThrow(() => validateOrigin(request))
  const cookie = sessionCookieOptions(request)
  assert.equal(cookie.secure, true)
  assert.equal(cookie.httpOnly, true)
  assert.equal(cookie.sameSite, 'lax')
  assert.equal(cookie.maxAge, 7 * 24 * 60 * 60)
  assert.throws(() => validateOrigin(new Request(request.url)), hasStatus(403))
  assert.throws(
    () =>
      validateOrigin(
        new Request(request.url, {
          headers: { origin: 'https://attacker.example' },
        })
      ),
    hasStatus(403)
  )
  process.env.APP_ORIGIN = 'http://localhost:3000'
  assert.equal(sessionCookieOptions(request).secure, false)
  delete process.env.APP_ORIGIN
  Object.assign(process.env, { NODE_ENV: 'development' })
  assert.doesNotThrow(() =>
    validateOrigin(
      new Request('http://localhost:3000/api/auth/login', {
        headers: { origin: 'http://localhost:3000' },
      })
    )
  )
  Object.assign(process.env, { NODE_ENV: 'production' })
  assert.throws(() => validateOrigin(request), hasStatus(500))
})

test('登录限流包含账号阈值和全局阈值', async () => {
  const now = Date.now() + 60 * 60 * 1000
  for (let i = 0; i < 10; i++) checkLoginRateLimit('rate-user', now)
  assert.throws(() => checkLoginRateLimit('RATE-USER', now), hasStatus(429))
  const next = now + 16 * 60 * 1000
  for (let i = 0; i < 120; i++) checkLoginRateLimit(`rate-${i}`, next)
  assert.throws(
    () => checkLoginRateLimit('rate-overflow', next),
    hasStatus(429)
  )
})

test('API 错误使用稳定的中文 JSON 契约', async () => {
  const response = handleApiError(new ApiError(401, '请先登录'))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: '请先登录' })
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})
