import { ApiError } from './errors'

export function getAppOrigin(request?: Request): string {
  const configured = process.env.APP_ORIGIN
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new ApiError(500, '服务器尚未配置 APP_ORIGIN')
  }
  try {
    const url = new URL(configured || request?.url || 'http://localhost:3000')
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (configured && (url.pathname !== '/' || url.search || url.hash))
    ) {
      throw new Error('Invalid origin')
    }
    return url.origin
  } catch {
    throw new ApiError(500, 'APP_ORIGIN 配置无效')
  }
}

export function validateOrigin(request: Request): void {
  const expectedOrigin = getAppOrigin(request)
  if (request.headers.get('origin') !== expectedOrigin) {
    throw new ApiError(403, '请求来源不受信任')
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, '请求来源不受信任')
  }
}

type Attempt = { count: number; expiresAt: number }
const attempts = new Map<string, Attempt>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ENTRIES = 1000
let globalWindow: Attempt = { count: 0, expiresAt: 0 }

// shortcut: 限流在单个 Node 进程内生效，多实例部署时需改用共享限流存储。
export function checkLoginRateLimit(username: string, now = Date.now()): void {
  if (globalWindow.expiresAt <= now) {
    globalWindow = { count: 0, expiresAt: now + 60 * 1000 }
  }
  if (++globalWindow.count > 120) {
    throw new ApiError(429, '登录尝试过于频繁，请稍后再试')
  }
  for (const [key, value] of attempts) {
    if (value.expiresAt <= now) attempts.delete(key)
  }
  const key = username.trim().toLowerCase().slice(0, 64)
  const entry = attempts.get(key)
  if (entry && entry.count >= 10) {
    throw new ApiError(429, '登录尝试过于频繁，请稍后再试')
  }
  if (entry) {
    entry.count++
  } else {
    if (attempts.size >= MAX_ENTRIES) {
      throw new ApiError(429, '登录尝试过于频繁，请稍后再试')
    }
    attempts.set(key, { count: 1, expiresAt: now + WINDOW_MS })
  }
}
