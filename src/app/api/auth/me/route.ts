import { requireUser } from '@/server/auth'
import { handleApiError } from '@/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return Response.json(
      { user: await requireUser() },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
