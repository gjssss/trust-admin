import { requireAdmin } from '@/server/auth'
import { handleApiError, readJson } from '@/server/errors'
import { validateOrigin } from '@/server/security'
import { createUser, listUsers } from '@/server/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const actor = await requireAdmin()
    return Response.json(
      { users: listUsers(actor.id) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    validateOrigin(request)
    const actor = await requireAdmin()
    const user = await createUser(actor.id, await readJson(request))
    return Response.json(
      { user },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
