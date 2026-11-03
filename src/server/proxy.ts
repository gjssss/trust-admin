import * as http from 'node:http'
import * as https from 'node:https'

export const MAX_BODY_BYTES = 20 * 1024 * 1024
export const UPSTREAM_TIMEOUT_MS = 24 * 60 * 60 * 1000
export const MAX_BUFFERED_REQUESTS = 4

const services = {
  'fake-news': {
    env: 'FAKE_NEWS_UPSTREAM_URL',
    fallback: 'http://localhost:30101',
    prefix: '/api',
  },
  'bot-detection': {
    env: 'BOT_DETECTION_UPSTREAM_URL',
    fallback: 'http://localhost:30102',
    prefix: '',
  },
  aigt: {
    env: 'AIGT_UPSTREAM_URL',
    fallback: 'http://localhost:30103',
    prefix: '',
  },
} as const

export type ProxyService = keyof typeof services
export type ProxyOptions = {
  timeoutMs?: number
  maxBodyBytes?: number
}

const strippedHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'cookie',
  'cookie2',
  'authorization',
  'set-cookie',
  'set-cookie2',
])

function filterHeaders(headers: Headers): Headers {
  const blocked = new Set(strippedHeaders)
  for (const token of (headers.get('connection') ?? '').split(',')) {
    blocked.add(token.trim().toLowerCase())
  }
  const filtered = new Headers()
  headers.forEach((value, key) => {
    if (!blocked.has(key)) filtered.append(key, value)
  })
  return filtered
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

let bufferedRequests = 0

/** Independent of authentication; callers must authenticate and validate origin. */
export function proxyRequest(
  request: Request,
  service: ProxyService,
  options: ProxyOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 2_147_483_647 ||
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes < 0 ||
    maxBodyBytes > MAX_BODY_BYTES
  ) {
    return Promise.resolve(errorResponse(500, '代理服务配置错误'))
  }

  const config = services[service]
  let upstream: URL
  let path: string
  try {
    upstream = new URL(process.env[config.env] || config.fallback)
    if (
      !['http:', 'https:'].includes(upstream.protocol) ||
      upstream.username ||
      upstream.password ||
      upstream.search ||
      upstream.hash
    )
      throw new Error('Invalid upstream')

    // Read the encoded path directly: catch-all params and URL reconstruction can alter it.
    const match = request.url.match(
      /^[a-z][a-z\d+.-]*:\/\/[^/?#]*(\/[^?#]*)?(\?[^#]*)?(?:#.*)?$/i
    )
    const pathname = match?.[1] || '/'
    const browserPrefix = `/api/${service}`
    if (
      pathname !== browserPrefix &&
      !pathname.startsWith(`${browserPrefix}/`)
    ) {
      return Promise.resolve(errorResponse(400, '请求路径无效'))
    }
    path =
      upstream.pathname.replace(/\/+$/, '') +
      config.prefix +
      pathname.slice(browserPrefix.length) +
      (match?.[2] ?? '')
    if (!path || path.startsWith('?')) path = '/' + path
  } catch {
    return Promise.resolve(errorResponse(500, '代理服务配置错误'))
  }

  if (request.signal.aborted) {
    return Promise.resolve(errorResponse(499, '请求已取消'))
  }
  const hasBody = request.body !== null
  if (hasBody && bufferedRequests >= MAX_BUFFERED_REQUESTS) {
    // Reject before reading instead of allowing an unbounded queue of buffered uploads.
    void request.body?.cancel().catch(() => {})
    return Promise.resolve(errorResponse(503, '上传请求过多，请稍后重试'))
  }
  if (hasBody) bufferedRequests++

  return new Promise<Response>((resolve) => {
    let slotHeld = hasBody
    let finished = false
    let responded = false
    let outgoing: http.ClientRequest | undefined
    let incoming: http.IncomingMessage | undefined
    let bodyBuffer: Buffer | undefined
    let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined
    let responseController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined

    const releaseSlot = () => {
      if (slotHeld) {
        slotHeld = false
        bufferedRequests--
      }
      bodyBuffer = undefined
    }
    const cleanup = () => {
      finished = true
      clearTimeout(timer)
      request.signal.removeEventListener('abort', onAbort)
      releaseSlot()
    }
    const fail = (status: number, message: string) => {
      if (finished) return
      cleanup()
      void bodyReader?.cancel().catch(() => {})
      outgoing?.destroy()
      incoming?.destroy()
      if (responded) responseController?.error(new Error(message))
      else {
        responded = true
        resolve(errorResponse(status, message))
      }
    }
    const onAbort = () => fail(499, '请求已取消')
    const timer = setTimeout(
      () => fail(504, '上游服务响应超时，请稍后重试'),
      timeoutMs
    )
    timer.unref()
    request.signal.addEventListener('abort', onAbort, { once: true })
    if (request.signal.aborted) onAbort()

    void (async () => {
      let bytes = 0
      if (hasBody && !finished) {
        bodyReader = request.body!.getReader()
        try {
          while (!finished) {
            const { done, value } = await bodyReader.read()
            if (finished || done) break
            if (value.byteLength > maxBodyBytes - bytes) {
              fail(413, '请求体超过大小限制')
              return
            }
            // One allocation bounds memory even for millions of tiny incoming chunks.
            if (value.byteLength) {
              bodyBuffer ??= Buffer.allocUnsafe(maxBodyBytes)
              bodyBuffer.set(value, bytes)
              bytes += value.byteLength
            }
          }
        } finally {
          bodyReader.releaseLock()
          bodyReader = undefined
        }
      }
      if (finished) return

      const headers = filterHeaders(request.headers)
      headers.delete('host')
      headers.delete('content-length')
      headers.delete('expect')
      if (hasBody) headers.set('content-length', String(bytes))
      const transport = upstream.protocol === 'https:' ? https : http
      outgoing = transport.request(upstream, {
        method: request.method,
        path,
        headers: Object.fromEntries(headers),
        // A private socket keeps cancellation and timeouts isolated to this request.
        agent: false,
      })
      outgoing.on('error', () => fail(502, '上游服务暂时不可用，请稍后重试'))
      outgoing.on('finish', releaseSlot)
      outgoing.on('upgrade', (_response, socket) => {
        socket.destroy()
        fail(502, '上游服务返回了不支持的响应')
      })
      outgoing.on('response', (response) => {
        if (finished) {
          response.destroy()
          return
        }
        incoming = response
        const upstreamHeaders = new Headers()
        for (let index = 0; index < response.rawHeaders.length; index += 2) {
          upstreamHeaders.append(
            response.rawHeaders[index],
            response.rawHeaders[index + 1]
          )
        }
        const responseHeaders = filterHeaders(upstreamHeaders)
        const location = responseHeaders.get('location')
        if (location !== null) {
          try {
            const target = new URL(location, upstream.origin + path)
            const upstreamPrefix = upstream.pathname.replace(/\/+$/, '') + config.prefix
            if (
              target.origin !== upstream.origin ||
              !target.href.startsWith(`${target.origin}/`) ||
              (upstreamPrefix && target.pathname !== upstreamPrefix &&
                !target.pathname.startsWith(`${upstreamPrefix}/`))
            ) throw new Error('Invalid redirect')
            // href preserves encoded query/fragment and even empty ?/# delimiters.
            responseHeaders.set('location', `/api/${service}` +
              target.href.slice(target.origin.length + upstreamPrefix.length))
          } catch {
            fail(502, '上游服务返回了不允许的跳转地址')
            return
          }
        }
        const status = response.statusCode ?? 502
        const hasResponseBody =
          request.method !== 'HEAD' && ![204, 205, 304].includes(status)
        response.on('error', () => fail(502, '上游服务响应中断，请稍后重试'))
        response.on('aborted', () => fail(502, '上游服务响应中断，请稍后重试'))
        response.on('end', () => {
          if (finished) return
          responseController?.close()
          cleanup()
          // An upstream may respond before consuming the upload; stop any remaining write.
          outgoing?.destroy()
        })
        response.pause()
        const body = hasResponseBody
          ? new ReadableStream<Uint8Array>(
              {
                start(controller) {
                  responseController = controller
                  response.on('data', (chunk: Buffer) => {
                    controller.enqueue(chunk)
                    if ((controller.desiredSize ?? 0) <= 0) response.pause()
                  })
                },
                pull() {
                  response.resume()
                },
                cancel() {
                  if (finished) return
                  cleanup()
                  outgoing?.destroy()
                  response.destroy()
                },
              },
              { highWaterMark: 64 * 1024, size: (chunk) => chunk.byteLength }
            )
          : null
        try {
          const result = new Response(body, {
            status,
            headers: responseHeaders,
          })
          responded = true
          resolve(result)
          if (!hasResponseBody) response.resume()
        } catch {
          fail(502, '上游服务返回了无效响应')
        }
      })
      outgoing.end(bodyBuffer?.subarray(0, bytes))
    })().catch(() => fail(502, '请求转发失败，请稍后重试'))
  })
}
