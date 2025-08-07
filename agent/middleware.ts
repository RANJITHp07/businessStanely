import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const pathname = request.nextUrl.pathname;

  // Define public routes that don't require authentication
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

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  });

  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, check authentication
  const token = request.cookies.get("agent-auth-token")?.value;

  // Debug logging
  console.log("Middleware check:", { pathname, token: token ? "present" : "missing" });

  if (!token) {
    console.log("No token found, redirecting to login");
    // Redirect to login if no token
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // Verify the token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET not found in middleware");
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set("agent-auth-token", "", { maxAge: 0 });
      return response;
    }
    
    jwt.verify(token, jwtSecret);
    return NextResponse.next();
  } catch (error) {
    console.error("Token verification failed:", error);
    // Clear invalid token and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("agent-auth-token", "", { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
