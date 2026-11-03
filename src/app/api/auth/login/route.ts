import { handleApiError, readJson } from '@/server/errors'
import { validateOrigin } from '@/server/security'
import {
  authenticate,
  revokeSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/server/session'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    validateOrigin(request)
    const { user, token } = await authenticate(await readJson(request))
    revokeSession(request.cookies.get(SESSION_COOKIE_NAME)?.value)
    const response = NextResponse.json(
      { user },
      { headers: { 'Cache-Control': 'no-store' } }
    )
    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions(request)
    )
    return response
  } catch (error) {
    return handleApiError(error)
  }
}
