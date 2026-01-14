import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only allow for Client Manager
  if (agent.agentRole !== "Advisor Agent" || agent.agentType !== "Client Manager") {
    return NextResponse.json([]);
  }
  // Find subordinates (Client Advisors)
  const links = await prisma.agentSuperior.findMany({
    where: { superiorId: agent.id },
    include: { subordinate: true },
  });
  const subordinates = links.map((l) => l.subordinate);
  return NextResponse.json(subordinates);
}
