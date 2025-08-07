import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: timeLogId } = await params;
    const { date, hours, description } = await req.json();

    // Validate required fields
    if (!date || !hours || !description) {
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

    // Verify the time log exists and belongs to the agent
    const existingTimeLog = await prisma.timeLog.findFirst({
      where: {
        id: timeLogId,
        agentId: agent.id,
      },
    });

    if (!existingTimeLog) {
      return NextResponse.json(
        { error: "Time log not found or access denied" },
        { status: 404 }
      );
    }

    // Update the time log
    const updatedTimeLog = await prisma.timeLog.update({
      where: { id: timeLogId },
      data: {
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
      message: "Time log updated successfully",
      timeLog: updatedTimeLog,
    });
  } catch (error) {
    console.error("Error updating time log:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: timeLogId } = await params;

    // Verify the time log exists and belongs to the agent
    const existingTimeLog = await prisma.timeLog.findFirst({
      where: {
        id: timeLogId,
        agentId: agent.id,
      },
    });

    if (!existingTimeLog) {
      return NextResponse.json(
        { error: "Time log not found or access denied" },
        { status: 404 }
      );
    }

    // Delete the time log
    await prisma.timeLog.delete({
      where: { id: timeLogId },
    });

    return NextResponse.json({
      message: "Time log deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting time log:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
