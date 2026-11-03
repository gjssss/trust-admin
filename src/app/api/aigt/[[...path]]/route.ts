import { requireUser } from '@/server/auth'
import { handleApiError } from '@/server/errors'
import { proxyRequest } from '@/server/proxy'
import { validateOrigin } from '@/server/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 86400

async function handle(request: Request): Promise<Response> {
  try {
    await requireUser()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      await validateOrigin(request)
    }
    return await proxyRequest(request, 'aigt')
  } catch (error) {
    return handleApiError(error)
  }
}

export {
  handle as GET,
  handle as HEAD,
  handle as OPTIONS,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
}
