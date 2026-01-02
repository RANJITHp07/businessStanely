import prisma from "@/lib/prisma";

// Calculate next due date based on recurring months
export function calculateNextDueDate(
  currentDate: Date,
  recurringMonths: number
): Date {
  const nextDate = new Date(currentDate);
  nextDate.setMonth(nextDate.getMonth() + recurringMonths);
  return nextDate;
}

// Auto-update recurring tasks based on calendar schedule (not completion)
export async function updateRecurringTaskSchedule(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { category: true },
  });

  if (
    !task ||
    !task.recurring ||
    !task.recurringType ||
    !task.triggerDate ||
    !task.category?.timePeriod
  ) {
    return null;
  }

  const now = new Date();
  const triggerDate = new Date(task.triggerDate);

  // Only update if today is the trigger date
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (triggerDate < startOfToday || triggerDate >= startOfTomorrow) {
    // Not trigger date yet
    return null;
  }

  // Step 1: dueDate = triggerDate + taskCategoryTime
  const dueDate = new Date(triggerDate);
  dueDate.setDate(dueDate.getDate() + task.category?.timePeriod);

  // Step 2: nextDueDate = triggerDate + recurring interval
  const nextTriggerDate = new Date(triggerDate);
  switch (task.recurringType) {
    case "DAY":
      nextTriggerDate.setDate(nextTriggerDate.getDate() + task.recurring);
      break;
    case "WEEK":
      nextTriggerDate.setDate(nextTriggerDate.getDate() + task.recurring * 7);
      break;
    case "MONTH":
      nextTriggerDate.setMonth(nextTriggerDate.getMonth() + task.recurring);
      break;
    default:
      return null;
  }

  // Step 3: Update the task
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueDate,
      nextDueDate: nextTriggerDate,
      triggerDate: nextTriggerDate,
      currentPeriodStart: triggerDate,
      completed: false,
      progress: 0,
      status: "To Do",
    },
  });

  console.log(
    `🔄 Recurring task triggered → triggerDate: ${triggerDate.toISOString()}, dueDate: ${dueDate.toISOString()}, nextDueDate: ${nextTriggerDate.toISOString()}`
  );

  return updatedTask;
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

// Extend updateAllRecurringTasks to include "Hold" tasks
export async function updateAllRecurringTasks() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  // Find all active recurring tasks
  const recurringTasks = await prisma.task.findMany({
    where: {
      recurring: { not: null },
      recurringType: { not: null },
      dueDate: { not: null },
      triggerDate: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
    },
  });

  const updatedTasks = [];

  for (const task of recurringTasks) {
    try {
      const updatedTask = await updateRecurringTaskSchedule(task.id);
      if (updatedTask && updatedTask.id !== task.id) {
        updatedTasks.push(updatedTask);
      }
    } catch (error) {
      console.error(`Error updating recurring task ${task.id}:`, error);
    }
  }

  const holdTasks = await updateHoldTasks();
  updatedTasks.push(...holdTasks);

  console.log(
    `📅 Auto-updated ${updatedTasks.length} tasks (recurring + hold).`
  );
  return updatedTasks;
}

// Initialize recurring task fields when task is created with recurring
export async function initializeRecurringTask(
  taskId: string,
  recurringMonths: number,
  dueDate: Date
) {
  const currentPeriodStart = new Date();

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      currentPeriodStart: currentPeriodStart as Date,
      nextDueDate: dueDate as Date,
    },
  });

  console.log(
    `🔄 Initialized recurring task. First due: ${dueDate.toISOString()}`
  );
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
  const completionHistory = Array.isArray(task.completionHistory)
    ? task.completionHistory
    : [];
  const nextDue = task.nextDueDate ? new Date(task.nextDueDate) : null;
  const isOverdue = nextDue ? now > nextDue && !task.completed : false;

  return {
    isRecurring: true,
    currentPeriod: task.currentPeriodStart
      ? new Date(task.currentPeriodStart)
      : null,
    nextDue,
    completionCount: completionHistory.length,
    isOverdue,
    lastCompleted: task.lastCompletedDate
      ? new Date(task.lastCompletedDate)
      : null,
  };
}
