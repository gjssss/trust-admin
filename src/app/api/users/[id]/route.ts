import { requireAdmin } from '@/server/auth'
import { handleApiError, readJson } from '@/server/errors'
import { validateOrigin } from '@/server/security'
import { deleteUser, getUser, updateUser } from '@/server/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireAdmin()
    const { id } = await context.params
    return Response.json(
      { user: getUser(actor.id, id) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    validateOrigin(request)
    const actor = await requireAdmin()
    const { id } = await context.params
    const user = await updateUser(actor.id, id, await readJson(request))
    return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    validateOrigin(request)
    const actor = await requireAdmin()
    const { id } = await context.params
    deleteUser(actor.id, id)
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
