import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/aws";

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      content,
      taskId,
      attachmentName,
      attachmentUrl,
      attachmentSize,
      attachmentType,
      attachments,
      commentDate,
      startTime,
      endTime,
    } = body;

    if (!content || !taskId) {
      return NextResponse.json(
        { error: "Content and taskId are required" },
        { status: 400 },
      );
    }

    // Verify the task exists and agent has access to it (creator, assigned, or superior of assigned)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { createdById: true, assignedToId: true, status: true },
    });

    if (task && task.status === "To Do") {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "In Progress" },
      });
    }

    let isAuthorized = false;
    if (task?.createdById === agent.id || task?.assignedToId === agent.id) {
      isAuthorized = true;
    } else if (task?.assignedToId) {
      // Check if agent is a superior of the assigned agent
      const superiorLink = await prisma.agentSuperior.findFirst({
        where: {
          superiorId: agent.id,
          subordinateId: task.assignedToId,
        },
      });
      if (superiorLink) isAuthorized = true;
    }
    if (!task || !isAuthorized) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 },
      );
    }

    const commentData: Prisma.CommentCreateInput = {
      content,
      task: { connect: { id: taskId } },
      authorType: "AGENT",
      agent: { connect: { id: agent.id } },
    };

    if (attachmentName) {
      commentData.attachmentName = attachmentName;
      commentData.attachmentUrl = attachmentUrl;
      commentData.attachmentSize = attachmentSize;
      commentData.attachmentType = attachmentType;
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      (commentData as any).attachments = attachments;
    }

    // Add timesheet fields if provided
    if (commentDate) {
      commentData.commentDate = new Date(commentDate);
    }
    if (startTime) {
      commentData.startTime = new Date(startTime);
    }
    if (endTime) {
      commentData.endTime = new Date(endTime);
    }

    const newComment = await prisma.comment.create({
      data: commentData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
    }
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 },
      );
    }

    // Verify the task exists and agent has access to it
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [{ createdById: agent.id }, { assignedToId: agent.id }],
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 },
      );
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 },
      );
    }

    // Find the comment and verify it belongs to the current agent
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: true,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify the agent has access to this comment (either they created it or have access to the task)
    const hasAccess =
      (comment.authorType === "AGENT" && comment.authorId === agent.id) ||
      comment.task.createdById === agent.id ||
      comment.task.assignedToId === agent.id;

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete attachment from S3 if exists
    if (comment.attachmentUrl) {
      try {
        await deleteFromS3(comment.attachmentUrl);
      } catch (error) {
        console.error("Error deleting file from S3:", error);
      }
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 },
    );
  }
}
