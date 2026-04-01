import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Get token from cookies
    const token = req.cookies.get("agent-auth-token")?.value;

    // Get expiryTime from request body if provided
    let expiryTime: number | null = null;
    try {
      const body = await req.json();
      expiryTime = body.expiryTime;
    } catch {
      // No body provided
    }

    let agentId: string | null = null;
    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (typeof decoded === "object" && decoded && "agentId" in decoded) {
          agentId = decoded.agentId as string;
        }
      } catch {
        // Ignore invalid/expired token
      }
    }

    // Clear currentSessionToken in DB if agentId is found
    if (agentId) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { currentSessionToken: null },
      });
      const lastLogin = await prisma.loginHistory.findFirst({
        where: {
          agentId,
          logoutAt: null,
        },
        orderBy: {
          loginAt: "desc",
        },
      });

      if (lastLogin) {
        // Use expiryTime if provided, otherwise use current date
        const logoutTime = expiryTime ? new Date(expiryTime) : new Date();

        await prisma.loginHistory.update({
          where: { id: lastLogin.id },
          data: {
            logoutAt: logoutTime,
          },
        });
      }
    }

    // Create response
    const response = NextResponse.json({
      message: "Logged out successfully",
    });

    // Clear the auth cookie
    response.cookies.set({
      name: "agent-auth-token",
      value: "",
      httpOnly: true,
      secure: process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Immediately expire the cookie
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
