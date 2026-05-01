import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

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
            createdByAgent: true,
            assignedAgent: true,
            comments: {
              include: {
                user: true,
                agent: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        comments: {
          include: {
            user: true,
            agent: true,
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
    const { name, phoneNumber, description, amount, nextFollowUp, status } =
      body;
    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        name,
        phoneNumber,
        description,
        amount,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        status,
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
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
        authorId: admin.id,
        authorType: "ADMIN",
        opportunityId: id,
      },
    });
    // Fetch the comment with admin/user relation for display
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
      { error: "Failed to add comment", details: error },
      { status: 500 },
    );
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    await prisma.opportunity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete opportunity" },
      { status: 500 },
    );
  }
}
