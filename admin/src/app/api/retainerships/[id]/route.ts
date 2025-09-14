import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
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

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Retainership ID is required" },
        { status: 400 }
      );
    }

    // Find the retainership in database with creator information (user or agent)
    const retainership = await prisma.retainership.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            adminType: true,
            photo: true,
          }
        },
        createdByAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            photo: true,
          }
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
            email: true,
            photo: true,
          }
        },
        rejectedBy: {
          select: {
            id: true,
            username: true,
            email: true,
            photo: true,
          }
        },
      }
    });
    
    if (!retainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }
    
    // Count tasks associated with this retainership
    const taskCount = await prisma.task.count({ where: { retainershipId: id } });

    // Determine creator name, type, and role
    let creatorName = null;
    let creatorType = null;
    let creatorRole = null;
    let creatorId = null;
    if (retainership.createdByUser) {
      creatorName = retainership.createdByUser.username;
      creatorType = "user";
      creatorRole = retainership.createdByUser.adminType; // "owner" or "admin"
      creatorId = retainership.createdByUser.id;
    } else if (retainership.createdByAgent) {
      creatorName = retainership.createdByAgent.name;
      creatorType = "agent";
      creatorRole = null;
      creatorId = retainership.createdByAgent.id;
    }

    // Use the creator's photo if available, fallback to null
    let photo = null;
    if (retainership.createdByUser && retainership.createdByUser.photo) {
      photo = retainership.createdByUser.photo;
    } else if (retainership.createdByAgent && retainership.createdByAgent.photo) {
      photo = retainership.createdByAgent.photo;
    } else {
      photo = null;
    }

    const formattedRetainership = {
      id: retainership.id,
      name: retainership.name,
      description: retainership.description || "",
      color: retainership.color,
      status: retainership.status,
      createdAt: retainership.createdAt,
      updatedAt: retainership.updatedAt,
      createdBy: creatorName || "Unknown",
      createdByType: creatorType,
      createdByRole: creatorRole,
      createdById: creatorId,
      approvedById: retainership.approvedById || null,
      approvedBy: retainership.approvedBy?.username || null,
      approvedAt: retainership.approvedAt || null,
      rejectedById: retainership.rejectedById || null,
      rejectedBy: retainership.rejectedBy?.username || null,
      rejectedAt: retainership.rejectedAt || null,
      rejectionReason: retainership.rejectionReason || null,
      taskCount: taskCount,
      isOwner: currentAdmin.adminType === "owner",
      photo,
    };

    return NextResponse.json(formattedRetainership);
  } catch (error) {
    console.error("Error fetching retainership:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only owner can edit retainerships
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can edit retainerships" },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { name, description, color } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check if retainership exists
    const existingRetainership = await prisma.retainership.findUnique({
      where: { id },
    });

    if (!existingRetainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }

    // Update the retainership
    const updatedRetainership = await prisma.retainership.update({
      where: { id },
      data: {
        name,
        description: description || "",
        color: color || "blue",
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
          }
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    return NextResponse.json(updatedRetainership);
  } catch (error) {
    console.error("Error updating retainership:", error);
    
    // Check for unique constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "A retainership with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update retainership" },
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only owner can delete retainerships
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can delete retainerships" },
        { status: 403 }
      );
    }

    const { id } = params;

    // Check if retainership exists
    const existingRetainership = await prisma.retainership.findUnique({
      where: { id },
    });

    if (!existingRetainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }

    // Delete the retainership
    await prisma.retainership.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Retainership deleted successfully" });
  } catch (error) {
    console.error("Error deleting retainership:", error);
    
    // Check for foreign key constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        { error: "Cannot delete retainership because it is being used by tasks" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete retainership" },
      { status: 500 }
    );
  }
}