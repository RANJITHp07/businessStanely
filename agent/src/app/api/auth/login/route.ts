import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

// Create a separate rate limiter for login attempts (more strict)
class LoginRateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> =
    new Map();
  private readonly maxAttempts = 5; // 5 failed attempts
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry) {
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (now > entry.resetTime) {
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxAttempts) {
      return false;
    }

    entry.count++;
    this.attempts.set(identifier, entry);
    return true;
  }

  getRemainingTime(identifier: string): number {
    const entry = this.attempts.get(identifier);
    if (!entry) return 0;

    const now = Date.now();
    return Math.max(0, entry.resetTime - now);
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

const loginRateLimiter = new LoginRateLimiter();

export async function POST(req: NextRequest) {
  try {
    // First verify database connection
    try {
      await prisma.$connect();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    // Basic validation - just check if credentials are provided
    if (!password || !email) {
      return NextResponse.json(
        {
          error:
            "Incorrect email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    // Check rate limiting using email as identifier
    const identifier = email;
    if (!loginRateLimiter.isAllowed(identifier)) {
      const remainingTime = loginRateLimiter.getRemainingTime(identifier);
      const minutes = Math.ceil(remainingTime / (60 * 1000));
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Please try again in ${minutes} minute${
            minutes !== 1 ? "s" : ""
          }.`,
        },
        { status: 429 }
      );
    }

    // Find agent by email (case-insensitive)
    const agent = await prisma.agent.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
      },
    });

    if (!agent) {
      return NextResponse.json(
        {
          error:
            "Incorrect email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    // Enforce single-session: block login if agent is already logged in elsewhere
    if (agent.currentSessionToken) {
      return NextResponse.json(
        {
          error: "Agent is already logged in elsewhere. Please log out from other devices first.",
        },
        { status: 403 }
      );
    }

    // Check if agent is active
    if (agent.status !== "active") {
      return NextResponse.json(
        {
          error: "Your account is inactive. Please contact support.",
        },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, agent.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          error:
            "Incorrect email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful login
    loginRateLimiter.reset(identifier);

    // Generate a new session token and store in DB
    const crypto = await import('crypto');
    const sessionToken = crypto.randomUUID();
    await prisma.agent.update({
      where: { id: agent.id },
      data: { currentSessionToken: sessionToken, lastLogin: new Date() },
    });

    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Generate JWT token with sessionToken and 8 hour expiry
    const token = jwt.sign(
      {
        agentId: agent.id,
        name: agent.name,
        email: agent.email,
        agentType: agent.agentType,
        sessionToken,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Create response
    const response = NextResponse.json({
      message: "Login successful",
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        agentType: agent.agentType,
        phoneNumber: agent.phoneNumber,
        jurisdiction: agent.jurisdiction,
        specializations: agent.specializations,
        photo: agent.photo,
      },
      token,
    });

    // Set HTTP-only cookie for middleware
    const isProduction =
      process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
      process.env.NEXT_PUBLIC_DEPLOYMENT === "production";

    response.cookies.set({
      name: "agent-auth-token",
      value: token,
      httpOnly: false, // Allow JavaScript access for client-side auth checks
      secure: isProduction, // Set to true in production
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: "/", // Ensure cookie is available for all paths
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    // Temporarily show detailed errors in production for debugging
    const errorMessage =
      error instanceof Error
        ? `Error: ${error.message}\nStack: ${error.stack}`
        : "Unknown error";

    console.error(errorMessage);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage, // Remove this in production after debugging
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
