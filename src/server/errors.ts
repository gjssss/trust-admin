import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: '输入参数不正确，请检查用户名、密码和用户设置' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  console.error('服务器请求失败', error)
  return Response.json(
    { error: '服务器暂时无法处理请求' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ApiError(400, '请求内容必须是有效的 JSON')
  }
}
