import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { params } = context;
    const id = params?.id;

    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);
    
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Find the category in database with creator information (user or agent)
    const category = await prisma.taskCategory.findUnique({
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
    
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    
    // Count tasks associated with this category
    const taskCount = await prisma.task.count({ where: { categoryId: id } });

    // Determine creator name, type, and role
    let creatorName = null;
    let creatorType = null;
    let creatorRole = null;
    let creatorId = null;
    if (category.createdByUser) {
      creatorName = category.createdByUser.username;
      creatorType = "user";
      creatorRole = category.createdByUser.adminType; // "owner" or "admin"
      creatorId = category.createdByUser.id;
    } else if (category.createdByAgent) {
      creatorName = category.createdByAgent.name;
      creatorType = "agent";
      creatorRole = null;
      creatorId = category.createdByAgent.id;
    }

    // Use the creator's photo if available, fallback to null
    let photo = null;
    if (category.createdByUser && category.createdByUser.photo) {
      photo = category.createdByUser.photo;
    } else if (category.createdByAgent && category.createdByAgent.photo) {
      photo = category.createdByAgent.photo;
    } else {
      photo = null;
    }

    const formattedCategory = {
      id: category.id,
      name: category.name,
      description: category.description || "",
      notes: category.notes || "",
      processFlow: category.processFlow || "",
      color: category.color,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      createdBy: creatorName || "Unknown",
      createdByType: creatorType,
      createdByRole: creatorRole,
      createdById: creatorId,
      approvedById: category.approvedById || null,
      approvedBy: category.approvedBy?.username || null,
      approvedAt: category.approvedAt || null,
      rejectedById: category.rejectedById || null,
      rejectedBy: category.rejectedBy?.username || null,
      rejectedAt: category.rejectedAt || null,
      rejectionReason: category.rejectionReason || null,
      taskCount: taskCount,
      isOwner: currentAdmin.adminType === "owner",
      photo,
      timePeriod: category.timePeriod ?? null,
      agentCanEditDays: category.agentCanEditDays ?? false,
    };
    return NextResponse.json(formattedCategory);
  } catch (error) {
    console.error("Error fetching task category:", error);
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

    // Only owner can edit categories
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can edit services" },
        { status: 403 }
      );
    }

  const { id } = params;
  const body = await req.json();
  const { name, description, color, timePeriod, notes, processFlow, agentCanEditDays } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check if category exists
    const existingCategory = await prisma.taskCategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Update the category
    const updatedCategory = await prisma.taskCategory.update({
      where: { id },
      data: {
        name,
        description: description || "",
        notes: notes || "",
        processFlow: processFlow || "",
        color: color || "blue",
        timePeriod: typeof timePeriod === 'number' ? timePeriod : (timePeriod ? parseInt(timePeriod, 10) : null),
        agentCanEditDays: agentCanEditDays ?? false,
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

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error("Error updating task category:", error);
    
    // Check for unique constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update category" },
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

    // Only owner can delete categories
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can delete categories" },
        { status: 403 }
      );
    }

    const { id } = params;

    // Check if category exists
    const existingCategory = await prisma.taskCategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Delete the category
    await prisma.taskCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting task category:", error);
    
    // Check for foreign key constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        { error: "Cannot delete category because it is being used by tasks" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 }
    );
  }
}