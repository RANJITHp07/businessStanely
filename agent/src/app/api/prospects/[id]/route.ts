import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

// GET: Get a single prospect by ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: { assignedAgent: true, createdByAgent: true },
    });
    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch prospect" }, { status: 500 });
  }
}

// PUT: Update a prospect by ID
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = params;
    const body = await req.json();
    const { name, email, phone, phoneNumber, address, leadSource, description, status, notes, nextFollowUp, assignedAgentId } = body;
    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        phoneNumber,
        address,
        leadSource,
        description,
        status,
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgentId,
      },
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update prospect" }, { status: 500 });
  }
}

// DELETE: Delete a prospect by ID
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Await params if it's a Promise (Next.js 14+)
    const awaitedParams = typeof params.then === "function" ? await params : params;
    const { id } = awaitedParams;
    await prisma.prospect.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete prospect" }, { status: 500 });
  }
}
