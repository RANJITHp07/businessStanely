import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, email, password, confirmPassword } = body;

    // Validate required fields
    if (!username || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate username length
    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters long" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Validate password match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    // Send welcome email
    try {
      // Always try to send actual welcome email using Nodemailer
      const emailResult = await sendWelcomeEmail({
        to: email,
        userName: username,
      });

      if (emailResult.success) {
        console.log(`Welcome email sent successfully to ${email}`);
      } else {
        console.error("Failed to send welcome email:", emailResult.error);
        // Don't fail signup if email fails, but log the error
      }
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Continue execution - don't fail the signup if email fails
    }

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
    const response = NextResponse.json(
      {
        message: "Account created successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        token,
      },
      { status: 201 }
    );

    // Set HTTP-only cookie for middleware
    response.cookies.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours in seconds
    });

    return response;
  } catch (error) {
    console.error("Signup error:", error);

    // Handle Prisma unique constraint errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const field = error.meta?.target as string[];
        if (field?.includes("username")) {
          return NextResponse.json(
            { error: "Username already exists" },
            { status: 409 }
          );
        }
        if (field?.includes("email")) {
          return NextResponse.json(
            { error: "Email already exists" },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: "User already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}