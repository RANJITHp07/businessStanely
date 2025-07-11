import { NextRequest, NextResponse } from "next/server";
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    console.error(`Error fetching task ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updatedTask = await prisma.task.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error(`Error updating task ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.task.delete({
      where: { id: params.id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting task ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}