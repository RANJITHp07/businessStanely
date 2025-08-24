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
}

/**
 * Verify JWT token from request cookies
 * @param req Next.js request object
 * @returns Decoded JWT payload or null if invalid
 */
export async function verifyAuth(req: NextRequest): Promise<JWTPayload | null> {
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
        select: { currentSessionToken: true },
      });
      if (!user || user.currentSessionToken !== decoded.sessionToken) {
        console.error("Session token mismatch or missing in DB. Forcing logout.");
        return null;
      }
    }

    return decoded;
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
  const decoded = await verifyAuth(req);

  if (!decoded?.email) {
    return null;
  }

  const admin = await prisma.user.findUnique({
    where: { email: decoded.email },
    select: {
      id: true,
      email: true,
      username: true,
      adminType: true,
    },
  });

  return admin as AdminUser | null;
}
