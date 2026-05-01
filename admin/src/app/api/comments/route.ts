import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { deleteFromS3 } from "@/lib/aws";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      content,
      taskId,
      authorId,
      attachmentName,
      attachmentUrl,
      attachmentSize,
      attachmentType,
      attachments,
      commentDate,
      startTime,
      endTime,
    } = body;

    if (!content || !taskId || !authorId) {
      return NextResponse.json(
        { error: "Content, taskId, and authorId are required" },
        { status: 400 },
      );
    }

    // First check if it's a user or agent
    const user = await prisma.user.findUnique({
      where: { id: authorId },
    });

    const agent = await prisma.agent.findUnique({
      where: { id: authorId },
    });

    if (!user && !agent) {
      return NextResponse.json(
        { error: "Invalid authorId. No user or agent found with this ID." },
        { status: 404 },
      );
    }

    const commentData: Prisma.CommentCreateInput = {
      content,
      task: { connect: { id: taskId } },
      authorType: user ? "USER" : "AGENT",
      ...(user
        ? { user: { connect: { id: authorId } } }
        : { agent: { connect: { id: authorId } } }),
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

    // Check if task is in "To Do" status and change it to "In Progress"
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });

    if (task && task.status === "To Do") {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "In Progress" },
      });
    }

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
    }
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 },
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
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 },
      );
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

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
