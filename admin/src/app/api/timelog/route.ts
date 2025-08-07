import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

// POST: Create a new time log (admin can create for any agent/task)
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { taskId, agentId, date, hours, description } = await req.json();
    if (!taskId || !agentId || !date || !hours || !description) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    const hoursFloat = parseFloat(hours);
    if (isNaN(hoursFloat) || hoursFloat <= 0) {
      return NextResponse.json({ error: "Hours must be a positive number" }, { status: 400 });
    }
    // Verify the task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    // Verify the agent exists
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const timeLog = await prisma.timeLog.create({
      data: {
        taskId,
        agentId,
        date: new Date(date),
        hours: hoursFloat,
        description,
      },
      include: {
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
    return NextResponse.json({ message: "Time log created successfully", timeLog });
  } catch (error) {
    console.error("Error creating time log:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: Fetch all time logs for a task (admin can view all)
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }
    // Verify the task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    // Fetch time logs for the task
    const timeLogs = await prisma.timeLog.findMany({
      where: { taskId },
      include: {
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
        date: "desc",
      },
    });
    const totalHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);
    return NextResponse.json({ timeLogs, totalHours });
  } catch (error) {
    console.error("Error fetching time logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
