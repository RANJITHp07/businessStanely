import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

// GET: Get a single prospect by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Await params if it's a Promise (Next.js 14+)
    const awaitedParams =
      typeof params.then === "function" ? await params : params;
    const { id } = awaitedParams;
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        assignedAgent: true,
        createdByAgent: true,
        leadSource: true,
        comments: {
          include: {
            user: true,
            agent: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch prospect" },
      { status: 500 }
    );
  }
}

// PUT: Update a prospect by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Await params if it's a Promise (Next.js 14+)
    const awaitedParams =
      typeof params.then === "function" ? await params : params;
    const { id } = awaitedParams;
    const body = await req.json();
    const {
      name,
      email,
      phone,
      phoneNumber,
      address,
      leadSourceId,
      description,
      status,
      notes,
      nextFollowUp,
      assignedAgentId,
      amount,
    } = body;

    // If status is being set to 'Opportunity', create Opportunity and archive prospect
    if (status === "Opportunity") {
      try {
        // Get the current prospect data
        const prospect = await prisma.prospect.findUnique({ where: { id } });
        if (!prospect) {
          return NextResponse.json(
            { error: "Prospect not found" },
            { status: 404 }
          );
        }
        // Create Opportunity
        const opportunity = await prisma.opportunity.create({
          data: {
            name: name || prospect.name,
            phoneNumber: phoneNumber || prospect.phoneNumber,
            description: description || prospect.description,
            amount: typeof amount === "number" ? amount : 0,
            nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
            status: "Proposal Issued",
            prospectId: prospect.id,
          },
        });
        // Archive the prospect instead of deleting
        await prisma.prospect.update({
          where: { id },
          data: { archived: true, status: "Converted" },
        });
        return NextResponse.json({ opportunity, archivedProspectId: id });
      } catch (opportunityError) {
        console.error(
          "Error creating opportunity and archiving prospect:",
          opportunityError
        );
        return NextResponse.json(
          {
            error: "Failed to create opportunity or archive prospect",
            details: opportunityError?.message || opportunityError,
          },
          { status: 500 }
        );
      }
    }

    // Otherwise, just update the prospect
    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        phoneNumber,
        address,
        leadSourceId,
        description,
        status,
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgentId,
        amount: parseFloat(amount),
      },
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    console.error("Error in PUT /api/prospects/[id] route:", error);
    return NextResponse.json(
      { error: "Failed to update prospect", details: error?.message || error },
      { status: 500 }
    );
  }
}

// DELETE: Delete a prospect by ID
// POST: Add a comment to a prospect
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const awaitedParams =
      typeof params.then === "function" ? await params : params;
    const { id } = awaitedParams;
    const body = await req.json();
    const {
      content,
      attachmentName,
      attachmentUrl,
      attachmentSize,
      attachmentType,
    } = body;
    if (!content) {
      return NextResponse.json(
        { error: "Comment content required" },
        { status: 400 }
      );
    }
    const created = await prisma.comment.create({
      data: {
        content,
        attachmentName,
        attachmentUrl,
        attachmentSize,
        attachmentType,
        authorId: agent.id,
        authorType: "AGENT",
        prospectId: id,
      },
    });
    // Fetch the comment with agent/user relation for display
    const comment = await prisma.comment.findUnique({
      where: { id: created.id },
      include: {
        agent: true,
        user: true,
      },
    });
    return NextResponse.json({ comment });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add comment", details: error?.message || error },
      { status: 500 }
    );
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Await params if it's a Promise (Next.js 14+)
    const awaitedParams =
      typeof params.then === "function" ? await params : params;
    const { id } = awaitedParams;
    await prisma.prospect.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete prospect" },
      { status: 500 }
    );
  }
}
