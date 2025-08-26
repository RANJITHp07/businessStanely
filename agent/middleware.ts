
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "./src/lib/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Define public and protected routes
  const publicRoutes = [
    "/",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/logout",
    "/api/auth/forgot-password",
  ];
  const protectedRoutes = [
    "/dashboard",
    "/admin",
    "/agent",
    "/client",
    "/task",
    "/setting"
  ];

  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  });
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, check authentication and session token in DB
  const validAgent = await getCurrentAgent(request);

  if (isProtectedRoute && !validAgent) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("agent-auth-token", "", { maxAge: 0, path: "/" });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/api/:path*',
  ],
};
