import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const output = '.next/standalone'
mkdirSync(join(output, 'node_modules'), { recursive: true })
cpSync('public', join(output, 'public'), { recursive: true })
cpSync('.next/static', join(output, '.next/static'), { recursive: true })
cpSync('dist', join(output, 'dist'), { recursive: true })
// Standalone tracing omits the root module link used by the separate initializer.
const driver = 'better-' + 'sqlite3'
cpSync(dirname(require.resolve(`${driver}/package.json`)), join(output, 'node_modules', driver), { recursive: true, dereference: true })
