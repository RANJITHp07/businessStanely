import { PrismaClient, Task } from "@prisma/client";

const prisma = new PrismaClient();

export interface TaskCreationData {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  categoryId?: string;
  assignedToId?: string;
  clientId?: string;
  dueDate?: Date;
  recurring?: number | null;
}

// Calculate end date based on recurring months
export function calculateEndDate(startDate: Date, recurringMonths: number): Date {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + recurringMonths);
  return endDate;
}

// Create recurring tasks based on task completion
export async function createNextRecurringTask(completedTask: Task) {
  if (!completedTask.recurring || completedTask.recurring <= 0) {
    return;
  }

  try {
    const nextDueDate = new Date(completedTask.dueDate || new Date());
    nextDueDate.setMonth(nextDueDate.getMonth() + completedTask.recurring);

    const nextTask = await prisma.task.create({
      data: {
        title: completedTask.title,
        description: completedTask.description,
        priority: completedTask.priority,
        status: "To Do",
        categoryId: completedTask.categoryId,
        assignedToId: completedTask.assignedToId,
        clientId: completedTask.clientId,
        dueDate: nextDueDate,
        recurring: completedTask.recurring,
      },
    });

    console.log("Created next recurring task:", nextTask);
    return nextTask;
  } catch (error) {
    console.error("Error creating recurring task:", error);
    throw error;
  }
}

// Create recurring tasks based on calendar schedule
export async function createCalendarBasedRecurringTasks() {
  try {
    // Get all tasks with recurring settings that are not completed
    const recurringTasks = await prisma.task.findMany({
      where: {
        recurring: {
          not: null,
          gt: 0,
        },
        status: {
          not: "Completed",
        },
      },
      include: {
        category: true,
      },
    });

    const today = new Date();
    const createdTasks = [];

    for (const task of recurringTasks) {
      if (!task.recurring) continue;

      // Calculate when the next task should be created
      const lastDueDate = new Date(task.dueDate || new Date());
      const nextDueDate = new Date(lastDueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + task.recurring);

      // Check if it's time to create the next recurring task
      const timeDiff = nextDueDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Create task 7 days before it's due (you can adjust this logic)
      if (daysDiff <= 7 && daysDiff > 0) {
        // Check if a task for this period already exists
        const existingTask = await prisma.task.findFirst({
          where: {
            title: task.title,
            dueDate: {
              gte: new Date(nextDueDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
              lte: new Date(nextDueDate.getTime() + 24 * 60 * 60 * 1000), // 1 day after
            },
            assignedToId: task.assignedToId,
            clientId: task.clientId,
          },
        });

        if (!existingTask) {
          const newTask = await prisma.task.create({
            data: {
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: "To Do",
              categoryId: task.categoryId,
              assignedToId: task.assignedToId,
              clientId: task.clientId,
              dueDate: nextDueDate,
              recurring: task.recurring,
            },
          });

          createdTasks.push(newTask);
          console.log("Created calendar-based recurring task:", newTask);
        }
      }
    }

    return createdTasks;
  } catch (error) {
    console.error("Error creating calendar-based recurring tasks:", error);
    throw error;
  }
}

// Get display dates for recurring tasks
export function getRecurringDateRange(dueDate: Date, recurring: number | null, categoryTimePeriod: number | null): { start: Date; end: Date } {
  const start = new Date(dueDate);
  const end = new Date(dueDate);
  
  if (recurring && recurring > 0) {
    // Use recurring months
    end.setMonth(end.getMonth() + recurring);
  } else if (categoryTimePeriod && categoryTimePeriod > 0) {
    // Use category time period as fallback
    end.setMonth(end.getMonth() + categoryTimePeriod);
  } else {
    // Default to 1 month if no period specified
    end.setMonth(end.getMonth() + 1);
  }
  
  return { start, end };
}

const recurringTasks = {
  calculateEndDate,
  createNextRecurringTask,
  createCalendarBasedRecurringTasks,
  getRecurringDateRange,
};

export default recurringTasks;