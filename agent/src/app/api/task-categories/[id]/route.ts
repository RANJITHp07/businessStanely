import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { params } = context;
    const id = params?.id;
    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
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
      creatorId = category.createdByUserId;
    } else if (category.createdByAgent) {
      creatorName = category.createdByAgent.name;
      creatorType = "agent";
      creatorRole = null;
      creatorId = category.createdByAgentId;
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
      isOwner: creatorRole === "owner",
      photo,
      processFlow: category.processFlow || null,
      notes: category.notes || null,
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
    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();
  const { name, description, color, notes, processFlow } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check if category exists and is created by this agent
    const existingCategory = await prisma.taskCategory.findUnique({
      where: { id },
    });
    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    if (existingCategory.createdByAgentId !== currentAgent.id) {
      return NextResponse.json(
        { error: "You can only edit your own categories" },
        { status: 403 }
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
      },
      include: {
        createdByAgent: {
          select: {
            id: true,
            name: true,
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
    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;

    // Check if category exists and is created by this agent
    const existingCategory = await prisma.taskCategory.findUnique({
      where: { id },
    });
    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    if (existingCategory.createdByAgentId !== currentAgent.id) {
      return NextResponse.json(
        { error: "You can only delete your own services" },
        { status: 403 }
      );
    }

    // Delete the category
    await prisma.taskCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Error deleting service:", error);

    // Check for foreign key constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        { error: "Cannot delete category because it is being used by tasks" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}