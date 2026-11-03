import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { passwordSchema, usernameSchema } from '../lib/auth-schema'
import { hashInitialPassword } from './password'

let database: Database.Database | undefined

export function initializeDatabase(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
    `)
    const initialized = db
      .prepare("SELECT value FROM app_metadata WHERE key = 'initialized'")
      .get()
    if (initialized) return

    const count = db.prepare('SELECT count(*) AS count FROM users').get() as {
      count: number
    }
    if (count.count !== 0) {
      throw new Error('数据库缺少初始化标记但已有用户，请检查数据库完整性')
    }
    const username = usernameSchema.safeParse(process.env.ADMIN_USERNAME)
    const password = passwordSchema.safeParse(process.env.ADMIN_PASSWORD)
    if (!username.success || !password.success) {
      throw new Error(
        '首次初始化需要有效的 ADMIN_USERNAME 和 ADMIN_PASSWORD（密码至少 8 位）'
      )
    }
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO users
       (id, username, password_hash, role, enabled, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', 1, ?, ?)`
    ).run(
      randomUUID(),
      username.data,
      hashInitialPassword(password.data),
      now,
      now
    )
    db.prepare(
      "INSERT INTO app_metadata (key, value) VALUES ('initialized', '1')"
    ).run()
  }).immediate()
}

export function getDatabase(): Database.Database {
  if (database) return database
  const filename = process.env.DATABASE_PATH || './data/trust-admin.sqlite'
  if (filename !== ':memory:') {
    mkdirSync(dirname(resolve(/* turbopackIgnore: true */ filename)), {
      recursive: true,
      mode: 0o700,
    })
  }
  const db = new Database(filename)
  try {
    initializeDatabase(db)
    database = db
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

export function closeDatabase(): void {
  database?.close()
  database = undefined
}
