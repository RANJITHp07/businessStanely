import { NextRequest, NextResponse } from "next/server";
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

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
      attachmentType 
    } = body;

    if (!content || !taskId || !authorId) {
      return NextResponse.json({ error: "Content, taskId, and authorId are required" }, { status: 400 });
    }

    const commentData: Prisma.CommentCreateInput = {
      content,
      task: { connect: { id: taskId } },
      author: { connect: { id: authorId } },
    };

    // Add attachment fields if they exist
    if (attachmentName) {
      commentData.attachmentName = attachmentName;
      commentData.attachmentUrl = attachmentUrl;
      commentData.attachmentSize = attachmentSize;
      commentData.attachmentType = attachmentType;
    }

    const newComment = await prisma.comment.create({
      data: commentData,
      include: {
        author: {
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
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}
