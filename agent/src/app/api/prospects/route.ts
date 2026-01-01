import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

// GET: List all prospects (optionally filter by assignedAgentId)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url!);
    const assignedAgentId = url.searchParams.get("assignedAgentId");
    const where: any = assignedAgentId ? { assignedAgentId } : {};
    where.status = { not: "opportunity" };
    const prospects = await prisma.prospect.findMany({
      where,
      include: { assignedAgent: true, createdByAgent: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ prospects });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch prospects" }, { status: 500 });
  }
}

// POST: Create a new prospect
export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { name, email, phone, phoneNumber, description, status, notes, nextFollowUp, assignedAgentId } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const prospect = await prisma.prospect.create({
      data: {
        name,
        email,
        phone,
        phoneNumber,
        description,
        status: status || "New",
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgentId: assignedAgentId || agent.id,
        createdByAgentId: agent.id,
      },
      include: { createdByAgent: true, assignedAgent: true },
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create prospect" }, { status: 500 });
  }
}
