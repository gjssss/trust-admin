import { getCurrentUser } from '@/server/auth'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (
    path === '/sign-in' ||
    path === '/api/auth/login' ||
    path === '/api/health'
  )
    return NextResponse.next()
  const user = await getCurrentUser()
  if (!user) {
    if (path.startsWith('/api/'))
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    const url = new URL('/sign-in', request.url)
    url.searchParams.set('redirect', path + request.nextUrl.search)
    return NextResponse.redirect(url)
  }
  if (
    (path === '/users' ||
      path.startsWith('/users/') ||
      path === '/api/users' ||
      path.startsWith('/api/users/')) &&
    user.role !== 'admin'
  ) {
    if (path.startsWith('/api/'))
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    return NextResponse.redirect(new URL('/403', request.url))
  }
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/((?!_next/static/|_next/image|images/|favicon.ico).*)'],
}
