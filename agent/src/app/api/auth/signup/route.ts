import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

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
    const {
      name,
      email,
      password,
      phoneNumber,
      secondaryPhoneNumber,
      agentType,
      barAssociationId,
      jurisdiction,
      specializations,
    } = body;

    // Validate required fields
    if (!name || !email || !password || !phoneNumber || !agentType || !barAssociationId || !jurisdiction) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Check if agent already exists
    const existingAgent = await prisma.agent.findUnique({
      where: { email },
    });

    if (existingAgent) {
      return NextResponse.json(
        { error: "An agent with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the agent
    const agent = await prisma.agent.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phoneNumber,
        secondaryPhoneNumber: secondaryPhoneNumber || null,
        agentType,
        barAssociationId,
        jurisdiction,
        specializations: Array.isArray(specializations) ? specializations : [],
        status: "active",
      },
      select: {
        id: true,
        name: true,
        email: true,
        agentType: true,
        phoneNumber: true,
        jurisdiction: true,
        specializations: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Agent account created successfully",
        agent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);

    // Check for unique constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "An agent with this email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
