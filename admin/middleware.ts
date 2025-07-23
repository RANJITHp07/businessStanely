import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/agent',
  '/client', 
  '/task',
  '/setting'
]

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup', 
  '/forgot-password',
  '/reset-password'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🔍 MIDDLEWARE CALLED FOR: ${pathname}`)
  
  // Get token from cookies
  const token = request.cookies.get('auth-token')?.value
  
  console.log(`🔐 Token found: ${token ? 'YES' : 'NO'}`)
  
  // Handle root route - always redirect to appropriate page
  if (pathname === '/') {
    console.log(`📍 Root route accessed`)
    if (token) {
      console.log(`➡️ Redirecting logged-in user to /dashboard`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      console.log(`➡️ Redirecting anonymous user to /login`)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  )

  console.log(`🛡️ Protected route: ${isProtectedRoute}, Public route: ${isPublicRoute}`)

  // If it's a protected route and no token exists, redirect to login
  if (isProtectedRoute && !token) {
    console.log(`🚫 Redirecting to login - protected route without token`)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If user is logged in and tries to access auth pages, redirect to dashboard
  if (isPublicRoute && token) {
    console.log(`➡️ Redirecting logged-in user from auth page to dashboard`)
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  console.log(`✅ Allowing access to: ${pathname}`)
  return NextResponse.next()
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}