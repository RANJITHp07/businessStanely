import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);
    
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch active admins only. Deleted admins are soft-deleted as inactive.
    const admins = await prisma.user.findMany({
      where: {
        status: "active",
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map the data to match the Admin interface in the frontend
    const formattedAdmins = admins.map(admin => ({
        id: admin.id,
        name: admin.username, // Use username for display
        email: admin.email,
        role: admin.adminType,
        status: admin.status,
        createdAt: admin.createdAt.toISOString(),
        photo: "/placeholder.svg?height=40&width=40", // Default placeholder image
        lastLogin: undefined, // We don't have this data yet
        permissions: [], // Default empty permissions array
    }));

    return NextResponse.json(formattedAdmins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: "Error fetching admins" },
      { status: 500 }
    );
  }
}
