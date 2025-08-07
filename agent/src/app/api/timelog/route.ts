import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { taskId, date, hours, description } = await req.json();

    // Validate required fields
    if (!taskId || !date || !hours || !description) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate hours is a positive number
    const hoursFloat = parseFloat(hours);
    if (isNaN(hoursFloat) || hoursFloat <= 0) {
      return NextResponse.json(
        { error: "Hours must be a positive number" },
        { status: 400 }
      );
    }

    // Verify the task exists and agent has access
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: agent.id },
          { assignedToId: agent.id },
        ],
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 }
      );
    }

    // Create the time log entry
    const timeLog = await prisma.timeLog.create({
      data: {
        taskId,
        agentId: agent.id,
        date: new Date(date),
        hours: hoursFloat,
        description,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Time log created successfully",
      timeLog,
    });
  } catch (error) {
    console.error("Error creating time log:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    // Verify the task exists and agent has access
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: agent.id },
          { assignedToId: agent.id },
        ],
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 }
      );
    }

    // Fetch time logs for the task
    const timeLogs = await prisma.timeLog.findMany({
      where: { taskId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    // Calculate total hours
    const totalHours = timeLogs.reduce((sum: number, log) => sum + log.hours, 0);

    return NextResponse.json({
      timeLogs,
      totalHours,
    });
  } catch (error) {
    console.error("Error fetching time logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
