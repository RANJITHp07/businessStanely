import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "./prisma";

// JWT payload interface
export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  sessionToken?: string;
}

// Admin user interface
export interface AdminUser {
  id: string;
  email: string;
  username: string;
  adminType: "owner" | "admin";
  status?: string;
}

/**
 * Verify JWT token from request cookies
 * @param req Next.js request object
 * @returns Decoded JWT payload or null if invalid
 */
export async function verifyAuth(req: NextRequest): Promise<JWTPayload | null> {
  return (await resolveSession(req))?.decoded ?? null;
}

const SESSION_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  adminType: true,
  status: true,
} as const;

/** Verifies the token and returns the user row the session check already read. */
async function resolveSession(req: NextRequest) {
  try {
    // Get token from cookies
    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return null;
    }

    // Verify JWT token (will throw if expired or invalid)
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fallback-secret"
      ) as JWTPayload;
    } catch (err) {
      // Explicitly log and return null for expired/invalid tokens
      console.error("JWT verification failed (expired or invalid):", err);
      return null;
    }

    // Single-session enforcement: check sessionToken in DB
    if (decoded.userId && decoded.sessionToken) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { ...SESSION_USER_SELECT, currentSessionToken: true },
      });
      if (!user) {
        console.error("User not found in DB. User ID:", decoded.userId);
        return null;
      }
      if (user.status === "inactive") {
        console.error("Inactive user attempted to use an existing session.");
        return null;
      }
      if (user.currentSessionToken !== decoded.sessionToken) {
        console.error("Session token mismatch for user:", decoded.userId);
        return null;
      }
      const { currentSessionToken: _token, ...sessionUser } = user;
      return { decoded, user: sessionUser };
    }

    return { decoded, user: null };
  } catch (error) {
    console.error("Auth verification error:", error);
    return null;
  }
}

/**
 * Check if the user is an owner
 * @param email User's email
 * @returns Boolean indicating if user is an owner
 */
export async function isOwner(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { adminType: true },
    });

    return user?.adminType === "owner";
  } catch (error) {
    console.error("Owner check error:", error);
    return false;
  }
}

/**
 * Get current admin user from request
 * @param req Next.js request object
 * @returns Admin user object or null if not authenticated
 */
export async function getCurrentAdmin(
  req: NextRequest
): Promise<AdminUser | null> {
  const session = await resolveSession(req);
  const decoded = session?.decoded;

  if (!decoded?.email) {
    return null;
  }

  // The session check has usually read this user already.
  const admin =
    session?.user?.email === decoded.email
      ? session.user
      : await prisma.user.findUnique({
          where: { email: decoded.email },
          select: SESSION_USER_SELECT,
        });

  if (!admin || admin.status === "inactive") {
    return null;
  }

  return admin as AdminUser | null;
}
