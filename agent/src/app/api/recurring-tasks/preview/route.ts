import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import { calculateNextDueDate } from "@/lib/recurringTasks";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    
    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const today = new Date();
    
    // Find all recurring tasks that could potentially create new instances
    const recurringTasks = await prisma.task.findMany({
      where: {
        recurring: { not: null },
        dueDate: { not: null },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            timePeriod: true,
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            clientType: true,
          }
        }
      }
    });

    const analysis = recurringTasks.map(task => {
      if (!task.dueDate || !task.recurring) return null;

      const taskDueDate = new Date(task.dueDate);
      const nextDueDate = calculateNextDueDate(taskDueDate, task.recurring);
      const categoryTimePeriod = task.category?.timePeriod || 0;
      
      const creationDate = new Date(nextDueDate);
      creationDate.setDate(creationDate.getDate() - categoryTimePeriod);
      
      const shouldCreate = today >= creationDate;
      
      return {
        taskId: task.id,
        title: task.title,
        currentDueDate: taskDueDate.toLocaleDateString('en-GB'),
        nextDueDate: nextDueDate.toLocaleDateString('en-GB'),
        recurringMonths: task.recurring,
        categoryTimePeriod,
        creationDate: creationDate.toLocaleDateString('en-GB'),
        shouldCreateToday: shouldCreate,
        client: task.client?.clientType === 'individual' 
          ? `${task.client.firstName} ${task.client.lastName}` 
          : task.client?.organizationName
      };
    }).filter(Boolean);

    return NextResponse.json({
      message: "Recurring tasks analysis",
      today: today.toLocaleDateString('en-GB'),
      totalRecurringTasks: analysis.length,
      tasksToCreateToday: analysis.filter(t => t?.shouldCreateToday).length,
      tasks: analysis
    });

  } catch (error) {
    console.error("Error analyzing recurring tasks:", error);
    return NextResponse.json(
      { error: "Failed to analyze recurring tasks" },
      { status: 500 }
    );
  }
}