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
    if (statusParam && ["approved", "pending"].includes(statusParam)) {
      where.status = statusParam; // Filter by retainership status
    }

    // Fetch retainerships from the database
    const retainerships = await prisma.retainership.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            username: true,
          },
        },
        createdByAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Add debugging logs and ensure proper resolution of createdBy field
    const transformedRetainerships = await Promise.all(
      retainerships.map(async (retainership) => {
        // Safely resolve client name
        const clientName = retainership.client
          ? retainership.client.organizationName ||
            `${retainership.client.firstName || ""} ${retainership.client.lastName || ""}`.trim()
          : "Unknown Client";

        return {
          id: retainership.id,
          name: retainership.name,
          description: retainership.description || "",
          status: retainership.status,
          createdAt: retainership.createdAt.toISOString(),
          updatedAt: retainership.updatedAt.toISOString(),
          client: retainership.client
            ? {
                id: retainership.client.id,
                name: clientName,
                email: retainership.client.email,
              }
            : null, // Handle null client case
          createdBy: retainership.createdByUser
            ? {
                id: retainership.createdByUser.id,
                name: retainership.createdByUser.username,
                type: "User",
              }
            : retainership.createdByAgent
            ? {
                id: retainership.createdByAgent.id,
                name: retainership.createdByAgent.name,
                type: "Agent",
              }
            : null, // Handle null createdBy case
        };
      })
    );

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

// POST /api/legislations - Create a new legislation
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { name, description, clientId, legislation } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Retainership name is required" },
        { status: 400 }
      );
    }

    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }


    // Determine creator (user or agent)
    const createdByUserId = currentAgent.name ? currentAgent.id : null;
    const createdByAgentId = currentAgent.agentType ? currentAgent.id : null;

    if (!createdByUserId && !createdByAgentId) {
      console.warn("Neither createdByUserId nor createdByAgentId could be resolved for currentAgent:", currentAgent);
    }

    // Create the retainership
    const newRetainership = await prisma.retainership.create({
      data: {
        name,
        description: description || "",
        clientId,
        createdByUserId,
        createdByAgentId,
      },
    });

    // Create legislations if provided
    if (legislation && Array.isArray(legislation)) {
      for (const leg of legislation) {
        const { title, description, assignedAgent } = leg;

        if (!title) {
          throw new Error("Each legislation must have a title");
        }

        const agent = await prisma.agent.findFirst({
          where: { name: assignedAgent },
        });

        if (!agent) {
          throw new Error(`Agent with name '${assignedAgent}' not found`);
        }

        await prisma.legislation.create({
          data: {
            title,
            description: description || "",
            assignedAgentId: agent.id,
            retainershipId: newRetainership.id,
          },
        });
      }
    }

    return NextResponse.json(newRetainership, { status: 201 });
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