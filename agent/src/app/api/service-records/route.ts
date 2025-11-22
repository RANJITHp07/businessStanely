import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Fetch service records for the current agent or specified agent
export async function GET(request: NextRequest) {
  try {
    const currentAgent = await getCurrentAgent(request);
    
    if (!currentAgent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get("agentId");
    
    // If agentId is provided, use it (for admin access)
    // Otherwise, use the current logged-in agent's ID
    let agentId: string;
    
    if (agentIdParam) {
      agentId = agentIdParam;
    } else {
      // Use current agent's ID
      agentId = currentAgent.id;
    }

    // Verify the agent exists
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // If accessing another agent's records, verify permissions
    if (agentId !== currentAgent.id) {
      // Check if current user is a superior of the target agent
      const isSupervior = await prisma.agentSuperior.findFirst({
        where: {
          superiorId: currentAgent.id,
          subordinateId: agentId
        }
      });

      if (!isSupervior) {
        return NextResponse.json(
          { error: "Forbidden - You can only view your own service records" },
          { status: 403 }
        );
      }
    }

    const serviceRecords = await prisma.serviceRecord.findMany({
      where: {
        agentId: agentId
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map the response to match the expected format
    const formattedRecords = serviceRecords.map(record => ({
      ...record,
      createdByUser: {
        id: record.createdByUser.id,
        name: record.createdByUser.username,
        email: record.createdByUser.email
      }
    }));

    return NextResponse.json({ serviceRecords: formattedRecords });

  } catch (error) {
    console.error("Error fetching service records:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}