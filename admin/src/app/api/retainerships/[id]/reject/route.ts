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
        { error: "Only owners can reject retainerships" },
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

    // Get rejection reason from request body
    const body = await req.json();
    const { rejectionReason } = body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    // Find retainership and ensure it exists
    const existingRetainership = await prisma.retainership.findUnique({
      where: { id }
    });

    if (!existingRetainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }

    // Update retainership to rejected status
    const updatedRetainership = await prisma.retainership.update({
      where: { id },
      data: {
        status: "rejected",
        rejectedById: currentAdmin.id,
        rejectedAt: new Date(),
        rejectionReason,
        updatedAt: new Date()
      }
    });

    return NextResponse.json(updatedRetainership);
  } catch (error) {
    console.error("Error rejecting retainership:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}