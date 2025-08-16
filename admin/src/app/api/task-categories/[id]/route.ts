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
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Find the category in database with creator information
    const category = await prisma.taskCategory.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
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
    
    // Add isOwner flag to indicate if the current user can perform owner actions
    const isOwner = currentAdmin.adminType === "owner";
    
    // Count tasks associated with this category
    // Note: We don't seem to have a direct relation between Task and TaskCategory in the schema
    // Using a placeholder count for now - this should be updated with the correct relation field
    const taskCount = 0; // We'll need to update this when the Task-Category relation is established
    
    const formattedCategory = {
      ...category,
      taskCount,
      createdByUser: category.createdByUser?.username || "Unknown",
      isOwner  // Add flag to indicate if user has owner permissions
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
        { error: "Only owners can edit categories" },
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
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}