import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LENGTH = 64
const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(KEY_LENGTH)}`

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

// 首次初始化在同步 SQLite 事务内执行；请求路径只使用异步版本。
export function hashInitialPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return `scrypt$${salt}$${key.toString('hex')}`
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = await deriveKey(password, salt)
  return `scrypt$${salt}$${key.toString('hex')}`
}

export async function verifyPassword(
  password: string,
  storedHash?: string
): Promise<boolean> {
  const encoded = storedHash ?? DUMMY_HASH
  const [algorithm, salt, digest] = encoded.split('$')
  if (
    algorithm !== 'scrypt' ||
    !salt ||
    !digest ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(digest)
  ) {
    await verifyPassword(password)
    return false
  }
  const actual = await deriveKey(password, salt)
  return timingSafeEqual(actual, Buffer.from(digest, 'hex')) && !!storedHash
}
