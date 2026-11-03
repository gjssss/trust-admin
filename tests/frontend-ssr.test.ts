import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

test('hidden page modules load without browser globals during SSR', async () => {
  assert.equal(typeof window, 'undefined')
  assert.equal(typeof document, 'undefined')
  assert.equal(typeof FileList, 'undefined')

  // Import the actual page dependency graphs: FileList used to throw here.
  await Promise.all([
    import('../src/features/tasks'),
    import('../src/features/apps'),
    import('../src/features/chats'),
    import('../src/features/settings'),
    import('../src/features/settings/account'),
    import('../src/features/settings/appearance'),
    import('../src/features/settings/display'),
    import('../src/features/settings/notifications'),
    import('../src/features/settings/profile'),
    import('../src/features/dashboard'),
  ])

  const { TasksImportDialog } = await import('../src/features/tasks/components/tasks-import-dialog')
  assert.doesNotThrow(() => renderToString(createElement(TasksImportDialog, {
    open: false,
    onOpenChange: () => {},
  })))
})

test('preference providers render with no browser or cookie state', async () => {
  const { ThemeProvider } = await import('../src/context/theme-provider')
  const { FontProvider } = await import('../src/context/font-provider')
  const { DirectionProvider } = await import('../src/context/direction-provider')
  const { LayoutProvider } = await import('../src/context/layout-provider')
  for (const Provider of [ThemeProvider, FontProvider, DirectionProvider, LayoutProvider]) {
    const html = renderToString(createElement(Provider, {
      children: createElement('span', null, 'SSR content'),
    }))
    assert.ok(html.includes('SSR content'))
  }
})

test('task fixtures match across separate server and browser clocks', () => {
  function generateAt(now: string) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      const RealDate = Date;
      const now = ${JSON.stringify(now)};
      globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return new RealDate(now).valueOf(); }
      };
      const { tasks } = await import('./src/features/tasks/data/tasks.ts');
      process.stdout.write(JSON.stringify(tasks));
    `], { cwd: projectRoot, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  }
  const server = generateAt('2026-01-01T00:00:00.000Z')
  const browser = generateAt('2026-06-01T00:00:00.000Z')
  assert.equal(server.length, 100)
  assert.deepEqual(server, browser)
})
