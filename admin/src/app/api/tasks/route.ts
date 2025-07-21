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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assignedToId = searchParams.get('assignedToId');
    const clientId = searchParams.get('clientId');

    // Build the where clause based on query parameters
    const whereClause: Prisma.TaskWhereInput = {};
    
    if (assignedToId) {
      whereClause.assignedToId = assignedToId;
    }
    
    if (clientId) {
      whereClause.clientId = clientId;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}