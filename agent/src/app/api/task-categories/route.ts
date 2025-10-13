import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/task-categories - Get all task categories
export async function GET(req: NextRequest) {
  try {
    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const includeAll = url.searchParams.get("includeAll") === "true";

    // Build where clause for the query
    const where: { status?: string | { not: string } } = {};
    
    // If status parameter is provided, filter by specific status
    if (statusParam && ["approved", "pending", "rejected"].includes(statusParam)) {
      where.status = statusParam;
    } else if (includeAll) {
      // Show all categories including rejected (for admin purposes)
      // No status filter
    } else {
      // Default: exclude rejected categories for task creation/selection
      where.status = { not: "rejected" };
    }
    
    // Get categories from the database with proper relations
    // Get categories from the database with proper relations
    const categories = await prisma.taskCategory.findMany({
      where,
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            adminType: true,
          }
        },
        createdByAgent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            username: true
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
      // Count tasks that belong to this category
      const taskCount = await prisma.task.count({
        where: {
          categoryId: category.id
        }
      });
      // Determine creator name and type
      let creatorName = null;
      let creatorType = null;
      let creatorRole = null;
      if (category.createdByUser) {
        creatorName = category.createdByUser.username;
        creatorType = "user";
        creatorRole = category.createdByUser.adminType; // "owner" or "admin"
      } else if (category.createdByAgent) {
        creatorName = category.createdByAgent.name;
        creatorType = "agent";
        creatorRole = null;
      }
      return {
        id: category.id,
        name: category.name,
        description: category.description || "",
        color: category.color,
        status: category.status,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
        createdBy: creatorName,
        createdByType: creatorType,
        createdByRole: creatorRole,
        createdById: category.createdByUserId || category.createdByAgentId,
        approvedById: category.approvedById || null,
        approvedBy: category.approvedBy?.username || null,
        approvedAt: category.approvedAt?.toISOString() || null,
        taskCount: taskCount,
        isOwner: false,
        timePeriod: category.timePeriod,
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
    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
  const { name, description, color, timePeriod, notes, processFlow } = body; // Include notes, processFlow

    // Convert timePeriod to an integer
    const parsedTimePeriod = timePeriod ? parseInt(timePeriod, 10) : null;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // All agent-created categories are pending and not approved
    const newCategory = await prisma.taskCategory.create({
      data: {
        name,
        description: description || "",
        notes: notes || "",
        processFlow: processFlow || "",
        color: color || "blue",
        timePeriod: parsedTimePeriod, // Use parsed integer value
        status: "pending",
        createdByAgentId: currentAgent.id,
        approvedById: null,
        approvedAt: null,
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

    // Transform data for frontend
    const transformedCategory = {
      id: newCategory.id,
      name: newCategory.name,
      description: newCategory.description || "",
      color: newCategory.color,
      status: newCategory.status,
      createdAt: newCategory.createdAt.toISOString(),
      updatedAt: newCategory.updatedAt.toISOString(),
      createdBy: newCategory.createdByAgent?.name || null,
      createdById: newCategory.createdByAgentId,
      approvedById: newCategory.approvedById,
      approvedBy: newCategory.approvedBy?.username || null,
      approvedAt: newCategory.approvedAt?.toISOString() || null,
      taskCount: 0,
      timePeriod: newCategory.timePeriod, // Include timePeriod in the response
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