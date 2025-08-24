import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAuth } from './src/lib/auth'

const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/agent',
  '/client',
  '/task',
  '/setting'
]

const publicRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Validate token using verifyAuth
  const validUser = await verifyAuth(request)

  // Handle root route
  if (pathname === '/') {
    if (validUser) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If protected and not valid, redirect to login
  if (isProtectedRoute && !validUser) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If public and valid, redirect to dashboard
  if (isPublicRoute && validUser) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}