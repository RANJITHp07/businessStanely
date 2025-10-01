import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Fetch subordinates (team members) for the current agent using join table
    const agentWithSubordinates = await prisma.agent.findUnique({
      where: { id: agent.id },
      include: {
        subordinatesLinks: {
          include: {
            subordinate: {
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
              }
            }
          }
        }
      }
    });
    const teamMembers = agentWithSubordinates?.subordinatesLinks?.map(link => link.subordinate) || [];
    return NextResponse.json(teamMembers);
  } catch {
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
  }
}
