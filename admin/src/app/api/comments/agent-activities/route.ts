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
    // Find all comments made by this agent, include task info
    const comments = await prisma.comment.findMany({
      where: { authorId: agentId, authorType: "AGENT" },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        prospect: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    // Format for activities tab
    const activities = comments.map((comment) => ({
      taskId:
        comment.task?.id ||
        comment.prospect?.id ||
        comment.opportunity?.id ||
        null,
      taskTitle:
        comment.task?.title ||
        comment?.prospect?.name ||
        comment?.opportunity?.name ||
        "Unknown Task",
      content: comment.content,
      createdAt: comment.createdAt,
    }));
    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching agent activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent activities" },
      { status: 500 },
    );
  }
}
