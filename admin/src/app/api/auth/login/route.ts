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
    const body = await req.json();
    const { username, email, password } = body;

    // Basic validation - just check if credentials are provided
    if (!password || (!username && !email)) {
      return NextResponse.json(
        {
          error:
            "Incorrect username/email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    // Check rate limiting using email or username as identifier
    const identifier = email || username;
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

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [username ? { username } : {}, email ? { email } : {}].filter(
          (obj) => Object.keys(obj).length > 0
        ),
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Incorrect username/email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          error:
            "Incorrect username/email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful login
    loginRateLimiter.reset(identifier);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "24h" }
    );

    // Create response
    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    });

    // Set HTTP-only cookie for middleware
    response.cookies.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      secure: false, // Set to false for localhost development
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: "/", // Ensure cookie is available for all paths
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}