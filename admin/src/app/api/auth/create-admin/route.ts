import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendAdminInviteEmail } from "@/lib/email";
import { getCurrentAdmin } from "@/lib/auth";

const buildArchivedAdminEmail = (email: string, adminId: string) => {
  const normalized = email.toLowerCase();
  const [localPart, domainPart] = normalized.split("@");
  const suffix = `inactive-${adminId.slice(-6)}-${Date.now()}`;

  if (localPart && domainPart) {
    return `${localPart}+${suffix}@${domainPart}`;
  }

  return `${normalized}.${suffix}`;
};

const buildArchivedAdminUsername = (username: string, adminId: string) =>
  `${username}-inactive-${adminId.slice(-6)}-${Date.now()}`;

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
    const normalizedEmail = email.toLowerCase();

    const [existingAdminEmail, existingAdminUsername] = await Promise.all([
      prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true, email: true, status: true },
      }),
      prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true, status: true },
      }),
    ]);

    if (existingAdminEmail) {
      if (existingAdminEmail.status !== "inactive") {
        return NextResponse.json(
          { error: "Username or email already exists" },
          { status: 409 },
        );
      }

      await prisma.user.update({
        where: { id: existingAdminEmail.id },
        data: {
          email: buildArchivedAdminEmail(
            existingAdminEmail.email,
            existingAdminEmail.id,
          ),
        },
      });
    }

    if (existingAdminUsername) {
      if (existingAdminUsername.status !== "inactive") {
        return NextResponse.json(
          { error: "Username or email already exists" },
          { status: 409 },
        );
      }

      await prisma.user.update({
        where: { id: existingAdminUsername.id },
        data: {
          username: buildArchivedAdminUsername(
            existingAdminUsername.username,
            existingAdminUsername.id,
          ),
        },
      });
    }

    // Create the new admin, using username as name
    await prisma.user.create({
      data: {
        username,
        email: normalizedEmail,
        password: hashedPassword,
        adminType: adminType || "admin", // Use provided adminType or default to "admin"
        status: "active",
      },
    });

    // Send email with credentials
    await sendAdminInviteEmail({
      to: normalizedEmail,
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
