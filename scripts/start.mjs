import { resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

// The standalone server changes cwd; initialization and serving must use one database.
process.env.DATABASE_PATH = resolve(process.env.DATABASE_PATH || './data/trust-admin.sqlite')
process.env.NODE_ENV = 'production'
const initialized = spawnSync(process.execPath, ['dist/init-db.cjs'], { stdio: 'inherit', env: process.env })
if (initialized.status !== 0) process.exit(initialized.status || 1)
const server = spawn(process.execPath, ['.next/standalone/server.js'], { stdio: 'inherit', env: process.env })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('error', (error) => { console.error(error.message); process.exit(1) })
server.on('exit', (code) => process.exit(code ?? 0))
