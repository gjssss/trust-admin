import assert from 'node:assert/strict'

const origin = process.env.TEST_ORIGIN || 'http://localhost:3100'
const password = process.env.TEST_PASSWORD
if (!password) throw new Error('TEST_PASSWORD is required')
async function request(path, { cookie, method = 'GET', data, requestOrigin = origin } = {}) {
  return fetch(origin + path, { method, redirect: 'manual', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) })
}
async function login(username, secret = password) {
  const response = await request('/api/auth/login', { method: 'POST', data: { username, password: secret } })
  assert.equal(response.status, 200, await response.clone().text())
  const header = response.headers.get('set-cookie')
  assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=lax/i)
  return { cookie: header.split(';')[0], user: (await response.json()).user }
}
for (const path of ['/', '/fake-news', '/bot-detection', '/text-source', '/users', '/tasks', '/apps', '/chats', '/settings/account', '/missing-page']) {
  const response = await request(path)
  assert.equal(response.status, 307, path)
  assert.match(response.headers.get('location'), /\/sign-in\?redirect=/)
}
for (const path of ['/api/auth/me', '/api/users', '/api/fake-news/health', '/api/bot-detection/health', '/api/aigt/cn_detect']) assert.equal((await request(path)).status, 401, path)
const admin = await login(process.env.TEST_ADMIN || 'smoke_admin')
assert.equal((await request('/api/users', { cookie: admin.cookie })).status, 200)
assert.equal((await request('/api/users', { cookie: admin.cookie, method: 'POST', requestOrigin: 'https://foreign.invalid', data: { username: 'blocked', password } })).status, 403)
assert.equal((await request(`/api/users/${admin.user.id}`, { cookie: admin.cookie, method: 'PATCH', data: { role: 'user' } })).status, 409)
const username = 'http_' + Date.now()
const created = await request('/api/users', { cookie: admin.cookie, method: 'POST', data: { username, password } })
assert.equal(created.status, 201); const { user } = await created.json()
let normal = await login(username)
assert.equal((await request('/api/users', { cookie: normal.cookie })).status, 403)
assert.equal((await request('/users', { cookie: normal.cookie })).status, 307)
for (const path of ['/', '/fake-news', '/bot-detection', '/text-source', '/tasks', '/apps', '/chats', '/help-center', '/settings/fake-news', '/settings/bot-detection', '/settings/account', '/settings/appearance', '/settings/notifications', '/settings/display', '/401', '/403', '/404', '/500', '/503', '/errors/not-found']) {
  const response = await request(path, { cookie: normal.cookie })
  assert.equal(response.status, path === '/404' ? 404 : path === '/500' ? 500 : 200, path)
  assert.doesNotMatch(await response.text(), /页面暂时无法加载|Switch to client rendering|The server could not finish this Suspense boundary|data-dgst="[0-9]+"/, path)
}
assert.equal((await request(`/api/users/${user.id}`, { cookie: admin.cookie, method: 'PATCH', data: { enabled: false } })).status, 200)
assert.equal((await request('/api/auth/me', { cookie: normal.cookie })).status, 401)
assert.equal((await request('/api/auth/login', { method: 'POST', data: { username, password } })).status, 401)
await request(`/api/users/${user.id}`, { cookie: admin.cookie, method: 'PATCH', data: { enabled: true } })
normal = await login(username)
await request(`/api/users/${user.id}`, { cookie: admin.cookie, method: 'PATCH', data: { password: password + 'X' } })
assert.equal((await request('/api/auth/me', { cookie: normal.cookie })).status, 401)
normal = await login(username, password + 'X')
await request(`/api/users/${user.id}`, { cookie: admin.cookie, method: 'PATCH', data: { role: 'admin' } })
assert.equal((await request('/api/auth/me', { cookie: normal.cookie })).status, 401)
normal = await login(username, password + 'X')
assert.equal((await request('/api/users', { cookie: normal.cookie })).status, 200)
assert.equal((await request(`/api/users/${user.id}`, { cookie: admin.cookie, method: 'DELETE' })).status, 200)
assert.equal((await request('/api/auth/me', { cookie: normal.cookie })).status, 401)
assert.equal((await request('/api/auth/logout', { cookie: admin.cookie, method: 'POST' })).status, 200)
assert.equal((await request('/api/auth/me', { cookie: admin.cookie })).status, 401)
console.log('HTTP smoke passed: protected routes, role checks, CRUD, CSRF, last admin, session revocation, logout')
