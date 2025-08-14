import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
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

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Find the category in database with creator information
    const category = await prisma.taskCategory.findUnique({
      where: { id },
      include: {
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
    const formattedCategory = {
      ...category,
      taskCount,
      createdBy: category.createdByAgent?.name || "Unknown",
      createdById: category.createdByAgentId,
      isOwner: false
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
    const { name, description, color } = body;

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
        { error: "You can only delete your own categories" },
        { status: 403 }
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
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}