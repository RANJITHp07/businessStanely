import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/comments/agent-activities?agentId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 },
      );
    }
    // Find all comments made by this agent, with whatever record each was left on
    const comments = await prisma.comment.findMany({
      where: { authorId: agentId, authorType: "AGENT" },
      include: {
        task: { select: { id: true, title: true } },
        prospect: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
        enquiry: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    // Format for activities tab. A comment belongs to exactly one record, and
    // the page needs its type to link to the right detail route.
    const activities = comments.map((comment) => {
      const target = comment.task
        ? { type: "task", id: comment.task.id, title: comment.task.title }
        : comment.prospect
          ? { type: "prospect", id: comment.prospect.id, title: comment.prospect.name }
          : comment.opportunity
            ? { type: "opportunity", id: comment.opportunity.id, title: comment.opportunity.name }
            : comment.enquiry
              ? { type: "enquiry", id: comment.enquiry.id, title: comment.enquiry.name }
              : null;
      return {
        entityType: target?.type ?? null,
        entityId: target?.id ?? null,
        entityTitle: target?.title ?? null,
        content: comment.content,
        createdAt: comment.createdAt,
      };
    });
    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching agent activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent activities" },
      { status: 500 },
    );
  }
}
