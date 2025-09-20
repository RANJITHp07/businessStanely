import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/retainerships - Get all retainerships
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

    // Build where clause for the query
    const where: { status?: string } = {};
    
    // If status parameter is provided, filter by status
    if (statusParam && ["approved", "pending"].includes(statusParam)) {
      where.status = statusParam;
    }
    // Otherwise show all retainerships (both pending and approved)
    
    // Get retainerships from the database with proper relations
    const retainerships = await prisma.retainership.findMany({
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

    // Get task counts for each retainership (this will be implemented later)
    // For now, we'll return 0 for task counts
    
    // Transform data for frontend
    const transformedRetainerships = await Promise.all(retainerships.map(async (retainership) => {
      // Count tasks that belong to this retainership
      const taskCount = await prisma.task.count({
        where: {
          retainershipId: retainership.id
        }
      });
      // Determine creator name and type
      let creatorName = null;
      let creatorType = null;
      let creatorRole = null;
      if (retainership.createdByUser) {
        creatorName = retainership.createdByUser.username;
        creatorType = "user";
        creatorRole = retainership.createdByUser.adminType; // "owner" or "admin"
      } else if (retainership.createdByAgent) {
        creatorName = retainership.createdByAgent.name;
        creatorType = "agent";
        creatorRole = null;
      }
      return {
        id: retainership.id,
        name: retainership.name,
        description: retainership.description || "",
        color: retainership.color,
        status: retainership.status,
        createdAt: retainership.createdAt.toISOString(),
        updatedAt: retainership.updatedAt.toISOString(),
        createdBy: creatorName,
        createdByType: creatorType,
        createdByRole: creatorRole,
        createdById: retainership.createdByUserId || retainership.createdByAgentId,
        approvedById: retainership.approvedById || null,
        approvedBy: retainership.approvedBy?.username || null,
        approvedAt: retainership.approvedAt?.toISOString() || null,
        taskCount: taskCount,
        isOwner: false,
      };
    }));

    return NextResponse.json(transformedRetainerships);
  } catch (error) {
    console.error("Error fetching retainerships:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/retainerships - Create a new retainership
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
    const { name, description, color, legislation } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Create the retainership
    const newRetainership = await prisma.retainership.create({
      data: {
        name,
        description: description || "",
        color: color || "blue",
        status: "pending",
        createdByAgentId: currentAgent.id,
        approvedById: null,
        approvedAt: null,
        legislation: {
          create: legislation?.map((leg: { title: string; description: string; assignedAgent: string }) => ({
            title: leg.title, // Corrected from `name` to `title`
            description: leg.description,
            assignedAgent: leg.assignedAgent
          })),
        },
      },
    });

    // Fetch the created retainership with related data
    const fetchedRetainership = await prisma.retainership.findUnique({
      where: { id: newRetainership.id },
      include: {
        createdByAgent: {
          select: {
            id: true,
            name: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        legislation: true,
      },
    });

    // Transform data for frontend
    const transformedRetainership = {
      id: fetchedRetainership?.id,
      name: fetchedRetainership?.name,
      description: fetchedRetainership?.description || "",
      color: fetchedRetainership?.color,
      status: fetchedRetainership?.status,
      createdAt: fetchedRetainership?.createdAt.toISOString(),
      updatedAt: fetchedRetainership?.updatedAt.toISOString(),
      createdBy: fetchedRetainership?.createdByAgent?.name || null,
      createdById: fetchedRetainership?.createdByAgentId,
      approvedById: fetchedRetainership?.approvedById,
      approvedBy: fetchedRetainership?.approvedBy?.username || null,
      approvedAt: fetchedRetainership?.approvedAt?.toISOString() || null,
      legislation: fetchedRetainership?.legislation,
      taskCount: 0,
    };

    return NextResponse.json(transformedRetainership, { status: 201 });
  } catch (error) {
    console.error("Error creating retainership:", error);

    // Check for unique constraint violations - Prisma error
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "A retainership with this name already exists" },
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