import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Get token from cookies
    const token = req.cookies.get("auth-token")?.value;
    let userId: string | null = null;
    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (typeof decoded === "object" && decoded && "userId" in decoded) {
          userId = decoded.userId as string;
        }
      } catch {
        // Ignore invalid/expired token
      }
    }

    // Clear currentSessionToken in DB if userId is found
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { currentSessionToken: null },
      });
    }

    // Create response
    const response = NextResponse.json({
      message: "Logged out successfully",
    });

    // Clear the auth cookie
    response.cookies.set({
      name: "auth-token",
      value: "",
      httpOnly: true,
      secure: false, // Set to false for localhost development
      sameSite: "lax",
      maxAge: 0, // Expire immediately
      path: "/", // Ensure cookie is cleared for all paths
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}