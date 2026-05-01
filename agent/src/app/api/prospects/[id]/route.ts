import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

// GET: Get a single prospect by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
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
        { status: 404 },
      );
    }
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch prospect" },
      { status: 500 },
    );
  }
}

// PUT: Update a prospect by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);
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
      dialCode,
      nextFollowUp,
      assignedAgentId,
      assignedTo,
      amount,
      service,
      quote,
    } = body;

    let prospect = await prisma.prospect.findUnique({ where: { id } });
    // If status is being set to 'Opportunity', create Opportunity and archive prospect
    if (status === "Opportunity") {
      try {
        // Get the current prospect data
        if (!prospect) {
          return NextResponse.json(
            { error: "Prospect not found" },
            { status: 404 },
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
            prevFollowup:
              nextFollowUp && prospect?.nextFollowUp
                ? prospect?.nextFollowUp
                : undefined,
            quote: quote || "",
            status: quote ? "Proposal Issued" : "New Opportunity",
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
          opportunityError,
        );
        return NextResponse.json(
          {
            error: "Failed to create opportunity or archive prospect",
            details: opportunityError?.message || opportunityError,
          },
          { status: 500 },
        );
      }
    }

    // Otherwise, just update the prospect
    prospect = await prisma.prospect.update({
      where: { id },
      data: {
        name,
        email,
        dialCode,
        phoneNumber,
        address,
        ...(leadSourceId && {
          leadSource: {
            connect: {
              id: leadSourceId,
            },
          },
        }),
        description,
        status,
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        prevFollowup:
          nextFollowUp && prospect?.nextFollowUp
            ? prospect?.nextFollowUp
            : undefined,
        assignedAgent: {
          connect: { id: assignedAgentId || assignedTo },
        },
        amount: parseFloat(amount),
        ...(service && {
          service,
        }),
      },
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    console.error("Error in PUT /api/prospects/[id] route:", error);
    return NextResponse.json(
      { error: "Failed to update prospect", details: error?.message || error },
      { status: 500 },
    );
  }
}

// DELETE: Delete a prospect by ID
// POST: Add a comment to a prospect
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);
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
      attachments,
    } = body;
    if (!content) {
      return NextResponse.json(
        { error: "Comment content required" },
        { status: 400 },
      );
    }
    const result = await prisma.$transaction(async (tx) => {
      const [prospect, existingCommentsCount] = await Promise.all([
        tx.prospect.findUnique({
          where: { id },
          select: { status: true },
        }),
        tx.comment.count({ where: { prospectId: id } }),
      ]);

      const newComment = await tx.comment.create({
        data: {
          content,
          attachmentName,
          attachmentUrl,
          attachmentSize,
          attachmentType,
          ...(attachments &&
          Array.isArray(attachments) &&
          attachments.length > 0
            ? { attachments }
            : {}),
          authorId: agent.id,
          authorType: "AGENT",
          prospectId: id,
        },
      });

      if (prospect?.status === "New" && existingCommentsCount === 0) {
        await tx.prospect.update({
          where: { id },
          data: { status: "In Progress" },
        });
      }

      const nextStatus =
        prospect?.status === "New" && existingCommentsCount === 0
          ? "In Progress"
          : (prospect?.status ?? null);

      return { newComment, nextStatus };
    });
    // Fetch the comment with agent/user relation for display
    const comment = await prisma.comment.findUnique({
      where: { id: result.newComment.id },
      include: {
        agent: true,
        user: true,
      },
    });
    return NextResponse.json({ comment, prospectStatus: result.nextStatus });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add comment", details: error?.message || error },
      { status: 500 },
    );
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);
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
      { status: 500 },
    );
  }
}
