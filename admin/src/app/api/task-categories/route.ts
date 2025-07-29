import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/task-categories - Get all task categories
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

    // Parse query parameters
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");

    // Build query based on user role and status parameter
    const query: Record<string, string> = {};
    
    // If user is not an owner, only show approved categories
    if (currentAdmin.adminType !== "owner") {
      query.status = "approved";
    } 
    // If status parameter is provided and user is owner, filter by status
    else if (statusParam && ["approved", "pending"].includes(statusParam)) {
      query.status = statusParam;
    }

    // Build where clause for the query
    const where: { status?: string } = {};
    
    // Filter by status if needed
    if (currentAdmin.adminType !== "owner") {
      where.status = "approved";
    } else if (statusParam && ["approved", "pending"].includes(statusParam)) {
      where.status = statusParam;
    }
    
    // Get categories from the database with proper relations
    const categories = await prisma.taskCategory.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
          }
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get task counts for each category (this will be implemented later)
    // For now, we'll return 0 for task counts
    
    // Transform data for frontend
    const transformedCategories = await Promise.all(categories.map(async (category) => {
      // Count tasks that belong to this category (placeholder for now)
      const taskCount = 0; // We'll implement this later
      
      return {
        id: category.id,
        name: category.name,
        description: category.description || "",
        color: category.color,
        status: category.status,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
        createdBy: category.createdBy.username,
        createdById: category.createdById,
        approvedById: category.approvedById || null,
        approvedBy: category.approvedBy?.username || null,
        approvedAt: category.approvedAt?.toISOString() || null,
        taskCount: taskCount,
      };
    }));

    return NextResponse.json(transformedCategories);
  } catch (error) {
    console.error("Error fetching task categories:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/task-categories - Create a new task category
export async function POST(req: NextRequest) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);
    
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { name, description, color } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Create new category in the database
    const newCategory = await prisma.taskCategory.create({
      data: {
        name,
        description: description || "",
        color: color || "blue",
        status: "pending", // Always start as pending for approval flow
        createdById: currentAdmin.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    // Transform data for frontend
    const transformedCategory = {
      id: newCategory.id,
      name: newCategory.name,
      description: newCategory.description || "",
      color: newCategory.color,
      status: newCategory.status,
      createdAt: newCategory.createdAt.toISOString(),
      updatedAt: newCategory.updatedAt.toISOString(),
      createdBy: newCategory.createdBy.username,
      createdById: newCategory.createdById,
      approvedById: null,
      approvedBy: null,
      approvedAt: null,
      taskCount: 0,
    };

    return NextResponse.json(transformedCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating task category:", error);
    
    // Check for unique constraint violations - Prisma error
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}