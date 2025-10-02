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

// Create recurring tasks based on calendar schedule - IMPROVED VERSION
export async function createCalendarBasedRecurringTasks() {
  try {
    const today = new Date();
    const createdTasks = [];
    
    // Get all completed recurring tasks that might need next iteration
    const completedRecurringTasks = await prisma.task.findMany({
      where: {
        recurring: {
          not: null,
          gt: 0,
        },
        status: "Completed",
        completed: true,
      },
      include: {
        category: true,
      },
      orderBy: {
        updatedAt: 'desc', // Get most recently completed first
      },
    });

    console.log(`Found ${completedRecurringTasks.length} completed recurring tasks to check`);

    for (const completedTask of completedRecurringTasks) {
      if (!completedTask.recurring || !completedTask.dueDate) continue;

      // Calculate when the next task should be due
      const originalDueDate = new Date(completedTask.dueDate);
      const nextDueDate = new Date(originalDueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + completedTask.recurring);

      // Only create if the next due date is in the future or within the current month
      if (nextDueDate <= today) {
        // Check if we already created a task for this next period
        const existingNextTask = await prisma.task.findFirst({
          where: {
            title: completedTask.title,
            categoryId: completedTask.categoryId,
            assignedToId: completedTask.assignedToId,
            clientId: completedTask.clientId,
            dueDate: {
              gte: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), 1), // Start of month
              lte: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0), // End of month
            },
            recurring: completedTask.recurring,
          },
        });

        if (!existingNextTask) {
          // Create the next recurring task
          const newTask = await prisma.task.create({
            data: {
              title: completedTask.title,
              description: completedTask.description,
              priority: completedTask.priority,
              status: "To Do",
              categoryId: completedTask.categoryId,
              assignedToId: completedTask.assignedToId,
              clientId: completedTask.clientId,
              createdById: completedTask.createdById,
              dueDate: nextDueDate,
              recurring: completedTask.recurring,
              progress: 0,
              completed: false,
              followUpRequired: completedTask.followUpRequired,
            },
          });

          createdTasks.push(newTask);
          console.log(`Created recurring task: "${newTask.title}" due ${nextDueDate.toISOString().split('T')[0]}`);
        } else {
          console.log(`Task already exists for period: "${completedTask.title}" - ${nextDueDate.toISOString().split('T')[0]}`);
        }
      }
    }

    // Also check for overdue recurring tasks (missed cycles)
    const overdueRecurringTasks = await checkForOverdueRecurringTasks();
    createdTasks.push(...overdueRecurringTasks);

    return createdTasks;
  } catch (error) {
    console.error("Error creating calendar-based recurring tasks:", error);
    throw error;
  }
}

// Helper function to check for missed recurring cycles
async function checkForOverdueRecurringTasks() {
  try {
    const today = new Date();
    const createdTasks = [];
    
    // Find the latest completed task for each recurring pattern
    const recurringPatterns = await prisma.task.groupBy({
      by: ['title', 'categoryId', 'assignedToId', 'clientId', 'recurring'],
      where: {
        recurring: {
          not: null,
          gt: 0,
        },
        status: "Completed",
      },
      _max: {
        dueDate: true,
      },
    });

    for (const pattern of recurringPatterns) {
      if (!pattern.recurring || !pattern._max.dueDate) continue;

      const lastDueDate = new Date(pattern._max.dueDate);
      const monthsSinceLastTask = Math.floor((today.getTime() - lastDueDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      // If more than the recurring period has passed, create missing tasks
      if (monthsSinceLastTask >= pattern.recurring) {
        const missedCycles = Math.floor(monthsSinceLastTask / pattern.recurring);
        
        // Get the original task details
        const originalTask = await prisma.task.findFirst({
          where: {
            title: pattern.title,
            categoryId: pattern.categoryId,
            assignedToId: pattern.assignedToId,
            clientId: pattern.clientId,
            recurring: pattern.recurring,
          },
        });

        if (originalTask) {
          // Create only the most recent missed cycle (not all of them to avoid spam)
          const nextDueDate = new Date(lastDueDate);
          nextDueDate.setMonth(nextDueDate.getMonth() + pattern.recurring);

          // Check if this task already exists
          const existingTask = await prisma.task.findFirst({
            where: {
              title: pattern.title,
              categoryId: pattern.categoryId,
              assignedToId: pattern.assignedToId,
              clientId: pattern.clientId,
              dueDate: {
                gte: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), 1),
                lte: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0),
              },
            },
          });

          if (!existingTask) {
            const newTask = await prisma.task.create({
              data: {
                title: originalTask.title,
                description: originalTask.description,
                priority: originalTask.priority,
                status: "To Do",
                categoryId: originalTask.categoryId,
                assignedToId: originalTask.assignedToId,
                clientId: originalTask.clientId,
                createdById: originalTask.createdById,
                dueDate: nextDueDate,
                recurring: originalTask.recurring,
                progress: 0,
                completed: false,
                followUpRequired: originalTask.followUpRequired,
              },
            });

            createdTasks.push(newTask);
            console.log(`Created overdue recurring task: "${newTask.title}" (${missedCycles} cycles missed)`);
          }
        }
      }
    }

    return createdTasks;
  } catch (error) {
    console.error("Error checking overdue recurring tasks:", error);
    return [];
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