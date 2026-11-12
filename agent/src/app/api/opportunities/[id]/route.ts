import { AGENT_SECRET_FIELDS, USER_SECRET_FIELDS } from "@/lib/agentSecretFields";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  recordDeletionAudit,
  actorFromAgent,
  softDeleteData,
} from "@/lib/audit";

const isClosedStatus = (status?: string | null) =>
  status === "Closed as Won" || status === "Closed as Loss";

/** closedAt for a status change: stamped on entering a closed status, cleared on reopening. */
const closedAtFor = (
  nextStatus: string | undefined,
  previousStatus: string | null | undefined,
) => {
  if (!nextStatus || nextStatus === previousStatus) return undefined;
  return isClosedStatus(nextStatus) ? new Date() : null;
};

// GET: Get a single opportunity by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    // Fetch the opportunity with its prospect and comments
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        prospect: {
          include: {
            leadSource: true,
            createdByAgent: { omit: AGENT_SECRET_FIELDS },
            assignedAgent: { omit: AGENT_SECRET_FIELDS },
            comments: {
              include: {
                user: { omit: USER_SECRET_FIELDS },
                agent: { omit: AGENT_SECRET_FIELDS },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        comments: {
          include: {
            user: { omit: USER_SECRET_FIELDS },
            agent: { omit: AGENT_SECRET_FIELDS },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }
    // Merge comments from prospect and opportunity, sort by createdAt desc
    const prospectComments = opportunity.prospect?.comments || [];
    const opportunityComments = opportunity.comments || [];
    const allComments = [...prospectComments, ...opportunityComments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    // Return opportunity with merged comments
    return NextResponse.json({
      opportunity: {
        ...opportunity,
        comments: allComments,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunity" },
      { status: 500 },
    );
  }
}

// PUT: Update an opportunity by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      phoneNumber,
      description,
      amount,
      nextFollowUp,
      status,
      quote,
    } = body;
    const opp = await prisma.opportunity.findUnique({
      where: {
        id,
      },
    });
    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        name,
        phoneNumber,
        description,
        amount,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        prevFollowup:
          nextFollowUp && opp?.nextFollowUp ? opp?.nextFollowUp : undefined,
        status,
        closedAt: closedAtFor(status, opp?.status),
        quote,
      },
    });
    return NextResponse.json({ opportunity });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update opportunity" },
      { status: 500 },
    );
  }
}

// DELETE: Delete an opportunity by ID
// POST: Add a comment to an opportunity
import { getCurrentAgent } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const {
      content,
      attachmentName,
      attachmentUrl,
      attachmentSize,
      attachmentType,
      attachments,
      commentDate,
      startTime,
      endTime,
    } = body;
    if (!content) {
      return NextResponse.json(
        { error: "Comment content required" },
        { status: 400 },
      );
    }
    const created = await prisma.comment.create({
      data: {
        content,
        attachmentName,
        attachmentUrl,
        attachmentSize,
        attachmentType,
        ...(attachments && Array.isArray(attachments) && attachments.length > 0
          ? { attachments }
          : {}),
        commentDate: commentDate ? new Date(commentDate) : null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        authorId: agent.id,
        authorType: "AGENT",
        opportunityId: id,
      },
    });
    // Fetch the comment with agent/user relation for display
    const comment = await prisma.comment.findUnique({
      where: { id: created.id },
      include: {
        agent: { omit: AGENT_SECRET_FIELDS },
        user: { omit: USER_SECRET_FIELDS },
      },
    });
    return NextResponse.json({ comment });
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

    const { id } = await params;

    const existing = await prisma.opportunity.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }

    const actor = actorFromAgent(agent);

    await prisma.opportunity.update({
      where: { id },
      data: softDeleteData(actor),
    });

    await recordDeletionAudit({
      entityType: "Opportunity",
      entityId: id,
      entityName: existing.name,
      actor,
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete opportunity" },
      { status: 500 },
    );
  }
}
