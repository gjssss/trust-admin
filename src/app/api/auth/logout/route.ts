import { requireUser } from '@/server/auth'
import { handleApiError } from '@/server/errors'
import { validateOrigin } from '@/server/security'
import {
  revokeSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/server/session'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    validateOrigin(request)
    await requireUser()
    revokeSession(request.cookies.get(SESSION_COOKIE_NAME)?.value)
    const response = NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      ...sessionCookieOptions(request),
      maxAge: 0,
      expires: new Date(0),
    })
    return response
  } catch (error) {
    return handleApiError(error)
  }
}
