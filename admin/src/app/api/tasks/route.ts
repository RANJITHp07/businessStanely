import { NextRequest, NextResponse } from "next/server";
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, status, priority, dueDate, clientId, createdById, assignedToId } = body;

    if (!title || !createdById) {
      return NextResponse.json({ error: "Title and createdById are required" }, { status: 400 });
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        dueDate,
        clientId,
        createdById,
        assignedToId,
      },
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
    }
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
      },
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}