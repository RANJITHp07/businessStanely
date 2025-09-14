import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);
    
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is an owner
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can approve retainerships" },
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Retainership ID is required" },
        { status: 400 }
      );
    }

    const retainership = await prisma.retainership.update({
      where: {
        id
      },
      data: {
        status: "approved",
        approvedById: currentAdmin.id,
        approvedAt: new Date(),
      },
      include: {
        createdByAgent: {
          select: {
            name: true,
            id: true
          }
        },
        approvedBy: {
          select: {
            username: true,
            id: true
          }
        }
      }
    });

    if (!retainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(retainership);
  } catch (error) {
    console.error("Error approving retainership:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}