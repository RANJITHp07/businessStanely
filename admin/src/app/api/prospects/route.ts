import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const where: Record<string, unknown> = {
      archived: false,
      status: { not: "opportunity" },
    };
    const prospects = await prisma.prospect.findMany({
      where,
      include: {
        assignedAgent: true,
        createdByAgent: true,
        comments: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ prospects });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to fetch prospects" },
      { status: 500 },
    );
  }
}

// POST: Create a new prospect
export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const {
      name,
      email,
      phone,
      phoneNumber,
      description,
      status,
      notes,
      nextFollowUp,
      assignedAgentId,
      leadSourceId,
      amount,
      address,
      service,
    } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!assignedAgentId) {
      return NextResponse.json(
        { error: "Assigned agent is required" },
        { status: 400 },
      );
    }
    let finalAssignedAgentId = assignedAgentId;

    const prospect = await prisma.prospect.create({
      data: {
        name,
        email,
        phone,
        phoneNumber,
        description,
        address,
        leadSourceId,
        status: status || "New",
        notes,
        service: service || "",
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgentId: finalAssignedAgentId,
        createdByAgentId: agent.id,
        amount: typeof amount === "number" ? amount : undefined,
      },
      include: { createdByAgent: true, assignedAgent: true },
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 },
    );
  }
}
