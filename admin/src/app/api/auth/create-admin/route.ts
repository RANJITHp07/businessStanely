import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendAdminInviteEmail } from "@/lib/email";
import { getCurrentAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);
    
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can create new admins" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { username, email, password: providedPassword, adminType } = body as {
      username: string;
      email: string;
      password?: string;
      adminType?: "owner" | "admin";
    };

    // Validate required fields
    if (!username || !email) {
      return NextResponse.json(
        { error: "Username and email are required" },
        { status: 400 }
      );
    }

    // Generate a random password if not provided
    const password = providedPassword || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new admin, using username as name
    await prisma.user.create({
      data: {
        username,
        email,
        name: username, // Use username as the name field
        password: hashedPassword,
        adminType: adminType || "admin", // Use provided adminType or default to "admin"
      },
    });

    // Send email with credentials
    await sendAdminInviteEmail({
      to: email,
      userName: username, // Use username instead of name
      password: password,
    });

    return NextResponse.json(
      { message: "Admin created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating admin:", error);
    
    // Check for unique constraint violations (email or username already exists)
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Error creating admin" },
      { status: 500 }
    );
  }
}
