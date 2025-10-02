import prisma from "@/lib/prisma";

export interface RecurringTaskData {
  taskId: string;
  recurring: number; // months
  currentDueDate: Date;
  categoryTimePeriod?: number; // days
}

/**
 * Calculate the next due date based on recurring interval
 */
export function calculateNextDueDate(currentDueDate: Date, recurringMonths: number): Date {
  const nextDueDate = new Date(currentDueDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + recurringMonths);
  return nextDueDate;
}

/**
 * Calculate the start date based on due date and category time period
 */
export function calculateStartDate(dueDate: Date, timePeriodDays?: number): Date {
  if (!timePeriodDays) return dueDate;
  
  const startDate = new Date(dueDate);
  startDate.setDate(startDate.getDate() - timePeriodDays);
  return startDate;
}

/**
 * Create the next recurring task
 */
interface CreatedTask {
  id: string;
  title: string;
  dueDate: Date | null;
}

interface OriginalTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: Date | null;
  recurring: number | null;
  clientId: string | null;
  createdById: string | null;
  assignedToId: string | null;
  categoryId: string | null;
  legislationId: string | null;
  retainershipId: string | null;
}

export async function createNextRecurringTask(originalTask: OriginalTask): Promise<CreatedTask | null> {
  try {
    // Check if task has recurring setting and due date
    if (!originalTask.recurring || originalTask.recurring <= 0 || !originalTask.dueDate) {
      return null;
    }

    // Calculate next due date
    const currentDueDate = new Date(originalTask.dueDate);
    const nextDueDate = calculateNextDueDate(currentDueDate, originalTask.recurring);

    // Get category time period if available (for future use in calculating start dates)
    if (originalTask.categoryId) {
      const category = await prisma.taskCategory.findUnique({
        where: { id: originalTask.categoryId },
        select: { timePeriod: true }
      });
      const categoryTimePeriod = category?.timePeriod || 0;
      console.log(`Category time period: ${categoryTimePeriod} days`);
    }

    // Create new task with updated dates
    const newTask = await prisma.task.create({
      data: {
        title: originalTask.title,
        description: originalTask.description,
        status: "To Do",
        priority: originalTask.priority,
        dueDate: nextDueDate,
        progress: 0,
        followUpRequired: false,
        completed: false,
        recurring: originalTask.recurring,
        clientId: originalTask.clientId,
        createdById: originalTask.createdById,
        assignedToId: originalTask.assignedToId,
        categoryId: originalTask.categoryId,
        legislationId: originalTask.legislationId,
        retainershipId: originalTask.retainershipId,
      },
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
        legislation: true,
      }
    });

    console.log(`Created recurring task: ${newTask.id} with due date: ${nextDueDate.toISOString()}`);
    return newTask;

  } catch (error) {
    console.error("Error creating recurring task:", error);
    return null;
  }
}

/**
 * Check and create recurring tasks based on calendar dates (automatic creation)
 */
export async function processScheduledRecurringTasks(): Promise<void> {
  try {
    const today = new Date();
    console.log(`Processing scheduled recurring tasks for date: ${today.toISOString()}`);

    // Find all tasks with recurring settings (completed or not)
    const recurringTasks = await prisma.task.findMany({
      where: {
        recurring: { not: null },
        dueDate: { not: null },
      },
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
        legislation: true,
      }
    });

    for (const task of recurringTasks) {
      if (!task.dueDate || !task.recurring) continue;

      // Calculate when the next recurring task should be created
      const taskDueDate = new Date(task.dueDate);
      const nextDueDate = calculateNextDueDate(taskDueDate, task.recurring);
      
      // Get category time period for advance creation
      const categoryTimePeriod = task.category?.timePeriod || 0;
      
      // Calculate when to create the next task (category time period before due date)
      const creationDate = new Date(nextDueDate);
      creationDate.setDate(creationDate.getDate() - categoryTimePeriod);
      
      // If today is the creation date or after, and the task hasn't been created yet
      if (today >= creationDate) {
        // Check if next task already exists
        const existingNextTask = await prisma.task.findFirst({
          where: {
            title: task.title,
            clientId: task.clientId,
            assignedToId: task.assignedToId,
            dueDate: {
              gte: new Date(nextDueDate.getTime() - 12 * 60 * 60 * 1000), // 12 hours before
              lte: new Date(nextDueDate.getTime() + 12 * 60 * 60 * 1000), // 12 hours after
            }
          }
        });

        if (!existingNextTask) {
          const nextTask = await createNextRecurringTask(task);
          if (nextTask) {
            console.log(`Auto-created recurring task: ${nextTask.id} for ${nextDueDate.toLocaleDateString()}`);
          }
        }
      }
    }

  } catch (error) {
    console.error("Error processing scheduled recurring tasks:", error);
  }
}

/**
 * Check and create recurring tasks for completed tasks (manual completion trigger)
 */
export async function processRecurringTasks(): Promise<void> {
  try {
    // Find completed tasks that have recurring settings and haven't been processed yet
    const completedRecurringTasks = await prisma.task.findMany({
      where: {
        completed: true,
        recurring: { not: null },
      },
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
        legislation: true,
      }
    });

    for (const task of completedRecurringTasks) {
      // Check if next task already exists (simple duplicate prevention)
      const nextDueDate = calculateNextDueDate(new Date(task.dueDate!), task.recurring!);
      const existingNextTask = await prisma.task.findFirst({
        where: {
          title: task.title,
          clientId: task.clientId,
          assignedToId: task.assignedToId,
          dueDate: {
            gte: new Date(nextDueDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
            lte: new Date(nextDueDate.getTime() + 24 * 60 * 60 * 1000), // 1 day after
          }
        }
      });

      if (!existingNextTask) {
        await createNextRecurringTask(task);
      }
    }

  } catch (error) {
    console.error("Error processing recurring tasks:", error);
  }
}