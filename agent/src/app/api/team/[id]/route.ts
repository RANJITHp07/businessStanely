import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Team member ID is required" }, { status: 400 });
    }
    // Find the team member by ID
    const teamMember = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        agentType: true,
        phoneNumber: true,
        jurisdiction: true,
        barAssociationId: true,
        specializations: true,
        photo: true,
        status: true,
        superiorId: true,
        superior: {
          select: {
            id: true,
            name: true,
            email: true,
            agentType: true,
            photo: true,
          }
        },
        subordinates: {
          select: {
            id: true,
            name: true,
            email: true,
            agentType: true,
            photo: true,
          }
        },
      }
    });
    if (!teamMember) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }
    return NextResponse.json(teamMember);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch team member" }, { status: 500 });
  }
}
