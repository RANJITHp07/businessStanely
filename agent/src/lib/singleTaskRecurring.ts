import prisma from '@/lib/prisma';

// Calculate next due date based on recurring months
export function calculateNextDueDate(currentDate: Date, recurringMonths: number): Date {
  const nextDate = new Date(currentDate);
  nextDate.setMonth(nextDate.getMonth() + recurringMonths);
  return nextDate;
}

// Auto-update recurring tasks based on calendar schedule (not completion)
export async function updateRecurringTaskSchedule(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task || !task.recurring || !task.dueDate) {
    return null; // Not a recurring task or no due date
  }

  const now = new Date();
  const taskDueDate = new Date(task.dueDate);
  
  // Check if the current period has passed
  if (now > taskDueDate) {
    // Calculate how many periods have passed
    const monthsDiff = (now.getFullYear() - taskDueDate.getFullYear()) * 12 + 
                      (now.getMonth() - taskDueDate.getMonth());
    
    const periodsPassed = Math.floor(monthsDiff / task.recurring);
    
    if (periodsPassed > 0) {
      // Calculate new due date by adding the required periods
      const newDueDate = new Date(taskDueDate);
      newDueDate.setMonth(newDueDate.getMonth() + (periodsPassed + 1) * task.recurring);
      
      // Update task with new due date and reset status
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          dueDate: newDueDate,
          nextDueDate: newDueDate as Date,
          currentPeriodStart: now as Date,
          completed: false, // Reset for new period
          progress: 0, // Reset progress
          status: 'To Do', // Reset status
        },
      });

      console.log(`🔄 Auto-updated recurring task. New due date: ${newDueDate.toISOString()}`);
      return updatedTask;
    }
  }

  return task; // No update needed
}

// Update due dates for tasks in "Hold" status
export async function updateHoldTasks() {
  const holdTasks = await prisma.task.findMany({
    where: {
      status: "Hold",
      dueDate: { not: null },
    },
  });

  const updatedTasks = [];

  for (const task of holdTasks) {
    try {
      if (!task.dueDate) continue; // Ensure dueDate is not null

      const currentDate = new Date();
      const dueDate = new Date(task.dueDate);

      // Extend due date by 1 day if the task is still on "Hold"
      if (currentDate >= dueDate) {
        const newDueDate = new Date(dueDate);
        newDueDate.setDate(newDueDate.getDate() + 1);

        const updatedTask = await prisma.task.update({
          where: { id: task.id },
          data: { dueDate: newDueDate },
        });

        updatedTasks.push(updatedTask);
      }
    } catch (error) {
      console.error(`Error updating hold task ${task.id}:`, error);
    }
  }

  console.log(`📅 Auto-updated ${updatedTasks.length} tasks in "Hold" status.`);
  return updatedTasks;
}

// Check and update overdue recurring tasks
export async function updateAllRecurringTasks() {
  // Find all active recurring tasks
  const recurringTasks = await prisma.task.findMany({
    where: {
      recurring: { not: null },
      dueDate: { not: null },
    },
  });

  const updatedTasks = [];

  for (const task of recurringTasks) {
    try {
      // Auto-update each recurring task based on calendar schedule
      const updatedTask = await updateRecurringTaskSchedule(task.id);
      
      if (updatedTask && updatedTask.id !== task.id) {
        // Task was updated
        updatedTasks.push(updatedTask);
      }
    } catch (error) {
      console.error(`Error updating recurring task ${task.id}:`, error);
    }
  }

  const holdTasks = await updateHoldTasks();
  updatedTasks.push(...holdTasks);

  console.log(`📅 Auto-updated ${updatedTasks.length} tasks (recurring + hold).`);
  return updatedTasks;
}

// Initialize recurring task fields when task is created with recurring
export async function initializeRecurringTask(taskId: string, recurringMonths: number, dueDate: Date) {
  const currentPeriodStart = new Date();
  
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      currentPeriodStart: currentPeriodStart as Date,
      nextDueDate: dueDate as Date,
    },
  });

  console.log(`🔄 Initialized recurring task. First due: ${dueDate.toISOString()}`);
  return updatedTask;
}

// Get recurring task status info
export function getRecurringTaskStatus(task: {
  recurring?: number | null;
  nextDueDate?: Date | null;
  completed?: boolean;
  currentPeriodStart?: Date | null;
  lastCompletedDate?: Date | null;
  completionHistory?: unknown;
}) {
  if (!task.recurring) {
    return {
      isRecurring: false,
      currentPeriod: null,
      nextDue: null,
      completionCount: 0,
      isOverdue: false,
    };
  }

  const now = new Date();
  const completionHistory = Array.isArray(task.completionHistory) ? task.completionHistory : [];
  const nextDue = task.nextDueDate ? new Date(task.nextDueDate) : null;
  const isOverdue = nextDue ? now > nextDue && !task.completed : false;

  return {
    isRecurring: true,
    currentPeriod: task.currentPeriodStart ? new Date(task.currentPeriodStart) : null,
    nextDue,
    completionCount: completionHistory.length,
    isOverdue,
    lastCompleted: task.lastCompletedDate ? new Date(task.lastCompletedDate) : null,
  };
}