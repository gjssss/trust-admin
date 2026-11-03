import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { gzipSync } from 'node:zlib'
import {
  MAX_BODY_BYTES,
  MAX_BUFFERED_REQUESTS,
  UPSTREAM_TIMEOUT_MS,
  proxyRequest,
  type ProxyService,
} from '../src/server/proxy.ts'

type Handler = (request: IncomingMessage, response: ServerResponse) => void
let handler: Handler
let upstreamUrl: string
const server = createServer((request, response) => handler(request, response))
const envNames = ['FAKE_NEWS_UPSTREAM_URL', 'BOT_DETECTION_UPSTREAM_URL', 'AIGT_UPSTREAM_URL']
const previousEnv = envNames.map((name) => process.env[name])

before(async () => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  upstreamUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  for (const name of envNames) process.env[name] = upstreamUrl
})

after(async () => {
  for (let index = 0; index < envNames.length; index++) {
    if (previousEnv[index] === undefined) delete process.env[envNames[index]]
    else process.env[envNames[index]] = previousEnv[index]
  }
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

function makeRequest(path = '/api/fake-news', init: RequestInit = {}): Request {
  return new Request(`http://browser.example${path}`, { ...init, duplex: 'half' } as RequestInit)
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function echo() {
  handler = (request, response) => {
    void readBody(request).then((body) => {
      response.writeHead(201, { 'content-type': request.headers['content-type'] ?? 'application/octet-stream' })
      response.end(body)
    })
  }
}

test('24 小时默认等待，原始编码路径和 query 按服务转发', async () => {
  assert.equal(UPSTREAM_TIMEOUT_MS, 86_400_000)
  const suffix = '/a%2Fb/%252F/%E4%B8%AD//item?x=%2f&x=%252F&space=+&empty=&raw=a%26b'
  for (const service of ['fake-news', 'bot-detection', 'aigt'] as ProxyService[]) {
    handler = (request, response) => response.end(request.url)
    const response = await proxyRequest(makeRequest(`/api/${service}${suffix}`), service)
    assert.equal(await response.text(), (service === 'fake-news' ? '/api' : '') + suffix)
  }
})

test('根路径、尾部斜杠和空 query 保留，拒绝不匹配浏览器前缀', async () => {
  handler = (request, response) => response.end(request.url)
  for (const [path, service, expected] of [
    ['/api/fake-news', 'fake-news', '/api'],
    ['/api/fake-news/', 'fake-news', '/api/'],
    ['/api/bot-detection?', 'bot-detection', '/?'],
  ] as const) {
    const response = await proxyRequest(makeRequest(path), service)
    assert.equal(await response.text(), expected)
  }
  const response = await proxyRequest(makeRequest('/api/fake-news-evil'), 'fake-news')
  assert.equal(response.status, 400)
})

test('上游 env 可含路径前缀，客户端无法改变上游 host', async () => {
  process.env.FAKE_NEWS_UPSTREAM_URL = upstreamUrl + '/gateway/'
  handler = (request, response) => response.end(`${request.headers.host} ${request.url}`)
  try {
    const response = await proxyRequest(makeRequest('/api/fake-news//evil.example/%2F?a=1', {
      headers: { host: 'evil.example' },
    }), 'fake-news')
    assert.equal(await response.text(), `${new URL(upstreamUrl).host} /gateway/api//evil.example/%2F?a=1`)
  } finally {
    process.env.FAKE_NEWS_UPSTREAM_URL = upstreamUrl
  }
})

test('JSON、urlencoded、multipart 和二进制请求/响应的字节及 Content-Type 保持一致', async () => {
  echo()
  const cases: [string, Uint8Array][] = [
    ['application/json; charset=utf-8', Buffer.from('{"中文":"你好","space": " a "}')],
    ['application/x-www-form-urlencoded', Buffer.from('text=%E4%B8%AD+word&x=%2f&x=%252F')],
    ['multipart/form-data; boundary=proxy-test', Buffer.concat([
      Buffer.from('--proxy-test\r\nContent-Disposition: form-data; name="file"; filename="x.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'),
      Buffer.from([0, 255, 128, 13, 10]),
      Buffer.from('\r\n--proxy-test--\r\n'),
    ])],
    ['application/octet-stream', Buffer.from([0, 1, 127, 128, 254, 255])],
  ]
  for (const [contentType, body] of cases) {
    const response = await proxyRequest(makeRequest('/api/fake-news/upload', {
      method: 'POST', headers: { 'content-type': contentType }, body: body as BodyInit,
    }), 'fake-news')
    assert.equal(response.status, 201)
    assert.equal(response.headers.get('content-type'), contentType)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(body))
  }
})

test('双向移除 hop headers、Connection 指定头和凭证，重算 Content-Length', async () => {
  handler = (request, response) => {
    void readBody(request).then((body) => {
      response.writeHead(202, {
        'content-type': 'application/json',
        connection: 'close, x-response-secret',
        'x-response-secret': 'hidden',
        'keep-alive': 'timeout=10',
        'proxy-authenticate': 'Basic secret',
        'set-cookie': ['session=secret', 'another=secret'],
        authorization: 'secret', cookie: 'secret',
        'x-preserved': 'yes',
      })
      response.end(JSON.stringify({ headers: request.headers, body: body.toString() }))
    })
  }
  const response = await proxyRequest(makeRequest('/api/fake-news', {
    method: 'POST', body: '你好',
    headers: {
      connection: 'keep-alive, x-private',
      'x-private': 'secret', 'keep-alive': 'timeout=99',
      cookie: 'session=secret', authorization: 'Bearer secret',
      'proxy-authorization': 'Basic secret', 'set-cookie': 'secret',
      te: 'trailers', trailer: 'x-end', upgrade: 'websocket',
      'content-length': '1', 'x-public': 'visible',
    },
  }), 'fake-news')
  assert.equal(response.status, 202)
  const { headers, body } = await response.json()
  assert.equal(body, '你好')
  assert.equal(headers['content-length'], '6')
  assert.equal(headers['x-public'], 'visible')
  for (const name of ['cookie', 'authorization', 'proxy-authorization', 'set-cookie', 'x-private', 'te', 'trailer', 'upgrade', 'keep-alive']) {
    assert.equal(headers[name], undefined, name)
  }
  // Node adds its own Connection: close; the browser's Connection value must not survive.
  assert.equal(headers.connection, 'close')
  for (const name of ['connection', 'keep-alive', 'proxy-authenticate', 'set-cookie', 'authorization', 'cookie', 'x-response-secret', 'transfer-encoding']) {
    assert.equal(response.headers.get(name), null, name)
  }
  assert.equal(response.headers.get('x-preserved'), 'yes')
})

test('上游错误状态和响应透传，重定向不跟随', async () => {
  let hits = 0
  for (const status of [302, 307, 422, 500]) {
    handler = (_request, response) => {
      hits++
      response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', location: '/api/redirect-target' })
      response.end('原始响应')
    }
    const response = await proxyRequest(makeRequest(), 'fake-news')
    assert.equal(response.status, status)
    assert.equal(response.headers.get('location'), '/api/fake-news/redirect-target')
    assert.equal(await response.text(), '原始响应')
  }
  assert.equal(hits, 4)
})

test('合法 Location 映回受保护前缀并保留路径、query、hash 编码', async () => {
  const suffix = '/a%2Fb/%252F?x=%2f&x=%252F&space=+#part%2f%252F'
  const cases: [ProxyService, string, string][] = [
    ['fake-news', upstreamUrl + '/api' + suffix, '/api/fake-news' + suffix],
    ['fake-news', '/api' + suffix, '/api/fake-news' + suffix],
    ['fake-news', '../next%2Fpart?x=+#hash%2f', '/api/fake-news/next%2Fpart?x=+#hash%2f'],
    ['fake-news', '?x=%252F#part%2f', '/api/fake-news/folder/item?x=%252F#part%2f'],
    ['fake-news', '/api?#', '/api/fake-news?#'],
    ['bot-detection', upstreamUrl + suffix, '/api/bot-detection' + suffix],
    ['aigt', '//'+ new URL(upstreamUrl).host + suffix, '/api/aigt' + suffix],
  ]
  let hits = 0
  for (const [service, location, expected] of cases) {
    handler = (_request, response) => {
      hits++
      response.writeHead(307, { location })
      response.end('redirect')
    }
    const response = await proxyRequest(makeRequest(`/api/${service}/folder/item`), service)
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), expected)
    assert.equal(await response.text(), 'redirect')
  }
  assert.equal(hits, cases.length)
})

test('跨上游、越出 fake-news /api 和配置前缀的跳转返回 502', async () => {
  for (const location of [
    'https://outside.example/api/next',
    '//outside.example/api/next',
    '/outside', '/api-evil/path', '../../outside', '/api/%2e%2e/outside',
    'javascript:alert(1)',
    upstreamUrl.replace('http://', 'http://user:secret@') + '/api/next',
  ]) {
    handler = (_request, response) => {
      response.writeHead(302, { location })
      response.end()
    }
    const response = await proxyRequest(makeRequest('/api/fake-news/folder/item'), 'fake-news')
    assert.equal(response.status, 502, location)
    assert.equal(response.headers.get('location'), null)
    assert.doesNotMatch(await response.text(), /outside|secret|127\.0\.0\.1/)
  }
  process.env.FAKE_NEWS_UPSTREAM_URL = upstreamUrl + '/gateway'
  try {
    for (const [location, expectedStatus] of [['/gateway/api/next', 302], ['/api/next', 502]] as const) {
      handler = (_request, response) => { response.writeHead(302, { location }); response.end() }
      const response = await proxyRequest(makeRequest(), 'fake-news')
      assert.equal(response.status, expectedStatus)
      assert.equal(response.headers.get('location'), expectedStatus === 302 ? '/api/fake-news/next' : null)
      await response.text()
    }
  } finally {
    process.env.FAKE_NEWS_UPSTREAM_URL = upstreamUrl
  }
})

test('HEAD、204、205、304 无响应体', async () => {
  for (const status of [200, 204, 205, 304]) {
    handler = (_request, response) => {
      response.writeHead(status, { 'x-preserved': 'yes' })
      response.end()
    }
    const response = await proxyRequest(makeRequest('/api/fake-news', {
      method: status === 200 ? 'HEAD' : 'GET',
    }), 'fake-news')
    assert.equal(response.status, status)
    assert.equal(response.body, null)
    assert.equal(response.headers.get('x-preserved'), 'yes')
  }
})

test('20MiB 精确边界放行，超出 1 字节在联系上游前拒绝', async () => {
  let hits = 0
  handler = (request, response) => {
    hits++
    void readBody(request).then((body) => response.end(String(body.length)))
  }
  const allowed = await proxyRequest(makeRequest('/api/fake-news', {
    method: 'POST', body: Buffer.alloc(MAX_BODY_BYTES, 123),
  }), 'fake-news')
  assert.equal(await allowed.text(), String(MAX_BODY_BYTES))
  const denied = await proxyRequest(makeRequest('/api/fake-news', {
    method: 'POST', body: Buffer.alloc(MAX_BODY_BYTES + 1),
    headers: { 'content-length': '1' },
  }), 'fake-news')
  assert.equal(denied.status, 413)
  assert.equal(hits, 1)
})

test('按实际 UTF-8 字节和 chunk 总量校验，忽略伪造长度', async () => {
  echo()
  const allowed = await proxyRequest(makeRequest('/api/fake-news', {
    method: 'POST', body: '你好', headers: { 'content-length': '99999999' },
  }), 'fake-news', { maxBodyBytes: 6 })
  assert.equal(await allowed.text(), '你好')
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Buffer.from('你'))
      controller.enqueue(Buffer.from('好'))
    },
    cancel() { cancelled = true },
  })
  const denied = await proxyRequest(makeRequest('/api/fake-news', {
    method: 'POST', body: stream,
  }), 'fake-news', { maxBodyBytes: 5 })
  assert.equal(denied.status, 413)
  assert.equal(cancelled, true)
})

test('并发上传缓存受限，取消后归还名额', async () => {
  const controllers = Array.from({ length: MAX_BUFFERED_REQUESTS }, () => new AbortController())
  const requests = controllers.map((controller) => proxyRequest(makeRequest('/api/fake-news', {
    method: 'POST', body: new ReadableStream(), signal: controller.signal,
  }), 'fake-news', { timeoutMs: 1000 }))
  try {
    let cancelled = false
    const excess = await proxyRequest(makeRequest('/api/fake-news', {
      method: 'POST', body: new ReadableStream({ cancel() { cancelled = true } }),
    }), 'fake-news')
    assert.equal(excess.status, 503)
    assert.equal(cancelled, true)
  } finally {
    controllers.forEach((controller) => controller.abort())
  }
  assert.deepEqual((await Promise.all(requests)).map((response) => response.status), [499, 499, 499, 499])
  echo()
  const next = await proxyRequest(makeRequest('/api/fake-news', { method: 'POST', body: 'ok' }), 'fake-news')
  assert.equal(await next.text(), 'ok')
})

test('响应在上游结束前可读，取消 reader 关闭上游连接', { timeout: 2000 }, async () => {
  const closed = deferred()
  handler = (request, response) => {
    request.socket.once('close', () => closed.resolve())
    response.writeHead(200, { 'content-type': 'application/octet-stream' })
    response.write(Buffer.from([0, 255, 1]))
  }
  const response = await proxyRequest(makeRequest(), 'fake-news')
  const reader = response.body!.getReader()
  const chunk = await reader.read()
  assert.deepEqual(Buffer.from(chunk.value!), Buffer.from([0, 255, 1]))
  await reader.cancel()
  await closed.promise
})

test('AbortSignal 在等待响应和读取响应期间均关闭上游', { timeout: 2000 }, async () => {
  for (const streaming of [false, true]) {
    const controller = new AbortController()
    const reached = deferred()
    const closed = deferred()
    handler = (request, response) => {
      request.socket.once('close', () => closed.resolve())
      if (streaming) response.write('started')
      reached.resolve()
    }
    const pending = proxyRequest(makeRequest('/api/fake-news', { signal: controller.signal }), 'fake-news')
    await reached.promise
    if (streaming) {
      const response = await pending
      const reader = response.body!.getReader()
      await reader.read()
      controller.abort()
      await assert.rejects(reader.read(), /请求已取消/)
    } else {
      controller.abort()
      assert.equal((await pending).status, 499)
    }
    await closed.promise
  }
  const controller = new AbortController()
  controller.abort()
  assert.equal((await proxyRequest(makeRequest('/api/fake-news', { signal: controller.signal }), 'fake-news')).status, 499)
})

test('超时清理等待中的上游连接和仍未完成的上传', { timeout: 2000 }, async () => {
  const closed = deferred()
  handler = (request) => request.socket.once('close', () => closed.resolve())
  const response = await proxyRequest(makeRequest(), 'fake-news', { timeoutMs: 100 })
  assert.equal(response.status, 504)
  assert.match(await response.text(), /超时/)
  await closed.promise
  let cancelled = false
  const upload = await proxyRequest(makeRequest('/api/fake-news', {
    method: 'POST', body: new ReadableStream({ cancel() { cancelled = true } }),
  }), 'fake-news', { timeoutMs: 20 })
  assert.equal(upload.status, 504)
  assert.equal(cancelled, true)
})

test('收到 headers 后超时仍中断响应流并关闭上游', { timeout: 2000 }, async () => {
  const closed = deferred()
  handler = (request, response) => {
    request.socket.once('close', () => closed.resolve())
    response.write('started')
  }
  const response = await proxyRequest(makeRequest(), 'fake-news', { timeoutMs: 100 })
  const reader = response.body!.getReader()
  await reader.read()
  await assert.rejects(reader.read(), /超时/)
  await closed.promise
})

test('连接失败返回中文错误，不暴露连接详情；响应中断使流失败', async () => {
  handler = (request) => request.socket.destroy()
  const response = await proxyRequest(makeRequest(), 'fake-news')
  assert.equal(response.status, 502)
  const error = await response.text()
  assert.match(error, /上游服务/)
  assert.doesNotMatch(error, /127\.0\.0\.1|localhost|ECONN|socket|http:/)
  handler = (_request, response) => {
    response.writeHead(200, { 'content-length': '100' })
    response.write('short')
    setImmediate(() => response.destroy())
  }
  const interrupted = await proxyRequest(makeRequest(), 'fake-news')
  assert.equal(interrupted.status, 200)
  await assert.rejects(interrupted.text(), /上游服务响应中断/)
})

test('压缩响应按原始字节转发并保留 Content-Encoding 和 Content-Length', async () => {
  const body = gzipSync(Buffer.from('保持原始压缩内容'))
  handler = (_request, response) => {
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-encoding': 'gzip',
      'content-length': String(body.length),
    })
    response.end(body)
  }
  const response = await proxyRequest(makeRequest(), 'fake-news')
  assert.equal(response.headers.get('content-encoding'), 'gzip')
  assert.equal(response.headers.get('content-length'), String(body.length))
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), body)
})

test('上传流异常清理并释放并发名额', async () => {
  for (let index = 0; index <= MAX_BUFFERED_REQUESTS; index++) {
    const response = await proxyRequest(makeRequest('/api/fake-news', {
      method: 'POST',
      body: new ReadableStream({ start(controller) { controller.error(new Error('private upload details')) } }),
    }), 'fake-news')
    assert.equal(response.status, 502)
    assert.doesNotMatch(await response.text(), /private upload details/)
  }
  echo()
  const response = await proxyRequest(makeRequest('/api/fake-news', { method: 'POST', body: 'recovered' }), 'fake-news')
  assert.equal(await response.text(), 'recovered')
})

test('测试选项不能提高生产请求体上限', async () => {
  const response = await proxyRequest(makeRequest(), 'fake-news', { maxBodyBytes: MAX_BODY_BYTES + 1 })
  assert.equal(response.status, 500)
})

test('无效上游配置返回中文错误且不泄露环境变量', async () => {
  process.env.AIGT_UPSTREAM_URL = 'ftp://secret:password@private.internal'
  try {
    const response = await proxyRequest(makeRequest('/api/aigt'), 'aigt')
    assert.equal(response.status, 500)
    assert.doesNotMatch(await response.text(), /secret|password|private/)
  } finally {
    process.env.AIGT_UPSTREAM_URL = upstreamUrl
  }
})
