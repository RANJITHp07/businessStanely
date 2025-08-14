import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = params;
    // Fetch a single team member (agent) by ID, only if subordinate of current agent
    const teamMember = await prisma.agent.findFirst({
      where: {
        id,
        superiorId: agent.id,
      },
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
    });
    if (!teamMember) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(teamMember);
  } catch {
    return NextResponse.json({ error: "Failed to fetch team member" }, { status: 500 });
  }
}
