import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Get statistics about recurring tasks
    const recurringTasksCount = await prisma.task.count({
      where: {
        recurring: {
          not: null,
          gt: 0,
        },
      },
    });

    const completedRecurringTasks = await prisma.task.count({
      where: {
        recurring: {
          not: null,
          gt: 0,
        },
        status: "Completed",
      },
    });

    const activeRecurringTasks = await prisma.task.count({
      where: {
        recurring: {
          not: null,
          gt: 0,
        },
        status: {
          not: "Completed",
        },
      },
    });

    // Get upcoming recurring tasks that might need to be created soon
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const upcomingRecurringTasks = await prisma.task.findMany({
      where: {
        recurring: {
          not: null,
          gt: 0,
        },
        status: {
          not: "Completed",
        },
        dueDate: {
          lte: nextWeek,
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    return NextResponse.json({
      summary: {
        totalRecurringTasks: recurringTasksCount,
        completedRecurringTasks: completedRecurringTasks,
        activeRecurringTasks: activeRecurringTasks,
      },
      upcomingTasks: upcomingRecurringTasks,
      message: "Recurring tasks summary",
    });
  } catch (error) {
    console.error("Error fetching recurring tasks summary:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch recurring tasks summary",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}