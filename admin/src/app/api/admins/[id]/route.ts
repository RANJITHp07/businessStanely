import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin, AdminUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const admin = (await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        adminType: true,
      },
    })) as AdminUser | null;

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // All admin types can view admin details

    return NextResponse.json(admin);
  } catch (error) {
    console.error("Error fetching admin:", error);
    return NextResponse.json(
      { error: "Error fetching admin details" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can update admin details" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { error: "Invalid admin ID format" },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Error parsing request body:", error);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Validate the fields that are present
    if (body.username && !body.username.trim()) {
      return NextResponse.json(
        { error: "Username cannot be empty" },
        { status: 400 }
      );
    }
    if (body.email && !body.email.trim()) {
      return NextResponse.json(
        { error: "Email cannot be empty" },
        { status: 400 }
      );
    }
    if (body.adminType && !body.adminType.trim()) {
      return NextResponse.json(
        { error: "Admin type cannot be empty" },
        { status: 400 }
      );
    }
    if (body.adminType && !["owner", "admin"].includes(body.adminType)) {
      return NextResponse.json(
        { error: "Admin type must be either 'owner' or 'admin'" },
        { status: 400 }
      );
    }

    // Get the existing admin data first
    const existingAdmin = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        adminType: true,
        password: true,
      },
    });

    if (!existingAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Handle password change if provided
    let hashedPassword;
    if (body.password) {
      hashedPassword = await bcrypt.hash(body.password, 10);
    }

    // Merge existing data with updates
    const updateData = {
      username: body.username ?? existingAdmin.username,
      email: body.email ?? existingAdmin.email,
      adminType: body.adminType ?? existingAdmin.adminType,
      ...(hashedPassword && { password: hashedPassword }),
    };


    // Always store and check emails in lowercase for case-insensitive uniqueness
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    // Check for duplicates with the merged data (case-insensitive for email)
    const [existingUsername, existingEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { username: updateData.username },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { email: { equals: updateData.email, mode: "insensitive" } },
        select: { id: true },
      }),
    ]);

    // Check for duplicate username
    if (existingUsername && existingUsername.id !== id) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      );
    }

    // Check for duplicate email (case-insensitive)
    if (existingEmail && existingEmail.id !== id) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    // Update the admin with merged data
    const updatedAdmin = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        adminType: true,
      },
    });

    return NextResponse.json(
      { message: "Admin updated successfully", admin: updatedAdmin },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating admin:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));

    // Check for unique constraint violations
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 }
      );
    }

    // Check for validation errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message || "Error updating admin" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only owners can delete admins
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can delete admins" },
        { status: 403 }
      );
    }

    // Ensure params is awaited before accessing its properties
    const id = params.id;

    // Prevent deleting yourself
    if (id === currentAdmin.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Check if admin exists
    const existingAdmin = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // First, find all comments associated with this admin
    const comments = await prisma.comment.findMany({
      where: {
        authorId: id,
        authorType: "USER",
      },
    });

    // If there are comments, delete them first
    if (comments.length > 0) {
      await prisma.comment.deleteMany({
        where: {
          authorId: id,
          authorType: "USER",
        },
      });
    }

    // Now delete the admin
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Admin deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: "Error deleting admin" },
      { status: 500 }
    );
  }
}