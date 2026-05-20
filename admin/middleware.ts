import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuth } from "./src/lib/auth";

const protectedRoutes = [
  "/dashboard",
  "/admin",
  "/agent",
  "/client",
  "/task",
  "/setting",
  "/whatsapp",
];

const publicRoutes = ["/login", "/forgot-password", "/reset-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Inject service token for WhatsApp backend proxy requests
  if (pathname.startsWith("/api/whatsapp")) {
    const serviceToken = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ?? "";
    const headers = new Headers(request.headers);
    if (serviceToken) {
      headers.set("x-whatsapp-service-token", serviceToken);
    }
    return NextResponse.next({ request: { headers } });
  }

  // Validate token using verifyAuth
  const validUser = await verifyAuth(request);

  // Handle root route
  if (pathname === "/") {
    if (validUser) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // If protected and not valid, redirect to login and clear cookie
  if (isProtectedRoute && !validUser) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("auth-token", "", { maxAge: 0, path: "/" }); // Clear cookie
    return response;
  }

  // If public and valid, redirect to dashboard
  if (isPublicRoute && validUser) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/whatsapp/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
