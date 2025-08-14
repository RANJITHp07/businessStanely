import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Fetch subordinates (team members) for the current agent
    const teamMembers = await prisma.agent.findMany({
      where: { superiorId: agent.id },
      select: {
        id: true,
        name: true,
        email: true,
        agentType: true,
        phoneNumber: true,
        jurisdiction: true,
        specializations: true,
        photo: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(teamMembers);
  } catch {
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
  }
}
