import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all agents first
    const allAgents = await prisma.agent.findMany({
      select: {
        id: true,
        name: true,
        agentRole: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    
    // Filter for execution role agents only
    const executionAgents = allAgents.filter(a => a.agentRole === "Execution Agent");
    
    // Fetch full data for execution agents using their IDs
    const agents = await prisma.agent.findMany({
      where: {
        id: { in: executionAgents.map(a => a.id) },
      },
      include: {
        superiorsLinks: { include: { superior: true } },
        subordinatesLinks: { include: { subordinate: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    
    console.log("[DEBUG] Execution agents fetched for timesheet:", agents.length, "agents");
    
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error fetching execution agents for timesheet:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution agents" },
      { status: 500 }
    );
  }
}