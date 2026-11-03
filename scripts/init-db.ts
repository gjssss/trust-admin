import { closeDatabase, getDatabase } from '../src/server/db'
import { getAppOrigin } from '../src/server/security'

try {
  const origin = getAppOrigin()
  if (process.env.NODE_ENV === 'production' && !origin.startsWith('https:')) {
    console.warn('生产环境建议将 APP_ORIGIN 配置为 HTTPS，以启用安全 Cookie')
  }
  getDatabase()
  console.log('数据库初始化完成')
} catch (error) {
  console.error(
    '数据库初始化失败：',
    error instanceof Error ? error.message : '未知错误'
  )
  process.exitCode = 1
} finally {
  closeDatabase()
}
