import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: List all opportunities (prospects with status 'opportunity')
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url!);
    const assignedAgentId = url.searchParams.get("assignedAgentId");
    const where: Record<string, unknown> = { status: "opportunity" };
    if (assignedAgentId) where.assignedAgentId = assignedAgentId;
    const opportunities = await prisma.prospect.findMany({
      where,
      include: { assignedAgent: true, createdByAgent: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch opportunities" }, { status: 500 });
  }
}
