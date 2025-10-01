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

  const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Retainership ID is required" },
        { status: 400 }
      );
    }

    // Find the retainership in database with creator information (user or agent)
    const retainership = await prisma.retainership.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            adminType: true,
            photo: true,
          },
        },
        createdByAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            photo: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        rejectedBy: {
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
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            email: true,
          },
        },
      },
    });

    if (!retainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }

  // Updated the mapping logic to handle the nested structure of `assignedAgent`
  const formattedRetainership = {
      id: retainership.id,
      name: retainership.name,
      description: retainership.description || "",
      color: retainership.color,
      status: retainership.status,
      createdAt: retainership.createdAt.toISOString(),
      updatedAt: retainership.updatedAt.toISOString(),
      rejectionReason: retainership.rejectionReason || null,
      createdBy: retainership.createdByUser?.username || retainership.createdByAgent?.name || "Unknown",
      client: retainership.client
        ? {
            id: retainership.client.id,
            name: retainership.client.organizationName || `${retainership.client.firstName || ""} ${retainership.client.lastName || ""}`.trim(),
            email: retainership.client.email,
          }
        : null,
      legislation: retainership.legislation.map((legislation) => ({
        id: legislation.id,
        title: legislation.title,
        description: legislation.description,
        assignedAgent: legislation.assignedAgent
          ? {
              id: legislation.assignedAgent.id,
              name: legislation.assignedAgent.name,
            }
          : null,
      })),
    };
    return NextResponse.json(formattedRetainership);
  } catch (error) {
    console.error("Error fetching retainership:", error);
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

    // Check if retainership exists
    const existingRetainership = await prisma.retainership.findUnique({
      where: { id },
    });

    if (!existingRetainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }

    // Update the retainership
    const updatedRetainership = await prisma.retainership.update({
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

    return NextResponse.json(updatedRetainership);
  } catch (error) {
    console.error("Error updating retainership:", error);
    
    // Check for unique constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "A retainership with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update retainership" },
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

    // Check if retainership exists
    const existingRetainership = await prisma.retainership.findUnique({
      where: { id },
    });

    if (!existingRetainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 }
      );
    }

    // Delete the retainership
    await prisma.retainership.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Retainership deleted successfully" });
  } catch (error) {
    console.error("Error deleting retainership:", error);
    
    // Check for foreign key constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        { error: "Cannot delete retainership because it is being used by tasks" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete retainership" },
      { status: 500 }
    );
  }
}