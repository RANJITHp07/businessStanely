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
        createdBy: {
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
    
    // If user is not an owner and category is not approved, return 404
    if (currentAdmin.adminType !== "owner" && category.status !== "approved") {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    
    // Count tasks associated with this category
    // Note: We don't seem to have a direct relation between Task and TaskCategory in the schema
    // Using a placeholder count for now - this should be updated with the correct relation field
    const taskCount = 0; // We'll need to update this when the Task-Category relation is established
    
    const formattedCategory = {
      ...category,
      taskCount,
      createdBy: category.createdBy?.username || "Unknown"
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