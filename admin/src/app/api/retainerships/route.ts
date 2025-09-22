import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/retainerships - Get all retainerships
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
        },
        client: {
          select: {
            id: true,
            organizationName: true,
            firstName: true,
            lastName: true,
            email: true
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
        isOwner: currentAdmin.adminType === "owner",
        client: retainership.client
        ? {
            id: retainership.client.id,
            organizationName: retainership.client.organizationName,
            firstName: retainership.client.firstName,
            lastName: retainership.client.lastName,
            email: retainership.client.email
          }
        : null
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
    const { name, description, clientId, color, legislation } = body;

    // Validate required fields
    if (!name || !clientId) {
      return NextResponse.json(
        { error: "Name and clientId are required" },
        { status: 400 }
      );
    }

    // Determine retainership status based on user role
    const status = currentAdmin.adminType === "owner" ? "approved" : "pending";
    const approvedById = currentAdmin.adminType === "owner" ? currentAdmin.id : null;
    const approvedAt = currentAdmin.adminType === "owner" ? new Date() : null;

    // Update legislation creation logic to store assignedAgentId
    const newRetainership = await prisma.retainership.create({
      data: {
        name,
        description: description || "",
        color: color || "blue",
        status,
        clientId,
        createdByUserId: currentAdmin.id,
        approvedById,
        approvedAt,
        legislation: {
          create: legislation?.map((leg: { title: string; description: string; assignedAgent: string }) => {
            console.log("Legislation being created:", leg);
            return {
              title: leg.title,
              description: leg.description,
              assignedAgentId: leg.assignedAgent, // Store assignedAgentId instead of assignedAgent
            };
          }),
        },
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        legislation: {
          include: {
            assignedAgent: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Log the created retainership data
    console.log("New retainership created:", newRetainership);

    // Transform legislation data to include assignedAgent name
    const transformedRetainership = {
      id: newRetainership.id,
      name: newRetainership.name,
      description: newRetainership.description || "",
      color: newRetainership.color,
      status: newRetainership.status,
      createdAt: newRetainership.createdAt.toISOString(),
      updatedAt: newRetainership.updatedAt.toISOString(),
      createdBy: newRetainership.createdByUser?.username || null,
      createdById: newRetainership.createdByUserId,
      approvedById: newRetainership.approvedById,
      approvedBy: newRetainership.approvedBy?.username || null,
      approvedAt: newRetainership.approvedAt?.toISOString() || null,
      legislation: newRetainership.legislation.map((leg) => ({
        id: leg.id,
        title: leg.title,
        description: leg.description,
        assignedAgent: leg.assignedAgent?.name || "Unknown", // Include assignedAgent name
      })),
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